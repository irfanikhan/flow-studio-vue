import { normalizeWorkflow } from './workflow'
import { clearSavedWorkflow, readSavedWorkflow, writeSavedWorkflow } from './workflowStorage'

const STORAGE_KEY = 'flow-studio-workflow-v1'
const PAYLOAD_PATH = '/candidate-assessments/payload.json'

/**
 * Read an existing localStorage snapshot and migrate it to IndexedDB.
 *
 * @returns {Promise<object[]|null>} A valid legacy workflow, if available.
 */
async function readLegacyWorkflow() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const legacy = normalizeWorkflow(JSON.parse(raw))
    try {
      await writeSavedWorkflow(legacy)
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      return legacy
    }

    return legacy
  } catch {
    return null
  }
}

/**
 * Load a valid saved workflow without letting corrupt browser data break rendering.
 *
 * @returns {Promise<object[]|null>} A valid saved workflow, if available.
 */
async function loadSavedWorkflow() {
  try {
    const stored = await readSavedWorkflow()
    if (stored !== undefined) {
      return normalizeWorkflow(stored)
    }
  } catch {
    return readLegacyWorkflow()
  }

  return readLegacyWorkflow()
}

/**
 * Fetch the supplied JSON and apply saved browser edits when available.
 *
 * @returns {Promise<object[]>} The normalized workflow.
 * @throws {Error} When the starter workflow cannot be fetched.
 */
export async function fetchWorkflow() {
  const saved = await loadSavedWorkflow()

  try {
    const response = await fetch(PAYLOAD_PATH)
    if (!response.ok) {
      throw new Error('Could not load the starter workflow.')
    }
    const seed = normalizeWorkflow(await response.json())

    return saved ?? seed
  } catch (cause) {
    if (saved) {
      return saved
    }

    throw cause
  }
}

/**
 * Persist a complete workflow snapshot in IndexedDB.
 *
 * @param {object[]} workflow - Nodes to save.
 * @returns {Promise<object[]>} The persisted nodes.
 */
export async function saveWorkflow(workflow) {
  try {
    await writeSavedWorkflow(workflow)
  } catch (cause) {
    if (cause?.name === 'QuotaExceededError') {
      throw new Error(
        'Browser storage is full. Remove attachments or free space, then try again.',
        {
          cause,
        },
      )
    }

    throw cause
  }

  return workflow
}

/**
 * Clear browser edits and reload the supplied workflow.
 *
 * @returns {Promise<object[]>} The original normalized nodes.
 * @throws {Error} When the starter workflow cannot be fetched.
 */
export async function resetWorkflow() {
  const response = await fetch(PAYLOAD_PATH)
  if (!response.ok) {
    throw new Error('Could not reset the workflow.')
  }
  const seed = normalizeWorkflow(await response.json())
  await clearSavedWorkflow()
  localStorage.removeItem(STORAGE_KEY)

  return seed
}
