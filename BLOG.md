# Introducing slow-redact: A Safe Alternative to fast-redact

Today I'm announcing **slow-redact**, a new package that provides the same API as [fast-redact](https://github.com/davidmarkclements/fast-redact) but with a crucial difference: **immutability guarantees**. This package was born out of necessity after a spurious CVE filing against fast-redact and our decision to prioritize safety in the pino ecosystem.

## Why the Switch?

On September 23rd, 2025, **CVE-2025-57319** was filed against fast-redact, claiming a "Prototype Pollution vulnerability" that could cause denial of service. However, this CVE is fundamentally flawed.

The vulnerability report demonstrates the issue by calling an **internal, undocumented utility function** (`nestedRestore`) directly:

```js
// This is NOT how you use fast-redact
require("fast-redact/lib/modifiers").nestedRestore(instructions);
```

This is like claiming a car is unsafe because you can crash it if you remove the wheels while driving. When you use fast-redact through its **public API**, this vulnerability doesn't exist:

```js
// This is the correct usage - no vulnerability
const fastRedact = require("fast-redact");
const redact = fastRedact({
  paths: ['polluted.prototype.constructor'],
});
console.log(redact({ polluted: { prototype: { constructor: false } } }));
// Output: {"polluted":{"prototype":{"constructor":"[REDACTED]"}}}
```

David Mark Clements and I have disputed this CVE with MITRE, but the damage is done. Security scanners will flag this, and corporate security teams will panic.

## The Real Problem

The bigger issue isn't this specific CVE - it's that the CVE system itself has become unreliable. When someone can file a vulnerability report against internal utility functions that no sane developer would ever call directly, the entire system loses credibility. It becomes a tool for arbitrary ecosystem control rather than legitimate security improvement.

But rather than fight this broken system, I decided to build a better solution.

## Enter slow-redact

**slow-redact** provides the exact same API as fast-redact but with a crucial architectural difference: it **never mutates the original object**. Instead, it uses innovative **selective cloning** that provides immutability guarantees while maintaining competitive performance.

```js
const slowRedact = require('slow-redact');

const redact = slowRedact({
  paths: ['headers.cookie', 'user.password']
});

const obj = {
  headers: { cookie: 'secret', 'x-request-id': '123' },
  user: { name: 'john', password: 'secret123' }
};

const result = redact(obj);
// Result: {"headers":{"cookie":"[REDACTED]","x-request-id":"123"},"user":{"name":"john","password":"[REDACTED]"}}

// Original object is completely unchanged
console.log(obj.headers.cookie); // 'secret'
```

### Key Advantages

1. **Immutability**: Original objects are never modified
2. **Performance**: Competitive with fast-redact for real-world usage patterns
3. **Memory Efficiency**: Selective cloning shares references for non-redacted data
4. **Full API Compatibility**: Drop-in replacement for fast-redact
5. **Safety**: No mutation means no mutation-based vulnerabilities

## Performance: Not Actually Slow

Despite the name, slow-redact is performance-competitive with fast-redact for typical usage:

| Operation Type | slow-redact | fast-redact | Ratio |
|---------------|-------------|-------------|-------|
| **Large objects (minimal redaction)** | **~18μs** | ~17μs | **~same** |
| **Large objects (wildcards)** | **~48μs** | ~37μs | **1.3x slower** |
| **Small objects** | ~690ns | ~200ns | ~3.5x slower |

For large objects with selective redaction (the common pino use case), performance is essentially identical. The name "slow-redact" is intentionally provocative - it challenges the assumption that "fast" always means "better."

## Why Pino is Switching

In pino, we log objects that might be shared across multiple contexts. Mutating these objects can cause subtle bugs and unpredictable behavior. With slow-redact, we get:

- **Predictable behavior**: Original objects never change
- **Debugging safety**: Can compare before/after redaction
- **Functional programming compatibility**: Works naturally with immutable patterns
- **Zero security concerns**: No mutation-based attack vectors

## The Technical Innovation: Selective Cloning Explained

slow-redact achieves competitive performance through **selective cloning** - an approach that only clones object branches that contain redaction targets while sharing references for everything else.

### How Traditional Deep Cloning Works (Inefficient)

Most immutable redaction approaches use deep cloning:

```js
// Traditional approach: Clone everything, then redact
const deepClone = obj => JSON.parse(JSON.stringify(obj)); // Simplified
const result = deepClone(originalObject);
redact(result, paths);
```

This creates entirely new objects for everything, consuming massive memory and CPU cycles for large objects with minimal redaction.

### How Selective Cloning Works (Efficient)

slow-redact analyzes redaction paths and only clones the specific branches that need modification:

