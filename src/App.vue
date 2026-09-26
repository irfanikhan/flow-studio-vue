<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { storeToRefs } from 'pinia'
import { Plus, Workflow, LayoutGrid, Undo2, Redo2, RotateCcw, Search, PanelLeftClose, PanelLeftOpen, ChevronRight, Sparkles, AlertCircle, LoaderCircle, Command, MessageSquareText, Send, CalendarClock, Zap, GitBranch } from 'lucide-vue-next'
import WorkflowNode from './components/WorkflowNode.vue'
import NodeDrawer from './components/NodeDrawer.vue'
import CreateNodeModal from './components/CreateNodeModal.vue'
import { fetchWorkflow, saveWorkflow, resetWorkflow } from './lib/repository'
import { toFlowElements, replaceNode, deleteNode, isEditable, NODE_TYPES } from './lib/workflow'
import { useUiStore } from './stores/ui'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const ui = useUiStore()
const { createOpen, toast, past, future } = storeToRefs(ui)
const sidebarOpen = ref(true)
const search = ref('')
const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ['workflow'], queryFn: fetchWorkflow })
const saveMutation = useMutation({ mutationFn: saveWorkflow, onSuccess: (workflow) => queryClient.setQueryData(['workflow'], workflow) })
const resetMutation = useMutation({ mutationFn: resetWorkflow, onSuccess: (workflow) => queryClient.setQueryData(['workflow'], workflow) })
const isSaving = saveMutation.isPending
const workflow = computed(() => data.value || [])
const elements = computed(() => toFlowElements(workflow.value))
const selectedNode = computed(() => workflow.value.find((node) => node.id === String(route.params.id)))
const editableSelectedNode = computed(() => isEditable(selectedNode.value) ? selectedNode.value : null)
const editableNodes = computed(() => workflow.value.filter(isEditable))
const filteredNodes = computed(() => editableNodes.value.filter((node) => node.name.toLowerCase().includes(search.value.toLowerCase())))

const icons = { sendMessage: Send, addComment: MessageSquareText, dateTime: CalendarClock, trigger: Zap, dateTimeConnector: GitBranch }

/** Persist a user edit and keep a snapshot for undo. */
async function commit(next, message) {
  try {
    ui.record(workflow.value)
    await saveMutation.mutateAsync(next)
    announce(message)
  } catch (cause) {
    ui.past.pop()
    announce(cause.message || 'Could not save changes.')
  }
}

/** Display a short confirmation message. */
function announce(message) {
  ui.announce(message)
  window.setTimeout(() => { if (ui.toast === message) ui.toast = '' }, 3200)
}

/** Open the route-backed drawer for editable nodes. */
function openNode(id) {
  const node = workflow.value.find((item) => item.id === String(id))
  if (isEditable(node)) router.push(`/nodes/${encodeURIComponent(node.id)}`)
}

/** Handle selection from the graph. */
function onNodeClick({ node }) {
  openNode(node.id)
}

/** Save the final position after a node drag ends. */
function onNodeDragStop({ node }) {
  const original = workflow.value.find((item) => item.id === node.id)
  if (!original || (original.position.x === node.position.x && original.position.y === node.position.y)) return
  commit(replaceNode(workflow.value, { ...original, position: { x: node.position.x, y: node.position.y } }), 'Node moved')
}

/** Create a node from the modal and open its details. */
async function onCreate(node) {
  await commit([...workflow.value, node], 'Node created')
  createOpen.value = false
  openNode(node.id)
}

/** Save an edited node record. */
async function onSave(node) {
  await commit(replaceNode(workflow.value, node), 'Changes saved')
}

/** Delete the selected node and close its route-backed drawer. */
async function onDelete(id) {
  await commit(deleteNode(workflow.value, id), 'Node deleted')
  router.push('/')
}

/** Undo the latest edit and persist the restored snapshot. */
async function undo() {
  const previous = ui.undo(workflow.value)
  if (!previous) return
  await saveMutation.mutateAsync(previous)
  announce('Change undone')
}

/** Redo the latest undone edit and persist the restored snapshot. */
async function redo() {
  const next = ui.redo(workflow.value)
  if (!next) return
  await saveMutation.mutateAsync(next)
  announce('Change redone')
}

/** Restore the original assessment payload after confirmation. */
async function reset() {
  if (!window.confirm('Reset the workflow to the original sample? Your edits in this browser will be removed.')) return
  ui.record(workflow.value)
  await resetMutation.mutateAsync()
  router.push('/')
  announce('Original workflow restored')
}

