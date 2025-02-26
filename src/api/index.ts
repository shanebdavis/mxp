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
      console.error('Unexpected error getting nodes:', error)
      res.status(500).json({ error: 'Failed to get nodes' })
    }
  })

  // Add a new node
  router.post('/nodes', async (req, res) => {
    try {
      const { node, parentNodeId, insertAtIndex } = req.body
      const { type, ...properties } = node
      const result = await fileStore.createNode(type, properties, parentNodeId, insertAtIndex)
      // Return the exact same object structure as FileStore.createNode
      res.status(201).json(result)
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
      const delta = await fileStore.updateNode(req.params.nodeId, req.body)
      res.json(delta)
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
      const delta = await fileStore.deleteNode(req.params.nodeId)
      res.json(delta)
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
      const delta = await fileStore.setNodeParent(req.params.nodeId, newParentId, insertAtIndex)
      res.status(200).json(delta)
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