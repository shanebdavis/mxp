import { useState, useCallback } from 'react'
export type { TreeNode, TreeNodeProperties }
import { TreeNode, TreeNodeProperties, createNode, getTreeWithNodeAdded, getTreeWithNodeParentChanged, getTreeWithNodeRemoved, getTreeWithNodeUpdated, isParentOfInTree } from './models'

export interface TreeStateMethods {
  addNode: (node: TreeNodeProperties) => void
  updateNode: (nodeId: string, properties: Partial<TreeNodeProperties>) => void
  setNodeParent: (nodeId: string, newParentId: string, insertAtIndex?: number | null) => void
  removeNode: (nodeId: string) => void
  isParentOf: (nodeId: string, potentialChildId: string) => boolean
  undo: () => void
  redo: () => void
  undosAvailable: boolean
  redosAvailable: boolean
}

interface UndoState {
  tree: TreeNode
}

export const useTreeState = (initialTree: TreeNode): [TreeNode, TreeStateMethods] => {
  const [treeRoot, setTreeRoot] = useState<TreeNode>(initialTree)
  const [undoStack, setUndoStack] = useState<UndoState[]>([])
  const [redoStack, setRedoStack] = useState<UndoState[]>([])

  const saveState = useCallback((newTree: TreeNode) => {
    setUndoStack(prev => [...prev, { tree: treeRoot }])
    setRedoStack([])
    setTreeRoot(newTree)
  }, [treeRoot])

  const addNode = (node: TreeNodeProperties) => {
    const newTree = getTreeWithNodeAdded(treeRoot, createNode(node), 'root', null)
    saveState(newTree)
  }

  const updateNode = (nodeId: string, properties: Partial<TreeNodeProperties>) => {
    const { tree: newTree } = getTreeWithNodeUpdated(treeRoot, nodeId, properties)
    saveState(newTree)
  }

  const setNodeParent = (nodeId: string, newParentId: string, insertAtIndex?: number | null) => {
    const newTree = getTreeWithNodeParentChanged(treeRoot, nodeId, newParentId, insertAtIndex)
    saveState(newTree)
  }

  const removeNode = (nodeId: string) => {
    if (nodeId === treeRoot.id) throw new Error('Cannot remove root node')
    const { tree: newTree } = getTreeWithNodeRemoved(treeRoot, nodeId)
    if (!newTree) throw new Error('Tree cannot be null')
    saveState(newTree)
  }

  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const { tree } = undoStack[undoStack.length - 1]
    setRedoStack(prev => [...prev, { tree: treeRoot }])
    setUndoStack(prev => prev.slice(0, -1))
    setTreeRoot(tree)
  }, [treeRoot])

  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const { tree } = redoStack[redoStack.length - 1]
    setUndoStack(prev => [...prev, { tree: treeRoot }])
    setRedoStack(prev => prev.slice(0, -1))
    setTreeRoot(tree)
  }, [treeRoot])

  const isParentOf = (nodeId: string, potentialChildId: string) => isParentOfInTree(treeRoot, nodeId, potentialChildId)

  const treeStateMethods: TreeStateMethods = {
    addNode,
    updateNode,
    setNodeParent,
    removeNode,
    isParentOf,
    undo,
    redo,
    undosAvailable: undoStack.length > 0,
    redosAvailable: redoStack.length > 0,
  }

  return [treeRoot, treeStateMethods] as const
}