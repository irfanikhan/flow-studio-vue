import { toRaw } from 'vue'

/**
 * Copy a JSON-like value while removing nested Vue proxies.
 *
 * @param {unknown} value - Value to copy.
 * @param {WeakMap<object, unknown>} seen - Previously copied object references.
 * @returns {unknown} A plain copy that retains large string values by reference.
 */
function copyValue(value, seen) {
  const raw = toRaw(value)
  if (!raw || typeof raw !== 'object') {
    return raw
  }
  if (seen.has(raw)) {
    return seen.get(raw)
  }

  const copy = Array.isArray(raw) ? [] : {}
  seen.set(raw, copy)
  for (const [key, item] of Object.entries(raw)) {
    copy[key] = copyValue(item, seen)
  }

  return copy
}

/**
 * Copy workflow data for history and IndexedDB without JSON serialization.
 *
 * @param {unknown} value - Reactive or plain JSON-like workflow data.
 * @returns {unknown} A plain copy of the workflow data.
 */
export function clonePlain(value) {
  return copyValue(value, new WeakMap())
}
