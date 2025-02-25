import { v4 as uuid } from 'uuid'
import { log } from '../ArtStandardLib'
import { moveElementInArray } from './arrayLib'
import { TreeNode, TreeNodeProperties, UpdateTreeNodeProperties, NodeType, RootNodesByType, TreeNodeMap, TreeNodeWithChildren } from './TreeNodeTypes'
import { getDefaultFilename, getChildrenIdsWithInsertion, getChildrenIdsWithRemoval, getChildNodes, getChildIds } from './TreeNodeLib'
import { calculateAllMetricsFromNode, calculateAllMetricsFromSetMetricsAndChildrenMetrics, compactMergeMetrics, metricsAreSame } from './TreeNodeMetrics'

export const ROOT_NODE_DEFAULT_PROPERTIES: Record<NodeType, TreeNodeProperties> = {
  map: { title: 'Root Problem', description: 'What is the root problem you are trying to solve? Trace your "why" back to the fundamental human needs you are serving. Who are you serving? What is the problem you are solving for them? What is the impact of that problem on their lives?' },
  waypoint: { title: 'Waypoints', description: 'What is the next deliverable? What does it require? When do you need it?' },
  user: { title: 'Contributors', description: 'Who is contributing to this expedition?' }
}

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

export const getUpdatedNode = (
  node: TreeNode,
  updates: UpdateTreeNodeProperties
): TreeNode => ({
  ...node,
  ...updates,
  setMetrics: compactMergeMetrics(node.setMetrics, updates.setMetrics)
})

export const getTreeWithNodeUpdated = (
  nodes: TreeNodeMap,
  nodeId: string,
  updates: UpdateTreeNodeProperties
): TreeNodeMap => {
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
  return updateNodeMetrics(updatedNodes, nodeId)
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

  // If moving within the same parent, handle differently
  if (node.parentId === newParentId) {
    const parent = nodes[newParentId];
    const currentIndex = parent.childrenIds.indexOf(nodeId);
    if (currentIndex === -1) throw new Error(`Node ${nodeId} not found in parent's children`);

    // If no insertAtIndex is provided, move to the end
    const targetIndex = insertAtIndex ?? parent.childrenIds.length - 1;
    // If moving to a later position, we need to account for the removal of the current item
    const adjustedTargetIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;

    return updateNodeMetrics(
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

//*******************************************
// Readonly Tree Inspectors
//*******************************************

export const getAllRootNodes = (nodes: TreeNodeMap): TreeNode[] => {
  return Object.values(nodes).filter(node => !node.parentId)
}

export const getRootNodesByType = (nodes: TreeNodeMap): { nodes: TreeNodeMap, rootNodesByType: RootNodesByType } => {
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

export const inspectTree = (nodes: TreeNodeMap, rootNodeId: string): TreeNodeWithChildren => ({
  ...nodes[rootNodeId],
  children: nodes[rootNodeId].childrenIds.map(id => inspectTree(nodes, id))
})
