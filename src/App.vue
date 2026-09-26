<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { storeToRefs } from 'pinia'
import {
  Plus,
  Workflow,
  LayoutGrid,
  Undo2,
  Redo2,
  RotateCcw,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Sparkles,
  AlertCircle,
  LoaderCircle,
  Command,
  MessageSquareText,
  Send,
  CalendarClock,
  Zap,
  GitBranch,
} from 'lucide-vue-next'
import WorkflowNode from './components/WorkflowNode.vue'
import NodeDrawer from './components/NodeDrawer.vue'
import CreateNodeModal from './components/CreateNodeModal.vue'
import { fetchWorkflow, saveWorkflow, resetWorkflow } from './lib/repository'
import { toFlowElements, replaceNode, deleteNode, isEditable, NODE_TYPES } from './lib/workflow'
import { useUiStore } from './stores/ui'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const { fitView, setCenter } = useVueFlow('conversation-flow')
const ui = useUiStore()
const { createOpen, toast, past, future } = storeToRefs(ui)
const sidebarOpen = ref(true)
const compactViewport = ref(window.innerWidth <= 640)
const fitViewOnInit = !compactViewport.value
const pendingCreatedNodeId = ref('')
const isWriting = ref(false)
const search = ref('')
const { data, isPending, isError, error, refetch } = useQuery({
  queryKey: ['workflow'],
  queryFn: fetchWorkflow,
})
const saveMutation = useMutation({
  mutationFn: saveWorkflow,
  onSuccess: (workflow) => queryClient.setQueryData(['workflow'], workflow),
})
const resetMutation = useMutation({
  mutationFn: resetWorkflow,
  onSuccess: (workflow) => queryClient.setQueryData(['workflow'], workflow),
})
const workflow = computed(() => data.value || [])
const elements = computed(() => toFlowElements(workflow.value))
const selectedNode = computed(() =>
  workflow.value.find((node) => node.id === String(route.params.id)),
)
const editableSelectedNode = computed(() =>
  isEditable(selectedNode.value) ? selectedNode.value : null,
)
const editableNodes = computed(() => workflow.value.filter(isEditable))
const filteredNodes = computed(() =>
  editableNodes.value.filter((node) =>
    node.name.toLowerCase().includes(search.value.toLowerCase()),
  ),
)

const icons = {
  sendMessage: Send,
  addComment: MessageSquareText,
  dateTime: CalendarClock,
  trigger: Zap,
  dateTimeConnector: GitBranch,
}

/**
 * Copy the current reactive workflow before replacing query data.
 *
 * @returns {object[]} A plain snapshot suitable for undo history.
 */
function snapshotWorkflow() {
  return JSON.parse(JSON.stringify(workflow.value))
}

/**
 * Persist a user edit and retain a snapshot for undo.
 *
 * @param {object[]} next - The next complete workflow state.
 * @param {string} message - Confirmation shown after a successful save.
 * @returns {Promise<boolean>} Whether the edit was persisted.
 */
async function commit(next, message) {
  if (isWriting.value) {
    return false
  }

  const previous = snapshotWorkflow()
  isWriting.value = true
  try {
    await saveMutation.mutateAsync(next)
    ui.record(previous)
    announce(message)

    return true
  } catch (cause) {
    announce(cause.message || 'Could not save changes.')

    return false
  } finally {
    isWriting.value = false
  }
}

/**
 * Display a short confirmation message.
 *
 * @param {string} message - Status text to display.
 * @returns {void}
 */
function announce(message) {
  ui.announce(message)
  window.setTimeout(() => {
    if (ui.toast === message) {
      ui.toast = ''
    }
  }, 3200)
}

/**
 * Open the route-backed drawer for an editable node.
 *
 * @param {string|number} id - Node ID to open.
 * @returns {void}
 */
function openNode(id) {
  const node = workflow.value.find((item) => item.id === String(id))
  if (isEditable(node)) {
    router.push(`/nodes/${encodeURIComponent(node.id)}`)
  }
}

