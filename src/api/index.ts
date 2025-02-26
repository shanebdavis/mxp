import express, { Request, Response, Router } from 'express'
import { createFileStore } from '../models/FileStore'

export interface ApiConfig {
  /** Absolute path to the storage folder */
  storageFolder: string
}

export const createApiRouter = async (config: ApiConfig): Promise<Router> => {
  const router = Router()
  const fileStore = await createFileStore(config.storageFolder)

  // Get all nodes
  router.get('/nodes', async (req, res) => {
    try {
      const nodes = fileStore.allNodes
      res.json(nodes)
    } catch (error: any) {
      // This should never happen since getAllNodes creates the directory if needed
      console.error('Unexpected error getting nodes:', error)
      res.status(500).json({ error: 'Failed to get nodes' })
    }
  })

  // Add a new node
  router.post('/nodes', async (req, res) => {
    try {
      const { node, parentNodeId, insertAtIndex } = req.body
      const { type, ...properties } = node
      const newNode = await fileStore.createNode(type, properties, parentNodeId, insertAtIndex)
      res.status(201).json(fileStore.allNodes)
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: `Parent node ${req.body.parentNodeId} not found` })
      } else {
        console.error('Unexpected error creating node:', error)
        res.status(500).json({ error: 'Failed to create node' })
      }
    }
  })

  // Update a node
  router.patch('/nodes/:nodeId', async (req, res) => {
    try {
      await fileStore.updateNode(req.params.nodeId, req.body)
      res.json(fileStore.allNodes)
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: `Node ${req.params.nodeId} not found` })
      } else {
        console.error('Unexpected error updating node:', error)
        res.status(500).json({ error: 'Failed to update node' })
      }
    }
  })

  // Delete a node
  router.delete('/nodes/:nodeId', async (req, res) => {
    try {
      await fileStore.deleteNode(req.params.nodeId)
      res.json(fileStore.allNodes)
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: `Node ${req.params.nodeId} not found` })
      } else {
        console.error('Unexpected error deleting node:', error)
        res.status(500).json({ error: 'Failed to delete node' })
      }
    }
  })

  // Change a node's parent
  router.put('/nodes/:nodeId/parent', async (req, res) => {
    try {
      const { newParentId, insertAtIndex } = req.body
      const oldNodes = fileStore.allNodes
      await fileStore.setNodeParent(req.params.nodeId, newParentId, insertAtIndex)
      const newNodes = fileStore.allNodes

      // Only return nodes that have changed
      const changedNodes: Record<string, any> = {}
      Object.keys(newNodes).forEach(id => {
        const oldNode = oldNodes[id]
        const newNode = newNodes[id]
        // Compare each property individually to handle array order changes
        const oldChildrenIds = JSON.stringify(oldNode?.childrenIds)
        const newChildrenIds = JSON.stringify(newNode?.childrenIds)
        if (
          !oldNode || // node was added
          !newNode || // node was removed
          oldChildrenIds !== newChildrenIds ||
          oldNode.parentId !== newNode.parentId ||
          oldNode.title !== newNode.title ||
          oldNode.description !== newNode.description ||
          JSON.stringify(oldNode.setMetrics) !== JSON.stringify(newNode.setMetrics) ||
          JSON.stringify(oldNode.calculatedMetrics) !== JSON.stringify(newNode.calculatedMetrics) ||
          oldNode.draft !== newNode.draft ||
          oldNode.type !== newNode.type
        ) {
          console.log('  -> Changed!')
          changedNodes[id] = newNode
        }
      })
      console.log('Changed nodes:', Object.keys(changedNodes))
      res.status(200).json(changedNodes)
    } catch (error: any) {
      console.error('Error changing node parent:', error)
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: `Node ${req.params.nodeId} not found` })
      } else if (error.message?.includes('descendants') || error.message?.includes('root node')) {
        res.status(400).json({ error: error.message })
      } else {
        console.error('Unexpected error changing node parent:', error)
        res.status(500).json({ error: 'Failed to change node parent' })
      }
    }
  })

  return router
}