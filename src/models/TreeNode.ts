import { v4 as uuid } from 'uuid'
import { log, neq } from '../ArtStandardLib'
import { moveElementInArray } from './arrayLib'
import { TreeNode, TreeNodeProperties, UpdateTreeNodeProperties, NodeType, RootNodesByType, TreeNodeSet, TreeNodeWithChildren, TreeNodeSetDelta } from './TreeNodeTypes'
import { getDefaultFilename, getChildrenIdsWithInsertion, getChildrenIdsWithRemoval, getChildNodes, getChildIds } from './TreeNodeLib'
import { calculateAllMetricsFromNode, calculateAllMetricsFromSetMetricsAndChildrenMetrics, compactMergeMetrics, metricsAreSame } from './TreeNodeMetrics'

//*******************************************
// Single Node Creation and Update
//*******************************************
export const createNode = (
  type: NodeType,
  properties: TreeNodeProperties,
  parentId: string | null = null,
): TreeNode => ({
  ...properties,
  type,
  id: uuid(),
  parentId,
  childrenIds: [],
  calculatedMetrics: calculateAllMetricsFromSetMetricsAndChildrenMetrics(properties.setMetrics ?? {}, []),
  filename: getDefaultFilename(properties)
})

export const getUpdatedNode = (
  node: TreeNode,
  updates: UpdateTreeNodeProperties
): TreeNode => ({
  ...node,
  ...updates,
  setMetrics: compactMergeMetrics(node.setMetrics, updates.setMetrics)
})

//*******************************************
// Whole Tree Mutators
//*******************************************

/**
 * Update the metrics for a node and all its parents
 * @param nodes - The nodes to update
 * @param startNodeId - The node to start the update from
 * @returns A new nodes object with the all nodes, updated and old
 */