/**
 * Close the details drawer and fit the graph in the restored desktop canvas.
 *
 * @returns {Promise<void>}
 */
async function closeDetails() {
  await router.push('/')
  if (compactViewport.value) {
    return
  }
  await nextTick()
  await fitView({ padding: 0.16, duration: 250 })
}

/**
 * Handle node selection from Vue Flow.
 *
 * @param {{node: {id: string}}} event - Vue Flow node click event.
 * @returns {void}
 */
function onNodeClick({ node }) {
  openNode(node.id)
}

/**
 * Save the final position after a node drag ends.
 *
 * @param {{node: {id: string, position: {x: number, y: number}}}} event - Vue Flow drag event.
 * @returns {void}
 */
function onNodeDragStop({ node }) {
  const original = workflow.value.find((item) => item.id === node.id)
  if (
    !original ||
    (original.position.x === node.position.x && original.position.y === node.position.y)
  ) {
    return
  }
  commit(
    replaceNode(workflow.value, {
      ...original,
      position: { x: node.position.x, y: node.position.y },
    }),
    'Node moved',
  )
}

/**
 * Create a node from the dialog and open its details.
 *
 * @param {object} node - New workflow node.
 * @returns {Promise<void>}
 */
async function onCreate(node) {
  pendingCreatedNodeId.value = node.id
  if (!(await commit([...workflow.value, node], 'Node created'))) {
    pendingCreatedNodeId.value = ''

    return
  }
  createOpen.value = false
  openNode(node.id)
}

/**
 * Frame the completed graph after Vue Flow measures a newly created node.
 *
 * @returns {Promise<void>}
 */
async function onNodesInitialized() {
  if (!pendingCreatedNodeId.value) {
    return
  }
  const node = workflow.value.find((item) => item.id === pendingCreatedNodeId.value)
  pendingCreatedNodeId.value = ''
  if (!node) {
    return
  }

  if (compactViewport.value) {
    await setCenter(node.position.x + 130, node.position.y + 95, {
      zoom: 0.65,
      duration: 250,
    })
  } else {
    await fitView({ padding: 0.16, duration: 250 })
  }
}

/**
 * Save an edited node record.
 *
 * @param {object} node - Updated workflow node.
 * @returns {Promise<void>}
 */
async function onSave(node) {
  await commit(replaceNode(workflow.value, node), 'Changes saved')
}

/**
 * Delete the selected node and close its route-backed drawer.
 *
 * @param {string} id - ID of the node to delete.
 * @returns {Promise<void>}
 */
async function onDelete(id) {
  if (await commit(deleteNode(workflow.value, id), 'Node deleted')) {
    await router.push('/')
  }
}

/**
 * Undo the latest edit and persist the restored snapshot.
 *
 * @returns {Promise<void>}
 */
async function undo() {
  const previous = ui.past.at(-1)
  if (isWriting.value || !previous) {
    return
  }

  const current = snapshotWorkflow()
  isWriting.value = true
  try {
    await saveMutation.mutateAsync(previous)
    ui.undo(current)
    if (route.params.id && !previous.some((node) => node.id === String(route.params.id))) {
      await router.push('/')
    }
    announce('Change undone')
  } catch (cause) {
    announce(cause.message || 'Could not undo the change.')
  } finally {
    isWriting.value = false
  }
}

/**
 * Redo the latest undone edit and persist the restored snapshot.
 *
 * @returns {Promise<void>}
 */
async function redo() {
  const next = ui.future.at(-1)
  if (isWriting.value || !next) {
    return
  }

  const current = snapshotWorkflow()
  isWriting.value = true
  try {
    await saveMutation.mutateAsync(next)
    ui.redo(current)
    announce('Change redone')
  } catch (cause) {
    announce(cause.message || 'Could not redo the change.')
  } finally {
    isWriting.value = false
  }
}

/**
 * Restore the original assessment payload after confirmation.
 *
 * @returns {Promise<void>}
 */
