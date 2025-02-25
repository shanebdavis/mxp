import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTreeWithNodeAdded,
  createNode,
  getTreeWithNodeRemoved,
  getTreeWithNodeUpdated,
  getTreeWithNodeParentChanged,
  isParentOfInTree,
  type TreeNode,
  type TreeNodeMap,
  NodeType,
  inspectTree
} from '../../models'
import { log } from '../../ArtStandardLib'

describe('TreeNode', () => {
  let testNodes: TreeNodeMap
  let rootNodeId: string

  beforeEach(() => {
    // Create a fresh test tree before each test
    const rootNode = createNode("map", {
      title: 'Test Root',
    })
    rootNodeId = rootNode.id
    const child1 = createNode("map", {
      title: 'Child 1',
    }, rootNode.id)

    testNodes = {
      [rootNode.id]: { ...rootNode, childrenIds: [child1.id] },
      [child1.id]: { ...child1 }
    }
  })

  describe('getTreeWithNodeAdded', () => {
    it('should add a node to the specified parent', () => {
      const newNode = createNode("map", {
        title: 'New Node',
        setMetrics: { readinessLevel: 3 }
      })

      const nodes2 = getTreeWithNodeAdded(testNodes, newNode, Object.keys(testNodes)[0])

      const rootNode = nodes2[Object.keys(testNodes)[0]]
      expect(rootNode.childrenIds.length).toBe(2)
      const newAddedNode = nodes2[newNode.id]
      expect(newAddedNode.title).toBe('New Node')
      expect(newAddedNode.calculatedMetrics.readinessLevel).toBe(3)
      expect(newAddedNode.id).toBeDefined()

      // now add a node to the new node
      const newNode2 = createNode("map", {
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
      expect(newNode2Added.calculatedMetrics.readinessLevel).toBe(4)
      expect(newNode3.calculatedMetrics.readinessLevel).toBe(3)
    })

    it('should add a node at specific index', () => {
      const newNode = createNode("map", {
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
      expect(newAddedNode.calculatedMetrics.readinessLevel).toBe(3)
    })

    it('should add nodes at multiple indexes', () => {
      // Setup a tree with multiple children
      const rootId = Object.keys(testNodes)[0]
      const child2 = createNode("map", {
        title: 'Child 2',
        setMetrics: { readinessLevel: 2 }
      })
      const nodesWithTwoChildren = getTreeWithNodeAdded(testNodes, child2, rootId)

      // Test adding at index 0 (beginning)
      const newNode1 = createNode("map", {
        title: 'First',
        setMetrics: { readinessLevel: 3 }
      })
      const result1 = getTreeWithNodeAdded(nodesWithTwoChildren, newNode1, rootId, 0)
      expect(result1[rootId].childrenIds[0]).toBe(newNode1.id)
      expect(result1[rootId].childrenIds.length).toBe(3)

      // Test adding at index 1 (middle)
      const newNode2 = createNode("map", {
        title: 'Middle',
        setMetrics: { readinessLevel: 3 }
      })
      const result2 = getTreeWithNodeAdded(nodesWithTwoChildren, newNode2, rootId, 1)
      expect(result2[rootId].childrenIds[1]).toBe(newNode2.id)
      expect(result2[rootId].childrenIds.length).toBe(3)

      // Test adding at index > children.length (should append)
      const newNode3 = createNode("map", {
        title: 'Last',
        setMetrics: { readinessLevel: 3 }
      })
      const result3 = getTreeWithNodeAdded(nodesWithTwoChildren, newNode3, rootId, 999)
      expect(result3[rootId].childrenIds[result3[rootId].childrenIds.length - 1]).toBe(newNode3.id)
      expect(result3[rootId].childrenIds.length).toBe(3)
    })

    it('should add node at end when index is negative', () => {
      // Setup a tree with multiple children
      const rootId = Object.keys(testNodes)[0]
      const child2 = createNode("map", {
        title: 'Child 2',
        setMetrics: { readinessLevel: 2 }
      })
      const nodesWithTwoChildren = getTreeWithNodeAdded(testNodes, child2, rootId)

      const newNode = createNode("map", {
        title: 'Last',
        setMetrics: { readinessLevel: 3 }
      })
      const result = getTreeWithNodeAdded(nodesWithTwoChildren, newNode, rootId, -1)
      expect(result[rootId].childrenIds[result[rootId].childrenIds.length - 1]).toBe(newNode.id)
      expect(result[rootId].childrenIds.length).toBe(3)

      // Test with other negative numbers too
      const newNode2 = createNode("map", {
        title: 'Last 2',
        setMetrics: { readinessLevel: 3 }
      })
      const result2 = getTreeWithNodeAdded(nodesWithTwoChildren, newNode2, rootId, -42)
      expect(result2[rootId].childrenIds[result2[rootId].childrenIds.length - 1]).toBe(newNode2.id)
      expect(result2[rootId].childrenIds.length).toBe(3)
    })

    it('should add nodes at deeper levels and update metrics correctly', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Add a grandchild
      const grandChild = createNode("map", {
        title: 'Grandchild',
        setMetrics: { readinessLevel: 3 }
      })
      const nodesWithGrandchild = getTreeWithNodeAdded(testNodes, grandChild, child1Id)

      // Verify structure
      expect(nodesWithGrandchild[child1Id].childrenIds.length).toBe(1)
      expect(nodesWithGrandchild[child1Id].childrenIds[0]).toBe(grandChild.id)
      expect(nodesWithGrandchild[grandChild.id].parentId).toBe(child1Id)

      // Add a great-grandchild
      const greatGrandChild = createNode("map", {
        title: 'Great Grandchild',
        setMetrics: { readinessLevel: 4 }
      })
      const nodesWithGreatGrandchild = getTreeWithNodeAdded(nodesWithGrandchild, greatGrandChild, grandChild.id)

      // Verify structure
      expect(nodesWithGreatGrandchild[grandChild.id].childrenIds.length).toBe(1)
      expect(nodesWithGreatGrandchild[grandChild.id].childrenIds[0]).toBe(greatGrandChild.id)
      expect(nodesWithGreatGrandchild[greatGrandChild.id].parentId).toBe(grandChild.id)

      // Verify metrics are propagated up
      expect(nodesWithGreatGrandchild[greatGrandChild.id].calculatedMetrics.readinessLevel).toBe(4)
      expect(nodesWithGreatGrandchild[grandChild.id].calculatedMetrics.readinessLevel).toBe(3)
      expect(nodesWithGreatGrandchild[child1Id].calculatedMetrics.readinessLevel).toBe(3)
      expect(nodesWithGreatGrandchild[rootId].calculatedMetrics.readinessLevel).toBe(3)
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
      const grandChild = createNode("map", {
        title: 'Grandchild',
        setMetrics: { readinessLevel: 3 }
      })
      const nodesWithGrandchild = getTreeWithNodeAdded(testNodes, grandChild, child1Id)

      const greatGrandChild = createNode("map", {
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
      const grandChild1 = createNode("map", {
        title: 'Grandchild 1',
        setMetrics: { readinessLevel: 3 }
      })
      const treeWithGrandchild1 = getTreeWithNodeAdded(testNodes, grandChild1, child1Id)

      const grandChild2 = createNode("map", {
        title: 'Grandchild 2',
        setMetrics: { readinessLevel: 4 }
      })
      const treeWithGrandchild2 = getTreeWithNodeAdded(treeWithGrandchild1, grandChild2, child1Id)

      const grandChild3 = createNode("map", {
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

    it('should handle setting and clearing readinessLevel', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Set readinessLevel
      const nodesWithSet = getTreeWithNodeUpdated(testNodes, child1Id, {
        setMetrics: { readinessLevel: 3 }
      })
      expect(nodesWithSet[child1Id].setMetrics?.readinessLevel).toBe(3)
      expect(nodesWithSet[child1Id].calculatedMetrics.readinessLevel).toBe(3)

      // Clear readinessLevel by setting to undefined
      const nodesWithCleared = getTreeWithNodeUpdated(nodesWithSet, child1Id, {
        setMetrics: { readinessLevel: null as any }
      })
      expect(nodesWithCleared[child1Id].setMetrics?.readinessLevel).toBeUndefined()
      expect(nodesWithCleared[child1Id].calculatedMetrics.readinessLevel).toBe(0) // No children, so defaults to 0
    })

    it('should calculate metrics correctly with mixed auto and set values', () => {
      const rootNode = testNodes[rootNodeId]
      const child1Id = rootNode.childrenIds[0]
      expect(rootNode.calculatedMetrics.readinessLevel).toBe(0)
      expect(testNodes[child1Id].calculatedMetrics.readinessLevel).toBe(0)

      // Add two grandchildren to child1
      const grandChild1 = createNode("map", {
        title: 'Grandchild 1',
        setMetrics: { readinessLevel: 4 }
      })
      const nodesWithGrandchild1 = getTreeWithNodeAdded(testNodes, grandChild1, child1Id)
      expect(nodesWithGrandchild1[child1Id].calculatedMetrics.readinessLevel).toBe(4)

      const grandChild2 = createNode("map", {
        title: 'Grandchild 2',
      })
      const nodesWithBothGrandchildren = getTreeWithNodeAdded(nodesWithGrandchild1, grandChild2, child1Id)

      // Add two great-grandchildren to grandChild1
      const greatGrandChild1 = createNode("map", {
        title: 'Great Grandchild 1',
        setMetrics: { readinessLevel: 1 }
      })
      const nodesWithGreatGrandchild1 = getTreeWithNodeAdded(nodesWithBothGrandchildren, greatGrandChild1, grandChild2.id)

      const greatGrandChild2 = createNode("map", {
        title: 'Great Grandchild 2',
        setMetrics: { readinessLevel: 3 }
      })
      const nodes = getTreeWithNodeAdded(nodesWithGreatGrandchild1, greatGrandChild2, grandChild2.id)

      // Initial state verification
      expect(nodes[grandChild1.id].calculatedMetrics.readinessLevel).toBe(4) // Min of its children (1, 3)
      expect(nodes[grandChild2.id].calculatedMetrics.readinessLevel).toBe(1) // Directly set
      expect(nodes[child1Id].calculatedMetrics.readinessLevel).toBe(1) // Min of grandchildren (1, 2)

      // Set grandChild1 to auto by clearing its setMetrics
      const nodesWithAuto = getTreeWithNodeUpdated(nodes, grandChild1.id, {
        setMetrics: { readinessLevel: null as any }
      })
      expect(nodesWithAuto[grandChild1.id].setMetrics?.readinessLevel).toBeUndefined()
      expect(nodesWithAuto[grandChild1.id].calculatedMetrics.readinessLevel).toBe(0) // Still 1 (min of children)
      expect(nodesWithAuto[child1Id].calculatedMetrics.readinessLevel).toBe(0) // Still 1 (min of 1 and 2)

      // Set grandChild1 to override its children
      const nodesWithOverride = getTreeWithNodeUpdated(nodesWithAuto, grandChild1.id, {
        setMetrics: { readinessLevel: 5 }
      })
      expect(nodesWithOverride[grandChild1.id].setMetrics?.readinessLevel).toBe(5)
      expect(nodesWithOverride[grandChild1.id].calculatedMetrics.readinessLevel).toBe(5) // Overridden to 5
      expect(nodesWithOverride[child1Id].calculatedMetrics.readinessLevel).toBe(1) // Min of 5 and 2
    })
  })

  describe('getTreeWithNodeParentChanged', () => {
    it('should move node to new parent', () => {
      // First add a second child to root
      const rootId = Object.keys(testNodes)[0]
      const child2 = createNode("map", {
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
      const child2 = createNode("map", {
        title: 'Child 2',
        setMetrics: { readinessLevel: 2 }
      })
      const nodesWithTwoChildren = getTreeWithNodeAdded(testNodes, child2, child1Id)

      expect(() =>
        getTreeWithNodeParentChanged(nodesWithTwoChildren, child1Id, child2.id)
      ).toThrow('Cannot move a node to one of its descendants')
    })

    it('correctly reorders children within the same parent', async () => {
      let nodes: TreeNodeMap = testNodes

      const addNode = (title: string, parentId: string) => {
        const node = createNode("map", { title, description: 'Child node' })
        nodes = getTreeWithNodeAdded(nodes, node, parentId)
        return node
      }

      // Create parent node
      const parent = addNode('Parent', rootNodeId)

      // Create 4 children in sequence
      const child1 = addNode('Child 1', parent.id)
      const child2 = addNode('Child 2', parent.id)
      const child3 = addNode('Child 3', parent.id)
      const child4 = addNode('Child 4', parent.id)

      // Verify initial order
      expect(nodes[parent.id].childrenIds).toEqual([
        child1.id, child2.id, child3.id, child4.id
      ])

      // Move child4 to position 2 (before child3)
      nodes = getTreeWithNodeParentChanged(nodes, child4.id, parent.id, 2)

      // Verify new order
      expect(nodes[parent.id].childrenIds).toEqual([
        child1.id, child2.id, child4.id, child3.id
      ])
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
      const child2 = createNode("map", {
        title: 'Child 2',
        setMetrics: { readinessLevel: 2 }
      })
      const nodesWithTwoLevels = getTreeWithNodeAdded(testNodes, child2, child1Id)

      expect(isParentOfInTree(nodesWithTwoLevels, rootId, child2.id)).toBe(true)
    })
  })

  describe('NodeType', () => {
    it('should default to Map type when not specified', () => {
      const node = createNode("map", { title: 'Test Node' })
      expect(node.type).toBe("map")
    })

    it('should allow setting different node types', () => {
      const waypoint = createNode("waypoint", { title: 'Waypoint Node' })
      expect(waypoint.type).toBe("waypoint")

      const user = createNode("user", { title: 'User Node' })
      expect(user.type).toBe("user")
    })

    it('should preserve node type through tree operations', () => {
      const rootId = Object.keys(testNodes)[0]

      // Add a waypoint node
      const waypoint = createNode("waypoint", { title: 'Waypoint' })
      const treeWithWaypoint = getTreeWithNodeAdded(testNodes, waypoint, rootId)
      expect(treeWithWaypoint[waypoint.id].type).toBe("waypoint")

      // Update the waypoint node
      const updatedTree = getTreeWithNodeUpdated(treeWithWaypoint, waypoint.id, { title: 'Updated Waypoint' })
      expect(updatedTree[waypoint.id].type).toBe("waypoint")

      // Move the waypoint node
      const user = createNode("user", { title: 'User' })
      const treeWithUser = getTreeWithNodeAdded(updatedTree, user, rootId)
      const movedTree = getTreeWithNodeParentChanged(treeWithUser, waypoint.id, user.id)
      expect(movedTree[waypoint.id].type).toBe("waypoint")
      expect(movedTree[user.id].type).toBe("user")
    })
  })
})