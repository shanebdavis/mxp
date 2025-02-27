import type { TreeNode, TreeNodeSet } from './TreeNodeTypes'
import { compactFlatten, isNumber } from '../ArtStandardLib'

// Function to find priority nodes in the map tree
export const findPriorityNodes = (nodes: TreeNodeSet, rootNodeId: string): TreeNode[] => {
  // Modified traverse function to only include nodes if none of their children are included
  const traverse = (nodeId: string): TreeNode[] => {
    const node = nodes[nodeId]
    if (!node) return []

    // Skip draft nodes
    if (node.nodeState === 'draft') return []

    if (isNumber(node.setMetrics?.readinessLevel)) {
      return [node]
    }

    // Collect nodes from children
    const childrenNodes = compactFlatten(node.childrenIds.map(traverse))

    // If we found priority nodes in children, return those
    if (childrenNodes.length > 0) {
      return childrenNodes
    }

    return [node]
  }

  // Start traversal from the root map node
  const result = traverse(rootNodeId)

  // Sort by readiness level (1, 2, 3, etc.)
  return compactFlatten(
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => result.filter(node => node.calculatedMetrics.readinessLevel === level))
  )
}
