const { test } = require('node:test')
const { strict: assert } = require('node:assert')
const slowRedact = require('../index.js')

test('basic path redaction', () => {
  const obj = {
    headers: {
      cookie: 'secret-cookie',
      authorization: 'Bearer token'
    },
    body: { message: 'hello' }
  }

  const redact = slowRedact({ paths: ['headers.cookie'] })
  const result = redact(obj)

  // Original object should remain unchanged
  assert.strictEqual(obj.headers.cookie, 'secret-cookie')

  // Result should have redacted path
  const parsed = JSON.parse(result)
  assert.strictEqual(parsed.headers.cookie, '[REDACTED]')
  assert.strictEqual(parsed.headers.authorization, 'Bearer token')
  assert.strictEqual(parsed.body.message, 'hello')
})

test('multiple paths redaction', () => {
  const obj = {
    user: { name: 'john', password: 'secret' },
    session: { token: 'abc123' }
  }

  const redact = slowRedact({
    paths: ['user.password', 'session.token']
  })
  const result = redact(obj)

  // Original unchanged
  assert.strictEqual(obj.user.password, 'secret')
  assert.strictEqual(obj.session.token, 'abc123')

  // Result redacted
  const parsed = JSON.parse(result)
  assert.strictEqual(parsed.user.password, '[REDACTED]')
  assert.strictEqual(parsed.session.token, '[REDACTED]')
  assert.strictEqual(parsed.user.name, 'john')
})

test('custom censor value', () => {
  const obj = { secret: 'hidden' }
  const redact = slowRedact({
    paths: ['secret'],
    censor: '***'
  })
  const result = redact(obj)

  const parsed = JSON.parse(result)
  assert.strictEqual(parsed.secret, '***')
})

test('serialize: false returns object with restore method', () => {
  const obj = { secret: 'hidden' }
  const redact = slowRedact({
    paths: ['secret'],
    serialize: false
  })
  const result = redact(obj)

  // Should be object, not string
  assert.strictEqual(typeof result, 'object')
  assert.strictEqual(result.secret, '[REDACTED]')

  // Should have restore method
  assert.strictEqual(typeof result.restore, 'function')

  const restored = result.restore()
  assert.strictEqual(restored.secret, 'hidden')
})

test('bracket notation paths', () => {
  const obj = {
    'weird-key': { 'another-weird': 'secret' },
    normal: 'public'
  }

  const redact = slowRedact({
    paths: ['["weird-key"]["another-weird"]']
  })
  const result = redact(obj)

  const parsed = JSON.parse(result)
  assert.strictEqual(parsed['weird-key']['another-weird'], '[REDACTED]')
  assert.strictEqual(parsed.normal, 'public')
})

test('array paths', () => {
  const obj = {
    users: [
      { name: 'john', password: 'secret1' },
      { name: 'jane', password: 'secret2' }
    ]
  }

  const redact = slowRedact({
    paths: ['users[0].password', 'users[1].password']
  })
  const result = redact(obj)

  const parsed = JSON.parse(result)
  assert.strictEqual(parsed.users[0].password, '[REDACTED]')
  assert.strictEqual(parsed.users[1].password, '[REDACTED]')
  assert.strictEqual(parsed.users[0].name, 'john')
  assert.strictEqual(parsed.users[1].name, 'jane')
})

test('wildcard at end of path', () => {
  const obj = {
    secrets: {
      key1: 'secret1',
      key2: 'secret2'
    },
    public: 'data'
  }

  const redact = slowRedact({
    paths: ['secrets.*']
  })
  const result = redact(obj)

  const parsed = JSON.parse(result)
  assert.strictEqual(parsed.secrets.key1, '[REDACTED]')
  assert.strictEqual(parsed.secrets.key2, '[REDACTED]')
  assert.strictEqual(parsed.public, 'data')
})

