<script setup>
import { reactive, computed } from 'vue'
import { X, Plus, Send, MessageSquareText, CalendarClock } from 'lucide-vue-next'
import { createNode, getNewNodePosition } from '../lib/workflow'

const props = defineProps({
  workflow: { type: Array, required: true },
  selectedId: { type: String, default: '' },
  busy: Boolean,
})
const emit = defineEmits(['close', 'create'])
const form = reactive({
  title: '',
  description: '',
  type: 'sendMessage',
  parentId: props.selectedId || props.workflow.at(-1)?.id || '',
})
const parents = computed(() => props.workflow)
const types = [
  { value: 'sendMessage', label: 'Send Message', icon: Send, description: 'Reply to a contact' },
  {
    value: 'addComment',
    label: 'Add Comment',
    icon: MessageSquareText,
    description: 'Add an internal note',
  },
  {
    value: 'dateTime',
    label: 'Business Hours',
    icon: CalendarClock,
    description: 'Route by schedule',
  },
]

/**
 * Validate the form and create a node near the end of the visible flow.
 *
 * @returns {void}
 */
function submit() {
  if (props.busy) {
    return
  }

  const position = getNewNodePosition(props.workflow, form.parentId || -1)
  emit('create', createNode({ ...form, parentId: form.parentId || -1, position }))
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <div class="modal-header">
        <div>
          <span class="eyebrow">BUILD YOUR WORKFLOW</span>
          <h2 id="create-title">Create a new node</h2>
          <p>Choose what happens next in your conversation.</p>
        </div>
        <button class="icon-button" aria-label="Close" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>
      <form @submit.prevent="submit">
        <label class="field-label">Node type</label>
        <div class="type-options">
          <label
            v-for="type in types"
            :key="type.value"
            class="type-option"
            :class="{ active: form.type === type.value }"
          >
            <input v-model="form.type" type="radio" name="type" :value="type.value" />
            <component :is="type.icon" :size="20" />
            <strong>{{ type.label }}</strong
            ><small>{{ type.description }}</small>
          </label>
        </div>
        <div class="form-row">
          <label class="field-label" for="new-title">Title</label
          ><input
            id="new-title"
            v-model.trim="form.title"
            class="text-input"
            maxlength="80"
            required
            placeholder="e.g. Follow-up message"
          />
        </div>
        <div class="form-row">
          <label class="field-label" for="new-description">Description</label
          ><textarea
            id="new-description"
            v-model.trim="form.description"
            class="text-input"
            maxlength="500"
            rows="3"
            required
            placeholder="What should this node do?"
          />
        </div>
        <div class="form-row">
          <label class="field-label" for="new-parent"
            >Connect after <span class="optional">Optional</span></label
          ><select id="new-parent" v-model="form.parentId" class="text-input">
            <option value="">Leave unconnected</option>
            <option v-for="parent in parents" :key="parent.id" :value="parent.id">
              {{ parent.name }}
            </option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="button button-ghost" @click="emit('close')">Cancel</button
          ><button type="submit" class="button button-primary" :disabled="busy">
            <Plus :size="17" /> Create node
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
