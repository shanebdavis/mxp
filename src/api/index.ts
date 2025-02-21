import express, { Request, Response, Router } from 'express'
import { FileStore } from '../models/FileStore'

export interface ApiConfig {
  /** Absolute path to the storage folder */
  storageFolder: string
}

export const createApiRouter = (config: ApiConfig): Router => {
  const router = Router()
  const fileStore = new FileStore(config.storageFolder)

  // Get all nodes
  router.get('/nodes', async (req, res) => {
    try {
      const nodes = await fileStore.getAllNodes()
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
      const newNode = await fileStore.createNode(node, parentNodeId, insertAtIndex)
      res.status(201).json(await fileStore.getAllNodes())
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
      res.json(await fileStore.getAllNodes())
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
      res.json(await fileStore.getAllNodes())
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
      const oldNodes = await fileStore.getAllNodes()
      await fileStore.setNodeParent(req.params.nodeId, newParentId, insertAtIndex)
      const newNodes = await fileStore.getAllNodes()

      // Only return nodes that have changed
      const changedNodes: Record<string, any> = {}
      Object.keys(newNodes).forEach(id => {
        if (JSON.stringify(oldNodes[id]) !== JSON.stringify(newNodes[id])) {
          changedNodes[id] = newNodes[id]
        }
      })
      res.json(changedNodes)
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: `Node ${req.params.nodeId} not found` })
      } else if (error.message?.includes('descendants')) {
        res.status(400).json({ error: error.message })
      } else {
        console.error('Unexpected error changing node parent:', error)
        res.status(500).json({ error: 'Failed to change node parent' })
      }
    }
  })

  return router
}