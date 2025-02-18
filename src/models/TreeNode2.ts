import { v4 as uuid } from 'uuid'

export type Metrics = {
  readinessLevel: number
}

export interface TreeNodeProperties {
  title: string
  description?: string
  setMetrics?: Record<string, number>
}

export interface TreeNode2 extends TreeNodeProperties {
  id: string
  parentId: string | null
  childrenIds: string[]
  calculatedMetrics: Metrics
}

export type TreeNodeMap = Record<string, TreeNode2>

const getRootNodeId = (nodes: TreeNodeMap): string => {
  let rootNodeId: string | null = null
  Object.values(nodes).forEach(node => {
    if (!node.parentId) {
      if (rootNodeId) throw new Error('Multiple root nodes')
      rootNodeId = node.id
    }
  })
  if (!rootNodeId) throw new Error('No root node')
  return rootNodeId
}

const getChildIds = (nodes: TreeNodeMap, nodeId: string): string[] =>
  nodes[nodeId].childrenIds

const getChildNodes = (nodes: TreeNodeMap, nodeId: string): TreeNode2[] =>
  getChildIds(nodes, nodeId).map(id => nodes[id])

const calculateMetrics = (children: TreeNode2[]): Metrics => ({
  readinessLevel: Math.min(...children.map(child => child.calculatedMetrics.readinessLevel))
})

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
  const updatedNodes: TreeNodeMap = {}

  const updateNode = (nodeId: string) => {
    const node = nodes[nodeId]
    if (!node) return

    const newCalculatedMetrics = calculateMetrics(getChildNodes(nodes, nodeId))
    if (!metricsAreSame(newCalculatedMetrics, node.calculatedMetrics)) {
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
  return Object.keys(updatedNodes).length > 0
    ? { ...nodes, ...updatedNodes }
    : nodes
}

export const createNode = (
  properties: TreeNodeProperties,
  parentId: string | null = null
): TreeNode2 => ({
  ...properties,
  id: uuid(),
  parentId,
  childrenIds: [],
  calculatedMetrics: calculateMetrics([])
})

const getChildrenIdsWithInsertion = (childrenIds: string[], nodeId: string, insertAtIndex?: number | null): string[] =>
  insertAtIndex
    ? [...childrenIds.slice(0, insertAtIndex), nodeId, ...childrenIds.slice(insertAtIndex)]
    : [...childrenIds, nodeId]

const getChildrenIdsWithRemoval = (childrenIds: string[], nodeId: string): string[] =>
  childrenIds.filter(id => id !== nodeId)

export const getTreeWithNodeAdded = (
  nodes: TreeNodeMap,
  node: TreeNode2,
  parentId: string,
  insertAtIndex?: number | null
): TreeNodeMap => {
  if (!nodes[parentId]) throw new Error(`Parent node ${parentId} not found`)

  return updateNodeMetrics({
    ...nodes,
    [parentId]: {
      ...nodes[parentId],
      childrenIds: getChildrenIdsWithInsertion(nodes[parentId].childrenIds, node.id, insertAtIndex)
    },
    [node.id]: { ...node, parentId }
  }, getRootNodeId(nodes))
}

export const getTreeWithNodeUpdated = (
  nodes: TreeNodeMap,
  nodeId: string,
  properties: Partial<TreeNodeProperties>
): TreeNodeMap => {
  const node = nodes[nodeId]
  if (!node) throw new Error(`Node ${nodeId} not found`)

  const updatedNodes = {
    ...nodes,
    [nodeId]: { ...node, ...properties, setMetrics: { ...node.setMetrics, ...properties.setMetrics } }
  }
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

  return node.parentId
    ? updateNodeMetrics({ ...nodes, ...updatedNodes }, node.parentId)
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
