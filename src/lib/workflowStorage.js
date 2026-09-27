import { clonePlain } from './clonePlain'

const DATABASE_NAME = 'flow-studio-workflow'
const STORE_NAME = 'snapshots'
const WORKFLOW_KEY = 'current'

/**
 * Open the browser database used for saved workflow snapshots.
 *
 * @returns {Promise<IDBDatabase>} The opened database.
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Browser storage is unavailable.'))

      return
    }

    const request = indexedDB.open(DATABASE_NAME, 1)
    let blocked = false
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => {
      if (blocked) {
        request.result.close()

        return
      }

      resolve(request.result)
    }
    request.onerror = () => reject(request.error || new Error('Could not open browser storage.'))
    request.onblocked = () => {
      blocked = true
      reject(new Error('Browser storage is busy. Close other tabs and retry.'))
    }
  })
}

/**
 * Complete one IndexedDB request and close its database connection.
 *
 * @param {IDBTransactionMode} mode - Transaction access mode.
 * @param {(store: IDBObjectStore) => IDBRequest} operation - Store operation to run.
 * @returns {Promise<unknown>} The request result after the transaction commits.
 */
async function runTransaction(mode, operation) {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction(STORE_NAME, mode)
      const request = operation(transaction.objectStore(STORE_NAME))
      transaction.oncomplete = () => {
        database.close()
        resolve(request.result)
      }
      transaction.onerror = () => {
        database.close()
        reject(transaction.error || request.error || new Error('Could not access browser storage.'))
      }
      transaction.onabort = () => {
        database.close()
        reject(transaction.error || new Error('Browser storage was interrupted.'))
      }
    } catch (cause) {
      database.close()
      reject(cause)
    }
  })
}

/**
 * Read the latest saved workflow from IndexedDB.
 *
 * @returns {Promise<object[]|undefined>} The saved workflow, if present.
 */
export async function readSavedWorkflow() {
  return runTransaction('readonly', (store) => store.get(WORKFLOW_KEY))
}

/**
 * Persist a workflow without synchronous JSON serialization.
 *
 * @param {object[]} workflow - Workflow nodes to save.
 * @returns {Promise<void>}
 */
export async function writeSavedWorkflow(workflow) {
  await runTransaction('readwrite', (store) => store.put(clonePlain(workflow), WORKFLOW_KEY))
}

/**
 * Remove the saved workflow after a successful sample reset.
 *
 * @returns {Promise<void>}
 */
export async function clearSavedWorkflow() {
  await runTransaction('readwrite', (store) => store.delete(WORKFLOW_KEY))
}
