import { normalizeWorkflow } from './workflow'

const STORAGE_KEY = 'flow-studio-workflow-v1'
const PAYLOAD_PATH = '/candidate-assessments/payload.json'

/**
 * Fetch the supplied JSON and apply saved browser edits when available.
 *
 * @returns {Promise<object[]>} The normalized workflow.
 * @throws {Error} When the starter workflow cannot be fetched.
 */
export async function fetchWorkflow() {
  let saved

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    saved = raw ? normalizeWorkflow(JSON.parse(raw)) : null
  } catch {
    saved = null
  }

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
 * Persist a complete workflow snapshot in the current browser.
 *
 * @param {object[]} workflow - Nodes to save.
 * @returns {Promise<object[]>} The persisted nodes.
 */
export async function saveWorkflow(workflow) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflow))

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
  localStorage.removeItem(STORAGE_KEY)

  return seed
}
