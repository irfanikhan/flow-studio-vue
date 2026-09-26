export const NODE_TYPES = {
  sendMessage: { label: 'Send Message', color: 'teal' },
  addComment: { label: 'Add Comment', color: 'violet' },
  dateTime: { label: 'Business Hours', color: 'orange' },
  trigger: { label: 'Trigger', color: 'pink' },
  dateTimeConnector: { label: 'Condition', color: 'blue' },
}

export const DAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
]

const INITIAL_POSITIONS = {
  1: { x: 300, y: 45 },
  d09c08: { x: 300, y: 285 },
  '161f52': { x: 165, y: 535 },
  '28c4b9': { x: 565, y: 535 },
  b0653a: { x: 100, y: 620 },
  b6a0c1: { x: 500, y: 620 },
  e879e4: { x: 500, y: 850 },
}

/**
 * Return a human-readable description for a workflow node.
 *
 * @param {object} node - The workflow node to describe.
 * @returns {string} The description displayed on the canvas.
 */
export function getDescription(node) {
  if (node.description) return node.description
  if (node.type === 'trigger') return 'Conversation opened'
  if (node.type === 'dateTime') return `Business hours · ${node.data?.timezone || 'UTC'}`
  if (node.type === 'dateTimeConnector')
    return node.data?.connectorType === 'success'
      ? 'Within business hours'
      : 'Outside business hours'
  if (node.type === 'addComment') return node.data?.comment || 'Add a note to the conversation'
  if (node.type === 'sendMessage')
    return node.data?.payload?.find((item) => item.type === 'text')?.text || 'Send a message'
  return ''
}

/**
 * Normalize the supplied payload while preserving node data and relationships.
 *
 * @param {object[]} payload - Raw nodes from the assessment JSON.
 * @returns {object[]} Nodes with string IDs and canvas positions.
 * @throws {Error} When the payload is not an array.
 */
export function normalizeWorkflow(payload) {
  if (!Array.isArray(payload)) throw new Error('The workflow payload must be an array.')
  return payload.map((node) => ({
    ...node,
    id: String(node.id),
    parentId: node.parentId === -1 ? -1 : String(node.parentId),
    name:
      node.name ||
      (node.type === 'trigger'
        ? 'Conversation Opened'
        : NODE_TYPES[node.type]?.label || 'Untitled node'),
    data: structuredClone(node.data || {}),
    position: node.position || INITIAL_POSITIONS[String(node.id)] || { x: 420, y: 180 },
  }))
}

/**
 * Convert workflow records into Vue Flow nodes and edges.
 *
 * @param {object[]} workflow - Normalized workflow nodes.
 * @returns {{nodes: object[], edges: object[]}} Vue Flow graph elements.
 */
export function toFlowElements(workflow) {
  const nodes = workflow.map((node) => ({
    id: node.id,
    type: 'workflow',
    position: node.position,
    draggable: true,
    selectable: true,
    data: {
      label: node.name,
      description: getDescription(node),
      kind: node.type,
      connectorType: node.data?.connectorType,
      attachments: node.data?.payload?.filter((item) => item.type === 'attachment').length || 0,
      locked: node.type === 'trigger' || node.type === 'dateTimeConnector',
    },
  }))
  const knownIds = new Set(workflow.map((node) => node.id))
  const edges = workflow
    .filter((node) => node.parentId !== -1 && knownIds.has(String(node.parentId)))
    .map((node) => ({
      id: `e-${node.parentId}-${node.id}`,
      source: String(node.parentId),
      target: node.id,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke:
          node.data?.connectorType === 'failure' || node.parentId === '28c4b9'
            ? '#f69b8d'
            : '#b6c4d9',
        strokeWidth: 2,
      },
    }))
  return { nodes, edges }
}

/**
 * Create a workflow node with initial data for the selected type.
 *
 * @param {object} options - Fields entered in the create node dialog.
 * @param {string} options.title - Node title.
 * @param {string} options.description - Node description and initial content.
 * @param {string} options.type - One of the editable node types.
 * @param {string|number} options.parentId - Parent node ID or -1 when unconnected.
 * @param {{x: number, y: number}} options.position - Initial canvas position.
 * @returns {object} A new workflow node.
 * @throws {Error} When required fields or the node type are invalid.
 */
export function createNode({ title, description, type, parentId, position }) {
  const name = title.trim()
  const detail = description.trim()
  if (!name || !detail) throw new Error('Title and description are required.')
  if (!['sendMessage', 'addComment', 'dateTime'].includes(type))
    throw new Error('Choose a valid node type.')
  const data =
    type === 'sendMessage'
      ? { payload: [{ type: 'text', text: detail }] }
      : type === 'addComment'
        ? { comment: detail }
        : {
            times: DAYS.map(([day]) => ({ day, startTime: '09:00', endTime: '17:00' })),
            timezone: 'UTC',
            action: 'businessHours',
          }
  return {
    id: crypto.randomUUID().slice(0, 8),
    parentId: parentId || -1,
    type,
    name,
    description: detail,
    data,
    position,
  }
}

/**
 * Remove a node and detach its direct children.
 *
 * @param {object[]} workflow - Current workflow nodes.
 * @param {string} id - ID of the node to remove.
 * @returns {object[]} Workflow without the deleted node or dangling child edges.
 */
export function deleteNode(workflow, id) {
  return workflow
    .filter((node) => node.id !== id)
    .map((node) => (node.parentId === id ? { ...node, parentId: -1 } : node))
}

/**
 * Replace a node by ID while preserving all other workflow records.
 *
 * @param {object[]} workflow - Current workflow nodes.
 * @param {object} updatedNode - Complete replacement node.
 * @returns {object[]} Workflow with the updated node.
 */
export function replaceNode(workflow, updatedNode) {
  return workflow.map((node) => (node.id === updatedNode.id ? updatedNode : node))
}

/**
 * Check whether a node has an editable details drawer.
 *
 * @param {object|undefined} node - Node to inspect.
 * @returns {boolean} Whether the node supports editing.
 */
export function isEditable(node) {
  return Boolean(node && ['sendMessage', 'addComment', 'dateTime'].includes(node.type))
}
