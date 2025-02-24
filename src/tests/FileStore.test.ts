import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { FileStore } from '../models/FileStore'
import { useTempDir } from './helpers/tempDir'
import { v4 as uuid } from 'uuid'
import { defaultMetrics, NodeType } from '../models/TreeNode'
import { log } from '../log'

describe('FileStore', () => {
  const { useTemp } = useTempDir({ prefix: 'filestore-test-' })
  let fileStore: FileStore

  const newTestFileStore = () => {
    const { path: testDir } = useTemp()
    return { testDir, fileStore: new FileStore(testDir) }
  }

  it('basic workflow: create and read a node', async () => {
    // Setup: Create a new FileStore in a temp directory
    const { fileStore, testDir } = newTestFileStore()

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
      calculatedMetrics: { readinessLevel: 5 },
      filename: 'My First Node.md',
      draft: false,
      type: NodeType.Map
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
    const { fileStore, testDir } = newTestFileStore()

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
    const { fileStore, testDir } = newTestFileStore()

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
    const { fileStore, testDir } = newTestFileStore()

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
    const { fileStore, testDir } = newTestFileStore()

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
    const { fileStore, testDir } = newTestFileStore()

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
    const { fileStore, testDir } = newTestFileStore()

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
      setMetrics: { readinessLevel: null }
    })

    // Verify calculatedMetrics defaults to 0 when no setMetrics
    expect(clearedNode.setMetrics).toEqual({})
    expect(clearedNode.calculatedMetrics.readinessLevel).toBe(0)
  })

  it('calculates parent metrics from children', async () => {
    const { fileStore, testDir } = newTestFileStore()

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
      setMetrics: { readinessLevel: null }
    })

    nodes = await fileStore.getAllNodes()
    updatedRoot = nodes[root.id]

    // Root should return to readinessLevel = 2 (min of children)
    expect(updatedRoot.setMetrics).toEqual({})
    expect(updatedRoot.calculatedMetrics.readinessLevel).toBe(2)
  })

  it('heals files with missing data', async () => {
    const { fileStore, testDir } = newTestFileStore()

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
    const { fileStore, testDir } = newTestFileStore()
    // Create root node
    const root = await fileStore.createNode({
      title: 'Root Node'
    }, null)

    // Create node with invalid parent
    await fs.writeFile(path.join(testDir, 'Orphan Node.md'), `---
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
    const fileContent = await fs.readFile(path.join(testDir, 'Orphan Node.md'), 'utf-8')
    expect(fileContent).toContain(`parentId: ${root.id}`)
  })

  it('handles empty and missing titles correctly', async () => {
    const { fileStore, testDir } = newTestFileStore()

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

  it('propagates readiness level changes through multiple generations', async () => {
    const { fileStore, testDir } = newTestFileStore()

    // Create a three-generation hierarchy
    const grandparent = await fileStore.createNode({
      title: 'Grandparent'
    }, null)

    const parent = await fileStore.createNode({
      title: 'Parent'
    }, grandparent.id)

    const child = await fileStore.createNode({
      title: 'Child',
      setMetrics: { readinessLevel: 2 }
    }, parent.id)

    // Verify initial state
    let nodes = await fileStore.getAllNodes()
    expect(nodes[child.id].calculatedMetrics.readinessLevel).toBe(2)
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(2)
    expect(nodes[grandparent.id].calculatedMetrics.readinessLevel).toBe(2)

    // Update child's readiness level
    await fileStore.updateNode(child.id, {
      setMetrics: { readinessLevel: 3 }
    })

    // Verify updated state
    nodes = await fileStore.getAllNodes()
    expect(nodes[child.id].calculatedMetrics.readinessLevel).toBe(3)
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(3)
    expect(nodes[grandparent.id].calculatedMetrics.readinessLevel).toBe(3)
  })

  it('excludes draft nodes from readiness level calculations', async () => {
    const { fileStore, testDir } = newTestFileStore()

    // Create parent node
    const parent = await fileStore.createNode({
      title: 'Parent'
    }, null)

    // Create non-draft child with RL3
    const nonDraftChild = await fileStore.createNode({
      title: 'Non-draft Child',
      setMetrics: { readinessLevel: 3 }
    }, parent.id)

    // Create draft child with RL2
    const draftChild = await fileStore.createNode({
      title: 'Draft Child',
      setMetrics: { readinessLevel: 2 },
      draft: true
    }, parent.id)

    // Verify state
    const nodes = await fileStore.getAllNodes()
    expect(nodes[nonDraftChild.id].calculatedMetrics.readinessLevel).toBe(3)
    expect(nodes[draftChild.id].calculatedMetrics.readinessLevel).toBe(2)
    // Parent should only consider the non-draft child's readiness level
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(3)
  })

  it('treats readinessLevel 0 as a valid manual setting', async () => {
    const { fileStore, testDir } = newTestFileStore()

    // Create parent node with RL0 explicitly set
    const parent = await fileStore.createNode({
      title: 'Parent',
      setMetrics: { readinessLevel: 0 }
    }, null)

    // Create child with RL3
    const child = await fileStore.createNode({
      title: 'Child',
      setMetrics: { readinessLevel: 3 }
    }, parent.id)

    // Verify state
    let nodes = await fileStore.getAllNodes()
    // Parent should keep its manually set 0, not use child's 3
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[parent.id].setMetrics?.readinessLevel).toBe(0)

    // Now clear the parent's setMetrics
    await fileStore.updateNode(parent.id, { setMetrics: { readinessLevel: null } })
    nodes = await fileStore.getAllNodes()
    // Now parent should use child's value
    expect(nodes[parent.id].setMetrics).toEqual({})
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(3)
  })

  it('properly handles readinessLevel 0 in parent calculations', async () => {
    const { fileStore, testDir } = newTestFileStore()

    // Create parent node with auto metrics
    const parent = await fileStore.createNode({
      title: 'Parent'
    }, null)

    // Create two children, one with RL0 and one with RL3
    const child1 = await fileStore.createNode({
      title: 'Child 1',
      setMetrics: { readinessLevel: 0 }
    }, parent.id)

    const child2 = await fileStore.createNode({
      title: 'Child 2',
      setMetrics: { readinessLevel: 3 }
    }, parent.id)

    // Verify state
    let nodes = await fileStore.getAllNodes()
    // Parent should use minimum of all children, including RL0
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[child1.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[child2.id].calculatedMetrics.readinessLevel).toBe(3)

    // Update child1 to auto mode
    await fileStore.updateNode(child1.id, { setMetrics: { readinessLevel: null } })
    nodes = await fileStore.getAllNodes()
    // Now parent should only consider child2's value since child1 is in auto mode
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[child1.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[child2.id].calculatedMetrics.readinessLevel).toBe(3)
  })

  it('distinguishes between readinessLevel 0 and draft mode', async () => {
    const { fileStore, testDir } = newTestFileStore()

    // Create parent node with auto metrics
    const parent = await fileStore.createNode({
      title: 'Parent'
    }, null)

    // Create child with RL0 (not draft)
    const child1 = await fileStore.createNode({
      title: 'Child 1',
      setMetrics: { readinessLevel: 0 }
    }, parent.id)

    // Create draft child with RL3
    const child2 = await fileStore.createNode({
      title: 'Child 2',
      setMetrics: { readinessLevel: 3 },
      draft: true
    }, parent.id)

    // Create normal child with RL5
    const child3 = await fileStore.createNode({
      title: 'Child 3',
      setMetrics: { readinessLevel: 5 }
    }, parent.id)

    // Verify state
    let nodes = await fileStore.getAllNodes()

    // Child1 (RL0) should be included in parent's calculation
    // Child2 (draft) should be excluded
    // Child3 (RL5) should be included
    // Parent should be 0 (min of 0 and 5)
    expect(nodes[child1.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[child2.id].calculatedMetrics.readinessLevel).toBe(3)
    expect(nodes[child3.id].calculatedMetrics.readinessLevel).toBe(5)
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(0)

    // Now set child1 to draft mode
    await fileStore.updateNode(child1.id, { draft: true })
    nodes = await fileStore.getAllNodes()
    // Parent should now only consider child3's value since both child1 and child2 are draft
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(5)
  })

  it('handles complex readinessLevel 0 scenarios', async () => {
    const { fileStore, testDir } = newTestFileStore()

    // Create a three-level hierarchy
    const root = await fileStore.createNode({
      title: 'Root',
      setMetrics: { readinessLevel: 0 }  // Explicitly set to 0
    }, null)

    const middle = await fileStore.createNode({
      title: 'Middle',
      setMetrics: { readinessLevel: 3 }
    }, root.id)

    const leaf1 = await fileStore.createNode({
      title: 'Leaf 1',
      setMetrics: { readinessLevel: 0 }  // Explicitly set to 0
    }, middle.id)

    const leaf2 = await fileStore.createNode({
      title: 'Leaf 2',
      setMetrics: { readinessLevel: 5 }
    }, middle.id)

    // Verify initial state
    let nodes = await fileStore.getAllNodes()
    expect(nodes[root.id].calculatedMetrics.readinessLevel).toBe(0)    // Manually set to 0
    expect(nodes[middle.id].calculatedMetrics.readinessLevel).toBe(3)  // Manually set to 3
    expect(nodes[leaf1.id].calculatedMetrics.readinessLevel).toBe(0)   // Manually set to 0
    expect(nodes[leaf2.id].calculatedMetrics.readinessLevel).toBe(5)   // Manually set to 5

    // Clear middle node's setMetrics
    await fileStore.updateNode(middle.id, { setMetrics: { readinessLevel: null } })
    nodes = await fileStore.getAllNodes()
    // Middle should now calculate from children (min of 0 and 5)
    expect(nodes[middle.id].calculatedMetrics.readinessLevel).toBe(0)
    // Root should still be 0 (manually set)
    expect(nodes[root.id].calculatedMetrics.readinessLevel).toBe(0)

    // Clear root's setMetrics
    await fileStore.updateNode(root.id, { setMetrics: { readinessLevel: null } })
    nodes = await fileStore.getAllNodes()
    // Root should now calculate from middle node
    expect(nodes[root.id].calculatedMetrics.readinessLevel).toBe(0)
  })

  it('correctly reorders children within the same parent', async () => {
    const { fileStore, testDir } = newTestFileStore()

    // Create parent node
    const parent = await fileStore.createNode({
      title: 'Parent',
      description: 'Parent node'
    }, null)

    // Create 4 children in sequence
    const child1 = await fileStore.createNode({ title: 'Child 1' }, parent.id)
    const child2 = await fileStore.createNode({ title: 'Child 2' }, parent.id)
    const child3 = await fileStore.createNode({ title: 'Child 3' }, parent.id)
    const child4 = await fileStore.createNode({ title: 'Child 4' }, parent.id)

    // Verify initial order
    let nodes = await fileStore.getAllNodes()
    expect(nodes[parent.id].childrenIds).toEqual([
      child1.id, child2.id, child3.id, child4.id
    ])

    // Move child4 to position 2 (before child3)
    await fileStore.setNodeParent(child4.id, parent.id, 2)

    // Verify new order
    nodes = await fileStore.getAllNodes()
    expect(nodes[parent.id].childrenIds).toEqual([
      child1.id, child2.id, child4.id, child3.id
    ])
  })
})