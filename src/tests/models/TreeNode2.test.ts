import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTreeWithNodeAdded,
  createNode,
  getTreeWithNodeRemoved,
  getTreeWithNodeUpdated,
  getTreeWithNodeParentChanged,
  isParentOfInTree,
  type TreeNode2,
  type TreeNodeMap
} from '../../models/TreeNode2'

describe('TreeNode2', () => {
  let testNodes: TreeNodeMap

  beforeEach(() => {
    // Create a fresh test tree before each test
    const rootNode = createNode({
      title: 'Test Root',
      setMetrics: { readinessLevel: 1 }
    })
    const child1 = createNode({
      title: 'Child 1',
      setMetrics: { readinessLevel: 2 }
    }, rootNode.id)

    testNodes = {
      [rootNode.id]: { ...rootNode, childrenIds: [child1.id], calculatedMetrics: { readinessLevel: 2 } },
      [child1.id]: { ...child1, calculatedMetrics: { readinessLevel: 0 } }
    }
  })

  describe('getTreeWithNodeAdded', () => {
    it('should add a node to the specified parent', () => {
      const newNode = createNode({
        title: 'New Node',
        setMetrics: { readinessLevel: 3 }
      })

      const nodes2 = getTreeWithNodeAdded(testNodes, newNode, Object.keys(testNodes)[0])

      const rootNode = nodes2[Object.keys(testNodes)[0]]
      expect(rootNode.childrenIds.length).toBe(2)
      const newAddedNode = nodes2[newNode.id]
      expect(newAddedNode.title).toBe('New Node')
      expect(newAddedNode.calculatedMetrics.readinessLevel).toBe(0)
      expect(newAddedNode.id).toBeDefined()

      // now add a node to the new node
      const newNode2 = createNode({
        title: 'New Node 2',
        setMetrics: { readinessLevel: 4 }
      })

      const nodes3 = getTreeWithNodeAdded(nodes2, newNode2, newNode.id)

      const rootNode3 = nodes3[Object.keys(testNodes)[0]]
      expect(rootNode3.childrenIds.length).toBe(2)
      const newNode3 = nodes3[newNode.id]
      expect(newNode3.title).toBe('New Node')
      expect(newNode3.childrenIds.length).toBe(1)
      const newNode2Added = nodes3[newNode2.id]
      expect(newNode2Added.title).toBe('New Node 2')
      expect(newNode2Added.id).toBeDefined()
      expect(newNode2Added.calculatedMetrics.readinessLevel).toBe(0)
      expect(newNode3.calculatedMetrics.readinessLevel).toBe(0)
    })

    it('should add a node at specific index', () => {
      const newNode = createNode({
        title: 'New Node',
        setMetrics: { readinessLevel: 3 }
      })

      const rootId = Object.keys(testNodes)[0]
      const nodes2 = getTreeWithNodeAdded(testNodes, newNode, rootId, 0)

      const rootNode = nodes2[rootId]
      expect(rootNode.childrenIds.length).toBe(2)
      expect(rootNode.childrenIds[0]).toBe(newNode.id)
      const newAddedNode = nodes2[newNode.id]
      expect(newAddedNode.title).toBe('New Node')
      expect(newAddedNode.calculatedMetrics.readinessLevel).toBe(0)
    })

    it('should add nodes at multiple indexes', () => {
      // Setup a tree with multiple children
      const rootId = Object.keys(testNodes)[0]
      const child2 = createNode({
        title: 'Child 2',
        setMetrics: { readinessLevel: 2 }
      })
      const nodesWithTwoChildren = getTreeWithNodeAdded(testNodes, child2, rootId)

      // Test adding at index 0 (beginning)
      const newNode1 = createNode({ title: 'First', setMetrics: { readinessLevel: 3 } })
      const result1 = getTreeWithNodeAdded(nodesWithTwoChildren, newNode1, rootId, 0)
      expect(result1[rootId].childrenIds[0]).toBe(newNode1.id)
      expect(result1[rootId].childrenIds.length).toBe(3)

      // Test adding at index 1 (middle)
      const newNode2 = createNode({ title: 'Middle', setMetrics: { readinessLevel: 3 } })
      const result2 = getTreeWithNodeAdded(nodesWithTwoChildren, newNode2, rootId, 1)
      expect(result2[rootId].childrenIds[1]).toBe(newNode2.id)
      expect(result2[rootId].childrenIds.length).toBe(3)

      // Test adding at index > children.length (should append)
      const newNode3 = createNode({ title: 'Last', setMetrics: { readinessLevel: 3 } })
      const result3 = getTreeWithNodeAdded(nodesWithTwoChildren, newNode3, rootId, 999)
      expect(result3[rootId].childrenIds[result3[rootId].childrenIds.length - 1]).toBe(newNode3.id)
      expect(result3[rootId].childrenIds.length).toBe(3)
    })

    it('should add node at end when index is negative', () => {
      // Setup a tree with multiple children
      const rootId = Object.keys(testNodes)[0]
      const child2 = createNode({
        title: 'Child 2',
        setMetrics: { readinessLevel: 2 }
      })
      const nodesWithTwoChildren = getTreeWithNodeAdded(testNodes, child2, rootId)

      const newNode = createNode({ title: 'Last', setMetrics: { readinessLevel: 3 } })
      const result = getTreeWithNodeAdded(nodesWithTwoChildren, newNode, rootId, -1)
      expect(result[rootId].childrenIds[result[rootId].childrenIds.length - 1]).toBe(newNode.id)
      expect(result[rootId].childrenIds.length).toBe(3)

      // Test with other negative numbers too
      const newNode2 = createNode({ title: 'Last 2', setMetrics: { readinessLevel: 3 } })
      const result2 = getTreeWithNodeAdded(nodesWithTwoChildren, newNode2, rootId, -42)
      expect(result2[rootId].childrenIds[result2[rootId].childrenIds.length - 1]).toBe(newNode2.id)
      expect(result2[rootId].childrenIds.length).toBe(3)
    })

    it('should add nodes at deeper levels and update metrics correctly', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Add a grandchild
      const grandChild = createNode({
        title: 'Grandchild',
        setMetrics: { readinessLevel: 3 }
      })
      const nodesWithGrandchild = getTreeWithNodeAdded(testNodes, grandChild, child1Id)

      // Verify structure
      expect(nodesWithGrandchild[child1Id].childrenIds.length).toBe(1)
      expect(nodesWithGrandchild[child1Id].childrenIds[0]).toBe(grandChild.id)
      expect(nodesWithGrandchild[grandChild.id].parentId).toBe(child1Id)

      // Add a great-grandchild
      const greatGrandChild = createNode({
        title: 'Great Grandchild',
        setMetrics: { readinessLevel: 4 }
      })
      const nodesWithGreatGrandchild = getTreeWithNodeAdded(nodesWithGrandchild, greatGrandChild, grandChild.id)

      // Verify structure
      expect(nodesWithGreatGrandchild[grandChild.id].childrenIds.length).toBe(1)
      expect(nodesWithGreatGrandchild[grandChild.id].childrenIds[0]).toBe(greatGrandChild.id)
      expect(nodesWithGreatGrandchild[greatGrandChild.id].parentId).toBe(grandChild.id)

      // Verify metrics are propagated up
      expect(nodesWithGreatGrandchild[greatGrandChild.id].calculatedMetrics.readinessLevel).toBe(0)
      expect(nodesWithGreatGrandchild[grandChild.id].calculatedMetrics.readinessLevel).toBe(0)
      expect(nodesWithGreatGrandchild[child1Id].calculatedMetrics.readinessLevel).toBe(0)
      expect(nodesWithGreatGrandchild[rootId].calculatedMetrics.readinessLevel).toBe(0)
    })
  })

  describe('getTreeWithNodeRemoved', () => {
    it('should delete a node from the tree', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      expect(testNodes[rootId].childrenIds.length).toBe(1)
      const nodes2 = getTreeWithNodeRemoved(testNodes, child1Id)
      expect(nodes2).not.toBe(testNodes)
      expect(nodes2[rootId].childrenIds.length).toBe(0)
      expect(nodes2[child1Id]).toBeUndefined()
    })

    it('can remove root node', () => {
      const rootId = Object.keys(testNodes)[0]
      const nodes2 = getTreeWithNodeRemoved(testNodes, rootId)
      expect(nodes2).not.toBe(testNodes)
      expect(Object.keys(nodes2).length).toBe(0)
    })

    it('should remove nodes from deeper levels and update metrics correctly', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Setup a deep tree
      const grandChild = createNode({
        title: 'Grandchild',
        setMetrics: { readinessLevel: 3 }
      })
      const nodesWithGrandchild = getTreeWithNodeAdded(testNodes, grandChild, child1Id)

      const greatGrandChild = createNode({
        title: 'Great Grandchild',
        setMetrics: { readinessLevel: 4 }
      })
      const deepTree = getTreeWithNodeAdded(nodesWithGrandchild, greatGrandChild, grandChild.id)

      // Remove the grandchild (which should also remove the great-grandchild)
      const result = getTreeWithNodeRemoved(deepTree, grandChild.id)

      // Verify structure
      expect(result[child1Id].childrenIds.length).toBe(0)
      expect(result[grandChild.id]).toBeUndefined()
      expect(result[greatGrandChild.id]).toBeUndefined()

      // Verify metrics are updated
      expect(result[child1Id].calculatedMetrics.readinessLevel).toBe(0)
      expect(result[rootId].calculatedMetrics.readinessLevel).toBe(0)
    })

    it('should remove all children when removing a parent node', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Add multiple children to child1
      const grandChild1 = createNode({
        title: 'Grandchild 1',
        setMetrics: { readinessLevel: 3 }
      })
      const treeWithGrandchild1 = getTreeWithNodeAdded(testNodes, grandChild1, child1Id)

      const grandChild2 = createNode({
        title: 'Grandchild 2',
        setMetrics: { readinessLevel: 4 }
      })
      const treeWithGrandchild2 = getTreeWithNodeAdded(treeWithGrandchild1, grandChild2, child1Id)

      const grandChild3 = createNode({
        title: 'Grandchild 3',
        setMetrics: { readinessLevel: 5 }
      })
      const treeWithAllGrandchildren = getTreeWithNodeAdded(treeWithGrandchild2, grandChild3, child1Id)

      // Verify initial structure
      expect(treeWithAllGrandchildren[child1Id].childrenIds.length).toBe(3)
      expect(Object.keys(treeWithAllGrandchildren).length).toBe(5) // root, child1, and 3 grandchildren

      // Remove child1
      const result = getTreeWithNodeRemoved(treeWithAllGrandchildren, child1Id)

      // Verify all nodes are removed
      expect(result[child1Id]).toBeUndefined()
      expect(result[grandChild1.id]).toBeUndefined()
      expect(result[grandChild2.id]).toBeUndefined()
      expect(result[grandChild3.id]).toBeUndefined()
      expect(Object.keys(result).length).toBe(1) // only root remains
      expect(result[rootId].childrenIds.length).toBe(0)
      expect(result[rootId].calculatedMetrics.readinessLevel).toBe(0)
    })
  })

  describe('getTreeWithNodeUpdated', () => {
    it('should update node properties', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      const nodes2 = getTreeWithNodeUpdated(testNodes, child1Id, {
        title: 'Updated Name',
        setMetrics: { readinessLevel: 3 }
      })
      expect(nodes2).not.toBe(testNodes)

      const updatedNode = nodes2[child1Id]
      expect(updatedNode.title).toBe('Updated Name')
      expect(updatedNode.setMetrics?.readinessLevel).toBe(3)
    })
  })

  describe('getTreeWithNodeParentChanged', () => {
    it('should move node to new parent', () => {
      // First add a second child to root
      const rootId = Object.keys(testNodes)[0]
      const child2 = createNode({
        title: 'Child 2',
        setMetrics: { readinessLevel: 2 }
      })
      const nodesWithTwoChildren = getTreeWithNodeAdded(testNodes, child2, rootId)

      // Then move child1 to be under the new child2
      const child1Id = testNodes[rootId].childrenIds[0]
      const result = getTreeWithNodeParentChanged(nodesWithTwoChildren, child1Id, child2.id)

      expect(result[rootId].childrenIds.length).toBe(1) // root now has 1 child
      expect(result[child2.id].childrenIds.length).toBe(1) // child2 now has 1 child
      expect(result[child2.id].childrenIds[0]).toBe(child1Id) // child1 is now under child2
    })

    it('should throw error when trying to set root as child', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]
      expect(() =>
        getTreeWithNodeParentChanged(testNodes, rootId, child1Id)
      ).toThrow('Cannot move a node to one of its descendants')
    })

    it('should throw error when trying to create circular reference', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]
      const child2 = createNode({
        title: 'Child 2',
        setMetrics: { readinessLevel: 2 }
      })
      const nodesWithTwoChildren = getTreeWithNodeAdded(testNodes, child2, child1Id)

      expect(() =>
        getTreeWithNodeParentChanged(nodesWithTwoChildren, child1Id, child2.id)
      ).toThrow('Cannot move a node to one of its descendants')
    })
  })

  describe('isParentOfInTree', () => {
    it('should return true for direct parent relationship', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]
      expect(isParentOfInTree(testNodes, rootId, child1Id)).toBe(true)
    })

    it('should return false for non-parent relationship', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]
      expect(isParentOfInTree(testNodes, child1Id, rootId)).toBe(false)
    })

    it('should return true for indirect parent relationship', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]
      const child2 = createNode({
        title: 'Child 2',
        setMetrics: { readinessLevel: 2 }
      })
      const nodesWithTwoLevels = getTreeWithNodeAdded(testNodes, child2, child1Id)

      expect(isParentOfInTree(nodesWithTwoLevels, rootId, child2.id)).toBe(true)
    })
  })
})