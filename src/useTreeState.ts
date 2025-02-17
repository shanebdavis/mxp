import { useState } from 'react'
export type { TreeNode, TreeNodeProperties }
import { TreeNode, TreeNodeProperties, createNode, getTreeWithNodeAdded, getTreeWithNodeParentChanged, getTreeWithNodeRemoved, getTreeWithNodeUpdated, isParentOfInTree } from './models'

export interface TreeStateMethods {
  addNode: (node: TreeNodeProperties) => void
  updateNode: (nodeId: string, properties: Partial<TreeNodeProperties>) => void
  setNodeParent: (nodeId: string, newParentId: string, insertAtIndex?: number | null) => void
  removeNode: (nodeId: string) => void
  isParentOf: (nodeId: string, potentialChildId: string) => boolean
}

export const useTreeState = (initialTree: TreeNode): [TreeNode, TreeStateMethods] => {
  const [treeRoot, setTreeRoot] = useState<TreeNode>(initialTree)

  const addNode = (node: TreeNodeProperties) => setTreeRoot((treeRoot) => {
    return getTreeWithNodeAdded(treeRoot, createNode(node), 'root', null)
  })

  const updateNode = (nodeId: string, properties: Partial<TreeNodeProperties>) => setTreeRoot((treeRoot) =>
    getTreeWithNodeUpdated(treeRoot, nodeId, properties).tree
  )

  const setNodeParent = (nodeId: string, newParentId: string, insertAtIndex?: number | null) => setTreeRoot((treeRoot) =>
    getTreeWithNodeParentChanged(treeRoot, nodeId, newParentId, insertAtIndex)
  )

  const removeNode = (nodeId: string) => setTreeRoot((treeRoot) => {
    if (nodeId === treeRoot.id) throw new Error('Cannot remove root node')
    const { tree } = getTreeWithNodeRemoved(treeRoot, nodeId)
    if (!tree) throw new Error('Tree cannot be null')
    return tree
  })

  const isParentOf = (nodeId: string, potentialChildId: string) => isParentOfInTree(treeRoot, nodeId, potentialChildId)

  const treeStateMethods: TreeStateMethods = {
    addNode,
    updateNode,
    setNodeParent,
    removeNode,
    isParentOf
  }

  return [treeRoot, treeStateMethods] as const
}