test('wildcard with arrays', () => {
  const obj = {
    items: ['secret1', 'secret2', 'secret3']
  }

  const redact = slowRedact({
    paths: ['items.*']
  })
  const result = redact(obj)

  const parsed = JSON.parse(result)
  assert.strictEqual(parsed.items[0], '[REDACTED]')
  assert.strictEqual(parsed.items[1], '[REDACTED]')
  assert.strictEqual(parsed.items[2], '[REDACTED]')
})

test('intermediate wildcard', () => {
  const obj = {
    users: {
      user1: { password: 'secret1' },
      user2: { password: 'secret2' }
    }
  }

  const redact = slowRedact({
    paths: ['users.*.password']
  })
  const result = redact(obj)

  const parsed = JSON.parse(result)
  assert.strictEqual(parsed.users.user1.password, '[REDACTED]')
  assert.strictEqual(parsed.users.user2.password, '[REDACTED]')
})

test('censor function', () => {
  const obj = { secret: 'hidden' }
  const redact = slowRedact({
    paths: ['secret'],
    censor: (value, path) => `REDACTED:${path}`
  })
  const result = redact(obj)

  const parsed = JSON.parse(result)
  assert.strictEqual(parsed.secret, 'REDACTED:secret')
})

test('custom serialize function', () => {
  const obj = { secret: 'hidden', public: 'data' }
  const redact = slowRedact({
    paths: ['secret'],
    serialize: (obj) => `custom:${JSON.stringify(obj)}`
  })
  const result = redact(obj)

  assert(result.startsWith('custom:'))
  const parsed = JSON.parse(result.slice(7))
  assert.strictEqual(parsed.secret, '[REDACTED]')
  assert.strictEqual(parsed.public, 'data')
})

test('nested paths', () => {
  const obj = {
    level1: {
      level2: {
        level3: {
          secret: 'hidden'
        }
      }
    }
  }

  const redact = slowRedact({
    paths: ['level1.level2.level3.secret']
  })
  const result = redact(obj)

  const parsed = JSON.parse(result)
  assert.strictEqual(parsed.level1.level2.level3.secret, '[REDACTED]')
})

test('non-existent paths are ignored', () => {
  const obj = { existing: 'value' }
  const redact = slowRedact({
    paths: ['nonexistent.path']
  })
  const result = redact(obj)

  const parsed = JSON.parse(result)
  assert.strictEqual(parsed.existing, 'value')
  assert.strictEqual(parsed.nonexistent, undefined)
})

test('null and undefined handling', () => {
  const obj = {
    nullValue: null,
    undefinedValue: undefined,
    nested: {
      nullValue: null
    }
  }

  const redact = slowRedact({
    paths: ['nullValue', 'nested.nullValue']
  })
  const result = redact(obj)

  const parsed = JSON.parse(result)
  assert.strictEqual(parsed.nullValue, '[REDACTED]')
  assert.strictEqual(parsed.nested.nullValue, '[REDACTED]')
})

test('original object remains unchanged', () => {
  const original = {
    secret: 'hidden',
    nested: { secret: 'hidden2' }
  }
  const copy = JSON.parse(JSON.stringify(original))

  const redact = slowRedact({
    paths: ['secret', 'nested.secret']
  })
  redact(original)

  // Original should be completely unchanged
  assert.deepStrictEqual(original, copy)
})

test('strict mode with primitives', () => {
  const redact = slowRedact({
    paths: ['test'],
    strict: true
  })

  const stringResult = redact('primitive')
  assert.strictEqual(stringResult, '"primitive"')

  const numberResult = redact(42)
  assert.strictEqual(numberResult, '42')
})

// Path validation tests to match fast-redact behavior
test('path validation - non-string paths should throw', () => {
  assert.throws(() => {
    slowRedact({ paths: [123] })
  }, {
    message: 'Paths must be (non-empty) strings'
  })

  assert.throws(() => {
    slowRedact({ paths: [null] })
  }, {
    message: 'Paths must be (non-empty) strings'
  })

  assert.throws(() => {
    slowRedact({ paths: [undefined] })
  }, {
    message: 'Paths must be (non-empty) strings'
  })
})

