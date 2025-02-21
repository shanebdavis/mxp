import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { FileStore } from '../models/FileStore'
import { useTempDir } from './helpers/tempDir'
import { v4 as uuid } from 'uuid'

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
      calculatedMetrics: { readinessLevel: 5 }
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

  it('updates calculatedMetrics when setMetrics changes', async () => {
    const { path: testDir } = useTemp()
    fileStore = new FileStore(testDir)

    // Create a node with initial readinessLevel
    const node = await fileStore.createNode({
      title: 'Test Node',
      description: 'Test Description',
      setMetrics: { readinessLevel: 5 }
    }, null)

    // Verify initial state
    expect(node.setMetrics?.readinessLevel).toBe(5)
    expect(node.calculatedMetrics.readinessLevel).toBe(5)

    // Update readinessLevel
    const updatedNode = await fileStore.updateNode(node.id, {
      setMetrics: { readinessLevel: 7 }
    })

    // Verify calculatedMetrics was updated
    expect(updatedNode.setMetrics?.readinessLevel).toBe(7)
    expect(updatedNode.calculatedMetrics.readinessLevel).toBe(7)

    // Clear setMetrics
    const clearedNode = await fileStore.updateNode(node.id, {
      setMetrics: {}
    })

    // Verify calculatedMetrics defaults to 0 when no setMetrics
    expect(clearedNode.setMetrics).toBeUndefined()
    expect(clearedNode.calculatedMetrics.readinessLevel).toBe(0)
  })

  it('calculates parent metrics from children', async () => {
    const { path: testDir } = useTemp()
    fileStore = new FileStore(testDir)

    // Create root node with no setMetrics (auto)
    const root = await fileStore.createNode({
      title: 'Root Node'
    }, null)

    // Create two children with different readiness levels
    const child1 = await fileStore.createNode({
      title: 'Child 1',
      setMetrics: { readinessLevel: 2 }
    }, root.id)

    const child2 = await fileStore.createNode({
      title: 'Child 2',
      setMetrics: { readinessLevel: 3 }
    }, root.id)

    // Get the updated root node
    let nodes = await fileStore.getAllNodes()
    let updatedRoot = nodes[root.id]

    // Root should have calculatedMetrics.readinessLevel = 2 (min of children)
    expect(updatedRoot.setMetrics).toBeUndefined()
    expect(updatedRoot.calculatedMetrics.readinessLevel).toBe(2)

    // Now force root's readiness level to 4
    await fileStore.updateNode(root.id, {
      setMetrics: { readinessLevel: 4 }
    })

    nodes = await fileStore.getAllNodes()
    updatedRoot = nodes[root.id]

    // Root should now have readinessLevel = 4 (manually set)
    expect(updatedRoot.setMetrics?.readinessLevel).toBe(4)
    expect(updatedRoot.calculatedMetrics.readinessLevel).toBe(4)

    // Clear root's readiness level to resume auto mode
    await fileStore.updateNode(root.id, {
      setMetrics: {}
    })

    nodes = await fileStore.getAllNodes()
    updatedRoot = nodes[root.id]

    // Root should return to readinessLevel = 2 (min of children)
    expect(updatedRoot.setMetrics).toBeUndefined()
    expect(updatedRoot.calculatedMetrics.readinessLevel).toBe(2)
  })

  it('heals files with missing data', async () => {
    const { path: testDir } = useTemp()
    const fileStore = new FileStore(testDir)

    // Create an empty markdown file
    await fs.writeFile(path.join(testDir, 'test-node.md'), '')

    // Get all nodes
    const nodes = await fileStore.getAllNodes()

    // Verify we got exactly one node
    const nodeIds = Object.keys(nodes)
    expect(nodeIds).toHaveLength(1)

    // Get the node
    const node = nodes[nodeIds[0]]

    // Verify the node has an id and title
    expect(node.id).toBeDefined()
    expect(node.id).toMatch(/^[0-9a-f-]{36}$/) // UUID format
    expect(node.title).toBe('test-node')

    // Verify the file was healed
    const fileContent = await fs.readFile(path.join(testDir, 'test-node.md'), 'utf-8')
    expect(fileContent).toMatch(/^---\n/)
    expect(fileContent).toMatch(/\nid: [0-9a-f-]{36}\n/)
    expect(fileContent).toMatch(/\ntitle: test-node\n/)
  })

  it('heals invalid parentIds by attaching to root', async () => {
    const { path: testDir } = useTemp()
    const fileStore = new FileStore(testDir)

    // Create root node
    const root = await fileStore.createNode({
      title: 'Root Node'
    }, null)

    // Create node with invalid parent
    await fs.writeFile(path.join(testDir, 'orphan.md'), `---
id: ${uuid()}
title: Orphan Node
parentId: invalid-parent-id
childrenIds: []
calculatedMetrics:
  readinessLevel: 0
---
`)

    // Get all nodes
    const nodes = await fileStore.getAllNodes()

    // Find the orphan node
    const orphan = Object.values(nodes).find(n => n.title === 'Orphan Node')
    expect(orphan).toBeDefined()
    expect(orphan?.parentId).toBe(root.id)

    // Verify root has the orphan as a child
    expect(nodes[root.id].childrenIds).toContain(orphan?.id)

    // Verify the orphan's file was updated
    const fileContent = await fs.readFile(path.join(testDir, 'orphan.md'), 'utf-8')
    expect(fileContent).toContain(`parentId: ${root.id}`)
  })

  it('handles empty and missing titles correctly', async () => {
    const { path: testDir } = useTemp()
    const fileStore = new FileStore(testDir)

    // Create node with empty title
    const emptyTitleNode = await fileStore.createNode({
      title: '',
      description: 'Node with empty title'
    }, null)

    // Verify node has empty title but file is named "untitled"
    expect(emptyTitleNode.title).toBe('')
    const files = await fs.readdir(testDir)
    expect(files).toContain('untitled.md')

    // Verify the empty title is preserved in the file
    const content = await fs.readFile(path.join(testDir, 'untitled.md'), 'utf-8')
    expect(content).toContain('\ntitle: ""\n')

    // Create file with no title field
    await fs.writeFile(path.join(testDir, 'test-file.md'), `---
id: ${uuid()}
childrenIds: []
calculatedMetrics:
  readinessLevel: 0
---
`)

    // Get all nodes and find our node
    const nodes = await fileStore.getAllNodes()
    const noTitleNode = Object.values(nodes).find(n => n.id !== emptyTitleNode.id)
    expect(noTitleNode).toBeDefined()
    expect(noTitleNode?.title).toBe('test-file')

    // Verify the title was added to the file
    const healedContent = await fs.readFile(path.join(testDir, 'test-file.md'), 'utf-8')
    expect(healedContent).toContain('\ntitle: test-file\n')
  })
})