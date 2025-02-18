import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTreeWithNodeAdded,
  createNode,
  getTreeWithNodeRemoved,
  isParentOfInTree,
  getTreeWithNodeParentChanged,
  type TreeNode,
  getTreeWithNodeUpdated
} from '../../models/TreeNode'

describe('TreeNode', () => {
  let testTree: TreeNode

  beforeEach(() => {
    // Create a fresh test tree before each test
    testTree = {
      id: 'root',
      name: 'Test Root',
      readinessLevel: 1,
      nodeType: "problem",
      children: [
        {
          id: 'child1',
          name: 'Child 1',
          readinessLevel: 2,
          children: [],
          nodeType: "problem"
        }
      ]
    }
  })

  describe('addNode', () => {
    it('should add a node to the specified parent', () => {
      const newNode = createNode({
        name: 'New Node',
        readinessLevel: 3
      })

      const tree2 = getTreeWithNodeAdded(testTree, newNode, 'root')

      expect(tree2.children.length).toBe(2)
      expect(tree2.children[1].name).toBe('New Node')
      expect(tree2.children[1].readinessLevel).toBe(3)
      expect(tree2.children[1].id).toBeDefined()

      // now add a node to the new node
      const newNode2 = createNode({
        name: 'New Node 2',
        readinessLevel: 4
      })

      const tree3 = getTreeWithNodeAdded(tree2, newNode2, newNode.id)

      expect(tree3.children.length).toBe(2)
      expect(tree3.children[1].name).toBe('New Node')
      expect(tree3.children[1].children.length).toBe(1)
      expect(tree3.children[1].children[0].name).toBe('New Node 2')
      expect(tree3.children[1].children[0].id).toBeDefined()
    })

    it('should add a node at specific index', () => {
      const newNode = createNode({
        name: 'New Node',
        readinessLevel: 3
      })

      const result = getTreeWithNodeAdded(testTree, newNode, 'root', 0)

      expect(result.children.length).toBe(2)
      expect(result.children[0].name).toBe('New Node')
    })

    it('should add nodes at specific indexes', () => {
      // Setup a tree with multiple children
      const treeWithChildren: TreeNode = {
        id: 'root',
        name: 'Root',
        readinessLevel: 1,
        nodeType: "problem",
        children: [
          {
            id: 'child1',
            name: 'Child 1',
            readinessLevel: 2,
            children: [],
            nodeType: "problem"
          },
          {
            id: 'child2',
            name: 'Child 2',
            readinessLevel: 2,
            children: [],
            nodeType: "problem"
          }
        ]
      }

      // Test adding at index 0 (beginning)
      const newNode1 = createNode({ name: 'First', readinessLevel: 3 })
      const result1 = getTreeWithNodeAdded(treeWithChildren, newNode1, 'root', 0)
      expect(result1.children[0].name).toBe('First')
      expect(result1.children.length).toBe(3)

      // Test adding at index 1 (middle)
      const newNode2 = createNode({ name: 'Middle', readinessLevel: 3 })
      const result2 = getTreeWithNodeAdded(treeWithChildren, newNode2, 'root', 1)
      expect(result2.children[1].name).toBe('Middle')
      expect(result2.children.length).toBe(3)

      // Test adding at index > children.length (should append)
      const newNode3 = createNode({ name: 'Last', readinessLevel: 3 })
      const result3 = getTreeWithNodeAdded(treeWithChildren, newNode3, 'root', 999)
      expect(result3.children[result3.children.length - 1].name).toBe('Last')
      expect(result3.children.length).toBe(3)
    })

    it('should add node at end when index is negative', () => {
      // Setup a tree with multiple children
      const treeWithChildren: TreeNode = {
        id: 'root',
        name: 'Root',
        readinessLevel: 1,
        nodeType: "problem",
        children: [
          {
            id: 'child1',
            name: 'Child 1',
            readinessLevel: 2,
            nodeType: "problem",
            children: []
          },
          {
            id: 'child2',
            name: 'Child 2',
            readinessLevel: 2,
            nodeType: "problem",
            children: []
          }
        ]
      }

      const newNode = createNode({ name: 'Last', readinessLevel: 3 })
      const result = getTreeWithNodeAdded(treeWithChildren, newNode, 'root', -1)
      expect(result.children[result.children.length - 1].name).toBe('Last')
      expect(result.children.length).toBe(3)

      // Test with other negative numbers too
      const result2 = getTreeWithNodeAdded(treeWithChildren, newNode, 'root', -42)
      expect(result2.children[result2.children.length - 1].name).toBe('Last')
      expect(result2.children.length).toBe(3)
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
    it('should throw error when trying to set root as child', () => {
      expect(() =>
        getTreeWithNodeParentChanged(testTree, 'root', 'child1', null)
      ).toThrow('Cannot set root node as child')
    })
    it('should throw error when trying to create circular reference', () => {
      const child2 = createNode({
        name: 'Child 2',
        readinessLevel: 2
      })
      const intermediateTree = getTreeWithNodeAdded(testTree, child2, 'child1', null)
      expect(isParentOfInTree(intermediateTree, 'child1', child2.id)).toBe(true)

      expect(() =>
        getTreeWithNodeParentChanged(intermediateTree, 'child1', child2.id, null)
      ).toThrow('Cannot set node as its own child')
    })
  })


  describe('isParentOf', () => {
    it('should return true for direct parent relationship', () => {
      expect(isParentOfInTree(testTree, 'root', 'child1')).toBe(true)
    })

    it('should return true for self-reference', () => {
      expect(isParentOfInTree(testTree, 'root', 'root')).toBe(true)
    })

    it('should return false for non-parent relationship', () => {
      expect(isParentOfInTree(testTree, 'child1', 'root')).toBe(false)
    })
  })
})