const getTreeWithUpdatedNodeMetrics = (nodes: TreeNodeSet, startNodeId: string): TreeNodeSet => {
  // create map of only the nodes we're going to modify
  const updatedNodes: TreeNodeSet = { ...nodes }
  let changes = 0

  const updateNode = (nodeId: string) => {
    const node = updatedNodes[nodeId]
    if (!node) return

    const children = getChildNodes(updatedNodes, nodeId)
    const newCalculatedMetrics = calculateAllMetricsFromNode(node, children)

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


export const getTreeWithNodeAdded = (
  nodes: TreeNodeSet,
  nodeToAdd: TreeNode,
  parentId: string,
  insertAtIndex?: number | null
): TreeNodeSet => {
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
  return getTreeWithUpdatedNodeMetrics(updatedNodes, nodeToAdd.id)
}

export const getTreeWithNodeUpdated = (
  nodes: TreeNodeSet,
  nodeId: string,
  updates: UpdateTreeNodeProperties
): TreeNodeSet => {
  const node = nodes[nodeId]
  if (!node) throw new Error(`Node ${nodeId} not found`)

  // Create updated node
  const updatedNode = getUpdatedNode(node, updates)

  // Update the nodes object and recalculate metrics
  const updatedNodes = {
    ...nodes,
    [nodeId]: updatedNode
  }

  // Recalculate metrics for this node and its ancestors
  return getTreeWithUpdatedNodeMetrics(updatedNodes, nodeId)
}

/**
 * Move a node to a new parent
 *
 * TODO: I'd rather have this, or a helper function like this, only return the nodes that changed
 *
 * @param nodes - The nodes to update
 * @param nodeId - The node to move
 * @param newParentId - The new parent of the node
 * @param insertAtIndex - The index to insert the node at, if null, the node will be added to the end
 * @returns A new nodes object with the node moved
 */
export const getTreeWithNodeParentChanged = (
  nodes: TreeNodeSet,
  nodeId: string,
  newParentId: string,
  insertAtIndex?: number | null
): TreeNodeSet => {
  const node = nodes[nodeId]
  if (!node) throw new Error(`Node ${nodeId} not found`)
  if (!nodes[newParentId]) throw new Error(`New parent node ${newParentId} not found`)
  if (isParentOfInTree(nodes, nodeId, newParentId)) {
    throw new Error('Cannot move a node to one of its descendants')
  }

  // If moving within the same parent, handle differently
  if (node.parentId === newParentId) {
    const parent = nodes[newParentId];
    const currentIndex = parent.childrenIds.indexOf(nodeId);
    if (currentIndex === -1) throw new Error(`Node ${nodeId} not found in parent's children`);

    // If no insertAtIndex is provided, move to the end
    const targetIndex = insertAtIndex ?? parent.childrenIds.length - 1;
    // If moving to a later position, we need to account for the removal of the current item
    const adjustedTargetIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;

    return getTreeWithUpdatedNodeMetrics(
      {
        ...nodes,
        [newParentId]: {
          ...parent,
          childrenIds: moveElementInArray(
            parent.childrenIds,
            currentIndex,
            adjustedTargetIndex
          )
        }
      },
      newParentId
    );
  }

  // Otherwise, handle moving to a new parent
  const oldParent = node.parentId ? nodes[node.parentId] : null

  let updatedNodes = {
    ...nodes,
    [nodeId]: { ...node, parentId: newParentId },
    [newParentId]: { ...nodes[newParentId], childrenIds: getChildrenIdsWithInsertion(nodes[newParentId].childrenIds, nodeId, insertAtIndex) }
  }
  if (oldParent) {
    updatedNodes[oldParent.id] = { ...oldParent, childrenIds: getChildrenIdsWithRemoval(oldParent.childrenIds, nodeId) }
    updatedNodes = getTreeWithUpdatedNodeMetrics(updatedNodes, oldParent.id)
  }
  return getTreeWithUpdatedNodeMetrics(updatedNodes, newParentId)
}

export const getTreeWithNodeRemoved = (
  nodes: TreeNodeSet,
  nodeId: string
): TreeNodeSet => {
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
    ? getTreeWithUpdatedNodeMetrics(updatedNodes, node.parentId)
    : updatedNodes
}

//*******************************************
// Readonly Tree Inspectors
//*******************************************

export const getAllRootNodes = (nodes: TreeNodeSet): TreeNode[] => {
  return Object.values(nodes).filter(node => !node.parentId)
}

export const getRootNodesByType = (nodes: TreeNodeSet): { nodes: TreeNodeSet, rootNodesByType: RootNodesByType } => {
  const rootNodes = getAllRootNodes(nodes)
  const rootNodesByType: RootNodesByType = {} as RootNodesByType
  rootNodes.forEach(node => {
    if (rootNodesByType[node.type]) {
      // already have a root node of this type, so add this node as a child
      nodes = getTreeWithNodeParentChanged(nodes, node.id, rootNodesByType[node.type].id)
    } else {
      rootNodesByType[node.type] = node
    }
  })
  return { nodes, rootNodesByType }
}

export const isParentOfInTree = (
  nodes: TreeNodeSet,
  parentId: string,
  childId: string
): boolean => {
  const child = nodes[childId]
  if (!child) return false
  if (child.parentId === parentId) return true
  if (!child.parentId) return false
  return isParentOfInTree(nodes, parentId, child.parentId)
}

export const inspectTree = (nodes: TreeNodeSet, rootNodeId: string): TreeNodeWithChildren => ({
  ...nodes[rootNodeId],
  children: nodes[rootNodeId].childrenIds.map(id => inspectTree(nodes, id))
})

export const getRemovedNodes = (oldNodes: TreeNodeSet, newNodes: TreeNodeSet): TreeNodeSet =>
  Object.keys(oldNodes).filter(id => !newNodes[id]).reduce((acc, id) => ({ ...acc, [id]: oldNodes[id] }), {})

export const getUpdatedNodes = (oldNodes: TreeNodeSet, newNodes: TreeNodeSet): TreeNodeSet =>
  Object.keys(newNodes).filter(id => neq(oldNodes[id], newNodes[id])).reduce((acc, id) => ({ ...acc, [id]: newNodes[id] }), {})

export const getTreeNodeSetDelta = (oldNodes: TreeNodeSet, newNodes: TreeNodeSet): TreeNodeSetDelta =>
  ({ removed: getRemovedNodes(oldNodes, newNodes), updated: getUpdatedNodes(oldNodes, newNodes) })

export const getTreeNodeSetWithNodesRemoved = (nodes: TreeNodeSet, nodesToRemove: TreeNodeSet): TreeNodeSet =>
  Object.keys(nodes).filter(id => !nodesToRemove[id]).reduce((acc, id) => ({ ...acc, [id]: nodes[id] }), {})

export const getTreeNodeSetWithDeltaApplied = (nodes: TreeNodeSet, delta: TreeNodeSetDelta): TreeNodeSet =>
  getTreeNodeSetWithNodesRemoved(
    { ...nodes, ...delta.updated },
    delta.removed
  )

//*******************************************
// Tree Delta Functions
//*******************************************

export const getTreeNodeSetDeltaForNodeAdded = (
  nodes: TreeNodeSet,
  nodeToAdd: TreeNode,
  parentId: string,
  insertAtIndex?: number | null
): TreeNodeSetDelta =>
  getTreeNodeSetDelta(nodes, getTreeWithNodeAdded(nodes, nodeToAdd, parentId, insertAtIndex))

export const getTreeNodeSetDeltaForNodeUpdated = (
  nodes: TreeNodeSet,
  nodeId: string,
  updates: UpdateTreeNodeProperties
): TreeNodeSetDelta =>
  getTreeNodeSetDelta(nodes, getTreeWithNodeUpdated(nodes, nodeId, updates))

export const getTreeNodeSetDeltaForNodeParentChanged = (
  nodes: TreeNodeSet,
  nodeId: string,
  newParentId: string,
  insertAtIndex?: number | null
): TreeNodeSetDelta =>
  getTreeNodeSetDelta(nodes, getTreeWithNodeParentChanged(nodes, nodeId, newParentId, insertAtIndex))

export const getTreeNodeSetDeltaForNodeRemoved = (
  nodes: TreeNodeSet,
  nodeId: string
): TreeNodeSetDelta =>
  getTreeNodeSetDelta(nodes, getTreeWithNodeRemoved(nodes, nodeId))