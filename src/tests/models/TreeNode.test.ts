import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTreeWithNodeAdded,
  createNode,
  getTreeWithNodeRemoved,
  isParentOf,
  getTreeWithNodeParentChanged,
  type TreeNode,
  getTreeWithNodeUpdated
} from '../../models/TreeNode'
import { log } from '../../log'

describe('TreeNode', () => {
  let testTree: TreeNode

  beforeEach(() => {
    // Create a fresh test tree before each test
    testTree = {
      id: 'root',
      name: 'Test Root',
      readinessLevel: 1,
      children: [
        {
          id: 'child1',
          name: 'Child 1',
          readinessLevel: 2,
          children: []
        }
      ]
    }
  })

  describe('addNode', () => {
    it('should add a node to the specified parent', async () => {
      const newNode = createNode({
        name: 'New Node',
        readinessLevel: 3
      })

      const tree2 = await getTreeWithNodeAdded(testTree, newNode, 'root')

      expect(tree2.children.length).toBe(2)
      expect(tree2.children[1].name).toBe('New Node')
      expect(tree2.children[1].readinessLevel).toBe(3)
      expect(tree2.children[1].id).toBeDefined()

      // now add a node to the new node
      const newNode2 = createNode({
        name: 'New Node 2',
        readinessLevel: 4
      })

      const tree3 = await getTreeWithNodeAdded(tree2, newNode2, newNode.id)

      expect(tree3.children.length).toBe(2)
      expect(tree3.children[1].name).toBe('New Node')
      expect(tree3.children[1].children.length).toBe(1)
      expect(tree3.children[1].children[0].name).toBe('New Node 2')
      expect(tree3.children[1].children[0].id).toBeDefined()
    })

    it('should add a node at specific index', async () => {
      const newNode = createNode({
        name: 'New Node',
        readinessLevel: 3
      })

      const result = await getTreeWithNodeAdded(testTree, newNode, 'root', 0)

      expect(result.children.length).toBe(2)
      expect(result.children[0].name).toBe('New Node')
    })
  })

  describe('getTreeWithNodeRemoved', () => {
    it('should delete a node from the tree', async () => {
      expect(testTree.children.length).toBe(1)
      const { tree, removedNode } = await getTreeWithNodeRemoved(testTree, 'child1')
      expect(tree).not.toBe(testTree)
      expect(tree?.children.length).toBe(0)
      expect(tree?.children.length).toBe(0)
      expect(removedNode?.id).toBe('child1')
    })

    it('can remove root node', async () => {
      const { tree, removedNode } = await getTreeWithNodeRemoved(testTree, 'root')
      expect(tree).not.toBe(testTree)
      expect(tree).toBeNull()
      expect(removedNode?.id).toBe('root')
    })
  })

  describe('getTreeWithNodeUpdated', () => {
    it('should update node properties', async () => {
      const { tree, updatedNode } = await getTreeWithNodeUpdated(testTree, 'child1', {
        name: 'Updated Name',
        readinessLevel: 3
      })
      expect(tree).not.toBe(testTree)

      expect(updatedNode.name).toBe('Updated Name')
      expect(updatedNode.readinessLevel).toBe(3)
    })
  })

  describe('setNodeParent', () => {
    it('should move node to new parent', async () => {
      // First add a second child to root
      const intermediateTree = await getTreeWithNodeAdded(testTree, createNode({
        name: 'Child 2',
        readinessLevel: 2
      }), 'root', null)

      // Then move child1 to be under the new child2
      const newChild2Id = intermediateTree.children[1].id
      const result = await getTreeWithNodeParentChanged(intermediateTree, 'child1', newChild2Id, null)

      expect(result.children.length).toBe(1) // root now has 1 child
      expect(result.children[0].children.length).toBe(1) // child2 now has 1 child
      expect(result.children[0].children[0].id).toBe('child1') // child1 is now under child2
    })
    it('should throw error when trying to set root as child', async () => {
      await expect(getTreeWithNodeParentChanged(testTree, 'root', 'child1', null))
        .rejects.toThrow('Cannot set root node as child')
    })
    it('should throw error when trying to create circular reference', async () => {
      const child2 = createNode({
        name: 'Child 2',
        readinessLevel: 2
      })
      const intermediateTree = await getTreeWithNodeAdded(testTree, child2, 'child1', null)
      expect(isParentOf(intermediateTree, 'child1', child2.id)).toBe(true)

      await expect(getTreeWithNodeParentChanged(intermediateTree, 'child1', child2.id, null))
        .rejects.toThrow()
    })
  })


  describe('isParentOf', () => {
    it('should return true for direct parent relationship', () => {
      expect(isParentOf(testTree, 'root', 'child1')).toBe(true)
    })

    it('should return true for self-reference', () => {
      expect(isParentOf(testTree, 'root', 'root')).toBe(true)
    })

    it('should return false for non-parent relationship', () => {
      expect(isParentOf(testTree, 'child1', 'root')).toBe(false)
    })
  })
})