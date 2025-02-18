import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTreeWithNodeAdded,
  createNode,
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
  })
})