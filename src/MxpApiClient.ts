import {
  TreeNode,
  TreeNodeSet,
  TreeNodeProperties,
  UpdateTreeNodeProperties,
  TreeNodeSetDelta,
  isParentOfInTree,
  NodeType
} from './TreeNode'

export interface TreeStateMethods {
  addNode: (node: TreeNodeProperties, parentNodeId: string, insertAtIndex?: number | null) => Promise<string>
  updateNode: (nodeId: string, properties: UpdateTreeNodeProperties) => Promise<void>
  setNodeParent: (nodeId: string, newParentId: string, insertAtIndex?: number | null) => Promise<void>
  removeNode: (nodeId: string) => Promise<void>
  isParentOf: (nodeId: string, potentialChildId: string) => boolean
}

interface CreateNodeResponse {
  node: TreeNode
  delta: TreeNodeSetDelta
}

const apiFetch = async (baseUrl: string, path: string, method: string, body?: any) => {
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

  return response.json()
}

export class MxpApiClient implements TreeStateMethods {
  constructor(private baseUrl: string, private nodes: TreeNodeSet, private applyDelta: (delta: TreeNodeSetDelta) => void) { }

  getNodes(): Promise<TreeNodeSet> {
    return apiFetch(this.baseUrl, '/nodes', 'GET') as Promise<TreeNodeSet>
  }

  async addNode(node: TreeNodeProperties, parentNodeId: string, insertAtIndex?: number | null): Promise<string> {
    const parentNode = this.nodes[parentNodeId];
    if (!parentNode) {
      throw new Error(`Parent node ${parentNodeId} not found`);
    }

    const response = (await apiFetch(this.baseUrl, '/nodes', 'POST', {
      node: {
        ...node,
        type: parentNode.type
      },
      parentNodeId,
      insertAtIndex
    })) as CreateNodeResponse
    this.applyDelta(response.delta)
    return response.node.id
  }

  async updateNode(nodeId: string, properties: UpdateTreeNodeProperties): Promise<void> {
    const delta = await apiFetch(this.baseUrl, `/nodes/${nodeId}`, 'PATCH', properties) as TreeNodeSetDelta
    this.applyDelta(delta)
  }

  async setNodeParent(nodeId: string, newParentId: string, insertAtIndex?: number | null): Promise<void> {
    const delta = await apiFetch(this.baseUrl, `/nodes/${nodeId}/parent`, 'PUT', {
      newParentId,
      insertAtIndex
    }) as TreeNodeSetDelta
    this.applyDelta(delta)
  }

  async removeNode(nodeId: string): Promise<void> {
    const delta = await apiFetch(this.baseUrl, `/nodes/${nodeId}`, 'DELETE') as TreeNodeSetDelta
    this.applyDelta(delta)
  }

  isParentOf(nodeId: string, potentialChildId: string): boolean {
    return isParentOfInTree(this.nodes, nodeId, potentialChildId)
  }
}
