<script setup>
import { computed, reactive, ref } from 'vue'
import {
  X,
  Trash2,
  Save,
  Send,
  MessageSquareText,
  CalendarClock,
  Paperclip,
  Plus,
  FileText,
} from 'lucide-vue-next'
import { DAYS, getDescription } from '../lib/workflow'
import { clonePlain } from '../lib/clonePlain'

const props = defineProps({ node: { type: Object, required: true }, saving: Boolean })
const emit = defineEmits(['close', 'save', 'delete'])
const draftData = clonePlain(props.node.data ?? {})
if (props.node.type === 'sendMessage' && !Array.isArray(draftData.payload)) {
  draftData.payload = []
}
if (props.node.type === 'dateTime') {
  const times = Array.isArray(draftData.times) ? draftData.times : []
  const byDay = new Map(times.map((time) => [time.day, time]))
  draftData.times = DAYS.map(([day]) => ({
    startTime: '09:00',
    endTime: '17:00',
    ...byDay.get(day),
    day,
  }))
}
const form = reactive({
  name: props.node.name,
  description: props.node.description ?? getDescription(props.node),
  data: draftData,
})
const error = ref('')
const uploadInput = ref(null)
const payloadKeys = new WeakMap()
const kind = computed(
  () =>
    ({
      sendMessage: { label: 'Send Message', icon: Send, tone: 'teal' },
      addComment: { label: 'Add Comment', icon: MessageSquareText, tone: 'violet' },
      dateTime: { label: 'Business Hours', icon: CalendarClock, tone: 'orange' },
    })[props.node.type],
)
const payload = computed(() => (Array.isArray(form.data.payload) ? form.data.payload : []))
const attachments = computed(() => payload.value.filter((item) => item.type === 'attachment'))
const texts = computed(() => payload.value.filter((item) => item.type === 'text'))

/**
 * Keep a stable rendering key while editable payload items are added or removed.
 *
 * @param {object} item - A reactive payload item.
 * @returns {string} Stable key for this item while the drawer is mounted.
 */
function getPayloadKey(item) {
  let key = payloadKeys.get(item)
  if (!key) {
    key = crypto.randomUUID()
    payloadKeys.set(item, key)
  }

  return key
}

/**
 * Check whether an attachment can be rendered as an image preview.
 *
 * @param {string} url - Attachment URL or data URL.
 * @returns {boolean} Whether the attachment is an image.
 */
function isImage(url) {
  return /^data:image\//.test(url) || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)
}

/**
 * Open the native file picker for a new local attachment.
 *
 * @returns {void}
 */
function chooseAttachment() {
  uploadInput.value?.click()
}

/**
 * Read a selected file and append it to the node payload.
 *
 * @param {Event} event - File input change event.
 * @returns {Promise<void>}
 */
async function uploadAttachment(event) {
  const file = event.target.files?.[0]
  if (!file) {
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    error.value = 'Choose a file smaller than 2 MB so it can be saved in this browser.'
    event.target.value = ''

    return
  }

  try {
    const url = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Could not read this file.'))
      reader.onabort = () => reject(new Error('Attachment reading was cancelled.'))
      reader.readAsDataURL(file)
    })
    form.data.payload.push({ type: 'attachment', attachment: url, name: file.name })
    error.value = ''
  } catch (cause) {
    error.value = cause.message || 'Could not read this attachment.'
  } finally {
    event.target.value = ''
  }
}

/**
 * Add an editable text item to a message node.
 *
 * @returns {void}
 */
function addText() {
  if (!Array.isArray(form.data.payload)) {
    form.data.payload = []
  }

  form.data.payload.push({ type: 'text', text: '' })
}

/**
 * Remove a message payload item by object reference.
 *
 * @param {object} item - Text or attachment item to remove.
 * @returns {void}
 */
function removePayload(item) {
  form.data.payload = payload.value.filter((entry) => entry !== item)
}

/**
 * Clear the internal comment and replace any description copied from it.
 *
 * @returns {void}
 */
function removeComment() {
  const originalComment = props.node.data?.comment?.trim() ?? ''
  form.data.comment = ''
  if (form.description.trim() === originalComment) {
    form.description = 'No internal comment'
  }
  error.value = ''
}

/**
 * Validate node fields and emit the complete updated record.
 *
 * @returns {void}
 */
function save() {
  error.value = ''
  if (props.node.type === 'addComment') {
    if (form.data.comment?.trim()) {
      form.data.comment = form.data.comment.trim()
    } else {
      removeComment()
    }
  }
  if (!form.name.trim()) {
    error.value = 'A title is required.'

    return
  }
  if (!form.description.trim()) {
    error.value = 'A description is required.'

    return
  }
  if (props.node.type === 'sendMessage' && texts.value.some((item) => !item.text.trim())) {
    error.value = 'Message text cannot be empty.'

    return
  }
  if (
    props.node.type === 'dateTime' &&
    form.data.times.some((time) => time.startTime >= time.endTime)
  ) {
    error.value = 'Each start time must be before its end time.'

    return
  }
  emit('save', {
    ...props.node,
    name: form.name.trim(),
    description: form.description.trim(),
    data: clonePlain(form.data),
  })
}

/**
 * Ask for confirmation before removing the selected node.
 *
 * @returns {void}
 */
function removeNode() {
  if (window.confirm(`Delete “${props.node.name}”? Connected children will become unconnected.`)) {
    emit('delete', props.node.id)
  }
}
</script>

