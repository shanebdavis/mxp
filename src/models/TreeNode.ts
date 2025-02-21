import { v4 as uuid } from 'uuid'
import { log } from '../log'
export type Metrics = {
  readinessLevel: number
}

export interface TreeNodeProperties {
  title: string
  description?: string
  metadata?: Record<string, string | number | boolean | Date>
  setMetrics?: Record<string, number | null>
  readinessLevel?: number | null
}

export interface TreeNode extends TreeNodeProperties {
  id: string
  parentId: string | null
  childrenIds: string[]
  calculatedMetrics: Metrics
  filename: string  // The name of the file storing this node
}

export type TreeNodeMap = Record<string, TreeNode>

const getChildIds = (nodes: TreeNodeMap, nodeId: string): string[] =>
  nodes[nodeId].childrenIds

const getChildNodes = (nodes: TreeNodeMap, nodeId: string): TreeNode[] =>
  getChildIds(nodes, nodeId).map(id => nodes[id])

const calculateMetrics = (node: TreeNode, children: TreeNode[]): Metrics => {
  // If this node has a manually set value, use it
  if (node.setMetrics?.readinessLevel != null) {
    return { readinessLevel: node.setMetrics.readinessLevel }
  }

  // Otherwise calculate from children
  return {
    readinessLevel: node.setMetrics?.readinessLevel != null
      ? node.setMetrics.readinessLevel
      : children.length > 0
        ? Math.min(...children.map(child => child.calculatedMetrics.readinessLevel))
        : 0
  }
}

const metricsAreSame = (a: Metrics, b: Metrics): boolean =>
  a.readinessLevel === b.readinessLevel

/**
 * Update the metrics for a node and all its parents
 * @param nodes - The nodes to update
 * @param startNodeId - The node to start the update from
 * @returns A new nodes object with the all nodes, updated and old
 */
const updateNodeMetrics = (nodes: TreeNodeMap, startNodeId: string): TreeNodeMap => {
  // create map of only the nodes we're going to modify
  const updatedNodes: TreeNodeMap = { ...nodes }
  let changes = 0

  const updateNode = (nodeId: string) => {
    const node = updatedNodes[nodeId]
    if (!node) return

    const children = getChildNodes(updatedNodes, nodeId)
    const newCalculatedMetrics = calculateMetrics(node, children)

    if (!metricsAreSame(newCalculatedMetrics, node.calculatedMetrics)) {
      changes++
      updatedNodes[nodeId] = {
        ...node,
        calculatedMetrics: newCalculatedMetrics
      }
      // if this node changed and has a parent, that parent might need updating too
      if (node.parentId) updateNode(node.parentId)
    }
  }

  updateNode(startNodeId)

  // only create a new nodes object if we actually made changes
  return changes > 0
    ? updatedNodes
    : nodes
}

export const createNode = (
  properties: TreeNodeProperties,
  parentId: string | null = null
): TreeNode => ({
  ...properties,
  id: uuid(),
  parentId,
  childrenIds: [],
  calculatedMetrics: { readinessLevel: 0 },
  filename: `${properties.title || 'untitled'}.md`
})

const getChildrenIdsWithInsertion = (childrenIds: string[], nodeId: string, insertAtIndex?: number | null): string[] =>
  insertAtIndex != null && insertAtIndex >= 0
    ? [...childrenIds.slice(0, insertAtIndex), nodeId, ...childrenIds.slice(insertAtIndex)]
    : [...childrenIds, nodeId]

const getChildrenIdsWithRemoval = (childrenIds: string[], nodeId: string): string[] =>
  childrenIds.filter(id => id !== nodeId)

export const getTreeWithNodeAdded = (
  nodes: TreeNodeMap,
  nodeToAdd: TreeNode,
  parentId: string,
  insertAtIndex?: number | null
): TreeNodeMap => {
  if (!nodes[parentId]) throw new Error(`Parent node ${parentId} not found`)

  // First add the node to the tree, ensuring it starts with readinessLevel 0
  const updatedNodes = {
    ...nodes,
    [parentId]: {
      ...nodes[parentId],
      childrenIds: getChildrenIdsWithInsertion(nodes[parentId].childrenIds, nodeToAdd.id, insertAtIndex)
    },
    [nodeToAdd.id]: {
      ...nodeToAdd,
      parentId,
      calculatedMetrics: { readinessLevel: 0 }
    }
  }

  // Update the nodes object and recalculate parent metrics
  return updateNodeMetrics(updatedNodes, nodeToAdd.id)
}

