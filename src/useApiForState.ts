import { useState, useCallback, useEffect } from 'react'
import type {
  TreeNode,
  TreeNodeSet,
  TreeNodeProperties,
  UpdateTreeNodeProperties,
  TreeNodeSetDelta
} from './TreeNode/TreeNodeTypes'
import { getTreeNodeSetWithDeltaApplied } from './TreeNode'

export interface TreeStateMethods {
  addNode: (node: TreeNodeProperties, parentNodeId: string, insertAtIndex?: number | null) => Promise<string>
  updateNode: (nodeId: string, properties: UpdateTreeNodeProperties) => Promise<void>
  setNodeParent: (nodeId: string, newParentId: string, insertAtIndex?: number | null) => Promise<TreeNodeSet>
  removeNode: (nodeId: string) => Promise<void>
  isParentOf: (nodeId: string, potentialChildId: string) => boolean
}

interface UseApiForStateOptions {
  /** Base URL for the API. Defaults to /api */
  baseUrl?: string
}

interface CreateNodeResponse {
  node: TreeNode
  delta: TreeNodeSetDelta
}

/**
 * Hook that implements TreeStateMethods using the API
 */
export const useApiForState = (options: UseApiForStateOptions = {}): {
  nodes: TreeNodeSet
  treeStateMethods: TreeStateMethods
  rootNodeId: string | null
  loading: boolean
  error: Error | null
} => {
  const baseUrl = options.baseUrl || '/api'
  const [nodes, setNodes] = useState<TreeNodeSet>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [rootNodeId, setRootNodeId] = useState<string | null>(null)

  // Helper function to apply a delta to the current state
  const applyDelta = useCallback((delta: TreeNodeSetDelta) => {
    setNodes(prevNodes => getTreeNodeSetWithDeltaApplied(prevNodes, delta))
  }, [])

  // Helper to make API calls and handle responses
  const apiCall = useCallback(async (
    path: string,
    method: string = 'GET',
    body?: any
  ): Promise<TreeNodeSet | TreeNodeSetDelta | CreateNodeResponse> => {
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

    const result = await response.json()

    // For GET /nodes, replace the entire state
    if (method === 'GET' && path === '/nodes') {
      setNodes(result as TreeNodeSet)
      const rootId = Object.values(result as TreeNodeSet).find(node => !node.parentId)?.id
      setRootNodeId(rootId ?? null)
      return result
    }

    // For POST /nodes (create node)
    if (method === 'POST' && path === '/nodes') {
      const createResult = result as CreateNodeResponse
      applyDelta(createResult.delta)
      return createResult
    }

    // For all other calls (PATCH, DELETE, PUT), apply delta to state
    const deltaResult = result as TreeNodeSetDelta
    applyDelta(deltaResult)
    return deltaResult
  }, [baseUrl, applyDelta])

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
    }) as CreateNodeResponse

    // Return the ID of the newly created node from the response
    return result.node.id
  }, [apiCall])

  const updateNode = useCallback(async (
    nodeId: string,
    properties: UpdateTreeNodeProperties
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
    return nodes // Get the freshest state
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