<template>
  <aside class="details-drawer" aria-label="Node details">
    <div class="drawer-header">
      <div class="drawer-heading">
        <span class="drawer-icon" :class="`tone-${kind.tone}`"
          ><component :is="kind.icon" :size="21"
        /></span>
        <div>
          <span class="eyebrow">NODE DETAILS</span>
          <h2>{{ kind.label }}</h2>
        </div>
      </div>
      <button class="icon-button" aria-label="Close details" @click="emit('close')">
        <X :size="20" />
      </button>
    </div>
    <div class="drawer-scroll" :inert="saving">
      <div class="drawer-intro">
        Configure this step in your workflow. Changes are saved in this browser.
      </div>
      <div class="drawer-section">
        <h3>General</h3>
        <div class="form-row">
          <label class="field-label" for="node-title">Title</label
          ><input id="node-title" v-model="form.name" class="text-input" maxlength="80" />
        </div>
        <div class="form-row">
          <label class="field-label" for="node-description">Description</label
          ><textarea
            id="node-description"
            v-model="form.description"
            class="text-input"
            rows="3"
            maxlength="500"
          />
        </div>
      </div>

      <div v-if="node.type === 'sendMessage'" class="drawer-section">
        <div class="section-heading">
          <h3>Message content</h3>
          <button class="text-button" @click="addText"><Plus :size="15" /> Add text</button>
        </div>
        <div v-if="!texts.length" class="empty-small">
          No message text yet. Add a text block to get started.
        </div>
        <div v-for="(item, index) in texts" :key="getPayloadKey(item)" class="content-item">
          <div class="item-heading">
            <label class="field-label" :for="`message-${index}`">Text {{ index + 1 }}</label
            ><button
              class="icon-button subtle"
              :aria-label="`Remove text ${index + 1}`"
              @click="removePayload(item)"
            >
              <Trash2 :size="15" />
            </button>
          </div>
          <textarea
            :id="`message-${index}`"
            v-model="item.text"
            class="text-input"
            rows="4"
            maxlength="2000"
          />
        </div>
        <div class="section-heading attachment-heading">
          <h3>
            Attachments <span class="count-badge">{{ attachments.length }}</span>
          </h3>
        </div>
        <div v-if="attachments.length" class="attachment-grid">
          <div
            v-for="(item, index) in attachments"
            :key="getPayloadKey(item)"
            class="attachment-tile"
          >
            <img
              v-if="isImage(item.attachment)"
              :src="item.attachment"
              :alt="item.name || `Attachment ${index + 1}`"
            />
            <div v-else class="file-preview"><FileText :size="25" /></div>
            <span class="attachment-name">{{ item.name || `Attachment ${index + 1}` }}</span
            ><button
              class="attachment-remove"
              :aria-label="`Remove attachment ${index + 1}`"
              @click="removePayload(item)"
            >
              <X :size="13" />
            </button>
          </div>
        </div>
        <button class="upload-tile" @click="chooseAttachment">
          <span><Paperclip :size="18" /></span><strong>Upload an attachment</strong
          ><small>Images or files up to 2 MB</small></button
        ><input ref="uploadInput" type="file" hidden @change="uploadAttachment" />
      </div>

      <div v-if="node.type === 'addComment'" class="drawer-section">
        <div class="section-heading">
          <h3>Internal comment</h3>
          <button v-if="form.data.comment?.trim()" class="text-button" @click="removeComment">
            <Trash2 :size="15" /> Remove comment
          </button>
        </div>
        <p class="section-help">Visible to your team in the conversation.</p>
        <textarea
          id="node-comment"
          v-model="form.data.comment"
          class="text-input"
          rows="6"
          maxlength="2000"
          aria-label="Internal comment"
        />
      </div>

      <div v-if="node.type === 'dateTime'" class="drawer-section">
        <h3>Weekly schedule</h3>
        <p class="section-help">Set the opening window for each day.</p>
        <div class="schedule-list">
          <div v-for="([day, label], index) in DAYS" :key="day" class="schedule-row">
            <span class="day-label">{{ label.slice(0, 3) }}</span
            ><input
              v-model="form.data.times[index].startTime"
              type="time"
              class="time-input"
              :aria-label="`${label} opening time`"
            /><span class="time-separator">to</span
            ><input
              v-model="form.data.times[index].endTime"
              type="time"
              class="time-input"
              :aria-label="`${label} closing time`"
            />
          </div>
        </div>
        <div class="form-row timezone-row">
          <label class="field-label" for="timezone">Time zone</label
          ><select id="timezone" v-model="form.data.timezone" class="text-input">
            <option value="UTC">(GMT+00:00) UTC</option>
            <option value="Asia/Karachi">(GMT+05:00) Karachi</option>
            <option value="Asia/Singapore">(GMT+08:00) Singapore</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
          </select>
        </div>
      </div>
      <div class="drawer-section danger-section">
        <h3>Danger zone</h3>
        <p class="section-help">Remove this node from the workflow.</p>
        <button class="button button-danger" :disabled="saving" @click="removeNode">
          <Trash2 :size="16" /> Delete node
        </button>
      </div>
    </div>
    <div class="drawer-footer">
      <span v-if="error" class="form-error" role="alert">{{ error }}</span
      ><button class="button button-primary save-button" :disabled="saving" @click="save">
        <Save :size="17" /> {{ saving ? 'Saving…' : 'Save changes' }}
      </button>
    </div>
  </aside>
</template>
