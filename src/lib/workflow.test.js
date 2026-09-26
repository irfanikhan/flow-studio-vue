import { describe, expect, it, vi } from 'vitest'
import {
  createNode,
  deleteNode,
  getDescription,
  getNewNodePosition,
  normalizeWorkflow,
  replaceNode,
  toFlowElements,
  isEditable,
} from './workflow'

const source = [
  { id: 1, parentId: -1, type: 'trigger', data: { type: 'conversationOpened' } },
  {
    id: 'hours',
    parentId: 1,
    type: 'dateTime',
    name: 'Hours',
    data: { times: [], timezone: 'UTC' },
  },
  {
    id: 'success',
    parentId: 'hours',
    type: 'dateTimeConnector',
    name: 'Success',
    data: { connectorType: 'success' },
  },
  {
    id: 'message',
    parentId: 'success',
    type: 'sendMessage',
    name: 'Welcome',
    data: { payload: [{ type: 'text', text: 'Hello' }] },
  },
]

describe('workflow model', () => {
  it('normalizes IDs without changing source relationships', () => {
    const workflow = normalizeWorkflow(source)
    expect(workflow[0].id).toBe('1')
    expect(workflow[1].parentId).toBe('1')
    expect(workflow[2].parentId).toBe('hours')
    expect(workflow[3].position).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    )
    expect(source[3].position).toBeUndefined()
  })

  it('builds a graph edge for each known parent', () => {
    const { nodes, edges } = toFlowElements(normalizeWorkflow(source))
    expect(nodes).toHaveLength(4)
    expect(edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual([
      '1->hours',
      'hours->success',
      'success->message',
    ])
  })

  it('places a new child below its parent with a visible connection gap', () => {
    const workflow = normalizeWorkflow(source)
    const position = getNewNodePosition(workflow, 'message')
    const created = createNode({
      title: 'Next step',
      description: 'Continue the conversation',
      type: 'sendMessage',
      parentId: 'message',
      position,
    })
    const { edges } = toFlowElements([...workflow, created])

    expect(position.y - workflow[3].position.y).toBeGreaterThan(250)
    expect(edges).toContainEqual(expect.objectContaining({ source: 'message', target: created.id }))
  })

  it('avoids nearby nodes when adding another child to a branch', () => {
    const workflow = normalizeWorkflow(source)
    const first = getNewNodePosition(workflow, 'message')
    const second = getNewNodePosition([...workflow, { id: 'new', position: first }], 'message')

    expect(Math.abs(second.x - first.x)).toBeGreaterThanOrEqual(300)
    expect(second.y).toBe(first.y)
  })

  it('derives readable card text from payload data', () => {
    expect(getDescription(source[3])).toBe('Hello')
    expect(getDescription(source[1])).toBe('Business hours · UTC')
  })

  it('validates creation and initializes type-specific data', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'abcdef12-0000-0000-0000-000000000000' })
    const node = createNode({
      title: ' Note ',
      description: ' Follow up ',
      type: 'addComment',
      parentId: 'message',
      position: { x: 1, y: 2 },
    })
    expect(node).toMatchObject({
      id: 'abcdef12',
      name: 'Note',
      description: 'Follow up',
      parentId: 'message',
      data: { comment: 'Follow up' },
    })
    expect(() => createNode({ title: '', description: 'Text', type: 'sendMessage' })).toThrow(
      /required/,
    )
    expect(() => createNode({ title: 'A', description: 'B', type: 'trigger' })).toThrow(/valid/)
    vi.unstubAllGlobals()
  })

  it('replaces one node and detaches children when that node is deleted', () => {
    const workflow = normalizeWorkflow(source)
    const updated = replaceNode(workflow, { ...workflow[3], name: 'Updated' })
    expect(updated[3].name).toBe('Updated')
    expect(updated[2]).toEqual(workflow[2])
    const deleted = deleteNode(updated, 'success')
    expect(deleted).toHaveLength(3)
    expect(deleted.find((node) => node.id === 'message').parentId).toBe(-1)
  })

  it('keeps trigger and branch connectors out of the editable drawer', () => {
    const workflow = normalizeWorkflow(source)
    expect(workflow.map(isEditable)).toEqual([false, true, false, true])
  })
})
