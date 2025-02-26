import { describe, it, expect } from 'vitest'

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { createFileStore, FileStore } from '../../models'
import { getTreeWithNodeParentChanged } from '../../TreeNode'
import { getActiveChildren } from '../../TreeNode'
import { useTempDir } from '../helpers/tempDir'
import { v4 as uuid } from 'uuid'
import { log } from '../../ArtStandardLib'

describe('FileStore', () => {
  const { useTemp } = useTempDir({ prefix: 'filestore-test-' })
  let fileStore: FileStore

  const newTestFileStore = async () => {
    const { path: testDir } = useTemp()
    return { testDir, fileStore: await createFileStore(testDir) }
  }

  it('basic workflow: create and read a node', async () => {
    // Setup: Create a new FileStore in a temp directory
    const { fileStore, testDir } = await newTestFileStore()
    const map = fileStore.rootNodesByType.map

    // Create a node
    const { node: createdNode } = await fileStore.createNode("map", {
      title: 'My First Node',
      description: 'This is a test node',
      setMetrics: { readinessLevel: 5 }
    }, map.id)

    // Get all nodes
    const allNodes = fileStore.allNodes

    // Verify we got exactly one node back
    expect(Object.keys(allNodes)).toHaveLength(4)

    // Get the node from the map
    const retrievedNode = allNodes[createdNode.id]

    // Verify the node matches what we created
    expect(retrievedNode).toEqual({
      id: createdNode.id,
      title: 'My First Node',
      description: 'This is a test node',
      parentId: fileStore.rootNodesByType.map.id,
      childrenIds: [],
      setMetrics: { readinessLevel: 5 },
      calculatedMetrics: { readinessLevel: 5 },
      filename: `${createdNode.id}.md`,
      nodeState: "active",
      type: "map"
    })

    // Verify the folders exists
    const dirs = await fs.readdir(testDir)
    expect(dirs.sort()).toEqual(['maps', 'users', 'waypoints'])

    // verify maps files
    const mapsFiles = await fs.readdir(path.join(testDir, 'maps'))
    expect(mapsFiles).toContain(`${createdNode.id}.md`)
    expect(mapsFiles).toContain('Root Problem.md')

    // Verify the file contents
    const content = await fs.readFile(path.join(testDir, 'maps', `${createdNode.id}.md`), 'utf-8')
    expect(content).toMatch(/^---\n/) // starts with frontmatter
    expect(content).toContain(`id: ${createdNode.id}`)
    expect(content).toContain('title: My First Node')
    expect(content).toContain('setMetrics:\n  readinessLevel: 5')
    expect(content).toMatch(/---\nThis is a test node$/) // ends with description
  })

  it('creates a node with title and description', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    const { node } = await fileStore.createNode("map", {
      title: 'Test Node',
      description: 'Test Description'
    }, null)

    // Verify node was created with correct properties
    expect(node.id).toBeDefined()
    expect(node.title).toBe('Test Node')
    expect(node.description).toBe('Test Description')

    // Verify file was created
    const files = await fs.readdir(fileStore.baseDirsByType.map)
    expect(files).toHaveLength(2)
    expect(files).toContain(`${node.id}.md`)
    expect(files).toContain('Root Problem.md')

    // Verify file contents
    const content = await fs.readFile(path.join(fileStore.baseDirsByType.map, `${node.id}.md`), 'utf-8')
    expect(content).toContain('Test Description')
    expect(content).toContain('id: ' + node.id)
  })

  it('maintains parent-child relationships', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create parent node
    const { node: parent } = await fileStore.createNode("map", {
      title: 'Parent',
      description: 'Parent Description'
    }, null)

    // Create child node
    const { node: child } = await fileStore.createNode("map", {
      title: 'Child',
      description: 'Child Description'
    }, parent.id)

    // Verify relationships
    expect(child.parentId).toBe(parent.id)

    // Read parent file and verify childrenIds
    const updatedParent = fileStore.getNode(parent.id)
    expect(updatedParent.childrenIds).toContain(child.id)
  })

  it('prevents circular parent-child relationships', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create a chain of nodes
    const { node: node1 } = await fileStore.createNode("map", { title: 'Node 1' })
    const { node: node2 } = await fileStore.createNode("map", { title: 'Node 2' }, node1.id)
    const { node: node3 } = await fileStore.createNode("map", { title: 'Node 3' }, node2.id)

    // Try to make node1 a child of node3 (should fail)
    await expect(
      fileStore.setNodeParent(node1.id, node3.id)
    ).rejects.toThrow('Cannot move a node to one of its descendants')
  })

  it('deletes nodes and updates parent references', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create a parent with two children
    const { node: parent } = await fileStore.createNode("map", { title: 'Parent' })
    const { node: child1 } = await fileStore.createNode("map", { title: 'Child 1' }, parent.id)
    const { node: child2 } = await fileStore.createNode("map", { title: 'Child 2' }, parent.id)

    // Delete first child
    await fileStore.deleteNode(child1.id)

    // Verify parent's childrenIds is updated
    const updatedParent = fileStore.getNode(parent.id)
    expect(updatedParent.childrenIds).not.toContain(child1.id)
    expect(updatedParent.childrenIds).toContain(child2.id)

    // Verify child1's file is deleted
    const files = await fs.readdir(testDir)
    expect(files).not.toContain('Child 1.md')
  })

  it('preserves filename when title changes', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create a node
    const { node } = await fileStore.createNode("map", {
      title: 'Original Title',
      description: 'Test'
    }, null)

    // Get the filename (which should be ID-based)
    const idBasedFilename = `${node.id}.md`

    // Update the title and wait for it to complete
    const delta = await fileStore.updateNode(node.id, {
      title: 'New Title'
    })
    // Give filesystem time to update
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify file with ID-based name exists and no new file was created
    const files = await fs.readdir(fileStore.baseDirsByType.map)
    expect(files).toContain(idBasedFilename)
    expect(files).not.toContain('New Title.md')

    // Verify node data is preserved by getting the node from allNodes
    const updatedNode = fileStore.getNode(node.id)
    expect(updatedNode.id).toBe(node.id)
    expect(updatedNode.title).toBe('New Title')
    expect(updatedNode.filename).toBe(idBasedFilename)
    expect(updatedNode.description).toBe('Test')
  })

  it('updates calculatedMetrics when setMetrics changes', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create a node with initial readinessLevel
    const { node } = await fileStore.createNode("map", {
      title: 'Test Node',
      description: 'Test Description',
      setMetrics: { readinessLevel: 5 }
    }, null)

    // Verify initial state
    expect(node.setMetrics?.readinessLevel).toBe(5)
    expect(node.calculatedMetrics.readinessLevel).toBe(5)

    // Update readinessLevel
    const { updated } = await fileStore.updateNode(node.id, {
      setMetrics: { readinessLevel: 7 }
    })
    const updatedNode = updated[node.id]

    // Verify calculatedMetrics was updated
    expect(updatedNode.setMetrics?.readinessLevel).toBe(7)
    expect(updatedNode.calculatedMetrics.readinessLevel).toBe(7)

    // Clear setMetrics
    const { updated: cleared } = await fileStore.updateNode(node.id, {
      setMetrics: { readinessLevel: null }
    })
    const clearedNode = cleared[node.id]

    // Verify calculatedMetrics defaults to 0 when no setMetrics
    expect(clearedNode.setMetrics).toEqual({})
    expect(clearedNode.calculatedMetrics.readinessLevel).toBe(0)
  })

  it('calculates parent metrics from children', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create root node with no setMetrics (auto)
    const { node: root } = await fileStore.createNode("map", {
      title: 'Root Node'
    }, null)

    // Create two children with different readiness levels
    const { node: child1 } = await fileStore.createNode("map", {
      title: 'Child 1',
      setMetrics: { readinessLevel: 2 }
    }, root.id)

    const { node: child2 } = await fileStore.createNode("map", {
      title: 'Child 2',
      setMetrics: { readinessLevel: 3 }
    }, root.id)

    // Get the updated root node
    let updatedRoot = fileStore.getNode(root.id)

    // Root should have calculatedMetrics.readinessLevel = 2 (min of children)
    expect(updatedRoot.setMetrics).toBeUndefined()
    expect(updatedRoot.calculatedMetrics.readinessLevel).toBe(2)

    // Now force root's readiness level to 4
    await fileStore.updateNode(root.id, {
      setMetrics: { readinessLevel: 4 }
    })

    updatedRoot = fileStore.getNode(root.id)

    // Root should now have readinessLevel = 4 (manually set)
    expect(updatedRoot.setMetrics?.readinessLevel).toBe(4)
    expect(updatedRoot.calculatedMetrics.readinessLevel).toBe(4)

    // Clear root's readiness level to resume auto mode
    await fileStore.updateNode(root.id, {
      setMetrics: { readinessLevel: null }
    })

    updatedRoot = fileStore.getNode(root.id)

    // Root should return to readinessLevel = 2 (min of children)
    expect(updatedRoot.setMetrics).toEqual({})
    expect(updatedRoot.calculatedMetrics.readinessLevel).toBe(2)
  })

  it('heals files with missing data', async () => {
    const initHelper = await newTestFileStore()

    // Create an empty markdown file
    await fs.writeFile(path.join(initHelper.fileStore.baseDirsByType.map, 'test-node.md'), '')

    // now re-load and verify the node is healed
    const { fileStore, testDir } = await newTestFileStore()

    // Get all nodes
    const nodes = fileStore.allNodes

    // Verify we got exactly one node
    const nodeIds = Object.keys(nodes)
    expect(nodeIds).toHaveLength(4)

    // Get the node
    const node = Object.values(nodes).find(n => /test-node/.test(n.filename))

    // Verify the node has an id and title
    expect(node).toBeDefined()
    if (!node) throw new Error('Node not found - typescript is so dumn')
    expect(node?.id).toBeDefined()
    expect(node?.id).toMatch(/^[0-9a-f-]{36}$/) // UUID format
    expect(node?.title).toBe('test-node')

    // Verify the file was healed
    const fileContent = await fs.readFile(fileStore.getFilePath(node), 'utf-8')
    expect(fileContent).toMatch(/^---\n/)
    expect(fileContent).toMatch(/\nid: [0-9a-f-]{36}\n/)
    expect(fileContent).toMatch(/\ntitle: test-node\n/)
  })

  it('heals invalid parentIds by attaching to root', async () => {
    const initHelper = await newTestFileStore()

    // Create node with invalid parent
    await fs.writeFile(path.join(initHelper.fileStore.baseDirsByType.map, 'Orphan Node.md'), `---
id: ${uuid()}
title: Orphan Node
parentId: invalid-parent-id
childrenIds: []
calculatedMetrics:
  readinessLevel: 0
---
`)

    const { fileStore, testDir } = await newTestFileStore()
    // Get all nodes
    const nodes = fileStore.allNodes

    const mapRoot = fileStore.rootNodesByType.map

    // Find the orphan node
    const orphan = Object.values(nodes).find(n => n.title === 'Orphan Node')
    expect(orphan).toBeDefined()
    if (!orphan) throw new Error('Orphan node not found')
    expect(orphan?.parentId).toBe(mapRoot.id)

    // Verify root has the orphan as a child
    expect(nodes[mapRoot.id].childrenIds).toContain(orphan?.id)

    // Verify the orphan's file was updated
    const fileContent = await fs.readFile(fileStore.getFilePath(orphan), 'utf-8')
    expect(fileContent).toContain(`parentId: ${mapRoot.id}`)
  })

  it('handles empty and missing titles correctly', async () => {
    const initHelper = await newTestFileStore()

    // Create a node with empty title
    const { node: emptyTitleNode } = await initHelper.fileStore.createNode("map", {
      title: '',
      description: 'Node with empty title'
    })

    // Verify the node was created with empty title and ID-based filename
    expect(emptyTitleNode.title).toBe('')
    const files = await fs.readdir(initHelper.fileStore.baseDirsByType.map)
    expect(files).toContain(`${emptyTitleNode.id}.md`)

    // Verify the empty title is preserved in the file
    const emptyTitleContent = await fs.readFile(path.join(initHelper.fileStore.baseDirsByType.map, `${emptyTitleNode.id}.md`), 'utf-8')
    expect(emptyTitleContent).toContain('title: ""')

    // Create file with no title field
    await fs.writeFile(path.join(initHelper.fileStore.baseDirsByType.map, 'test-file.md'), `---
id: ${uuid()}
childrenIds: []
calculatedMetrics:
  readinessLevel: 0
---
`)

    const { fileStore, testDir } = await newTestFileStore()


    // Get all nodes and find our node
    const nodes = fileStore.allNodes
    const noTitleNode = Object.values(nodes).find(n => /test-file/.test(n.filename))
    expect(noTitleNode).toBeDefined()
    if (!noTitleNode) throw new Error('NoTitleNode not found')
    expect(noTitleNode?.title).toBe('test-file')

    // Verify the title was added to the file
    const healedContent = await fs.readFile(fileStore.getFilePath(noTitleNode), 'utf-8')
    expect(healedContent).toContain('\ntitle: test-file\n')
  })

  it('propagates readiness level changes through multiple generations', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create a three-generation hierarchy
    const { node: grandparent } = await fileStore.createNode("map", {
      title: 'Grandparent'
    }, null)

    const { node: parent } = await fileStore.createNode("map", {
      title: 'Parent'
    }, grandparent.id)

    const { node: child } = await fileStore.createNode("map", {
      title: 'Child',
      setMetrics: { readinessLevel: 2 }
    }, parent.id)

    // Verify initial state
    let nodes = fileStore.allNodes
    expect(nodes[child.id].calculatedMetrics.readinessLevel).toBe(2)
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(2)
    expect(nodes[grandparent.id].calculatedMetrics.readinessLevel).toBe(2)

    // Update child's readiness level
    await fileStore.updateNode(child.id, {
      setMetrics: { readinessLevel: 3 }
    })

    // Verify updated state
    nodes = fileStore.allNodes
    expect(nodes[child.id].calculatedMetrics.readinessLevel).toBe(3)
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(3)
    expect(nodes[grandparent.id].calculatedMetrics.readinessLevel).toBe(3)
  })

  it('excludes draft nodes from readiness level calculations', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create parent node
    const { node: parent } = await fileStore.createNode("map", {
      title: 'Parent'
    }, null)

    // Create non-draft child with RL3
    const { node: nonDraftChild } = await fileStore.createNode("map", {
      title: 'Non-draft Child',
      setMetrics: { readinessLevel: 3 }
    }, parent.id)

    // Create draft child with RL2
    const { node: draftChild } = await fileStore.createNode("map", {
      title: 'Draft Child',
      setMetrics: { readinessLevel: 2 },
      nodeState: "draft"
    }, parent.id)

    // Verify state
    const nodes = fileStore.allNodes
    expect(nodes[nonDraftChild.id].calculatedMetrics.readinessLevel).toBe(3)
    expect(nodes[draftChild.id].calculatedMetrics.readinessLevel).toBe(2)
    // Parent should only consider the non-draft child's readiness level
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(3)
  })

  it('treats readinessLevel 0 as a valid manual setting', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create parent node with RL0 explicitly set
    const { node: parent } = await fileStore.createNode("map", {
      title: 'Parent',
      setMetrics: { readinessLevel: 0 }
    }, null)

    // Create child with RL3
    const { node: child } = await fileStore.createNode("map", {
      title: 'Child',
      setMetrics: { readinessLevel: 3 }
    }, parent.id)

    // Verify state
    let nodes = fileStore.allNodes
    // Parent should keep its manually set 0, not use child's 3
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[parent.id].setMetrics?.readinessLevel).toBe(0)

    // Now clear the parent's setMetrics
    await fileStore.updateNode(parent.id, { setMetrics: { readinessLevel: null } })
    nodes = fileStore.allNodes
    // Now parent should use child's value
    expect(nodes[parent.id].setMetrics).toEqual({})
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(3)
  })

  it('properly handles readinessLevel 0 in parent calculations', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create parent node with auto metrics
    const { node: parent } = await fileStore.createNode("map", {
      title: 'Parent'
    }, null)

    // Create two children, one with RL0 and one with RL3
    const { node: child1 } = await fileStore.createNode("map", {
      title: 'Child 1',
      setMetrics: { readinessLevel: 0 }
    }, parent.id)

    const { node: child2 } = await fileStore.createNode("map", {
      title: 'Child 2',
      setMetrics: { readinessLevel: 3 }
    }, parent.id)

    // Verify state
    let nodes = fileStore.allNodes
    // Parent should use minimum of all children, including RL0
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[child1.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[child2.id].calculatedMetrics.readinessLevel).toBe(3)

    // Update child1 to auto mode
    await fileStore.updateNode(child1.id, { setMetrics: { readinessLevel: null } })
    nodes = fileStore.allNodes
    // Now parent should only consider child2's value since child1 is in auto mode
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[child1.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[child2.id].calculatedMetrics.readinessLevel).toBe(3)
  })

  it('distinguishes between readinessLevel 0 and draft mode', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create parent node with auto metrics
    const { node: parent } = await fileStore.createNode("map", {
      title: 'Parent'
    }, null)

    // Create child with RL0 (not draft)
    const { node: child1 } = await fileStore.createNode("map", {
      title: 'Child 1',
      setMetrics: { readinessLevel: 0 }
    }, parent.id)

    // Create draft child with RL3
    const { node: child2 } = await fileStore.createNode("map", {
      title: 'Child 2',
      setMetrics: { readinessLevel: 3 },
      nodeState: "draft"
    }, parent.id)

    // Create normal child with RL5
    const { node: child3 } = await fileStore.createNode("map", {
      title: 'Child 3',
      setMetrics: { readinessLevel: 5 }
    }, parent.id)

    // Verify state
    let nodes = fileStore.allNodes

    expect(nodes[child1.id].calculatedMetrics.readinessLevel).toBe(0)
    expect(nodes[child2.id].calculatedMetrics.readinessLevel).toBe(3)
    expect(nodes[child3.id].calculatedMetrics.readinessLevel).toBe(5)
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(0)

    // Now set child1 to draft mode
    await fileStore.updateNode(child1.id, { nodeState: "draft" })
    nodes = fileStore.allNodes

    // Parent should now only consider child3's value since both child1 and child2 are draft
    expect(nodes[parent.id].calculatedMetrics.readinessLevel).toBe(5)
  })

  it('handles complex readinessLevel 0 scenarios', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create a three-level hierarchy
    const { node: root } = await fileStore.createNode("map", {
      title: 'Root',
      setMetrics: { readinessLevel: 0 }  // Explicitly set to 0
    }, null)

    const { node: middle } = await fileStore.createNode("map", {
      title: 'Middle',
      setMetrics: { readinessLevel: 3 }
    }, root.id)

    const { node: leaf1 } = await fileStore.createNode("map", {
      title: 'Leaf 1',
      setMetrics: { readinessLevel: 0 }  // Explicitly set to 0
    }, middle.id)

    const { node: leaf2 } = await fileStore.createNode("map", {
      title: 'Leaf 2',
      setMetrics: { readinessLevel: 5 }
    }, middle.id)

    // Verify initial state
    let nodes = fileStore.allNodes
    expect(nodes[root.id].calculatedMetrics.readinessLevel).toBe(0)    // Manually set to 0
    expect(nodes[middle.id].calculatedMetrics.readinessLevel).toBe(3)  // Manually set to 3
    expect(nodes[leaf1.id].calculatedMetrics.readinessLevel).toBe(0)   // Manually set to 0
    expect(nodes[leaf2.id].calculatedMetrics.readinessLevel).toBe(5)   // Manually set to 5

    // Clear middle node's setMetrics
    await fileStore.updateNode(middle.id, { setMetrics: { readinessLevel: null } })
    nodes = fileStore.allNodes
    // Middle should now calculate from children (min of 0 and 5)
    expect(nodes[middle.id].calculatedMetrics.readinessLevel).toBe(0)
    // Root should still be 0 (manually set)
    expect(nodes[root.id].calculatedMetrics.readinessLevel).toBe(0)

    // Clear root's setMetrics
    await fileStore.updateNode(root.id, { setMetrics: { readinessLevel: null } })
    nodes = fileStore.allNodes
    // Root should now calculate from middle node
    expect(nodes[root.id].calculatedMetrics.readinessLevel).toBe(0)
  })

  it('correctly reorders children within the same parent', async () => {
    const { fileStore, testDir } = await newTestFileStore()

    // Create parent node
    const { node: parent } = await fileStore.createNode("map", {
      title: 'Parent',
      description: 'Parent node'
    }, null)

    // Create 4 children in sequence
    const { node: child1 } = await fileStore.createNode("map", { title: 'Child 1' }, parent.id)
    const { node: child2 } = await fileStore.createNode("map", { title: 'Child 2' }, parent.id)
    const { node: child3 } = await fileStore.createNode("map", { title: 'Child 3' }, parent.id)
    const { node: child4 } = await fileStore.createNode("map", { title: 'Child 4' }, parent.id)

    // Verify initial order
    expect(fileStore.getNode(parent.id).childrenIds).toEqual([
      child1.id, child2.id, child3.id, child4.id
    ])

    getTreeWithNodeParentChanged(fileStore.allNodes, child4.id, parent.id, 2)

    // Move child4 to position 2 (before child3)
    await fileStore.setNodeParent(child4.id, parent.id, 2)

    // Verify new order
    expect(fileStore.getNode(parent.id).childrenIds).toEqual([
      child1.id, child2.id, child4.id, child3.id
    ])
  })
})