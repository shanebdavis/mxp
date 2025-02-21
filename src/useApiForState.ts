import { useState, useCallback, useEffect } from 'react'
import type { TreeNode, TreeNodeMap, TreeNodeProperties } from './models/TreeNode'

export interface TreeStateMethods {
  addNode: (node: TreeNodeProperties, parentNodeId: string, insertAtIndex?: number | null) => Promise<string>
  updateNode: (nodeId: string, properties: Partial<TreeNodeProperties>) => Promise<void>
  setNodeParent: (nodeId: string, newParentId: string, insertAtIndex?: number | null) => Promise<void>
  removeNode: (nodeId: string) => Promise<void>
  isParentOf: (nodeId: string, potentialChildId: string) => boolean
}

interface UseApiForStateOptions {
  /** Base URL for the API. Defaults to /api */
  baseUrl?: string
}

/**
 * Hook that implements TreeStateMethods using the API
 */
export const useApiForState = (options: UseApiForStateOptions = {}): {
  nodes: TreeNodeMap
  treeStateMethods: TreeStateMethods
  rootNodeId: string | null
  loading: boolean
  error: Error | null
} => {
  const baseUrl = options.baseUrl || '/api'
  const [nodes, setNodes] = useState<TreeNodeMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [rootNodeId, setRootNodeId] = useState<string | null>(null)

  // Helper to make API calls and handle responses
  const apiCall = useCallback(async (
    path: string,
    method: string = 'GET',
    body?: any
  ): Promise<TreeNodeMap> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
      const error = await response.json() as { error: string }
      throw new Error(error.error || 'API call failed')
    }

    const result = await response.json() as TreeNodeMap

    // For GET /nodes, replace the entire state
    if (method === 'GET' && path === '/nodes') {
      setNodes(result)
      const rootId = Object.values(result).find(node => !node.parentId)?.id
      setRootNodeId(rootId ?? null)
      return result
    }

    // For all other calls, merge changes into existing state
    setNodes(prevNodes => {
      const updatedNodes = { ...prevNodes, ...result }
      // Update rootNodeId if needed
      if (!rootNodeId) {
        const rootId = Object.values(updatedNodes).find(node => !node.parentId)?.id
        setRootNodeId(rootId ?? null)
      }
      return updatedNodes
    })

    return result
  }, [baseUrl])

  // Load initial state
  useEffect(() => {
    setLoading(true)
    apiCall('/nodes')
      .catch(err => setError(err))
      .finally(() => setLoading(false))
  }, [apiCall])

  const addNode = useCallback(async (
    node: TreeNodeProperties,
    parentNodeId: string,
    insertAtIndex?: number | null
  ): Promise<string> => {
    const result = await apiCall('/nodes', 'POST', {
      node,
      parentNodeId,
      insertAtIndex
    })
    // Find and return the ID of the newly created node
    const newNodeId = Object.keys(result).find(
      id => !Object.keys(nodes).includes(id)
    )
    if (!newNodeId) throw new Error('Failed to get ID of new node')
    return newNodeId
  }, [apiCall, nodes])

  const updateNode = useCallback(async (
    nodeId: string,
    properties: Partial<TreeNodeProperties>
  ) => {
    await apiCall(`/nodes/${nodeId}`, 'PATCH', properties)
  }, [apiCall])

  const setNodeParent = useCallback(async (
    nodeId: string,
    newParentId: string,
    insertAtIndex?: number | null
  ) => {
    await apiCall(`/nodes/${nodeId}/parent`, 'PUT', {
      newParentId,
      insertAtIndex
    })
  }, [apiCall])

  const removeNode = useCallback(async (nodeId: string) => {
    await apiCall(`/nodes/${nodeId}`, 'DELETE')
  }, [apiCall])

  const isParentOf = useCallback((nodeId: string, potentialChildId: string): boolean => {
    const child = nodes[potentialChildId]
    if (!child) return false
    if (child.parentId === nodeId) return true
    if (!child.parentId) return false
    return isParentOf(nodeId, child.parentId)
  }, [nodes])

  return {
    nodes,
    treeStateMethods: {
      addNode,
      updateNode,
      setNodeParent,
      removeNode,
      isParentOf
    },
    rootNodeId,
    loading,
    error
  }
}