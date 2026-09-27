import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { reactive } from 'vue'
import { fetchWorkflow, resetWorkflow, saveWorkflow } from '../repository'
import { readSavedWorkflow, writeSavedWorkflow } from '../workflowStorage'

const payload = [{ id: 1, parentId: -1, type: 'trigger', data: {} }]
const legacyKey = 'flow-studio-workflow-v1'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('workflow repository', () => {
  it('loads and resets the starter workflow through the remote payload proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchWorkflow()).toMatchObject([{ id: '1', type: 'trigger' }])
    await saveWorkflow(payload)
    expect(await readSavedWorkflow()).toEqual(payload)
    expect(await resetWorkflow()).toMatchObject([{ id: '1', type: 'trigger' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith('/candidate-assessments/payload.json')
    expect(await readSavedWorkflow()).toBeUndefined()
  })

  it('preserves browser edits when the remote reset fails', async () => {
    await saveWorkflow(payload)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(resetWorkflow()).rejects.toThrow('Could not reset the workflow.')
    expect(await readSavedWorkflow()).toEqual(payload)
  })

  it('loads saved edits when the starter service is unavailable', async () => {
    const saved = [{ ...payload[0], name: 'Saved locally' }]
    await saveWorkflow(saved)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))

    await expect(fetchWorkflow()).resolves.toMatchObject([{ id: '1', name: 'Saved locally' }])
  })

  it('migrates existing localStorage edits to IndexedDB', async () => {
    const legacy = [{ ...payload[0], name: 'Previous edit' }]
    localStorage.setItem(legacyKey, JSON.stringify(legacy))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))

    await expect(fetchWorkflow()).resolves.toMatchObject([{ id: '1', name: 'Previous edit' }])
    expect(localStorage.getItem(legacyKey)).toBeNull()
    expect(await readSavedWorkflow()).toMatchObject([{ id: '1', name: 'Previous edit' }])
  })

  it('ignores an unusable saved snapshot and loads the starter workflow', async () => {
    await writeSavedWorkflow([{ type: 'sendMessage', name: 'Missing ID' }])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))

    await expect(fetchWorkflow()).resolves.toMatchObject([{ id: '1', type: 'trigger' }])
  })

  it('accepts reactive workflow data without synchronous localStorage writes', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await saveWorkflow(reactive(payload))

    expect(await readSavedWorkflow()).toEqual(payload)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('reports a load failure when neither the service nor saved data is available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))

    await expect(fetchWorkflow()).rejects.toThrow('Network unavailable')
  })
})