export const getTreeWithNodeUpdated = (
  nodes: TreeNodeMap,
  nodeId: string,
  updates: Partial<TreeNode>
): TreeNodeMap => {
  const node = nodes[nodeId]
  if (!node) throw new Error(`Node ${nodeId} not found`)

  // Handle setMetrics updates
  let updatedSetMetrics = node.setMetrics
  if (updates.setMetrics) {
    if (Object.values(updates.setMetrics).every(v => v == null)) {
      updatedSetMetrics = undefined
    } else {
      updatedSetMetrics = { ...node.setMetrics, ...updates.setMetrics }
    }
  }

  // Create updated node
  const updatedNode = {
    ...node,
    ...updates,
    setMetrics: updatedSetMetrics
  }

  // Update the nodes object and recalculate metrics
  const updatedNodes = {
    ...nodes,
    [nodeId]: updatedNode
  }

  // Recalculate metrics for this node and its ancestors
  return updateNodeMetrics(updatedNodes, nodeId)
}

export const getTreeWithNodeParentChanged = (
  nodes: TreeNodeMap,
  nodeId: string,
  newParentId: string,
  insertAtIndex?: number | null
): TreeNodeMap => {
  const node = nodes[nodeId]
  if (!node) throw new Error(`Node ${nodeId} not found`)
  if (!nodes[newParentId]) throw new Error(`New parent node ${newParentId} not found`)
  if (isParentOfInTree(nodes, nodeId, newParentId)) {
    throw new Error('Cannot move a node to one of its descendants')
  }
  const oldParent = node.parentId ? nodes[node.parentId] : null
  if (!oldParent) throw new Error(`Old parent node ${node.parentId} not found`)

  let updatedNodes = {
    ...nodes,
    [nodeId]: { ...node, parentId: newParentId },
    [newParentId]: { ...nodes[newParentId], childrenIds: getChildrenIdsWithInsertion(nodes[newParentId].childrenIds, nodeId, insertAtIndex) }
  }
  if (oldParent) {
    updatedNodes[oldParent.id] = { ...oldParent, childrenIds: getChildrenIdsWithRemoval(oldParent.childrenIds, nodeId) }
    updatedNodes = updateNodeMetrics(updatedNodes, oldParent.id)
  }
  return updateNodeMetrics(updatedNodes, newParentId)
}

export const getTreeWithNodeRemoved = (
  nodes: TreeNodeMap,
  nodeId: string
): TreeNodeMap => {
  const node = nodes[nodeId]
  if (!node) throw new Error(`Node ${nodeId} not found`)

  // Get all descendant nodes to remove
  const nodesToRemove = new Set<string>()
  const addDescendants = (id: string) => {
    nodesToRemove.add(id)
    getChildIds(nodes, id).forEach(addDescendants)
  }
  addDescendants(nodeId)

  // Create new nodes object without the removed nodes
  const updatedNodes = { ...nodes }
  nodesToRemove.forEach(id => delete updatedNodes[id])

  // Remove the node from its parent's childrenIds
  if (node.parentId) {
    updatedNodes[node.parentId] = {
      ...updatedNodes[node.parentId],
      childrenIds: getChildrenIdsWithRemoval(updatedNodes[node.parentId].childrenIds, nodeId)
    }
  }

  return node.parentId
    ? updateNodeMetrics(updatedNodes, node.parentId)
    : updatedNodes
}

export const isParentOfInTree = (
  nodes: TreeNodeMap,
  parentId: string,
  childId: string
): boolean => {
  const child = nodes[childId]
  if (!child) return false
  if (child.parentId === parentId) return true
  if (!child.parentId) return false
  return isParentOfInTree(nodes, parentId, child.parentId)
}


type TreeNodeWithChildren = TreeNode & {
  children: TreeNodeWithChildren[]
}

export const inspectTree = (nodes: TreeNodeMap, rootNodeId: string): TreeNodeWithChildren => ({
  ...nodes[rootNodeId],
  children: nodes[rootNodeId].childrenIds.map(id => inspectTree(nodes, id))
})