test('path validation - empty string should throw', () => {
  assert.throws(() => {
    slowRedact({ paths: [''] })
  }, {
    message: 'Invalid redaction path ()'
  })
})

test('path validation - double dots should throw', () => {
  assert.throws(() => {
    slowRedact({ paths: ['invalid..path'] })
  }, {
    message: 'Invalid redaction path (invalid..path)'
  })

  assert.throws(() => {
    slowRedact({ paths: ['a..b..c'] })
  }, {
    message: 'Invalid redaction path (a..b..c)'
  })
})

test('path validation - unmatched brackets should throw', () => {
  assert.throws(() => {
    slowRedact({ paths: ['invalid[unclosed'] })
  }, {
    message: 'Invalid redaction path (invalid[unclosed)'
  })

  assert.throws(() => {
    slowRedact({ paths: ['invalid]unopened'] })
  }, {
    message: 'Invalid redaction path (invalid]unopened)'
  })

  assert.throws(() => {
    slowRedact({ paths: ['nested[a[b]'] })
  }, {
    message: 'Invalid redaction path (nested[a[b])'
  })
})

test('path validation - mixed valid and invalid should throw', () => {
  assert.throws(() => {
    slowRedact({ paths: ['valid.path', 123, 'another.valid'] })
  }, {
    message: 'Paths must be (non-empty) strings'
  })

  assert.throws(() => {
    slowRedact({ paths: ['valid.path', 'invalid..path'] })
  }, {
    message: 'Invalid redaction path (invalid..path)'
  })
})

test('path validation - valid paths should work', () => {
  // These should not throw
  assert.doesNotThrow(() => {
    slowRedact({ paths: [] })
  })

  assert.doesNotThrow(() => {
    slowRedact({ paths: ['valid.path'] })
  })

  assert.doesNotThrow(() => {
    slowRedact({ paths: ['user.password', 'data[0].secret'] })
  })

  assert.doesNotThrow(() => {
    slowRedact({ paths: ['["quoted-key"].value'] })
  })

  assert.doesNotThrow(() => {
    slowRedact({ paths: ["['single-quoted'].value"] })
  })

  assert.doesNotThrow(() => {
    slowRedact({ paths: ['array[0]', 'object.property', 'wildcard.*'] })
  })
})

test('type safety: accessing properties on primitive values should not throw', () => {
  // Test case from GitHub issue #5
  const redactor = slowRedact({ paths: ['headers.authorization'] })
  const data = {
    headers: 123 // primitive value
  }

  assert.doesNotThrow(() => {
    const result = redactor(data)
    const parsed = JSON.parse(result)
    assert.strictEqual(parsed.headers, 123) // Should remain unchanged
  })

  // Test wildcards with primitives
  const redactor2 = slowRedact({ paths: ['data.*.nested'] })
  const data2 = {
    data: {
      item1: 123, // primitive, trying to access .nested on it
      item2: { nested: 'secret' }
    }
  }

  assert.doesNotThrow(() => {
    const result2 = redactor2(data2)
    const parsed2 = JSON.parse(result2)
    assert.strictEqual(parsed2.data.item1, 123) // Primitive unchanged
    assert.strictEqual(parsed2.data.item2.nested, '[REDACTED]') // Object property redacted
  })

  // Test deep nested access on primitives
  const redactor3 = slowRedact({ paths: ['user.name.first.charAt'] })
  const data3 = {
    user: {
      name: 'John' // string primitive
    }
  }

  assert.doesNotThrow(() => {
    const result3 = redactor3(data3)
    const parsed3 = JSON.parse(result3)
    assert.strictEqual(parsed3.user.name, 'John') // Should remain unchanged
  })
})