async function reset() {
  if (isWriting.value) {
    return
  }

  if (
    !window.confirm(
      'Reset the workflow to the original sample? Your edits in this browser will be removed.',
    )
  ) {
    return
  }

  const previous = snapshotWorkflow()
  isWriting.value = true
  let restored = false
  try {
    await resetMutation.mutateAsync()
    ui.record(previous)
    restored = true
    await router.push('/')
    await nextTick()
    if (compactViewport.value) {
      await setCenter(430, 500, { zoom: 0.65, duration: 250 })
    } else {
      await fitView({ padding: 0.16, duration: 250 })
    }
    announce('Original workflow restored')
  } catch (cause) {
    announce(
      restored
        ? 'Workflow restored, but the canvas could not be reframed.'
        : cause.message || 'Could not reset the workflow.',
    )
  } finally {
    isWriting.value = false
  }
}

/**
 * Handle keyboard shortcuts without intercepting text field editing.
 *
 * @param {KeyboardEvent} event - The keydown event.
 * @returns {void}
 */
function onKeydown(event) {
  const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
  if (event.key === 'Escape') {
    createOpen.value = false
    if (editableSelectedNode.value) {
      router.push('/')
    }

    return
  }
  if (editable || isWriting.value) {
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      redo()
    } else {
      undo()
    }
  }
}

/**
 * Keep canvas behavior aligned with the current viewport width.
 *
 * @returns {Promise<void>}
 */
