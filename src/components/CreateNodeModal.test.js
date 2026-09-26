import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CreateNodeModal from './CreateNodeModal.vue'

describe('CreateNodeModal', () => {
  it('requires fields and emits a complete node after submission', async () => {
    const wrapper = mount(CreateNodeModal, { props: { workflow: [] } })
    expect(wrapper.findAll('input[required]')).toHaveLength(1)
    await wrapper.get('#new-title').setValue('First reply')
    await wrapper.get('#new-description').setValue('Welcome!')
    await wrapper.get('form').trigger('submit.prevent')
    const node = wrapper.emitted('create')?.[0]?.[0]
    expect(node).toMatchObject({ name: 'First reply', type: 'sendMessage', data: { payload: [{ type: 'text', text: 'Welcome!' }] } })
  })
})
