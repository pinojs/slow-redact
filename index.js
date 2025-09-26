function deepClone (obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime())
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item))
  }

  if (typeof obj === 'object') {
    const cloned = Object.create(Object.getPrototypeOf(obj))
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key])
      }
    }
    return cloned
  }

  return obj
}

function parsePath (path) {
  const parts = []
  let current = ''
  let inBrackets = false
  let inQuotes = false
  let quoteChar = ''

  for (let i = 0; i < path.length; i++) {
    const char = path[i]

    if (!inBrackets && char === '.') {
      if (current) {
        parts.push(current)
        current = ''
      }
    } else if (char === '[') {
      if (current) {
        parts.push(current)
        current = ''
      }
      inBrackets = true
    } else if (char === ']' && inBrackets) {
      if (current) {
        parts.push(current)
        current = ''
      }
      inBrackets = false
      inQuotes = false
    } else if ((char === '"' || char === "'") && inBrackets) {
      if (!inQuotes) {
        inQuotes = true
        quoteChar = char
      } else if (char === quoteChar) {
        inQuotes = false
        quoteChar = ''
      } else {
        current += char
      }
    } else {
      current += char
    }
  }

  if (current) {
    parts.push(current)
  }

  return parts
}

function setValue (obj, parts, value) {
  let current = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!(key in current)) {
      return false // Path doesn't exist, don't create it
    }
    if (typeof current[key] !== 'object' || current[key] === null) {
      return false // Path doesn't exist properly
    }
    current = current[key]
  }

  const lastKey = parts[parts.length - 1]
  if (lastKey === '*') {
    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        current[i] = value
      }
    } else if (typeof current === 'object' && current !== null) {
      for (const key in current) {
        current[key] = value
      }
    }
  } else {
    if (lastKey in current) {
      current[lastKey] = value
    }
  }
  return true
}

function getValue (obj, parts) {
  let current = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = current[part]
  }

  return current
}

function redactPaths (obj, paths, censor) {
  for (const path of paths) {
    const parts = parsePath(path)

    if (parts.includes('*')) {
      redactWildcardPath(obj, parts, censor, path)
    } else {
      const actualCensor = typeof censor === 'function'
        ? censor(getValue(obj, parts), path)
        : censor
      setValue(obj, parts, actualCensor)
    }
  }
}

function redactWildcardPath (obj, parts, censor, originalPath) {
  const wildcardIndex = parts.indexOf('*')

  if (wildcardIndex === parts.length - 1) {
    const parentParts = parts.slice(0, -1)
    let current = obj

    for (const part of parentParts) {
      if (current === null || current === undefined) return
      current = current[part]
    }

    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        const actualCensor = typeof censor === 'function'
          ? censor(current[i], `${originalPath.replace('*', i)}`)
          : censor
        current[i] = actualCensor
      }
    } else if (typeof current === 'object' && current !== null) {
      for (const key in current) {
        const actualCensor = typeof censor === 'function'
          ? censor(current[key], `${originalPath.replace('*', key)}`)
          : censor
        current[key] = actualCensor
      }
    }
  } else {
    redactIntermediateWildcard(obj, parts, censor, wildcardIndex, originalPath)
  }
}

function redactIntermediateWildcard (obj, parts, censor, wildcardIndex, originalPath) {
  const beforeWildcard = parts.slice(0, wildcardIndex)
  const afterWildcard = parts.slice(wildcardIndex + 1)

  function traverse (current, pathSoFar) {
    if (pathSoFar.length === beforeWildcard.length) {
      if (Array.isArray(current)) {
        for (let i = 0; i < current.length; i++) {
          traverse(current[i], [...pathSoFar, i.toString()])
        }
      } else if (typeof current === 'object' && current !== null) {
        for (const key in current) {
          traverse(current[key], [...pathSoFar, key])
        }
      }
    } else if (pathSoFar.length < beforeWildcard.length) {
      const nextKey = beforeWildcard[pathSoFar.length]
      if (current && typeof current === 'object' && nextKey in current) {
        traverse(current[nextKey], [...pathSoFar, nextKey])
      }
    } else {
      const actualCensor = typeof censor === 'function'
        ? censor(getValue(current, afterWildcard), pathSoFar.join('.') + '.' + afterWildcard.join('.'))
        : censor
      setValue(current, afterWildcard, actualCensor)
    }
  }

  if (beforeWildcard.length === 0) {
    traverse(obj, [])
  } else {
    let current = obj
    for (const part of beforeWildcard) {
      if (current === null || current === undefined) return
      current = current[part]
    }
    if (current !== null && current !== undefined) {
      traverse(current, beforeWildcard)
    }
  }
}

function slowRedact (options = {}) {
  const {
    paths = [],
    censor = '[REDACTED]',
    serialize = JSON.stringify,
    strict = true
  } = options

  if (!Array.isArray(paths)) {
    throw new TypeError('paths must be an array')
  }

  return function redact (obj) {
    if (strict && (obj === null || typeof obj !== 'object')) {
      if (obj === null || obj === undefined) {
        return serialize ? serialize(obj) : obj
      }
      if (typeof obj !== 'object') {
        return serialize ? serialize(obj) : obj
      }
    }

    const cloned = deepClone(obj)
    const original = deepClone(obj)

    let actualCensor = censor
    if (typeof censor === 'function') {
      actualCensor = censor
    }

    redactPaths(cloned, paths, actualCensor)

    if (serialize === false) {
      cloned.restore = function () {
        return deepClone(original)
      }
      return cloned
    }

    if (typeof serialize === 'function') {
      return serialize(cloned)
    }

    return JSON.stringify(cloned)
  }
}

module.exports = slowRedact