async function syncViewport() {
  const isCompact = window.innerWidth <= 640
  if (compactViewport.value === isCompact) {
    return
  }
  compactViewport.value = isCompact
  await nextTick()

  if (isCompact) {
    const focus = selectedNode.value?.position || { x: 430, y: 450 }
    await setCenter(focus.x + 130, focus.y + 95, { zoom: 0.65, duration: 250 })
  } else {
    await fitView({ padding: 0.16, duration: 250 })
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', syncViewport)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', syncViewport)
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ collapsed: !sidebarOpen }" aria-label="Workflow navigation">
      <div class="brand">
        <span class="brand-mark"><Workflow :size="23" :stroke-width="2.5" /></span
        ><span v-if="sidebarOpen" class="brand-name"
          >flow<span>studio</span><small>WORKFLOW BUILDER</small></span
        >
      </div>
      <div v-if="sidebarOpen" class="sidebar-body">
        <div class="sidebar-section-title">WORKSPACE</div>
        <button class="nav-link active">
          <LayoutGrid :size="18" /> Canvas <span class="nav-active-mark"></span>
        </button>
        <div class="sidebar-divider"></div>
        <div class="sidebar-section-title nodes-heading">
          <span>NODES</span><span class="sidebar-count">{{ editableNodes.length }}</span>
        </div>
        <label class="search-box"
          ><Search :size="16" /><input
            v-model="search"
            placeholder="Find a node..."
            aria-label="Find a node"
        /></label>
        <div class="node-nav-list">
          <button
            v-for="node in filteredNodes"
            :key="node.id"
            class="node-nav-item"
            :class="{ selected: selectedNode?.id === node.id }"
            @click="openNode(node.id)"
          >
            <span class="list-icon" :class="`tone-${NODE_TYPES[node.type]?.color}`"
              ><component :is="icons[node.type]" :size="15" /></span
            ><span>{{ node.name }}</span
            ><ChevronRight :size="15" class="list-chevron" />
          </button>
          <p v-if="!filteredNodes.length" class="sidebar-empty">No nodes found</p>
        </div>
        <button class="sidebar-add" :disabled="isWriting" @click="createOpen = true">
          <Plus :size="17" /> Add a node
        </button>
      </div>
      <div class="sidebar-bottom">
        <div v-if="sidebarOpen" class="sidebar-tip">
          <Sparkles :size="17" />
          <div>
            <strong>Make it yours</strong>
            <p>Drag nodes to shape your flow. Select one to edit its details.</p>
          </div>
        </div>
        <button
          class="collapse-button"
          :aria-label="sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'"
          @click="sidebarOpen = !sidebarOpen"
        >
          <PanelLeftClose v-if="sidebarOpen" :size="18" /><PanelLeftOpen v-else :size="18" /><span
            v-if="sidebarOpen"
            >Collapse sidebar</span
          >
        </button>
      </div>
    </aside>

    <main class="main-panel">
      <div class="page-heading">
        <div>
          <div class="heading-kicker">
            WORKFLOW EDITOR
            <span class="version-pill">DRAFT</span>
          </div>
          <h1>Conversation routing</h1>
          <p>Design the path every conversation takes, one step at a time.</p>
        </div>
        <button
          class="button button-primary create-button"
          :disabled="isWriting"
          @click="createOpen = true"
        >
          <Plus :size="19" /> Create new node
        </button>
      </div>
      <div class="canvas-frame">
        <div class="canvas-toolbar">
          <div class="canvas-label">
            <span class="canvas-label-icon"><GitBranch :size="17" /></span>
            <div>
              <strong>Workflow canvas</strong
              ><small>{{ workflow.length }} nodes · {{ elements.edges.length }} connections</small>
            </div>
          </div>
          <div class="toolbar-actions">
            <button
              class="tool-button"
              :disabled="isWriting || !past.length"
              title="Undo (⌘Z)"
              aria-label="Undo"
              @click="undo"
            >
              <Undo2 :size="18" /></button
            ><button
              class="tool-button"
              :disabled="isWriting || !future.length"
              title="Redo (⌘⇧Z)"
              aria-label="Redo"
              @click="redo"
            >
              <Redo2 :size="18" /></button
            ><span class="toolbar-separator"></span
            ><button
              class="tool-button"
              :disabled="isWriting"
              title="Reset to sample"
              aria-label="Reset to sample"
              @click="reset"
            >
              <RotateCcw :size="17" />
            </button>
          </div>
        </div>
        <div v-if="isPending" class="canvas-state">
          <LoaderCircle class="spin" :size="25" />
          <h3>Loading your workflow</h3>
          <p>Preparing the canvas…</p>
        </div>
        <div v-else-if="isError" class="canvas-state">
          <AlertCircle :size="27" />
          <h3>Could not load the workflow</h3>
          <p>{{ error?.message }}</p>
          <button class="button button-primary" @click="refetch">Try again</button>
        </div>
        <div v-else class="flow-wrap">
          <VueFlow
            id="conversation-flow"
            :nodes="elements.nodes"
            :edges="elements.edges"
            :fit-view-on-init="fitViewOnInit"
            :fit-view-options="{ padding: 0.14 }"
            :default-viewport="compactViewport ? { x: -25, y: 20, zoom: 0.65 } : undefined"
            :min-zoom="0.2"
            :max-zoom="1.5"
            :nodes-draggable="!isWriting"
            :default-edge-options="{ type: 'smoothstep' }"
            @node-click="onNodeClick"
            @node-drag-stop="onNodeDragStop"
            @nodes-initialized="onNodesInitialized"
            ><template #node-workflow="nodeProps"><WorkflowNode v-bind="nodeProps" /></template
            ><Background pattern-color="#dfe5ef" :gap="20" :size="1" /><Controls
              position="bottom-left"
              :show-interactive="false"
          /></VueFlow>
          <div class="canvas-hint">
            <Command :size="14" /> Drag to move · Scroll to zoom · Click a node to edit
          </div>
        </div>
      </div>
      <div class="footer-line">
        <span><span class="footer-online"></span> Your workflow is ready</span
        ><span>Flow Studio · Built with Vue 3</span>
      </div>
    </main>

    <NodeDrawer
      v-if="editableSelectedNode"
      :key="editableSelectedNode.id"
      :node="editableSelectedNode"
      :saving="isWriting"
      @close="closeDetails"
      @save="onSave"
      @delete="onDelete"
    />
    <CreateNodeModal
      v-if="createOpen"
      :workflow="workflow"
      :selected-id="editableSelectedNode?.id || ''"
      :busy="isWriting"
      @close="createOpen = false"
      @create="onCreate"
    />
    <div v-if="toast" class="toast" role="status">{{ toast }}</div>
  </div>
</template>