/** Support undo, redo, Escape, and deletion without intercepting text fields. */
function onKeydown(event) {
  const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
  if (event.key === 'Escape') {
    createOpen.value = false
    if (editableSelectedNode.value) router.push('/')
    return
  }
  if (editable) return
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ collapsed: !sidebarOpen }" aria-label="Workflow navigation">
      <div class="brand"><span class="brand-mark"><Workflow :size="23" :stroke-width="2.5" /></span><span v-if="sidebarOpen" class="brand-name">flow<span>studio</span><small>WORKFLOW BUILDER</small></span></div>
      <div v-if="sidebarOpen" class="sidebar-body"><div class="sidebar-section-title">WORKSPACE</div><button class="nav-link active"><LayoutGrid :size="18" /> Canvas <span class="nav-active-mark"></span></button><div class="sidebar-divider"></div><div class="sidebar-section-title nodes-heading"><span>NODES</span><span class="sidebar-count">{{ editableNodes.length }}</span></div><label class="search-box"><Search :size="16" /><input v-model="search" placeholder="Find a node..." aria-label="Find a node" /></label><div class="node-nav-list"><button v-for="node in filteredNodes" :key="node.id" class="node-nav-item" :class="{ selected: selectedNode?.id === node.id }" @click="openNode(node.id)"><span class="list-icon" :class="`tone-${NODE_TYPES[node.type]?.color}`"><component :is="icons[node.type]" :size="15" /></span><span>{{ node.name }}</span><ChevronRight :size="15" class="list-chevron" /></button><p v-if="!filteredNodes.length" class="sidebar-empty">No nodes found</p></div><button class="sidebar-add" @click="createOpen = true"><Plus :size="17" /> Add a node</button></div>
      <div class="sidebar-bottom"><div v-if="sidebarOpen" class="sidebar-tip"><Sparkles :size="17" /><div><strong>Make it yours</strong><p>Drag nodes to shape your flow. Select one to edit its details.</p></div></div><button class="collapse-button" :aria-label="sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'" @click="sidebarOpen = !sidebarOpen"><PanelLeftClose v-if="sidebarOpen" :size="18" /><PanelLeftOpen v-else :size="18" /><span v-if="sidebarOpen">Collapse sidebar</span></button></div>
    </aside>

    <main class="main-panel"><header class="topbar"><div class="breadcrumbs"><span>Workflows</span><ChevronRight :size="15" /><strong>Conversation routing</strong></div><div class="topbar-right"><span class="saved-indicator"><span class="saved-dot"></span> Saved locally</span><span class="topbar-avatar">FS</span></div></header>
      <div class="page-heading"><div><div class="heading-kicker"><span class="heading-line"></span> WORKFLOW EDITOR <span class="version-pill">DRAFT</span></div><h1>Conversation routing</h1><p>Design the path every conversation takes, one step at a time.</p></div><button class="button button-primary create-button" @click="createOpen = true"><Plus :size="19" /> Create new node</button></div>
      <div class="canvas-frame"><div class="canvas-toolbar"><div class="canvas-label"><span class="canvas-label-icon"><GitBranch :size="17" /></span><div><strong>Workflow canvas</strong><small>{{ workflow.length }} nodes · {{ elements.edges.length }} connections</small></div></div><div class="toolbar-actions"><button class="tool-button" :disabled="!past.length" title="Undo (⌘Z)" aria-label="Undo" @click="undo"><Undo2 :size="18" /></button><button class="tool-button" :disabled="!future.length" title="Redo (⌘⇧Z)" aria-label="Redo" @click="redo"><Redo2 :size="18" /></button><span class="toolbar-separator"></span><button class="tool-button" title="Reset to sample" aria-label="Reset to sample" @click="reset"><RotateCcw :size="17" /></button></div></div>
        <div v-if="isPending" class="canvas-state"><LoaderCircle class="spin" :size="25" /><h3>Loading your workflow</h3><p>Preparing the canvas…</p></div>
        <div v-else-if="isError" class="canvas-state"><AlertCircle :size="27" /><h3>Could not load the workflow</h3><p>{{ error?.message }}</p><button class="button button-primary" @click="refetch">Try again</button></div>
        <div v-else class="flow-wrap"><VueFlow :nodes="elements.nodes" :edges="elements.edges" :fit-view-on-init="true" :min-zoom="0.3" :max-zoom="1.5" :default-edge-options="{ type: 'smoothstep' }" @node-click="onNodeClick" @node-drag-stop="onNodeDragStop"><template #node-workflow="nodeProps"><WorkflowNode v-bind="nodeProps" /></template><Background pattern-color="#dfe5ef" :gap="20" :size="1" /><Controls position="bottom-left" :show-interactive="false" /></VueFlow><div class="canvas-hint"><Command :size="14" /> Drag to move · Scroll to zoom · Click a node to edit</div></div>
      </div>
      <div class="footer-line"><span><span class="footer-online"></span> Your workflow is ready</span><span>Flow Studio · Built with Vue 3</span></div>
    </main>

    <NodeDrawer v-if="editableSelectedNode" :key="editableSelectedNode.id" :node="editableSelectedNode" :saving="isSaving" @close="router.push('/')" @save="onSave" @delete="onDelete" />
    <CreateNodeModal v-if="createOpen" :workflow="workflow" @close="createOpen = false" @create="onCreate" />
    <div v-if="toast" class="toast" role="status">{{ toast }}</div>
  </div>
</template>
