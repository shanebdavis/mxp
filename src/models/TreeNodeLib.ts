import { NodeType, TreeNode, TreeNodeMap, TreeNodeProperties } from './TreeNodeTypes'
const { eq } = require('art-standard-lib')

export const ROOT_NODE_DEFAULT_PROPERTIES: Record<NodeType, TreeNodeProperties> = {
  map: { title: 'Root Problem', description: 'What is the root problem you are trying to solve? Trace your "why" back to the fundamental human needs you are serving. Who are you serving? What is the problem you are solving for them? What is the impact of that problem on their lives?' },
  waypoint: { title: 'Waypoints', description: 'What is the next deliverable? What does it require? When do you need it?' },
  user: { title: 'Contributors', description: 'Who is contributing to this expedition?' }
}

export const getDefaultFilename = (properties: TreeNodeProperties): string => {
  return `${properties.title || 'untitled'}.md`
}

export const getChildrenIdsWithInsertion = (childrenIds: string[], nodeId: string, insertAtIndex?: number | null): string[] =>
  insertAtIndex != null && insertAtIndex >= 0
    ? [...childrenIds.slice(0, insertAtIndex), nodeId, ...childrenIds.slice(insertAtIndex)]
    : [...childrenIds, nodeId]

export const getChildrenIdsWithRemoval = (childrenIds: string[], nodeId: string): string[] =>
  childrenIds.filter(id => id !== nodeId)


export const getActiveChildren = (nodes: TreeNodeMap, nodeId: string): TreeNode[] => {
  const node = nodes[nodeId]
  if (!node) return []
  return node.childrenIds.map(id => nodes[id]).filter(child => !child.draft)
}

export const getChildIds = (nodes: TreeNodeMap, nodeId: string): string[] =>
  nodes[nodeId].childrenIds

export const getChildNodes = (nodes: TreeNodeMap, nodeId: string): TreeNode[] =>
  getChildIds(nodes, nodeId).map(id => nodes[id])


export const nodesAreEqual = (a: TreeNode, b: TreeNode): boolean => {
  return eq(a, b)
}

