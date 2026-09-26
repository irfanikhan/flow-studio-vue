import { normalizeWorkflow } from './workflow'

const STORAGE_KEY = 'flow-studio-workflow-v1'

/** Fetch the supplied JSON and apply any saved browser edits. */
export async function fetchWorkflow() {
  const response = await fetch(`${import.meta.env.BASE_URL}payload.json`)
  if (!response.ok) throw new Error('Could not load the starter workflow.')
  const seed = normalizeWorkflow(await response.json())
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? normalizeWorkflow(JSON.parse(saved)) : seed
  } catch {
    return seed
  }
}

/** Persist a complete workflow snapshot for the current browser. */
export async function saveWorkflow(workflow) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflow))
  return workflow
}

/** Clear browser edits and reload the supplied workflow. */
export async function resetWorkflow() {
  localStorage.removeItem(STORAGE_KEY)
  const response = await fetch(`${import.meta.env.BASE_URL}payload.json`)
  if (!response.ok) throw new Error('Could not reset the workflow.')
  return normalizeWorkflow(await response.json())
}
