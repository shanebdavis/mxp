import { v4 as uuid } from 'uuid'
import { log, neq, objectHasKeys } from '../ArtStandardLib'
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

const getNode = (nodes: TreeNodeSet, nodeId: string, optionalDelta: TreeNodeSetDelta | undefined): TreeNode => {
  if (optionalDelta?.removed[nodeId]) throw new Error(`Node ${nodeId} is being removed`)
  const node = optionalDelta?.updated[nodeId] || nodes[nodeId]
  if (!node) throw new Error(`Node ${nodeId} not found`)
  return node
}

const getChildNodesWithOptionalDelta = (nodes: TreeNodeSet, nodeId: string, optionalDelta: TreeNodeSetDelta | undefined): TreeNode[] =>
  getNode(nodes, nodeId, optionalDelta).childrenIds.map(childId => getNode(nodes, childId, optionalDelta))

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

/**
 * Update the metrics for a node and all its parents, returning a delta
 * @param nodes - The original nodes set
 * @param delta - The delta to apply before updating metrics
 * @param startNodeId - The node to start the update from
 * @returns A new delta with updated metrics
 */
export const getTreeNodeSetDeltaWithUpdatedNodeMetrics = (
  nodes: TreeNodeSet,
  delta: TreeNodeSetDelta,
  startNodeId: string,
): TreeNodeSetDelta => {
  // Create a working copy of the delta
  const updatedDelta: TreeNodeSetDelta = {
    updated: { ...delta.updated },
    removed: { ...delta.removed }
  }

  const updateNodeMetrics = (nodeId: string) => {
    // Get the node, considering both the original nodes and the delta
    const node = getNode(nodes, nodeId, updatedDelta)

    // Get children using the helper function that considers the delta
    const newCalculatedMetrics = calculateAllMetricsFromNode(node, getChildNodesWithOptionalDelta(nodes, nodeId, updatedDelta))

    if (!metricsAreSame(newCalculatedMetrics, node.calculatedMetrics)) {
      // Update the node in the delta
      updatedDelta.updated[nodeId] = {
        ...node,
        calculatedMetrics: newCalculatedMetrics
      }

      // If this node changed and has a parent, that parent might need updating too
      if (node.parentId) updateNodeMetrics(node.parentId)
    }
  }

  updateNodeMetrics(startNodeId)

  // Only return a new delta if we actually made changes
  return updatedDelta
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

/**
 * Merges two TreeNodeSetDelta objects into a single delta
 * @param delta1 - The first delta
 * @param delta2 - The second delta to merge into the first
 * @returns A new delta with both deltas merged
 */
export const mergeTreeNodeSetDeltas = (
  delta1: TreeNodeSetDelta | undefined,
  delta2: TreeNodeSetDelta | undefined
): TreeNodeSetDelta =>
  delta1 && delta2 ?
    ({
      updated: { ...getTreeNodeSetWithNodesRemoved(delta1?.updated, delta2?.removed), ...delta2?.updated },
      removed: { ...getTreeNodeSetWithNodesRemoved(delta1?.removed, delta2?.updated), ...delta2?.removed }
    }) : delta1 || delta2 || { updated: {}, removed: {} }

export const getRootNodesByType = (nodes: TreeNodeSet): { delta: TreeNodeSetDelta, rootNodesByType: RootNodesByType } => {
  const rootNodes = getAllRootNodes(nodes)
  const rootNodesByType: RootNodesByType = {} as RootNodesByType

  // Initialize an empty delta
  let delta: TreeNodeSetDelta = {
    updated: {},
    removed: {}
  }

  rootNodes.forEach(node => {
    const existingRootOfType = rootNodesByType[node.type]

    if (existingRootOfType) {
      delta = getTreeNodeSetDeltaForNodeParentChanged(
        nodes,
        node.id,
        existingRootOfType.id,
        null,
        delta
      )

    } else {
      // This is the first root node of this type
      rootNodesByType[node.type] = node
    }
  })

  // Update rootNodesByType to reflect the final state
  // This ensures rootNodesByType has the latest versions of the nodes
  Object.keys(rootNodesByType).forEach(typeKey => {
    const type = typeKey as NodeType
    const nodeId = rootNodesByType[type].id
    rootNodesByType[type] = getNode(nodes, nodeId, delta)
  })

  return { delta, rootNodesByType }
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
  objectHasKeys(nodesToRemove)
    ? Object.keys(nodes).filter(id => !nodesToRemove[id]).reduce((acc, id) => ({ ...acc, [id]: nodes[id] }), {})
    : nodes

export const getTreeNodeSetWithDeltaApplied = (nodes: TreeNodeSet, delta: TreeNodeSetDelta): TreeNodeSet =>
  getTreeNodeSetWithNodesRemoved(
    objectHasKeys(delta.updated) ? { ...nodes, ...delta.updated } : nodes,
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
): TreeNodeSetDelta => {
  if (!nodes[parentId]) throw new Error(`Parent node ${parentId} not found`)

  // Create a delta that adds the node to the tree
  const delta: TreeNodeSetDelta = {
    removed: {},
    updated: {
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
  }

  // Update metrics for the node and its ancestors
  return getTreeNodeSetDeltaWithUpdatedNodeMetrics(nodes, delta, nodeToAdd.id)
}

export const getTreeNodeSetDeltaForNodeUpdated = (
  nodes: TreeNodeSet,
  nodeId: string,
  updates: UpdateTreeNodeProperties
): TreeNodeSetDelta => {
  const node = nodes[nodeId]
  if (!node) throw new Error(`Node ${nodeId} not found`)

  // Create updated node
  const updatedNode = getUpdatedNode(node, updates)

  // Create a delta with the updated node
  const delta: TreeNodeSetDelta = {
    removed: {},
    updated: {
      [nodeId]: updatedNode
    }
  }

  // Update metrics for this node and its ancestors
  return getTreeNodeSetDeltaWithUpdatedNodeMetrics(nodes, delta, nodeId)
}

export const getTreeNodeSetDeltaForNodeParentChanged = (
  nodes: TreeNodeSet,
  nodeId: string,
  newParentId: string,
  insertAtIndex?: number | null,
  optionalDelta?: TreeNodeSetDelta
): TreeNodeSetDelta => {
  const node = getNode(nodes, nodeId, optionalDelta)
  if (!node) throw new Error(`Node ${nodeId} not found`)
  if (!getNode(nodes, newParentId, optionalDelta)) throw new Error(`New parent node ${newParentId} not found`)
  if (isParentOfInTree(nodes, nodeId, newParentId)) {
    throw new Error('Cannot move a node to one of its descendants')
  }

  // If moving within the same parent, handle differently
  if (node.parentId === newParentId) {
    const parent = getNode(nodes, newParentId, optionalDelta);
    const currentIndex = parent.childrenIds.indexOf(nodeId);
    if (currentIndex === -1) throw new Error(`Node ${nodeId} not found in parent's children`);

    // If no insertAtIndex is provided, move to the end
    const targetIndex = insertAtIndex ?? parent.childrenIds.length - 1;
    // If moving to a later position, we need to account for the removal of the current item
    const adjustedTargetIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;

    const delta: TreeNodeSetDelta = mergeTreeNodeSetDeltas(
      optionalDelta,
      {
        removed: {},
        updated: {
          [newParentId]: {
            ...parent,
            childrenIds: moveElementInArray(
              parent.childrenIds,
              currentIndex,
              adjustedTargetIndex
            )
          }
        }
      },
    )

    return getTreeNodeSetDeltaWithUpdatedNodeMetrics(nodes, delta, newParentId);
  }

  // Otherwise, handle moving to a new parent
  const oldParent = node.parentId ? nodes[node.parentId] : null

  const delta: TreeNodeSetDelta = mergeTreeNodeSetDeltas(
    optionalDelta,
    {
      removed: {},
      updated: {
        [nodeId]: { ...node, parentId: newParentId },
        [newParentId]: {
          ...nodes[newParentId],
          childrenIds: getChildrenIdsWithInsertion(nodes[newParentId].childrenIds, nodeId, insertAtIndex)
        }
      }
    }
  )

  if (oldParent) {
    delta.updated[oldParent.id] = {
      ...oldParent,
      childrenIds: getChildrenIdsWithRemoval(oldParent.childrenIds, nodeId)
    }
    // Update metrics starting from the old parent
    const deltaWithOldParentUpdated = getTreeNodeSetDeltaWithUpdatedNodeMetrics(nodes, delta, oldParent.id)
    // Then update metrics starting from the new parent
    return getTreeNodeSetDeltaWithUpdatedNodeMetrics(nodes, deltaWithOldParentUpdated, newParentId)
  }

  // If there's no old parent, just update metrics starting from the new parent
  return getTreeNodeSetDeltaWithUpdatedNodeMetrics(nodes, delta, newParentId)
}

export const getTreeNodeSetDeltaForNodeRemoved = (
  nodes: TreeNodeSet,
  nodeId: string
): TreeNodeSetDelta => {
  const node = nodes[nodeId]
  if (!node) throw new Error(`Node ${nodeId} not found`)

  // Get all descendant nodes to remove
  const nodesToRemove = new Set<string>()
  const addDescendants = (id: string) => {
    nodesToRemove.add(id)
    getChildIds(nodes, id).forEach(addDescendants)
  }
  addDescendants(nodeId)

  // Create the delta with removed nodes
  const delta: TreeNodeSetDelta = {
    removed: {},
    updated: {}
  }

  // Add all nodes to be removed to the delta
  nodesToRemove.forEach(id => {
    delta.removed[id] = nodes[id]
  })

  // Remove the node from its parent's childrenIds
  if (node.parentId) {
    delta.updated[node.parentId] = {
      ...nodes[node.parentId],
      childrenIds: getChildrenIdsWithRemoval(nodes[node.parentId].childrenIds, nodeId)
    }

    // Update metrics starting from the parent
    return getTreeNodeSetDeltaWithUpdatedNodeMetrics(nodes, delta, node.parentId)
  }

  return delta
}