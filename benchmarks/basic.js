const { bench, group, run } = require('mitata')
const slowRedact = require('../index.js')

// Test objects
const smallObj = {
  user: { name: 'john', password: 'secret123' },
  headers: { cookie: 'session-token', authorization: 'Bearer abc123' }
}

const largeObj = {
  users: Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `user${i}`,
    email: `user${i}@example.com`,
    password: `secret${i}`,
    profile: {
      age: 20 + (i % 50),
      preferences: {
        theme: 'dark',
        notifications: true,
        apiKey: `key-${i}-secret`
      }
    }
  })),
  metadata: {
    version: '1.0.0',
    secret: 'app-secret-key',
    database: {
      host: 'localhost',
      password: 'db-password'
    }
  }
}

// Redaction configurations
const basicRedact = slowRedact({
  paths: ['user.password', 'headers.cookie']
})

const wildcardRedact = slowRedact({
  paths: ['users.*.password', 'users.*.profile.preferences.apiKey']
})

const deepRedact = slowRedact({
  paths: ['metadata.secret', 'metadata.database.password']
})

group('Small Object Redaction', () => {
  bench('basic paths', () => {
    basicRedact(smallObj)
  })

  bench('serialize: false', () => {
    const redact = slowRedact({
      paths: ['user.password'],
      serialize: false
    })
    redact(smallObj)
  })

  bench('custom censor function', () => {
    const redact = slowRedact({
      paths: ['user.password'],
      censor: (value, path) => `HIDDEN:${path}`
    })
    redact(smallObj)
  })
})

group('Large Object Redaction', () => {
  bench('wildcard patterns', () => {
    wildcardRedact(largeObj)
  })

  bench('deep nested paths', () => {
    deepRedact(largeObj)
  })

  bench('multiple wildcards', () => {
    const redact = slowRedact({
      paths: ['users.*.password', 'users.*.profile.preferences.*']
    })
    redact(largeObj)
  })
})

group('Object Cloning Overhead', () => {
  bench('deep clone small object', () => {
    const redact = slowRedact({ paths: [] })
    redact(smallObj)
  })

  bench('deep clone large object', () => {
    const redact = slowRedact({ paths: [] })
    redact(largeObj)
  })
})

run()
