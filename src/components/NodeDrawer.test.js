import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NodeDrawer from './NodeDrawer.vue'

const message = {
  id: 'message', name: 'Welcome', type: 'sendMessage', parentId: -1,
  data: { payload: [{ type: 'text', text: 'Hello' }, { type: 'attachment', attachment: 'https://example.com/photo.jpg' }] },
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

  it('rejects an invalid business hours interval', async () => {
    const node = {
      id: 'hours', name: 'Hours', type: 'dateTime', description: 'Open times', parentId: -1,
      data: { timezone: 'UTC', times: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => ({ day, startTime: '09:00', endTime: '17:00' })) },
    }
    const wrapper = mount(NodeDrawer, { props: { node } })
    await wrapper.get('input[aria-label="Monday opening time"]').setValue('18:00')
    await wrapper.get('.save-button').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toMatch(/start time/)
    expect(wrapper.emitted('save')).toBeUndefined()
  })
})
