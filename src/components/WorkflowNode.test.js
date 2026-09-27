import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import WorkflowNode from './WorkflowNode.vue'

describe('WorkflowNode', () => {
  it('opens editable nodes with Enter and Space', async () => {
    const wrapper = shallowMount(WorkflowNode, {
      props: {
        id: 'message',
        data: { kind: 'sendMessage', label: 'Welcome', description: 'Hello', locked: false },
      },
    })
    const node = wrapper.get('.workflow-node')

    expect(node.attributes('role')).toBe('button')
    expect(node.attributes('tabindex')).toBe('0')
    await node.trigger('keydown', { key: 'Enter' })
    await node.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('activate')).toHaveLength(2)
  })

  it('does not expose locked nodes as keyboard actions', async () => {
    const wrapper = shallowMount(WorkflowNode, {
      props: {
        id: 'trigger',
        data: { kind: 'trigger', label: 'Conversation Opened', locked: true },
      },
    })
    const node = wrapper.get('.workflow-node')

    expect(node.attributes('tabindex')).toBe('-1')
    expect(node.attributes('role')).toBeUndefined()
    await node.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('activate')).toBeUndefined()
  })
})
