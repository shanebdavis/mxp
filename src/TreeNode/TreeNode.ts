import { v4 as uuid } from 'uuid'
import { eq, log, neq, objectHasKeys } from '../ArtStandardLib'
import { moveElementInArray } from '../arrayLib'
import { TreeNode, TreeNodeProperties, UpdateTreeNodeProperties, NodeType, RootNodesByType, TreeNodeSet, TreeNodeWithChildren, TreeNodeSetDelta } from './TreeNodeTypes'
import { getDefaultFilename, getChildrenIdsWithInsertion, getChildrenIdsWithRemoval, getChildNodes, getChildIds, ROOT_NODE_DEFAULT_PROPERTIES, getActiveChildren } from './TreeNodeLib'
import { calculateAllMetricsFromNode, calculateAllMetricsFromSetMetricsAndChildrenMetrics, compactMergeMetrics, metricsAreSame } from './TreeNodeMetrics'
import { moveIdentifierInArray } from './TreeNodeInternalLib'

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
  calculatedMetrics: calculateAllMetricsFromSetMetricsAndChildrenMetrics(properties.setMetrics ?? {}, [], undefined),
  filename: getDefaultFilename(properties),
  nodeState: properties.nodeState ?? "active"
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

const getActiveChildNodesWithOptionalDelta = (nodes: TreeNodeSet, nodeId: string, optionalDelta: TreeNodeSetDelta | undefined): TreeNode[] =>
  getChildNodesWithOptionalDelta(nodes, nodeId, optionalDelta).filter(child => child.nodeState === "active")

