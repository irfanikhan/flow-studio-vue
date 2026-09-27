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
  if (node.description) {
    return node.description
  }
  if (node.type === 'trigger') {
    return 'Conversation opened'
  }
  if (node.type === 'dateTime') {
    return `Business hours · ${node.data?.timezone || 'UTC'}`
  }
  if (node.type === 'dateTimeConnector') {
    return node.data?.connectorType === 'success'
      ? 'Within business hours'
      : 'Outside business hours'
  }
  if (node.type === 'addComment') {
    return node.data?.comment || 'Add a note to the conversation'
  }
  if (node.type === 'sendMessage') {
    return node.data?.payload?.find((item) => item.type === 'text')?.text || 'Send a message'
  }

  return ''
}

/**
 * Repair type-specific fields while retaining supported source payload details.
 *
 * @param {string} type - Workflow node type.
 * @param {unknown} value - Raw node data.
 * @returns {object} Data safe for canvas rendering and the details drawer.
 */
function normalizeNodeData(type, value) {
  const data =
    value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {}
  if (type === 'sendMessage') {
    data.payload = (Array.isArray(data.payload) ? data.payload : [])
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => {
        if (item.type === 'text') {
          return { ...item, text: typeof item.text === 'string' ? item.text : '' }
        }
        if (item.type === 'attachment') {
          return {
            ...item,
            attachment: typeof item.attachment === 'string' ? item.attachment : '',
            name: typeof item.name === 'string' ? item.name : '',
          }
        }

        return item
      })
  }
  if (type === 'addComment') {
    data.comment = typeof data.comment === 'string' ? data.comment : ''
  }
  if (type === 'dateTime') {
    data.timezone = typeof data.timezone === 'string' ? data.timezone : 'UTC'
    data.times = (Array.isArray(data.times) ? data.times : [])
      .filter((time) => time && typeof time === 'object' && !Array.isArray(time))
      .map((time) => ({
        ...time,
        day: typeof time.day === 'string' ? time.day : '',
        startTime: typeof time.startTime === 'string' ? time.startTime : '09:00',
        endTime: typeof time.endTime === 'string' ? time.endTime : '17:00',
      }))
  }

  return data
}

/**
 * Normalize the supplied payload while preserving node data and relationships.
 *
 * @param {unknown} payload - Raw nodes from the assessment JSON or browser storage.
 * @returns {object[]} Nodes with safe fields, string IDs, and canvas positions.
 * @throws {Error} When a node cannot be identified or rendered.
 */
export function normalizeWorkflow(payload) {
  if (!Array.isArray(payload)) {
    throw new Error('The workflow payload must be an array.')
  }

  const knownIds = new Set()

  return payload.map((node, index) => {
    if (
      !node ||
      typeof node !== 'object' ||
      Array.isArray(node) ||
      !['string', 'number'].includes(typeof node.id) ||
      (typeof node.id === 'number' && !Number.isFinite(node.id)) ||
      !String(node.id).trim() ||
      !NODE_TYPES[node.type]
    ) {
      throw new Error(`Invalid workflow node at index ${index}.`)
    }

    const id = String(node.id)
    if (knownIds.has(id)) {
      throw new Error(`Duplicate workflow node ID: ${id}.`)
    }
    knownIds.add(id)

    const sourcePosition = node.position
    const fallbackPosition = INITIAL_POSITIONS[id] || { x: 420, y: 180 }
    const position =
      sourcePosition && Number.isFinite(sourcePosition.x) && Number.isFinite(sourcePosition.y)
        ? { x: sourcePosition.x, y: sourcePosition.y }
        : { ...fallbackPosition }
    const parentId =
      node.parentId === -1 || node.parentId === '-1' || node.parentId == null
        ? -1
        : ['string', 'number'].includes(typeof node.parentId)
          ? String(node.parentId)
          : -1

    return {
      ...node,
      id,
      parentId,
      name:
        typeof node.name === 'string' && node.name.trim()
          ? node.name
          : node.type === 'trigger'
            ? 'Conversation Opened'
            : NODE_TYPES[node.type].label,
      description: typeof node.description === 'string' ? node.description : undefined,
      data: normalizeNodeData(node.type, node.data),
      position,
    }
  })
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
  if (!name || !detail) {
    throw new Error('Title and description are required.')
  }
  if (!['sendMessage', 'addComment', 'dateTime'].includes(type)) {
    throw new Error('Choose a valid node type.')
  }
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

/**
 * Find an open canvas position for a new node below its selected parent.
 *
 * @param {object[]} workflow - Current workflow nodes and positions.
 * @param {string|number} parentId - Parent node ID or -1 for an unconnected node.
 * @returns {{x: number, y: number}} An open position with room for a visible edge.
 * @throws {Error} If no candidate position can be found.
 */
export function getNewNodePosition(workflow, parentId) {
  const parent = workflow.find((node) => node.id === String(parentId))
  const rightmost = Math.max(0, ...workflow.map((node) => node.position.x + 260))
  const baseline = parent
    ? parent.position.y + (parent.type === 'dateTimeConnector' ? 160 : 310)
    : Math.max(220, ...workflow.map((node) => node.position.y))
  const originX = parent?.position.x ?? rightmost + 100
  const offsets = [0, -340, 340, -680, 680, -1020, 1020]

  for (let row = 0; row <= workflow.length; row += 1) {
    for (const offset of offsets) {
      const position = { x: originX + offset, y: baseline + row * 260 }
      const occupied = workflow.some(
        (node) =>
          Math.abs(node.position.x - position.x) < 300 &&
          Math.abs(node.position.y - position.y) < 210,
      )
      if (!occupied) {
        return position
      }
    }
  }

  throw new Error('Could not find an open position for the new node.')
}
