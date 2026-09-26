import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWorkflow, resetWorkflow } from './repository'

const payload = [{ id: 1, parentId: -1, type: 'trigger', data: {} }]

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
    localStorage.setItem('flow-studio-workflow-v1', JSON.stringify(payload))
    expect(await resetWorkflow()).toMatchObject([{ id: '1', type: 'trigger' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith('/candidate-assessments/payload.json')
    expect(localStorage.getItem('flow-studio-workflow-v1')).toBeNull()
  })

  it('preserves browser edits when the remote reset fails', async () => {
    localStorage.setItem('flow-studio-workflow-v1', JSON.stringify(payload))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(resetWorkflow()).rejects.toThrow('Could not reset the workflow.')
    expect(localStorage.getItem('flow-studio-workflow-v1')).not.toBeNull()
  })

  it('loads saved edits when the starter service is unavailable', async () => {
    const saved = [{ ...payload[0], name: 'Saved locally' }]
    localStorage.setItem('flow-studio-workflow-v1', JSON.stringify(saved))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))

    await expect(fetchWorkflow()).resolves.toMatchObject([{ id: '1', name: 'Saved locally' }])
  })

  it('reports a load failure when neither the service nor saved data is available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))

    await expect(fetchWorkflow()).rejects.toThrow('Network unavailable')
  })
})
