import { useState, useCallback } from 'react'
import type { TreeNode, TreeNodeMap, TreeNodeProperties } from './models'
import { createNode, getTreeWithNodeAdded, getTreeWithNodeParentChanged, getTreeWithNodeRemoved, getTreeWithNodeUpdated, isParentOfInTree } from './models'

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
  nodes: TreeNodeMap
}

interface TreeState {
  nodes: TreeNodeMap
  treeStateMethods: TreeStateMethods
  rootNodeId: string
}

const findRootNodeId = (nodes: TreeNodeMap): string => {
  const rootId = Object.values(nodes).find(node => !node.parentId)?.id
  if (!rootId) throw new Error('No root node found in initialNodes')
  return rootId
}

export const useTreeState = (initialNodes: TreeNodeMap): TreeState => {
  // Find root node once at initialization
  const rootNodeId = findRootNodeId(initialNodes)

  const [nodes, setNodes] = useState<TreeNodeMap>(initialNodes)
  const [undoStack, setUndoStack] = useState<UndoState[]>([])
  const [redoStack, setRedoStack] = useState<UndoState[]>([])

  const saveState = useCallback((newNodes: TreeNodeMap) => {
    setUndoStack(prev => [...prev, { nodes }])
    setRedoStack([])
    setNodes(newNodes)
  }, [nodes])

  const addNode = useCallback((nodeProps: TreeNodeProperties, parentNodeId: string, insertAtIndex?: number | null): string => {
    const newNode = createNode(nodeProps, parentNodeId)
    const newNodes = getTreeWithNodeAdded(nodes, newNode, parentNodeId, insertAtIndex)
    saveState(newNodes)
    return newNode.id
  }, [nodes, saveState])

  const updateNode = useCallback((nodeId: string, properties: Partial<TreeNodeProperties>) => {
    const newNodes = getTreeWithNodeUpdated(nodes, nodeId, properties)
    saveState(newNodes)
  }, [nodes, saveState])

  const setNodeParent = useCallback((nodeId: string, newParentId: string, insertAtIndex?: number | null) => {
    const newNodes = getTreeWithNodeParentChanged(nodes, nodeId, newParentId, insertAtIndex)
    saveState(newNodes)
  }, [nodes, saveState])

  const removeNode = useCallback((nodeId: string) => {
    if (nodeId === rootNodeId) throw new Error('Cannot remove root node')
    const newNodes = getTreeWithNodeRemoved(nodes, nodeId)
    saveState(newNodes)
  }, [nodes, rootNodeId, saveState])

  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const { nodes: prevNodes } = undoStack[undoStack.length - 1]
    setRedoStack(prev => [...prev, { nodes }])
    setUndoStack(prev => prev.slice(0, -1))
    setNodes(prevNodes)
  }, [nodes])

  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const { nodes: nextNodes } = redoStack[redoStack.length - 1]
    setUndoStack(prev => [...prev, { nodes }])
    setRedoStack(prev => prev.slice(0, -1))
    setNodes(nextNodes)
  }, [nodes])

  const isParentOf = useCallback((nodeId: string, potentialChildId: string) =>
    isParentOfInTree(nodes, nodeId, potentialChildId)
    , [nodes])

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

  return { nodes, treeStateMethods, rootNodeId }
}