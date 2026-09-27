import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NodeDrawer from '../NodeDrawer.vue'
import { getDescription } from '../../lib/workflow'

const message = {
  id: 'message',
  name: 'Welcome',
  type: 'sendMessage',
  parentId: -1,
  data: {
    payload: [
      { type: 'text', text: 'Hello' },
      { type: 'attachment', attachment: 'https://example.com/photo.jpg' },
    ],
  },
}

describe('NodeDrawer', () => {
  it('loads source fields, edits message text, and emits an updated node', async () => {
    const wrapper = mount(NodeDrawer, { props: { node: message } })
    expect(wrapper.get('#node-description').element.value).toBe('Hello')
    expect(wrapper.findAll('.attachment-tile')).toHaveLength(1)
    await wrapper.get('#node-title').setValue('Greeting')
    await wrapper.get('#message-0').setValue('Hi there')
    await wrapper.get('.save-button').trigger('click')
    const updated = wrapper.emitted('save')?.[0]?.[0]
    expect(updated.name).toBe('Greeting')
    expect(updated.data.payload[0]).toEqual({ type: 'text', text: 'Hi there' })
    expect(updated.data.payload[1].type).toBe('attachment')
  })

  it('adds text to a message with no saved payload', async () => {
    const node = {
      id: 'legacy-message',
      name: 'Legacy message',
      type: 'sendMessage',
      description: 'Send a reply',
      data: {},
    }
    const wrapper = mount(NodeDrawer, { props: { node } })
    await wrapper.get('.text-button').trigger('click')
    await wrapper.get('#message-0').setValue('Hello again')
    await wrapper.get('.save-button').trigger('click')

    expect(wrapper.emitted('save')?.[0]?.[0].data.payload).toEqual([
      { type: 'text', text: 'Hello again' },
    ])
  })

  it('rejects an invalid business hours interval', async () => {
    const node = {
      id: 'hours',
      name: 'Hours',
      type: 'dateTime',
      description: 'Open times',
      parentId: -1,
      data: {
        timezone: 'UTC',
        times: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => ({
          day,
          startTime: '09:00',
          endTime: '17:00',
        })),
      },
    }
    const wrapper = mount(NodeDrawer, { props: { node } })
    await wrapper.get('input[aria-label="Monday opening time"]').setValue('18:00')
    await wrapper.get('.save-button').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toMatch(/start time/)
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('preserves unsaved fields when the selected node position changes', async () => {
    const wrapper = mount(NodeDrawer, { props: { node: message } })
    await wrapper.get('#node-title').setValue('Unsaved greeting')
    await wrapper.setProps({ node: { ...message, position: { x: 300, y: 400 } } })

    expect(wrapper.get('#node-title').element.value).toBe('Unsaved greeting')
  })

  it('binds business hours by day even when the payload order changes', () => {
    const node = {
      id: 'hours',
      name: 'Hours',
      type: 'dateTime',
      data: {
        timezone: 'UTC',
        times: [
          { day: 'tue', startTime: '11:00', endTime: '18:00' },
          { day: 'mon', startTime: '08:00', endTime: '16:00' },
        ],
      },
    }
    const wrapper = mount(NodeDrawer, { props: { node } })

    expect(wrapper.get('input[aria-label="Monday opening time"]').element.value).toBe('08:00')
    expect(wrapper.get('input[aria-label="Tuesday opening time"]').element.value).toBe('11:00')
    expect(wrapper.get('input[aria-label="Wednesday opening time"]').element.value).toBe('09:00')
  })

  it('removes a comment without leaving its old text on the canvas', async () => {
    const node = {
      id: 'comment',
      name: 'Internal note',
      type: 'addComment',
      data: { comment: 'Old internal note' },
    }
    const wrapper = mount(NodeDrawer, { props: { node } })
    await wrapper.get('.section-heading .text-button').trigger('click')
    await wrapper.get('.save-button').trigger('click')
    const updated = wrapper.emitted('save')?.[0]?.[0]

    expect(updated.data.comment).toBe('')
    expect(getDescription(updated)).toBe('No internal comment')
  })

  it('allows a comment to be cleared from the text field', async () => {
    const node = {
      id: 'comment',
      name: 'Internal note',
      type: 'addComment',
      data: { comment: 'Old internal note' },
    }
    const wrapper = mount(NodeDrawer, { props: { node } })
    await wrapper.get('#node-comment').setValue('')
    await wrapper.get('.save-button').trigger('click')

    expect(wrapper.emitted('save')?.[0]?.[0].data.comment).toBe('')
  })
})
