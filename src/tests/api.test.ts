import { describe, it, expect } from 'vitest'
import { useTempDir } from './helpers/tempDir'
import { startTestServer, TestServer } from './helpers/testServer'
import { log } from '../ArtStandardLib'
import { TreeNode } from '../TreeNodeTypes'

type ApiNode = TreeNode & {
  id: string
  type: 'map' | 'waypoint' | 'user'
}

type ApiResponse = Record<string, ApiNode>

describe('API', () => {
  const { useTemp } = useTempDir({ prefix: 'api-test-' })

  it('starts with an empty node list', async () => {
    // Setup: Create temp dir and start server
    const { path: storageFolder } = useTemp()
    const server = await startTestServer({ storageFolder })

    try {
      // Test: Get all nodes
      const response = await fetch(`${server.baseUrl}/api/nodes`)
      expect(response.status).toBe(200)

      const nodes = await response.json()
      // Expect root nodes for each type
      expect(Object.values(nodes)).toHaveLength(3)
      expect(Object.values(nodes).map(n => (n as any).type).sort()).toEqual(['map', 'user', 'waypoint'])
      expect(Object.values(nodes).every((n: any) => !n.parentId)).toBe(true)
    } finally {
      // Cleanup: Stop server
      await server.stop()
    }
  })

  it('supports basic CRUD operations', async () => {
    const { path: storageFolder } = useTemp()
    const server = await startTestServer({ storageFolder })

    try {
      // Get initial state to find the map root node
      const initialResponse = await fetch(`${server.baseUrl}/api/nodes`)
      const initialNodes = await initialResponse.json() as ApiResponse
      const mapRoot = Object.values(initialNodes).find((n) => n.type === 'map')
      if (!mapRoot) throw new Error('Map root not found')

      // Create a new map node under the map root
      const createNodeResponse = await fetch(`${server.baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: {
            title: 'Test Node',
            description: 'The test node',
            type: 'map'
          },
          parentNodeId: mapRoot.id
        })
      })
      expect(createNodeResponse.status).toBe(201)
      const createResult = await createNodeResponse.json()
      expect(createResult).toHaveProperty('node')
      expect(createResult).toHaveProperty('delta')

      const node = createResult.node
      expect(node.title).toBe('Test Node')
      expect(node.description).toBe('The test node')
      expect(node.parentId).toBe(mapRoot.id)
      expect(node.childrenIds).toEqual([])
      expect(node.type).toBe('map')

      // Get node ID for further operations
      const nodeId = node.id

      // Create child node
      const createChildResponse = await fetch(`${server.baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: {
            title: 'Child Node',
            description: 'A child node',
            setMetrics: { readinessLevel: 5 },
            type: 'map'
          },
          parentNodeId: nodeId,
          insertAtIndex: 0
        })
      })
      expect(createChildResponse.status).toBe(201)
      const createChildResult = await createChildResponse.json()

      const childNode = createChildResult.node
      expect(childNode.title).toBe('Child Node')
      expect(childNode.setMetrics?.readinessLevel).toBe(5)
      expect(childNode.parentId).toBe(nodeId)
      expect(childNode.type).toBe('map')

      // Get child ID for further operations
      const childId = childNode.id

      // Verify parent was updated with child in the delta
      expect(createChildResult.delta.updated[nodeId].childrenIds).toContain(childId)

      // Get latest nodes to verify state
      const nodesResponse = await fetch(`${server.baseUrl}/api/nodes`)
      const nodes = await nodesResponse.json() as ApiResponse
      expect(nodes[nodeId].childrenIds).toContain(childId)

      // Update child node
      const updateResponse = await fetch(`${server.baseUrl}/api/nodes/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated Child',
          setMetrics: { readinessLevel: 7 }
        })
      })
      expect(updateResponse.status).toBe(200)
      const updateResult = await updateResponse.json()
      expect(updateResult.updated[childId].title).toBe('Updated Child')
      expect(updateResult.updated[childId].setMetrics?.readinessLevel).toBe(7)

      // Create second child for move test
      const createChild2Response = await fetch(`${server.baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: {
            title: 'Child 2',
            description: 'Second child',
            type: 'map'
          },
          parentNodeId: nodeId
        })
      })
      expect(createChild2Response.status).toBe(201)
      const createChild2Result = await createChild2Response.json()
      const child2Id = createChild2Result.node.id

      // Move first child under second child
      const moveResponse = await fetch(`${server.baseUrl}/api/nodes/${childId}/parent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newParentId: child2Id
        })
      })
      expect(moveResponse.status).toBe(200)
      const moveResult = await moveResponse.json()
      expect(moveResult.updated[childId].parentId).toBe(child2Id)
      expect(moveResult.updated[child2Id].childrenIds).toContain(childId)
      expect(moveResult.updated[nodeId].childrenIds).not.toContain(childId)

      // Delete first child
      const deleteResponse = await fetch(`${server.baseUrl}/api/nodes/${childId}`, {
        method: 'DELETE'
      })
      expect(deleteResponse.status).toBe(200)
      const deleteResult = await deleteResponse.json()
      expect(deleteResult.removed[childId]).toBeDefined()
      expect(deleteResult.updated[child2Id].childrenIds).not.toContain(childId)

      // Verify final state
      const finalResponse = await fetch(`${server.baseUrl}/api/nodes`)
      expect(finalResponse.status).toBe(200)
      const finalNodes = await finalResponse.json()
      // Should have 5 nodes: 3 root nodes + our test node + child2
      expect(Object.keys(finalNodes)).toHaveLength(5)
      const testNode = Object.values(finalNodes).find(n => (n as ApiNode).title === 'Test Node') as ApiNode
      if (!testNode) throw new Error('Test node not found')
      const child2 = Object.values(finalNodes).find(n => (n as ApiNode).title === 'Child 2') as ApiNode
      if (!child2) throw new Error('Child 2 not found')
      expect(testNode.childrenIds).toEqual([child2.id])
      expect(child2.childrenIds).toEqual([])
    } finally {
      await server.stop()
    }
  })

  it('handles error cases appropriately', async () => {
    const { path: storageFolder } = useTemp()
    const server = await startTestServer({ storageFolder })

    try {
      // Try to update non-existent node
      const updateResponse = await fetch(`${server.baseUrl}/api/nodes/nonexistent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title' })
      })
      expect(updateResponse.status).toBe(404)

      // Get map root node
      const initialResponse = await fetch(`${server.baseUrl}/api/nodes`)
      const initialNodes = await initialResponse.json() as ApiResponse
      const mapRoot = Object.values(initialNodes).find((n) => n.type === 'map')
      if (!mapRoot) throw new Error('Map root not found')

      // Create a node under map root
      const nodeResponse = await fetch(`${server.baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: {
            title: 'Test Node',
            type: 'map'
          },
          parentNodeId: mapRoot.id
        })
      })
      expect(nodeResponse.status).toBe(201)
      const nodeResult = await nodeResponse.json()
      const nodeId = nodeResult.node.id

      // Create child node
      const childResponse = await fetch(`${server.baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: {
            title: 'Child',
            type: 'map'
          },
          parentNodeId: nodeId
        })
      })
      expect(childResponse.status).toBe(201)
      const childResult = await childResponse.json()
      const childId = childResult.node.id

      // Try to make parent a child of its child (should fail)
      const moveResponse = await fetch(`${server.baseUrl}/api/nodes/${nodeId}/parent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newParentId: childId
        })
      })
      expect(moveResponse.status).toBe(400)
      expect(await moveResponse.json()).toHaveProperty('error')

      // Try to delete non-existent node
      const deleteResponse = await fetch(`${server.baseUrl}/api/nodes/nonexistent`, {
        method: 'DELETE'
      })
      expect(deleteResponse.status).toBe(404)
    } finally {
      await server.stop()
    }
  })

  it('reorders children and returns only changed nodes', async () => {
    const { path: storageFolder } = useTemp()
    const server = await startTestServer({ storageFolder })

    try {
      // Get map root node
      const initialResponse = await fetch(`${server.baseUrl}/api/nodes`)
      const initialNodes = await initialResponse.json() as ApiResponse
      const mapRoot = Object.values(initialNodes).find((n) => n.type === 'map')
      if (!mapRoot) throw new Error('Map root not found')

      // Create parent node under map root
      const parentResponse = await fetch(`${server.baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: {
            title: 'Parent',
            type: 'map'
          },
          parentNodeId: mapRoot.id
        })
      })
      expect(parentResponse.status).toBe(201)
      const parentResult = await parentResponse.json()
      const parentId = parentResult.node.id

      // Create 4 children
      const childIds: string[] = []
      for (let i = 1; i <= 4; i++) {
        const response = await fetch(`${server.baseUrl}/api/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            node: {
              title: `Child ${i}`,
              type: 'map'
            },
            parentNodeId: parentId
          })
        });
        expect(response.status).toBe(201);
        const createResult = await response.json();
        childIds.push(createResult.node.id);
      }

      // Move the 4th child to the 3rd position
      const moveResponse = await fetch(`${server.baseUrl}/api/nodes/${childIds[3]}/parent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newParentId: parentId,
          insertAtIndex: 2
        })
      })

      // Verify response
      expect(moveResponse.ok).toBe(true)
      const moveResult = await moveResponse.json()

      // Should include the parent node since it's the only one that changed
      expect(Object.keys(moveResult.updated)).toHaveLength(1)
      expect(Object.keys(moveResult.updated)).toContain(parentId)

      // Verify the order in the parent's childrenIds
      expect(moveResult.updated[parentId].childrenIds).toEqual([
        childIds[0],
        childIds[1],
        childIds[3],
        childIds[2]
      ])

      // Verify full state through a separate request
      const finalResponse = await fetch(`${server.baseUrl}/api/nodes`)
      const finalNodes = await finalResponse.json() as ApiResponse
      expect(finalNodes[parentId].childrenIds).toEqual([
        childIds[0],
        childIds[1],
        childIds[3],
        childIds[2]
      ])
    } finally {
      await server.stop()
    }
  })
})