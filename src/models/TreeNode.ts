import { v4 as uuidv4 } from 'uuid'

export interface TreeNodeProperties {
  name: string
  readinessLevel?: number
  description?: string
  readinessLevelCalculated?: number
}

export interface TreeNode extends TreeNodeProperties {
  id: string
  children: TreeNode[]
}

export const getTreeNodeWithUpdatedCalculatedFields = (node: TreeNode): TreeNode => {
  return {
    ...node,
    readinessLevelCalculated: node.readinessLevel ?? // min value of all children
      Math.min(...node.children.map(child => child.readinessLevelCalculated ?? child.readinessLevel ?? 0))
  }
}

//*************************************************
// NON-MUTATING, PURE-FUNCTIONAL HELPERS
//*************************************************
const applyToChildren = (node: TreeNode, fn: (child: TreeNode, index: number) => TreeNode | null): TreeNode => {
  const newChildren = node.children.map(fn)
  const changed = node.children.find((child, i) => child !== newChildren[i])
  if (changed) {
    return getTreeNodeWithUpdatedCalculatedFields({
      ...node,
      children: newChildren.filter(child => child !== null)
    })
  }
  return node
}

const applyToMatchingChildRecursive = (currentNode: TreeNode, childNodeId: string, fn: ((child: TreeNode, index: number) => TreeNode | null), __indexInParent: number): TreeNode => {
  if (currentNode.id === childNodeId) {
    return fn(currentNode, __indexInParent) as TreeNode // this can actually be null, but that's accounted for in the recursive call; the root call will never return null
  }
  return applyToChildren(currentNode, (child, index) => applyToMatchingChildRecursive(child, childNodeId, fn, index))
}

const applyToMatchingNode = (currentNode: TreeNode, matchNodeId: string, fn: ((node: TreeNode, index: number) => TreeNode | null)): TreeNode | null => {
  if (currentNode.id === matchNodeId) {
    const node = fn(currentNode, 0)
    if (node && node != currentNode) {
      return getTreeNodeWithUpdatedCalculatedFields(node)
    }
    return node
  } else {
    return applyToChildren(currentNode, (child, index) => applyToMatchingChildRecursive(child, matchNodeId, fn, index))
  }
}

export const createNode = (properties: TreeNodeProperties, children: TreeNode[] = []): TreeNode => {
  return getTreeNodeWithUpdatedCalculatedFields({ ...properties, id: uuidv4(), children })
}

export const isParentOfInTree = (currentNode: TreeNode, potentialParentId: string, childId: string): boolean => {
  if (potentialParentId === childId) return true
  if (currentNode.id === potentialParentId && currentNode.children.find(child => child.id === childId)) return true
  return !!currentNode.children.find(child => isParentOfInTree(child, potentialParentId, childId))
}

//*************************************************
// MUTATING EXPORTS - these are placeholders for an eventual async API
//*************************************************
export const getTreeWithNodeParentChanged = (sourceTree: TreeNode, nodeId: string, newParentId: string, insertAtIndex: number | null | undefined): TreeNode => {
  if (nodeId === sourceTree.id) throw new Error('Cannot set root node as child')
  if (isParentOfInTree(sourceTree, nodeId, newParentId)) throw new Error('Cannot set node as its own child')
  const { tree: treeWithRemovedNode, removedNode } = getTreeWithNodeRemoved(sourceTree, nodeId)
  if (!removedNode) throw new Error('Node not found in tree')
  if (!treeWithRemovedNode) return removedNode
  return getTreeWithNodeAdded(treeWithRemovedNode, removedNode, newParentId, insertAtIndex)
}

export const getTreeWithNodeUpdated = (sourceTree: TreeNode, nodeId: string, properties: Partial<TreeNodeProperties>): { tree: TreeNode, updatedNode: TreeNode } => {
  let updatedNode: TreeNode | null = null
  const tree = applyToMatchingNode(sourceTree, nodeId, currentNode => {
    updatedNode = {
      ...currentNode,
      ...properties
    }
    return updatedNode
  })
  if (!tree) throw new Error('tree should not be null')
  if (!updatedNode) throw new Error('Node not found in tree')
  return { tree, updatedNode }
}

export const getTreeWithNodeRemoved = (sourceTree: TreeNode, toRemoveId: string): { tree: TreeNode | null, removedNode: TreeNode | null } => {
  let removedNode: TreeNode | null = null
  const tree = applyToMatchingNode(sourceTree, toRemoveId, (node) => {
    removedNode = node
    return null
  })
  return { tree, removedNode }
}

export const getTreeWithNodeAdded = (sourceTree: TreeNode, toAdd: TreeNode, newParentId: string, insertAtIndex?: number | null): TreeNode =>
  applyToMatchingNode(sourceTree, newParentId, (parent: TreeNode) => ({
    ...parent,
    children: insertAtIndex != null
      ? (insertAtIndex < 0
        ? [...parent.children, toAdd]  // append if negative
        : [...parent.children.slice(0, insertAtIndex), toAdd, ...parent.children.slice(insertAtIndex)]
      )
      : [...parent.children, toAdd]  // append if null/undefined
  })) as TreeNode


//*************************************************
// Helpers
//*************************************************
export const getDisplayOrder = (node: TreeNode, expandedNodes: Record<string, boolean>): string[] => {
  if (expandedNodes[node.id]) {
    return [node.id, ...node.children.map(child => getDisplayOrder(child, expandedNodes)).flat()]
  }
  return [node.id]
}

export const getParentMap = (node: TreeNode, parentNode: TreeNode | undefined = undefined, out: Record<string, TreeNode> = {}): Record<string, TreeNode> => {
  if (parentNode) out[node.id] = parentNode
  node.children.forEach(child => getParentMap(child, node, out))
  return out
}

export const getIndexInParentMap = (node: TreeNode, indexInParent: number = 0, out: Record<string, number> = {}): Record<string, number> => {
  out[node.id] = indexInParent
  node.children.forEach((child, index) => getIndexInParentMap(child, index, out))
  return out
}
