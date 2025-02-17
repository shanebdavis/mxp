import { useState, useCallback } from 'react'
export type { TreeNode, TreeNodeProperties }
import { TreeNode, TreeNodeProperties, createNode, getTreeWithNodeAdded, getTreeWithNodeParentChanged, getTreeWithNodeRemoved, getTreeWithNodeUpdated, isParentOfInTree } from './models'

export interface TreeStateMethods {
  addNode: (node: TreeNodeProperties, parentNodeId: string, insertAtIndex?: number | null) => string
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

const addAllChildrenToNodesById = (nodesById: Record<string, TreeNode>, node: TreeNode) => {
  nodesById[node.id] = node
  node.children.forEach(child => addAllChildrenToNodesById(nodesById, child))
}

interface TreeState {
  rootNode: TreeNode
  nodesById: Record<string, TreeNode>
  treeStateMethods: TreeStateMethods
}

export const useTreeState = (initialTree: TreeNode): TreeState => {
  const [rootNode, setRootNode] = useState<TreeNode>(initialTree)
  const [undoStack, setUndoStack] = useState<UndoState[]>([])
  const [redoStack, setRedoStack] = useState<UndoState[]>([])

  const saveState = useCallback((newTree: TreeNode) => {
    setUndoStack(prev => [...prev, { tree: rootNode }])
    setRedoStack([])
    setRootNode(newTree)
  }, [rootNode])

  const addNode = useCallback((node: TreeNodeProperties, parentNodeId: string, insertAtIndex?: number | null): string => {
    const newNode = createNode(node)
    const newTree = getTreeWithNodeAdded(
      rootNode,
      newNode,
      parentNodeId,
      insertAtIndex
    )
    saveState(newTree)
    return newNode.id  // Return the new node's ID
  }, [rootNode, saveState])

  const updateNode = (nodeId: string, properties: Partial<TreeNodeProperties>) => {
    const { tree: newTree } = getTreeWithNodeUpdated(rootNode, nodeId, properties)
    saveState(newTree)
  }

  const setNodeParent = (nodeId: string, newParentId: string, insertAtIndex?: number | null) => {
    const newTree = getTreeWithNodeParentChanged(rootNode, nodeId, newParentId, insertAtIndex)
    saveState(newTree)
  }

  const removeNode = (nodeId: string) => {
    if (nodeId === rootNode.id) throw new Error('Cannot remove root node')
    const { tree: newTree } = getTreeWithNodeRemoved(rootNode, nodeId)
    if (!newTree) throw new Error('Tree cannot be null')
    saveState(newTree)
  }

  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const { tree } = undoStack[undoStack.length - 1]
    setRedoStack(prev => [...prev, { tree: rootNode }])
    setUndoStack(prev => prev.slice(0, -1))
    setRootNode(tree)
  }, [rootNode])

  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const { tree } = redoStack[redoStack.length - 1]
    setUndoStack(prev => [...prev, { tree: rootNode }])
    setRedoStack(prev => prev.slice(0, -1))
    setRootNode(tree)
  }, [rootNode])

  const isParentOf = (nodeId: string, potentialChildId: string) => isParentOfInTree(rootNode, nodeId, potentialChildId)

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

  const nodesById: Record<string, TreeNode> = {}
  addAllChildrenToNodesById(nodesById, rootNode)

  return { rootNode, nodesById, treeStateMethods }
}