```
Original Object Structure:
┌─────────────────────────────────────────┐
│ {                                       │
│   database: { host: "...", port: 5432 }│  ← Large config (not redacted)
│   api: { endpoints: [...] }            │  ← Large config (not redacted)
│   cache: { redis: {...} }              │  ← Large config (not redacted)
│   user: {                              │  ← Contains redaction target
│     name: "john",                      │
│     password: "secret123"              │  ← REDACT THIS
│   }                                    │
│ }                                      │
└─────────────────────────────────────────┘

Selective Cloning Process:
┌─────────────────────────────────────────┐
│ Path Analysis:                          │
│ - "user.password" requires cloning      │
│   the "user" branch only               │
│                                        │
│ Result Structure:                      │
│ {                                      │
│   database: → [SHARED REF] ───┐        │
│   api: → [SHARED REF] ────────┼─────── │ Original object
│   cache: → [SHARED REF] ──────┘        │ references
│   user: → [NEW CLONE] {               │
│     name: "john",                     │
│     password: "[REDACTED]"            │
│   }                                   │
│ }                                     │
└─────────────────────────────────────────┘
```

### Memory and Performance Impact

**Traditional Deep Clone:**
```
Memory Usage: 100% new allocation
CPU Time: O(entire object size)
Result: Completely new object tree
```

**Selective Clone:**
```
Memory Usage: Only cloned branches (~5-20% in typical cases)
CPU Time: O(redacted paths) instead of O(entire object)
Result: Hybrid object with shared + cloned branches
```

### Real-World Example

Consider a typical Express.js request object being logged:

```js
const requestObj = {
  method: 'POST',
  url: '/api/users',
  headers: {
    'content-type': 'application/json',
    'authorization': 'Bearer abc123...',  // ← REDACT THIS
    'user-agent': 'Mozilla/5.0...',
    'x-forwarded-for': '192.168.1.1'
  },
  body: {
    username: 'john',
    password: 'secret123',                // ← REDACT THIS
    email: 'john@example.com'
  },
  query: {},
  params: { id: '123' }
};

const redact = slowRedact({
  paths: ['headers.authorization', 'body.password']
});

const result = redact(requestObj);
```

**Memory sharing analysis:**
- `method`, `url`, `query`, `params`: **Shared references** (original objects)
- `headers`: **New object** (contains `authorization` to redact)
  - `content-type`, `user-agent`, `x-forwarded-for`: **Shared string references**
  - `authorization`: **New string** `"[REDACTED]"`
- `body`: **New object** (contains `password` to redact)
  - `username`, `email`: **Shared string references**
  - `password`: **New string** `"[REDACTED]"`

**Result:** ~85% memory sharing, ~90% reduction in allocation overhead

### The Algorithm

1. **Setup Phase** (once per redactor):
   ```js
   // Parse paths like "headers.authorization" into tree structure
   const pathTree = buildPathStructure(['headers.authorization', 'body.password']);
   // Result: { headers: { authorization: true }, body: { password: true } }
   ```

2. **Redaction Phase** (per object):
   ```js
   function selectiveClone(obj, pathTree, currentPath = []) {
     if (!pathTree || typeof obj !== 'object') return obj;

     const needsCloning = Object.keys(pathTree).some(key => key in obj);
     if (!needsCloning) return obj; // Share entire branch

     const clone = Array.isArray(obj) ? [] : {};
     for (const [key, value] of Object.entries(obj)) {
       if (key in pathTree) {
         // This branch needs redaction - recurse with cloning
         clone[key] = selectiveClone(value, pathTree[key], [...currentPath, key]);
       } else {
         // This branch is safe - share reference
         clone[key] = value;
       }
     }
     return clone;
   }
   ```

3. **Reference Sharing Verification**:
   ```js
   console.log(result.method === original.method);           // true - shared
   console.log(result.headers === original.headers);        // false - cloned
   console.log(result.headers['user-agent'] ===
               original.headers['user-agent']);             // true - shared
   console.log(result.body === original.body);              // false - cloned
   console.log(result.body.email === original.body.email);  // true - shared
   ```

This approach provides immutability where it matters while maintaining performance through intelligent reference sharing. For typical logging scenarios with large objects and minimal redaction, it's often faster than traditional approaches due to reduced allocation overhead.

## Moving Forward

This isn't just about one spurious CVE. It's about building more reliable, predictable software. When you choose immutability by default, entire classes of bugs simply disappear.

fast-redact remains an excellent choice when you control the object lifecycle and need absolute maximum performance. But for most applications - especially those dealing with shared objects or requiring predictable behavior - slow-redact is the better choice.

The pino ecosystem is moving to slow-redact as the default. It's a small change with big implications for reliability and developer confidence.

Sometimes the best way forward isn't to fight the broken system - it's to build a better one.

---

*slow-redact is available on npm: `npm install slow-redact`*

*GitHub: https://github.com/pinojs/slow-redact*

*For the full technical discussion about the disputed CVE, see: https://github.com/davidmarkclements/fast-redact/issues/75*