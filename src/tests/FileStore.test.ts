import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { FileStore } from '../models/FileStore'
import { useTempDir } from './helpers/tempDir'

describe('FileStore', () => {
  const { useTemp } = useTempDir({ prefix: 'filestore-test-' })
  let fileStore: FileStore

  it('basic workflow: create and read a node', async () => {
    // Setup: Create a new FileStore in a temp directory
    const { path: testDir } = useTemp()
    const fileStore = new FileStore(testDir)

    // Create a node
    const createdNode = await fileStore.createNode({
      title: 'My First Node',
      description: 'This is a test node',
      setMetrics: { readinessLevel: 5 }
    }, null)

    // Get all nodes
    const allNodes = await fileStore.getAllNodes()

    // Verify we got exactly one node back
    expect(Object.keys(allNodes)).toHaveLength(1)

    // Get the node from the map
    const retrievedNode = allNodes[createdNode.id]

    // Verify the node matches what we created
    expect(retrievedNode).toEqual({
      id: createdNode.id,
      title: 'My First Node',
      description: 'This is a test node',
      parentId: null,
      childrenIds: [],
      setMetrics: { readinessLevel: 5 },
      calculatedMetrics: { readinessLevel: 0 }
    })

    // Verify the file exists and has the correct name
    const files = await fs.readdir(testDir)
    expect(files).toEqual(['My First Node.md'])

    // Verify the file contents
    const content = await fs.readFile(path.join(testDir, 'My First Node.md'), 'utf-8')
    expect(content).toMatch(/^---\n/) // starts with frontmatter
    expect(content).toContain(`id: ${createdNode.id}`)
    expect(content).toContain('title: My First Node')
    expect(content).toContain('setMetrics:\n  readinessLevel: 5')
    expect(content).toMatch(/---\nThis is a test node$/) // ends with description
  })

  it('creates a node with title and description', async () => {
    const { path: testDir } = useTemp()
    fileStore = new FileStore(testDir)

    const node = await fileStore.createNode({
      title: 'Test Node',
      description: 'Test Description'
    }, null)

    // Verify node was created with correct properties
    expect(node.id).toBeDefined()
    expect(node.title).toBe('Test Node')
    expect(node.description).toBe('Test Description')

    // Verify file was created
    const files = await fs.readdir(testDir)
    expect(files).toHaveLength(1)
    expect(files[0]).toBe('Test Node.md')

    // Verify file contents
    const content = await fs.readFile(path.join(testDir, files[0]), 'utf-8')
    expect(content).toContain('Test Description')
    expect(content).toContain('id: ' + node.id)
  })

  it('maintains parent-child relationships', async () => {
    const { path: testDir } = useTemp()
    fileStore = new FileStore(testDir)

    // Create parent node
    const parent = await fileStore.createNode({
      title: 'Parent',
      description: 'Parent Description'
    }, null)

    // Create child node
    const child = await fileStore.createNode({
      title: 'Child',
      description: 'Child Description'
    }, parent.id)

    // Verify relationships
    expect(child.parentId).toBe(parent.id)

    // Read parent file and verify childrenIds
    const [updatedParent] = await fileStore['findNodeById'](parent.id)
    expect(updatedParent.childrenIds).toContain(child.id)
  })

  it('prevents circular parent-child relationships', async () => {
    const { path: testDir } = useTemp()
    fileStore = new FileStore(testDir)

    // Create a chain of nodes
    const node1 = await fileStore.createNode({ title: 'Node 1' }, null)
    const node2 = await fileStore.createNode({ title: 'Node 2' }, node1.id)
    const node3 = await fileStore.createNode({ title: 'Node 3' }, node2.id)

    // Try to make node1 a child of node3 (should fail)
    await expect(
      fileStore.setNodeParent(node1.id, node3.id)
    ).rejects.toThrow('Cannot move a node to one of its descendants')
  })

  it('deletes nodes and updates parent references', async () => {
    const { path: testDir } = useTemp()
    fileStore = new FileStore(testDir)

    // Create a parent with two children
    const parent = await fileStore.createNode({ title: 'Parent' }, null)
    const child1 = await fileStore.createNode({ title: 'Child 1' }, parent.id)
    const child2 = await fileStore.createNode({ title: 'Child 2' }, parent.id)

    // Delete first child
    await fileStore.deleteNode(child1.id)

    // Verify parent's childrenIds is updated
    const [updatedParent] = await fileStore['findNodeById'](parent.id)
    expect(updatedParent.childrenIds).not.toContain(child1.id)
    expect(updatedParent.childrenIds).toContain(child2.id)

    // Verify child1's file is deleted
    const files = await fs.readdir(testDir)
    expect(files).not.toContain('Child 1.md')
  })

  it('handles file renames when title changes', async () => {
    const { path: testDir } = useTemp()
    fileStore = new FileStore(testDir)

    // Create a node
    const node = await fileStore.createNode({
      title: 'Original Title',
      description: 'Test'
    }, null)

    // Update the title
    const updated = await fileStore.updateNode(node.id, {
      title: 'New Title'
    })

    // Verify old file is gone and new file exists
    const files = await fs.readdir(testDir)
    expect(files).not.toContain('Original Title.md')
    expect(files).toContain('New Title.md')

    // Verify node data is preserved
    expect(updated.id).toBe(node.id)
    expect(updated.description).toBe('Test')
  })
})