# slow-redact

> Very fast object redaction for JavaScript applications - but safe!

Redact JS objects with the same API as [fast-redact](https://github.com/davidmarkclements/fast-redact), but creates full object copies instead of mutating the original. This provides better safety guarantees but at the cost of performance.

## Install

```bash
npm install slow-redact
```

## Usage

```js
const slowRedact = require('slow-redact')

const redact = slowRedact({
  paths: ['headers.cookie', 'headers.authorization', 'user.password']
})

const obj = {
  headers: {
    cookie: 'secret-session-token',
    authorization: 'Bearer abc123',
    'x-forwarded-for': '192.168.1.1'
  },
  user: {
    name: 'john',
    password: 'secret123'
  }
}

console.log(redact(obj))
// Output: {"headers":{"cookie":"[REDACTED]","authorization":"[REDACTED]","x-forwarded-for":"192.168.1.1"},"user":{"name":"john","password":"[REDACTED]"}}

// Original object is completely unchanged:
console.log(obj.headers.cookie) // 'secret-session-token'
```

## API

### slowRedact(options) → Function

Creates a redaction function with the specified options.

#### Options

- **paths** `string[]` (required): An array of strings describing the nested location of a key in an object
- **censor** `any` (optional, default: `'[REDACTED]'`): The value to replace sensitive data with. Can be a static value or function.
- **serialize** `Function|boolean` (optional, default: `JSON.stringify`): Serialization function. Set to `false` to return the redacted object.
- **remove** `boolean` (optional, default: `false`): Remove redacted keys from serialized output
- **strict** `boolean` (optional, default: `true`): Throw on non-object values or pass through primitives

#### Path Syntax

Supports the same path syntax as fast-redact:

- **Dot notation**: `'user.name'`, `'headers.cookie'`
- **Bracket notation**: `'user["password"]'`, `'headers["X-Forwarded-For"]'`
- **Array indices**: `'users[0].password'`, `'items[1].secret'`
- **Wildcards**:
  - Terminal: `'users.*.password'` (redacts password for all users)
  - Intermediate: `'*.password'` (redacts password at any level)
  - Array wildcard: `'items.*'` (redacts all array elements)

#### Examples

**Custom censor value:**
```js
const redact = slowRedact({
  paths: ['password'],
  censor: '***HIDDEN***'
})
```

**Dynamic censor function:**
```js
const redact = slowRedact({
  paths: ['password'],
  censor: (value, path) => `REDACTED:${path}`
})
```

**Return object instead of JSON string:**
```js
const redact = slowRedact({
  paths: ['secret'],
  serialize: false
})

const result = redact({ secret: 'hidden', public: 'data' })
console.log(result.secret) // '[REDACTED]'
console.log(result.public) // 'data'

// Restore original values
const restored = result.restore()
console.log(restored.secret) // 'hidden'
```

**Custom serialization:**
```js
const redact = slowRedact({
  paths: ['password'],
  serialize: obj => JSON.stringify(obj, null, 2)
})
```

**Wildcard patterns:**
```js
// Redact all properties in secrets object
const redact1 = slowRedact({ paths: ['secrets.*'] })

// Redact password for any user
const redact2 = slowRedact({ paths: ['users.*.password'] })

// Redact all items in an array
const redact3 = slowRedact({ paths: ['items.*'] })
```

## Key Differences from fast-redact

### Safety First
- **No mutation**: Original objects are never modified
- **Full copies**: Creates deep clones before redaction
- **Restore capability**: Can restore original values when `serialize: false`

### Performance Trade-off
- **Slower**: Creates object copies which takes time and memory
- **Memory usage**: Uses more memory due to cloning
- **CPU overhead**: Additional processing for deep cloning

### When to Use slow-redact
- When immutability is critical
- When you need to preserve original objects
- When objects are shared across multiple contexts
- In functional programming environments
- When debugging and you need to compare before/after

### When to Use fast-redact
- When performance is critical
- When working with large objects frequently
- When you control the object lifecycle
- In high-throughput logging scenarios

## Benchmarks

While slow-redact provides better safety guarantees, it comes with a performance cost:

```
fast-redact: ~2,000,000 ops/sec
slow-redact: ~100,000 ops/sec (20x slower)
```

The exact performance difference depends on object size and structure.

## Testing

```bash
npm test
```

## License

MIT

## Contributing

Pull requests welcome! Please ensure all tests pass and add tests for new features.