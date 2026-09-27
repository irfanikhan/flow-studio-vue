<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import {
  MessageSquareText,
  Send,
  CalendarClock,
  Zap,
  Paperclip,
  LockKeyhole,
} from 'lucide-vue-next'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: Boolean,
})
const emit = defineEmits(['activate'])

const icon = computed(
  () =>
    ({
      sendMessage: Send,
      addComment: MessageSquareText,
      dateTime: CalendarClock,
      trigger: Zap,
    })[props.data.kind] || CalendarClock,
)
const tone = computed(() =>
  props.data.kind === 'dateTimeConnector'
    ? props.data.connectorType === 'failure'
      ? 'coral'
      : 'blue'
    : { sendMessage: 'teal', addComment: 'violet', dateTime: 'orange', trigger: 'pink' }[
        props.data.kind
      ],
)

/**
 * Open the details for an editable node when activated from the keyboard.
 *
 * @returns {void}
 */
function activate() {
  if (props.data.locked) {
    return
  }

  emit('activate')
}
</script>

<template>
  <div
    v-if="data.kind === 'dateTimeConnector'"
    class="connector-node"
    :class="`tone-${tone}`"
    :aria-label="`${data.label} branch`"
  >
    <Handle type="target" :position="Position.Top" />
    <span class="connector-dot"></span>
    <span>{{ data.label }}</span>
    <Handle type="source" :position="Position.Bottom" />
  </div>
  <div
    v-else
    class="workflow-node"
    :class="[`tone-${tone}`, { 'is-selected': selected }]"
    :aria-label="`${data.label} node`"
    :role="data.locked ? undefined : 'button'"
    :tabindex="data.locked ? -1 : 0"
    @keydown.enter.stop.prevent="activate"
    @keydown.space.stop.prevent="activate"
  >
    <Handle v-if="data.kind !== 'trigger'" type="target" :position="Position.Top" />
    <div class="node-topline">
      <span class="node-icon"><component :is="icon" :size="20" :stroke-width="2.2" /></span>
      <span class="node-type">{{
        data.kind === 'trigger'
          ? 'WORKFLOW TRIGGER'
          : data.kind === 'dateTime'
            ? 'CONDITION'
            : data.kind === 'sendMessage'
              ? 'ACTION'
              : 'NOTE'
      }}</span>
      <LockKeyhole v-if="data.locked" :size="13" class="node-lock" />
    </div>
    <div class="node-content">
      <strong>{{ data.label }}</strong>
      <p>{{ data.description }}</p>
    </div>
    <div class="node-bottomline">
      <span>{{
        data.kind === 'dateTime'
          ? '7 days configured'
          : data.kind === 'trigger'
            ? 'Starts the flow'
            : data.kind === 'sendMessage'
              ? 'Message'
              : 'Internal comment'
      }}</span>
      <span v-if="data.attachments" class="attachment-count"
        ><Paperclip :size="12" /> {{ data.attachments }}</span
      >
      <span v-else class="node-chevron">↗</span>
    </div>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>
