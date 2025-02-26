import { useState, useCallback, useEffect, useMemo } from 'react'
import { TreeNodeSet, TreeNodeSetDelta, getTreeNodeSetWithDeltaApplied, getRootNodesByType, RootNodesByType } from './TreeNode'
import { MxpApiClient, TreeStateMethods } from './MxpApiClient'
export type { TreeStateMethods }

interface UseApiForStateOptions {
  baseUrl?: string
}

export const useApiForState = (options: UseApiForStateOptions = {}): {
  nodes: TreeNodeSet
  treeStateMethods: TreeStateMethods
  rootNodeId: string | undefined
  loading: boolean
  error: Error | null
} => {
  const baseUrl = options.baseUrl || '/api'
  const [nodes, setNodes] = useState<TreeNodeSet>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [rootNodesByType, setRootNodesByType] = useState<Partial<RootNodesByType>>({})
  // Helper function to apply a delta to the current state
  const applyDelta = useCallback((delta: TreeNodeSetDelta) => {
    setNodes((prevNodes: TreeNodeSet) => getTreeNodeSetWithDeltaApplied(prevNodes, delta))
  }, [setNodes])

  const apiClient = useMemo(() => new MxpApiClient(baseUrl, nodes, applyDelta), [baseUrl, nodes, applyDelta])

  // Load initial state
  useEffect(() => {
    setLoading(true)
    new MxpApiClient(baseUrl, nodes, applyDelta).getNodes()
      .then(
        nodes => {
          setNodes(nodes)
          setRootNodesByType(getRootNodesByType(nodes))
        },
        err => setError(err)
      )
      .finally(() => setLoading(false))
  }, [])

  return {
    nodes,
    treeStateMethods: apiClient,
    rootNodeId: rootNodesByType?.map?.id,
    loading,
    error
  }
}