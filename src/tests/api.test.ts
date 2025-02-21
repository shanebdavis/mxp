import { describe, it, expect } from 'vitest'
import { useTempDir } from './helpers/tempDir'
import { startTestServer, TestServer } from './helpers/testServer'
import type { TreeNode } from '../models/TreeNode'

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
      expect(nodes).toEqual({})
    } finally {
      // Cleanup: Stop server
      await server.stop()
    }
  })

  it('supports basic CRUD operations', async () => {
    const { path: storageFolder } = useTemp()
    const server = await startTestServer({ storageFolder })

    try {
      // Create root node
      const createRootResponse = await fetch(`${server.baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: {
            title: 'Root Node',
            description: 'The root node'
          },
          parentNodeId: null
        })
      })
      expect(createRootResponse.status).toBe(201)
      const rootResult = await createRootResponse.json()
      const rootId = Object.keys(rootResult)[0]
      const rootNode = rootResult[rootId]
      expect(rootNode.title).toBe('Root Node')
      expect(rootNode.description).toBe('The root node')
      expect(rootNode.parentId).toBeNull()
      expect(rootNode.childrenIds).toEqual([])

      // Create child node
      const createChildResponse = await fetch(`${server.baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: {
            title: 'Child Node',
            description: 'A child node',
            readinessLevel: 5
          },
          parentNodeId: rootId,
          insertAtIndex: 0
        })
      })
      expect(createChildResponse.status).toBe(201)
      const childResult = await createChildResponse.json()
      const childId = Object.keys(childResult).find(id => id !== rootId)!
      const childNode = childResult[childId]
      expect(childNode.title).toBe('Child Node')
      expect(childNode.readinessLevel).toBe(5)
      expect(childNode.parentId).toBe(rootId)

      // Verify root was updated with child
      expect(childResult[rootId].childrenIds).toEqual([childId])

      // Update child node
      const updateResponse = await fetch(`${server.baseUrl}/api/nodes/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated Child',
          readinessLevel: 7
        })
      })
      expect(updateResponse.status).toBe(200)
      const updateResult = await updateResponse.json()
      expect(updateResult[childId].title).toBe('Updated Child')
      expect(updateResult[childId].readinessLevel).toBe(7)

      // Create second child for move test
      const createChild2Response = await fetch(`${server.baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: {
            title: 'Child 2',
            description: 'Second child'
          },
          parentNodeId: rootId
        })
      })
      expect(createChild2Response.status).toBe(201)
      const child2Result = await createChild2Response.json()
      const child2Id = Object.keys(child2Result).find(id => !([rootId, childId].includes(id)))!

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
      expect(moveResult[childId].parentId).toBe(child2Id)
      expect(moveResult[child2Id].childrenIds).toContain(childId)
      expect(moveResult[rootId].childrenIds).not.toContain(childId)

      // Delete first child
      const deleteResponse = await fetch(`${server.baseUrl}/api/nodes/${childId}`, {
        method: 'DELETE'
      })
      expect(deleteResponse.status).toBe(200)
      const deleteResult = await deleteResponse.json()
      expect(deleteResult[childId]).toBeUndefined()
      expect(deleteResult[child2Id].childrenIds).not.toContain(childId)

      // Verify final state
      const finalResponse = await fetch(`${server.baseUrl}/api/nodes`)
      expect(finalResponse.status).toBe(200)
      const finalNodes = await finalResponse.json()
      expect(Object.keys(finalNodes)).toHaveLength(2) // root and child2
      expect(finalNodes[rootId].childrenIds).toEqual([child2Id])
      expect(finalNodes[child2Id].childrenIds).toEqual([])
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

      // Create a chain of nodes to test circular reference prevention
      const rootResponse = await fetch(`${server.baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: { title: 'Root' },
          parentNodeId: null
        })
      })
      const rootResult = await rootResponse.json()
      const rootId = Object.keys(rootResult)[0]

      const childResponse = await fetch(`${server.baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: { title: 'Child' },
          parentNodeId: rootId
        })
      })
      const childResult = await childResponse.json()
      const childId = Object.keys(childResult).find(id => id !== rootId)!

      // Try to make root a child of its child (should fail)
      const moveResponse = await fetch(`${server.baseUrl}/api/nodes/${rootId}/parent`, {
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
})