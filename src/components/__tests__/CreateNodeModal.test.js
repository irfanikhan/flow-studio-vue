import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CreateNodeModal from '../CreateNodeModal.vue'

describe('CreateNodeModal', () => {
  it('requires fields and emits a complete node after submission', async () => {
    const wrapper = mount(CreateNodeModal, { props: { workflow: [] } })
    expect(wrapper.findAll('input[required]')).toHaveLength(1)
    await wrapper.get('#new-title').setValue('First reply')
    await wrapper.get('#new-description').setValue('Welcome!')
    await wrapper.get('form').trigger('submit.prevent')
    const node = wrapper.emitted('create')?.[0]?.[0]
    expect(node).toMatchObject({
      name: 'First reply',
      type: 'sendMessage',
      data: { payload: [{ type: 'text', text: 'Welcome!' }] },
    })
  })

  it('connects a new node to the selected node by default', async () => {
    const workflow = [
      { id: 'parent', name: 'First reply', type: 'sendMessage', position: { x: 100, y: 200 } },
    ]
    const wrapper = mount(CreateNodeModal, { props: { workflow, selectedId: 'parent' } })

    expect(wrapper.get('#new-parent').element.value).toBe('parent')
    await wrapper.get('#new-title').setValue('Next reply')
    await wrapper.get('#new-description').setValue('Thanks for writing')
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('create')?.[0]?.[0]).toMatchObject({
      parentId: 'parent',
      position: { x: 100, y: 510 },
    })
  })

  it('keeps keyboard focus inside the dialog and restores its opener', async () => {
    const opener = document.createElement('button')
    const host = document.createElement('div')
    document.body.append(opener, host)
    opener.focus()
    const wrapper = mount(CreateNodeModal, { props: { workflow: [] }, attachTo: host })

    expect(document.activeElement).toBe(wrapper.get('#new-title').element)
    wrapper.get('[aria-label="Close"]').element.focus()
    await wrapper.get('.create-modal').trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(wrapper.get('button[type="submit"]').element)
    await wrapper.get('.create-modal').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Close"]').element)
    await wrapper.get('.create-modal').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
    expect(document.activeElement).toBe(opener)
    host.remove()
    opener.remove()
  })
})
