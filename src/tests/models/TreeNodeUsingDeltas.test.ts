import { describe, it, expect, beforeEach } from 'vitest'
import {
  createNode,
  getTreeNodeSetDeltaForNodeAdded,
  getTreeNodeSetDeltaForNodeRemoved,
  getTreeNodeSetDeltaForNodeUpdated,
  getTreeNodeSetDeltaForNodeParentChanged,
  getTreeNodeSetWithDeltaApplied,
  isParentOfInTree,
  type TreeNodeSet,
  getTreeNodeSetDeltaWithUpdatedNodeMetrics,
} from '../../models'

describe('TreeNode using Deltas', () => {
  let testNodes: TreeNodeSet
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

  describe('getTreeNodeSetDeltaForNodeAdded', () => {
    it('should add a node to the specified parent', () => {
      const newNode = createNode("map", {
        title: 'New Node',
        setMetrics: { readinessLevel: 3 }
      })

      const delta = getTreeNodeSetDeltaForNodeAdded(testNodes, newNode, Object.keys(testNodes)[0])
      const nodes2 = getTreeNodeSetWithDeltaApplied(testNodes, delta)

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

      const delta2 = getTreeNodeSetDeltaForNodeAdded(nodes2, newNode2, newNode.id)
      const nodes3 = getTreeNodeSetWithDeltaApplied(nodes2, delta2)

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
      const delta = getTreeNodeSetDeltaForNodeAdded(testNodes, newNode, rootId, 0)
      const nodes2 = getTreeNodeSetWithDeltaApplied(testNodes, delta)

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
      const delta1 = getTreeNodeSetDeltaForNodeAdded(testNodes, child2, rootId)
      const nodesWithTwoChildren = getTreeNodeSetWithDeltaApplied(testNodes, delta1)

      // Test adding at index 0 (beginning)
      const newNode1 = createNode("map", {
        title: 'First',
        setMetrics: { readinessLevel: 3 }
      })
      const delta2 = getTreeNodeSetDeltaForNodeAdded(nodesWithTwoChildren, newNode1, rootId, 0)
      const result1 = getTreeNodeSetWithDeltaApplied(nodesWithTwoChildren, delta2)
      expect(result1[rootId].childrenIds[0]).toBe(newNode1.id)
      expect(result1[rootId].childrenIds.length).toBe(3)

      // Test adding at index 1 (middle)
      const newNode2 = createNode("map", {
        title: 'Middle',
        setMetrics: { readinessLevel: 3 }
      })
      const delta3 = getTreeNodeSetDeltaForNodeAdded(nodesWithTwoChildren, newNode2, rootId, 1)
      const result2 = getTreeNodeSetWithDeltaApplied(nodesWithTwoChildren, delta3)
      expect(result2[rootId].childrenIds[1]).toBe(newNode2.id)
      expect(result2[rootId].childrenIds.length).toBe(3)

      // Test adding at index > children.length (should append)
      const newNode3 = createNode("map", {
        title: 'Last',
        setMetrics: { readinessLevel: 3 }
      })
      const delta4 = getTreeNodeSetDeltaForNodeAdded(nodesWithTwoChildren, newNode3, rootId, 999)
      const result3 = getTreeNodeSetWithDeltaApplied(nodesWithTwoChildren, delta4)
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
      const delta1 = getTreeNodeSetDeltaForNodeAdded(testNodes, child2, rootId)
      const nodesWithTwoChildren = getTreeNodeSetWithDeltaApplied(testNodes, delta1)

      const newNode = createNode("map", {
        title: 'Last',
        setMetrics: { readinessLevel: 3 }
      })
      const delta2 = getTreeNodeSetDeltaForNodeAdded(nodesWithTwoChildren, newNode, rootId, -1)
      const result = getTreeNodeSetWithDeltaApplied(nodesWithTwoChildren, delta2)
      expect(result[rootId].childrenIds[result[rootId].childrenIds.length - 1]).toBe(newNode.id)
      expect(result[rootId].childrenIds.length).toBe(3)

      // Test with other negative numbers too
      const newNode2 = createNode("map", {
        title: 'Last 2',
        setMetrics: { readinessLevel: 3 }
      })
      const delta3 = getTreeNodeSetDeltaForNodeAdded(nodesWithTwoChildren, newNode2, rootId, -42)
      const result2 = getTreeNodeSetWithDeltaApplied(nodesWithTwoChildren, delta3)
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
      const delta1 = getTreeNodeSetDeltaForNodeAdded(testNodes, grandChild, child1Id)
      const nodesWithGrandchild = getTreeNodeSetWithDeltaApplied(testNodes, delta1)

      // Verify structure
      expect(nodesWithGrandchild[child1Id].childrenIds.length).toBe(1)
      expect(nodesWithGrandchild[child1Id].childrenIds[0]).toBe(grandChild.id)
      expect(nodesWithGrandchild[grandChild.id].parentId).toBe(child1Id)

      // Add a great-grandchild
      const greatGrandChild = createNode("map", {
        title: 'Great Grandchild',
        setMetrics: { readinessLevel: 4 }
      })
      const delta2 = getTreeNodeSetDeltaForNodeAdded(nodesWithGrandchild, greatGrandChild, grandChild.id)
      const nodesWithGreatGrandchild = getTreeNodeSetWithDeltaApplied(nodesWithGrandchild, delta2)

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

  describe('getTreeNodeSetDeltaForNodeRemoved', () => {
    it('should delete a node from the tree', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      expect(testNodes[rootId].childrenIds.length).toBe(1)
      const delta = getTreeNodeSetDeltaForNodeRemoved(testNodes, child1Id)
      const nodes2 = getTreeNodeSetWithDeltaApplied(testNodes, delta)
      expect(nodes2).not.toBe(testNodes)
      expect(nodes2[rootId].childrenIds.length).toBe(0)
      expect(nodes2[child1Id]).toBeUndefined()
    })

    it('can remove root node', () => {
      const rootId = Object.keys(testNodes)[0]
      const delta = getTreeNodeSetDeltaForNodeRemoved(testNodes, rootId)
      const nodes2 = getTreeNodeSetWithDeltaApplied(testNodes, delta)
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
      const delta1 = getTreeNodeSetDeltaForNodeAdded(testNodes, grandChild, child1Id)
      const nodesWithGrandchild = getTreeNodeSetWithDeltaApplied(testNodes, delta1)

      const greatGrandChild = createNode("map", {
        title: 'Great Grandchild',
        setMetrics: { readinessLevel: 4 }
      })
      const delta2 = getTreeNodeSetDeltaForNodeAdded(nodesWithGrandchild, greatGrandChild, grandChild.id)
      const deepTree = getTreeNodeSetWithDeltaApplied(nodesWithGrandchild, delta2)

      // Remove the grandchild (which should also remove the great-grandchild)
      const delta3 = getTreeNodeSetDeltaForNodeRemoved(deepTree, grandChild.id)
      const result = getTreeNodeSetWithDeltaApplied(deepTree, delta3)

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
      const delta1 = getTreeNodeSetDeltaForNodeAdded(testNodes, grandChild1, child1Id)
      const treeWithGrandchild1 = getTreeNodeSetWithDeltaApplied(testNodes, delta1)

      const grandChild2 = createNode("map", {
        title: 'Grandchild 2',
        setMetrics: { readinessLevel: 4 }
      })
      const delta2 = getTreeNodeSetDeltaForNodeAdded(treeWithGrandchild1, grandChild2, child1Id)
      const treeWithGrandchild2 = getTreeNodeSetWithDeltaApplied(treeWithGrandchild1, delta2)

      const grandChild3 = createNode("map", {
        title: 'Grandchild 3',
        setMetrics: { readinessLevel: 5 }
      })
      const delta3 = getTreeNodeSetDeltaForNodeAdded(treeWithGrandchild2, grandChild3, child1Id)
      const treeWithAllGrandchildren = getTreeNodeSetWithDeltaApplied(treeWithGrandchild2, delta3)

      // Remove child1 and verify all grandchildren are removed
      const delta4 = getTreeNodeSetDeltaForNodeRemoved(treeWithAllGrandchildren, child1Id)
      const result = getTreeNodeSetWithDeltaApplied(treeWithAllGrandchildren, delta4)

      expect(result[child1Id]).toBeUndefined()
      expect(result[grandChild1.id]).toBeUndefined()
      expect(result[grandChild2.id]).toBeUndefined()
      expect(result[grandChild3.id]).toBeUndefined()
      expect(result[rootId].childrenIds.length).toBe(0)
      expect(result[rootId].calculatedMetrics.readinessLevel).toBe(0)
    })
  })

  describe('getTreeNodeSetDeltaForNodeUpdated', () => {
    it('should update a node in the tree', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      const delta = getTreeNodeSetDeltaForNodeUpdated(testNodes, child1Id, {
        title: 'Updated Child',
        setMetrics: { readinessLevel: 3 }
      })
      const nodes2 = getTreeNodeSetWithDeltaApplied(testNodes, delta)

      expect(nodes2).not.toBe(testNodes)
      expect(nodes2[child1Id].title).toBe('Updated Child')
      expect(nodes2[child1Id].calculatedMetrics.readinessLevel).toBe(3)
      expect(nodes2[rootId].calculatedMetrics.readinessLevel).toBe(3)
    })

    it('should handle setting and clearing metrics', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Set metrics
      const delta1 = getTreeNodeSetDeltaForNodeUpdated(testNodes, child1Id, {
        setMetrics: { readinessLevel: 3 }
      })
      const nodesWithSet = getTreeNodeSetWithDeltaApplied(testNodes, delta1)

      expect(nodesWithSet[child1Id].setMetrics?.readinessLevel).toBe(3)
      expect(nodesWithSet[child1Id].calculatedMetrics.readinessLevel).toBe(3)

      // Clear metrics
      const delta2 = getTreeNodeSetDeltaForNodeUpdated(nodesWithSet, child1Id, {
        setMetrics: { readinessLevel: null }
      })
      const nodesWithCleared = getTreeNodeSetWithDeltaApplied(nodesWithSet, delta2)

      expect(nodesWithCleared[child1Id].setMetrics?.readinessLevel).toBeUndefined()
      expect(nodesWithCleared[child1Id].calculatedMetrics.readinessLevel).toBe(0)
    })

    it('should update metrics through the tree hierarchy', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Create a deep tree
      const grandChild1 = createNode("map", {
        title: 'Grandchild 1',
        setMetrics: { readinessLevel: 0 }
      })
      const delta1 = getTreeNodeSetDeltaForNodeAdded(testNodes, grandChild1, child1Id)
      const nodesWithGrandchild1 = getTreeNodeSetWithDeltaApplied(testNodes, delta1)

      const grandChild2 = createNode("map", {
        title: 'Grandchild 2',
        setMetrics: { readinessLevel: 0 }
      })
      const delta2 = getTreeNodeSetDeltaForNodeAdded(nodesWithGrandchild1, grandChild2, child1Id)
      const nodesWithBothGrandchildren = getTreeNodeSetWithDeltaApplied(nodesWithGrandchild1, delta2)

      // Test auto-propagation of metrics up the tree
      const delta5 = getTreeNodeSetDeltaForNodeUpdated(nodesWithBothGrandchildren, grandChild1.id, {
        setMetrics: { readinessLevel: 3 }
      })
      const nodesWithAuto = getTreeNodeSetWithDeltaApplied(nodesWithBothGrandchildren, delta5)

      expect(nodesWithAuto[grandChild1.id].calculatedMetrics.readinessLevel).toBe(3)
      // Since there are two grandchildren, and only one has readinessLevel 3, the parent's readinessLevel should be 0
      expect(nodesWithAuto[child1Id].calculatedMetrics.readinessLevel).toBe(0)
      expect(nodesWithAuto[rootId].calculatedMetrics.readinessLevel).toBe(0)

      // Update the second grandchild too
      const delta6 = getTreeNodeSetDeltaForNodeUpdated(nodesWithAuto, grandChild2.id, {
        setMetrics: { readinessLevel: 3 }
      })
      const nodesWithBothUpdated = getTreeNodeSetWithDeltaApplied(nodesWithAuto, delta6)

      // Now both grandchildren have readinessLevel 3, so the parent should also have readinessLevel 3
      expect(nodesWithBothUpdated[grandChild1.id].calculatedMetrics.readinessLevel).toBe(3)
      expect(nodesWithBothUpdated[grandChild2.id].calculatedMetrics.readinessLevel).toBe(3)
      expect(nodesWithBothUpdated[child1Id].calculatedMetrics.readinessLevel).toBe(3)
      expect(nodesWithBothUpdated[rootId].calculatedMetrics.readinessLevel).toBe(3)

      // Test override with higher value
      const delta7 = getTreeNodeSetDeltaForNodeUpdated(nodesWithBothUpdated, grandChild1.id, {
        setMetrics: { readinessLevel: 5 }
      })
      const nodesWithOverride = getTreeNodeSetWithDeltaApplied(nodesWithBothUpdated, delta7)

      expect(nodesWithOverride[grandChild1.id].calculatedMetrics.readinessLevel).toBe(5)
      // Since one grandchild has readinessLevel 5 and the other has 3, the parent's readinessLevel should be 3
      expect(nodesWithOverride[child1Id].calculatedMetrics.readinessLevel).toBe(3)
      expect(nodesWithOverride[rootId].calculatedMetrics.readinessLevel).toBe(3)
    })
  })

  describe('getTreeNodeSetDeltaForNodeParentChanged', () => {
    it('should move a node to a new parent', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Add a second child to the root
      const child2 = createNode("map", {
        title: 'Child 2',
        setMetrics: { readinessLevel: 2 }
      })
      const delta1 = getTreeNodeSetDeltaForNodeAdded(testNodes, child2, rootId)
      const nodesWithTwoChildren = getTreeNodeSetWithDeltaApplied(testNodes, delta1)

      // Move child1 to be a child of child2
      const delta2 = getTreeNodeSetDeltaForNodeParentChanged(nodesWithTwoChildren, child1Id, child2.id)
      const result = getTreeNodeSetWithDeltaApplied(nodesWithTwoChildren, delta2)

      // Verify structure
      expect(result[rootId].childrenIds.length).toBe(1)
      expect(result[rootId].childrenIds[0]).toBe(child2.id)
      expect(result[child2.id].childrenIds.length).toBe(1)
      expect(result[child2.id].childrenIds[0]).toBe(child1Id)
      expect(result[child1Id].parentId).toBe(child2.id)

      // Verify metrics
      expect(result[child1Id].calculatedMetrics.readinessLevel).toBe(0)
      expect(result[child2.id].calculatedMetrics.readinessLevel).toBe(2)
      expect(result[rootId].calculatedMetrics.readinessLevel).toBe(2)
    })

    it('should throw error when trying to move a node to its descendant', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      expect(() => {
        getTreeNodeSetDeltaForNodeParentChanged(testNodes, rootId, child1Id)
      }).toThrow()
    })

    it('should throw error when trying to create a cycle', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Add a child to child1
      const child2 = createNode("map", {
        title: 'Child 2',
        setMetrics: { readinessLevel: 2 }
      })
      const delta1 = getTreeNodeSetDeltaForNodeAdded(testNodes, child2, child1Id)
      const nodesWithTwoChildren = getTreeNodeSetWithDeltaApplied(testNodes, delta1)

      expect(() => {
        getTreeNodeSetDeltaForNodeParentChanged(nodesWithTwoChildren, child1Id, child2.id)
      }).toThrow()
    })

    it('should move a node to a specific index', () => {
      // Create a parent with multiple children
      const parent = createNode("map", { title: 'Parent' })
      const child1 = createNode("map", { title: 'Child 1' })
      const child2 = createNode("map", { title: 'Child 2' })
      const child3 = createNode("map", { title: 'Child 3' })
      const child4 = createNode("map", { title: 'Child 4' })

      // Start with the parent node directly in the tree
      let nodes: TreeNodeSet = {
        [parent.id]: { ...parent, childrenIds: [] }
      }

      // Add children
      let delta = getTreeNodeSetDeltaForNodeAdded(nodes, child1, parent.id)
      nodes = getTreeNodeSetWithDeltaApplied(nodes, delta)

      delta = getTreeNodeSetDeltaForNodeAdded(nodes, child2, parent.id)
      nodes = getTreeNodeSetWithDeltaApplied(nodes, delta)

      delta = getTreeNodeSetDeltaForNodeAdded(nodes, child3, parent.id)
      nodes = getTreeNodeSetWithDeltaApplied(nodes, delta)

      delta = getTreeNodeSetDeltaForNodeAdded(nodes, child4, parent.id)
      nodes = getTreeNodeSetWithDeltaApplied(nodes, delta)

      // Move child4 to index 2 (third position)
      delta = getTreeNodeSetDeltaForNodeParentChanged(nodes, child4.id, parent.id, 2)
      const result = getTreeNodeSetWithDeltaApplied(nodes, delta)

      expect(result[parent.id].childrenIds[0]).toBe(child1.id)
      expect(result[parent.id].childrenIds[1]).toBe(child2.id)
      expect(result[parent.id].childrenIds[2]).toBe(child4.id)
      expect(result[parent.id].childrenIds[3]).toBe(child3.id)
    })

    it('should update metrics when moving nodes', () => {
      // Create a test tree with metrics
      const rootNode = createNode("map", { title: 'Root' })
      const waypoint = createNode("map", {
        title: 'Waypoint',
        setMetrics: { readinessLevel: 3 }
      })

      // Start with the root node directly in the tree
      let nodes: TreeNodeSet = {
        [rootNode.id]: { ...rootNode, childrenIds: [] }
      }

      // Add waypoint
      let delta = getTreeNodeSetDeltaForNodeAdded(nodes, waypoint, rootNode.id)
      const treeWithWaypoint = getTreeNodeSetWithDeltaApplied(nodes, delta)

      // Update the waypoint
      delta = getTreeNodeSetDeltaForNodeUpdated(treeWithWaypoint, waypoint.id, { title: 'Updated Waypoint' })
      const updatedTree = getTreeNodeSetWithDeltaApplied(treeWithWaypoint, delta)

      // Add a user node and move the waypoint under it
      const user = createNode("map", { title: 'User' })
      delta = getTreeNodeSetDeltaForNodeAdded(updatedTree, user, rootNode.id)
      const treeWithUser = getTreeNodeSetWithDeltaApplied(updatedTree, delta)

      delta = getTreeNodeSetDeltaForNodeParentChanged(treeWithUser, waypoint.id, user.id)
      const movedTree = getTreeNodeSetWithDeltaApplied(treeWithUser, delta)

      // Verify structure and metrics
      expect(movedTree[rootNode.id].childrenIds.length).toBe(1)
      expect(movedTree[rootNode.id].childrenIds[0]).toBe(user.id)
      expect(movedTree[user.id].childrenIds.length).toBe(1)
      expect(movedTree[user.id].childrenIds[0]).toBe(waypoint.id)
      expect(movedTree[waypoint.id].parentId).toBe(user.id)

      // Metrics should propagate up
      expect(movedTree[waypoint.id].calculatedMetrics.readinessLevel).toBe(3)
      expect(movedTree[user.id].calculatedMetrics.readinessLevel).toBe(3)
      expect(movedTree[rootNode.id].calculatedMetrics.readinessLevel).toBe(3)
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
      const delta = getTreeNodeSetDeltaForNodeAdded(testNodes, child2, child1Id)
      const nodesWithTwoLevels = getTreeNodeSetWithDeltaApplied(testNodes, delta)

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
      const delta1 = getTreeNodeSetDeltaForNodeAdded(testNodes, waypoint, rootId)
      const treeWithWaypoint = getTreeNodeSetWithDeltaApplied(testNodes, delta1)
      expect(treeWithWaypoint[waypoint.id].type).toBe("waypoint")

      // Update the waypoint node
      const delta2 = getTreeNodeSetDeltaForNodeUpdated(treeWithWaypoint, waypoint.id, { title: 'Updated Waypoint' })
      const updatedTree = getTreeNodeSetWithDeltaApplied(treeWithWaypoint, delta2)
      expect(updatedTree[waypoint.id].type).toBe("waypoint")

      // Move the waypoint node
      const user = createNode("user", { title: 'User' })
      const delta3 = getTreeNodeSetDeltaForNodeAdded(updatedTree, user, rootId)
      const treeWithUser = getTreeNodeSetWithDeltaApplied(updatedTree, delta3)

      const delta4 = getTreeNodeSetDeltaForNodeParentChanged(treeWithUser, waypoint.id, user.id)
      const movedTree = getTreeNodeSetWithDeltaApplied(treeWithUser, delta4)
      expect(movedTree[waypoint.id].type).toBe("waypoint")
      expect(movedTree[user.id].type).toBe("user")
    })
  })

  describe('getTreeNodeSetDeltaWithUpdatedNodeMetrics', () => {
    it('should update metrics in a delta', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Create a delta that updates a node's metrics
      const initialDelta = {
        removed: {},
        updated: {
          [child1Id]: {
            ...testNodes[child1Id],
            setMetrics: { readinessLevel: 3 }
          }
        }
      }

      // Apply the delta with updated metrics
      const updatedDelta = getTreeNodeSetDeltaWithUpdatedNodeMetrics(testNodes, initialDelta, child1Id)

      // Verify the delta contains the updated metrics
      expect(updatedDelta.updated[child1Id].calculatedMetrics.readinessLevel).toBe(3)

      // Apply the delta to the tree
      const updatedTree = getTreeNodeSetWithDeltaApplied(testNodes, updatedDelta)

      // Verify the metrics were updated in the tree
      expect(updatedTree[child1Id].calculatedMetrics.readinessLevel).toBe(3)
      expect(updatedTree[rootId].calculatedMetrics.readinessLevel).toBe(3)
    })

    it('should propagate metrics up the tree in a delta', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Add a grandchild
      const grandChild = createNode("map", {
        title: 'Grandchild',
        setMetrics: { readinessLevel: 0 }
      })
      const addDelta = getTreeNodeSetDeltaForNodeAdded(testNodes, grandChild, child1Id)
      const treeWithGrandchild = getTreeNodeSetWithDeltaApplied(testNodes, addDelta)

      // Create a delta that updates the grandchild's metrics
      const initialDelta = {
        removed: {},
        updated: {
          [grandChild.id]: {
            ...treeWithGrandchild[grandChild.id],
            setMetrics: { readinessLevel: 5 }
          }
        }
      }

      // Apply the delta with updated metrics
      const updatedDelta = getTreeNodeSetDeltaWithUpdatedNodeMetrics(treeWithGrandchild, initialDelta, grandChild.id)

      // Verify the delta contains updates for all affected nodes
      expect(updatedDelta.updated[grandChild.id].calculatedMetrics.readinessLevel).toBe(5)
      expect(updatedDelta.updated[child1Id].calculatedMetrics.readinessLevel).toBe(5)
      expect(updatedDelta.updated[rootId].calculatedMetrics.readinessLevel).toBe(5)

      // Apply the delta to the tree
      const updatedTree = getTreeNodeSetWithDeltaApplied(treeWithGrandchild, updatedDelta)

      // Verify the metrics were updated in the tree
      expect(updatedTree[grandChild.id].calculatedMetrics.readinessLevel).toBe(5)
      expect(updatedTree[child1Id].calculatedMetrics.readinessLevel).toBe(5)
      expect(updatedTree[rootId].calculatedMetrics.readinessLevel).toBe(5)
    })

    it('should handle nodes being removed in the delta', () => {
      const rootId = Object.keys(testNodes)[0]
      const child1Id = testNodes[rootId].childrenIds[0]

      // Create a delta that removes a node
      const initialDelta = {
        removed: { [child1Id]: testNodes[child1Id] },
        updated: {
          [rootId]: {
            ...testNodes[rootId],
            childrenIds: []
          }
        }
      }

      // Apply the delta with updated metrics
      const updatedDelta = getTreeNodeSetDeltaWithUpdatedNodeMetrics(testNodes, initialDelta, rootId)

      // Verify the delta still contains the removed node
      expect(updatedDelta.removed[child1Id]).toBeDefined()

      // Apply the delta to the tree
      const updatedTree = getTreeNodeSetWithDeltaApplied(testNodes, updatedDelta)

      // Verify the node was removed
      expect(updatedTree[child1Id]).toBeUndefined()
      expect(updatedTree[rootId].childrenIds.length).toBe(0)
      expect(updatedTree[rootId].calculatedMetrics.readinessLevel).toBe(0)
    })
  })
})