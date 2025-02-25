import { v4 as uuid } from 'uuid'
import { log } from '../ArtStandardLib'

const { eq } = require('art-standard-lib')
export type Metrics = {
  readinessLevel: number
}

export type PartialMetrics = Partial<Metrics>
export type UpdateMetrics = {
  [Property in keyof Metrics]?: Metrics[Property] | null;
}

type CalculatableMetric<T> = {
  default: T
  calculate: (setValue: T | undefined, childValues: T[]) => T
}

const calculatableMetrics: Record<keyof Metrics, CalculatableMetric<number>> = {
  readinessLevel: {
    default: 0,
    calculate: (setValue, childValues) => setValue != null ? setValue : childValues.length > 0 ? Math.min(...childValues) : 0
  }
}


function moveElementInArray<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= array.length) throw new Error(`fromIndex ${fromIndex} is out of bounds for array of length ${array.length}`)
  if (toIndex < 0) toIndex = 0
  const newArray = [...array];
  const [element] = newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, element);
  return newArray;
}

export const defaultMetrics: Record<keyof Metrics, number> = Object.fromEntries(Object.keys(calculatableMetrics).map(metric => [
  metric,
  calculatableMetrics[metric as keyof Metrics].default
])) as Record<keyof Metrics, number>

export const metricKeys = Object.keys(defaultMetrics) as (keyof Metrics)[]

/**
 * Merge two metrics objects, with m2 having top priority
 * 1. null values indicates intensionally erasing the value
 * 2. undefined values are ignored
 * @param m1 - The first metrics object
 * @param m2 - The second metrics object
 * @returns A new metrics object that is the result of merging m2 into m1
 */
export const mergeMetrics = (m1: UpdateMetrics | undefined | null, m2: UpdateMetrics | undefined | null): PartialMetrics => {
  const ret: any = {}
  if (!m1) m1 = {}
  if (!m2) m2 = {}
  metricKeys.forEach(metric => ret[metric] =
    m2[metric] === null ? null // m2 null means erase the value
      : m2[metric] ?? // m2 has a non-null, non-undefined value, use it
      (m1[metric] === null ? null // m1 null means erase the value
        : m1[metric]) // m1 has a non-null, use its value, undefined or not
  )
  return ret
}

/**
 * Compact a metrics object, removing null and undefined values
 * @param m - The metrics object to compact
 * @returns A new metrics object with null and undefined values removed
   */
export const compactMetrics = (m: UpdateMetrics): PartialMetrics => {
  return Object.fromEntries(Object.entries(m).filter(([_, value]) => value != null))
}

export const compactMergeMetrics = (m1: UpdateMetrics | undefined | null, m2: UpdateMetrics | undefined | null): PartialMetrics => {
  return compactMetrics(mergeMetrics(m1, m2))
}

export const calculateMetric = <T>(metric: keyof Metrics, setValues: PartialMetrics, childValues: T[]): T => {
  const calculator = calculatableMetrics[metric]
  const setValue = setValues[metric]
  return calculator.calculate(setValue, childValues as any[]) as T
}

export const calculateAllMetricsFromSetMetricsAndChildrenMetrics = (setMetrics: PartialMetrics, childrenMetrics: Metrics[]): Metrics => {
  // @ts-ignore
  const result: Metrics = Object.fromEntries(Object.keys(calculatableMetrics).map(metric => [
    metric,
    // @ts-ignore
    calculateMetric(metric, setMetrics, childrenMetrics.map(child => child[metric]))
  ]))
  return result
}

export const calculateAllMetricsFromNode = (node: TreeNode, children: TreeNode[]): Metrics => {
  return calculateAllMetricsFromSetMetricsAndChildrenMetrics(node.setMetrics ?? {}, children.map(child => child.calculatedMetrics))
}

export const calculateAllMetricsFromNodeId = (nodeId: string, allNodes: TreeNodeMap): Metrics => {
  const node = allNodes[nodeId]
  if (!node) throw new Error(`Node not found: ${nodeId}`)
  return calculateAllMetricsFromNode(node, getActiveChildren(allNodes, nodeId))
}

export type NodeType = "map" | "waypoint" | "user"
export type RootNodesByType = Record<NodeType, TreeNode>

export const ROOT_NODE_DEFAULT_PROPERTIES: Record<NodeType, TreeNodeProperties> = {
  map: { title: 'Root Problem', description: 'What is the root problem you are trying to solve? Trace your "why" back to the fundamental human needs you are serving. Who are you serving? What is the problem you are solving for them? What is the impact of that problem on their lives?' },
  waypoint: { title: 'Waypoints', description: 'What is the next deliverable? What does it require? When do you need it?' },
  user: { title: 'Contributors', description: 'Who is contributing to this expedition?' }
}

export interface TreeNodeProperties {
  title: string
  description?: string
  metadata?: Record<string, string | number | boolean | Date>
  setMetrics?: PartialMetrics
  draft?: boolean
}

export type UpdateTreeNodeProperties = Omit<Partial<TreeNodeProperties>, 'setMetrics'> & {
  setMetrics?: UpdateMetrics;
};

export interface TreeNode extends TreeNodeProperties {
  id: string
  type: NodeType
  parentId: string | null
  childrenIds: string[]
  calculatedMetrics: Metrics
  filename: string  // The name of the file storing this node
}

export const nodesAreEqual = (a: TreeNode, b: TreeNode): boolean => {
  return eq(a, b)
}

export type TreeNodeMap = Record<string, TreeNode>

export const getActiveChildren = (nodes: TreeNodeMap, nodeId: string): TreeNode[] => {
  const node = nodes[nodeId]
  if (!node) return []
  return node.childrenIds.map(id => nodes[id]).filter(child => !child.draft)
}

const getChildIds = (nodes: TreeNodeMap, nodeId: string): string[] =>
  nodes[nodeId].childrenIds

const getChildNodes = (nodes: TreeNodeMap, nodeId: string): TreeNode[] =>
  getChildIds(nodes, nodeId).map(id => nodes[id])

const calculateMetrics = (node: TreeNode, children: TreeNode[]): Metrics => {
  // If this node has a manually set value, use it
  if (node.setMetrics?.readinessLevel != null) {
    return { readinessLevel: node.setMetrics.readinessLevel }
  }

  // Otherwise calculate from non-draft children
  const nonDraftChildren = children.filter(child => !child.draft)

  // If all children are draft, treat as a leaf node
  if (nonDraftChildren.length === 0) {
    return { readinessLevel: 0 }
  }

  return {
    readinessLevel: Math.min(...nonDraftChildren.map(child => child.calculatedMetrics.readinessLevel))
  }
}

const metricsAreSame = (a: Metrics, b: Metrics): boolean => eq(a, b)

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

export const getDefaultFilename = (properties: TreeNodeProperties): string => {
  return `${properties.title || 'untitled'}.md`
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

    return updateNodeMetrics(
      {
        ...nodes,
        [newParentId]: {
          ...parent,
          childrenIds: moveElementInArray(
            parent.childrenIds,
            currentIndex,
            insertAtIndex ?? parent.childrenIds.length
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