//*******************************************
// Whole Tree Mutators
//*******************************************

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
  forceCheckParent: boolean = true
): TreeNodeSetDelta => {
  // Create a working copy of the delta
  const updatedDelta: TreeNodeSetDelta = {
    updated: { ...delta.updated },
    removed: { ...delta.removed }
  }

  const updateNodeMetrics = (nodeId: string) => {
    // Get the node, considering both the original nodes and the delta
    const node = getNode(nodes, nodeId, updatedDelta)

    // Use getActiveChildNodesWithOptionalDelta to filter out non-active nodes for metrics calculations
    const children = getActiveChildNodesWithOptionalDelta(nodes, nodeId, updatedDelta)
    const newCalculatedMetrics = calculateAllMetricsFromNode(node, children, node.metadata?.referenceMapNodeId != null ? nodes[node.metadata?.referenceMapNodeId] : undefined)

    if (forceCheckParent || !metricsAreSame(newCalculatedMetrics, node.calculatedMetrics)) {
      forceCheckParent = false
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

export const getTreeNodeSetDeltaWithManyUpdatedNodeMetrics = (
  nodes: TreeNodeSet,
  delta: TreeNodeSetDelta,
  startNodeIds: string[]
): TreeNodeSetDelta => {
  let updatedDelta: TreeNodeSetDelta = delta

  for (const startNodeId of startNodeIds) {
    updatedDelta = getTreeNodeSetDeltaWithUpdatedNodeMetrics(nodes, updatedDelta, startNodeId)
  }

  return updatedDelta
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

export const getRootNodesByType = (nodes: TreeNodeSet): RootNodesByType => {
  const rootNodesByType: RootNodesByType = {} as RootNodesByType
  getAllRootNodes(nodes).forEach(node => {
    rootNodesByType[node.type] = node
  })
  return rootNodesByType
}

export const vivifyRootNodesByType = (nodes: TreeNodeSet): { delta: TreeNodeSetDelta, rootNodesByType: RootNodesByType } => {
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

  // create any missing root nodes using ROOT_NODE_DEFAULT_PROPERTIES
  Object.keys(ROOT_NODE_DEFAULT_PROPERTIES).forEach(typeKey => {
    const type = typeKey as NodeType
    if (!rootNodesByType[type]) {
      const newRootNode = createNode(type, ROOT_NODE_DEFAULT_PROPERTIES[type])
      delta.updated[newRootNode.id] = rootNodesByType[type] = newRootNode
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
      }
    }
  }

  // Update metrics for the node and its ancestors
  return getTreeNodeSetDeltaWithUpdatedNodeMetrics(nodes, delta, nodeToAdd.id, true)
}

export const getTreeNodeSetDeltaForNodeCreated = (
  nodes: TreeNodeSet,
  type: NodeType,
  node: TreeNodeProperties,
  parentId: string
): { addedNode: TreeNode, delta: TreeNodeSetDelta } => {
  const addedNode = createNode(type, node)
  return { addedNode, delta: getTreeNodeSetDeltaForNodeAdded(nodes, addedNode, parentId) }
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
  // If nodeState is changing, we need to force an update of the parent's metrics
  // even if this node's metrics didn't change
  if ('nodeState' in updates && node.parentId) {
    // First update the node's own metrics
    const updatedDelta = getTreeNodeSetDeltaWithUpdatedNodeMetrics(nodes, delta, nodeId)

    // Then force an update of the parent's metrics
    return getTreeNodeSetDeltaWithUpdatedNodeMetrics(nodes, updatedDelta, node.parentId)
  }

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
    const childrenIds = insertAtIndex != null ? moveIdentifierInArray(
      parent.childrenIds,
      nodeId,
      insertAtIndex
    ) : parent.childrenIds

    const delta: TreeNodeSetDelta = mergeTreeNodeSetDeltas(
      optionalDelta,
      {
        removed: {},
        updated: {
          [newParentId]: {
            ...parent,
            childrenIds
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

//*******************************************
// Tree Healing Functions
//*******************************************


/**
 * Creates a delta to heal children references by removing invalid child IDs
 * from all nodes' childrenIds arrays.
 *
 * @param nodes The node set to heal
 * @returns A delta representing the changes needed to heal children references
 */
export const getHealedChildrenIdsDelta = (nodes: TreeNodeSet): TreeNodeSetDelta => {
  const delta: TreeNodeSetDelta = { removed: {}, updated: {} }

  // First, collect all valid node IDs
  const validNodeIds = new Set(Object.keys(nodes))

  // Then, for each node, remove any childrenIds that don't exist
  for (const node of Object.values(nodes)) {
    const validChildren = node.childrenIds.filter(id => validNodeIds.has(id))
    if (validChildren.length !== node.childrenIds.length) {
      delta.updated[node.id] = {
        ...node,
        childrenIds: validChildren
      }
    }
  }

  return delta
}


/**
 * Heals parent references by ensuring that all nodes have valid parent IDs.
 * If a node references a non-existent parent, it's attached to the root node.
 *
 * @returns A delta representing the changes needed to heal parent references
 */
export const getHealedParentIdsDelta = (nodes: TreeNodeSet): TreeNodeSetDelta => {
  // Find root node (node with no parent)
  let { rootNodesByType, delta } = vivifyRootNodesByType(nodes)

  // Check each node's parentId
  for (const node of Object.values(nodes)) {
    // Skip root node
    if (!node.parentId) continue

    // Check if the parentId exists in the nodes object or delta.updated
    const parentExists = nodes[node.parentId] !== undefined || (delta.updated[node.parentId] !== undefined);

    if (!parentExists) {
      // If parent doesn't exist in nodes, attach to root
      delta = getTreeNodeSetDeltaForNodeParentChanged(nodes, node.id, rootNodesByType[node.type].id, null, delta)
    } else {
      // Parent exists, check if it's not being removed in the delta
      try {
        const parent = getNode(nodes, node.parentId, delta)
        // Make sure this node is in parent's childrenIds
        if (!parent.childrenIds.includes(node.id)) {
          (delta.updated[node.parentId] ||= { ...parent }).childrenIds.push(node.id)
        }
      } catch (e) {
        // If there was an error getting the parent (e.g., it's being removed), attach to root
        delta = getTreeNodeSetDeltaForNodeParentChanged(nodes, node.id, rootNodesByType[node.type].id, null, delta)
      }
    }
  }

  return delta
}
