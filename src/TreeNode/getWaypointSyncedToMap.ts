import { TreeNodeSet, TreeNodeSetDelta, TreeNode } from "./TreeNodeTypes"
import { getAllDescendantNodes, getNodesByReferencedMapId } from "./TreeNodeLib"
import { createNode } from "./TreeNode"

const getWaypointSubTreeBasedOnMapNode = (
  nodes: TreeNodeSet,
  waypoint: TreeNode,
  map: TreeNode,
  waypointsByMapId: Record<string, TreeNode>,
  intoTreeNodeSetDelta: TreeNodeSetDelta = { updated: {}, removed: {} }
): TreeNodeSetDelta => {
  intoTreeNodeSetDelta.updated[waypoint.id] = {
    ...waypoint, childrenIds:
      map.childrenIds.map(childId => {
        const mapChild = nodes[childId]
        const waypointChild = waypointsByMapId[childId] || createNode("waypoint", {
          title: mapChild.title,
          metadata: { referenceMapNodeId: mapChild.id },
          nodeState: "active"
        }, waypoint.id)
        getWaypointSubTreeBasedOnMapNode(nodes, waypointChild, mapChild, waypointsByMapId, intoTreeNodeSetDelta)
        return waypointChild.id
      })
  }
  return intoTreeNodeSetDelta
}

const addOldNodesIfPresent = (
  nodes: TreeNodeSet,
  rootWaypointId: string,
  syncTreeNodeSetDelta: TreeNodeSetDelta,
  waypointSubtreeNodes: TreeNode[],
): TreeNodeSetDelta => {
  const missingNodes = waypointSubtreeNodes.filter(node => !syncTreeNodeSetDelta.updated[node.id])
  const missingNodesById = missingNodes.reduce<Record<string, TreeNode>>((acc, node) => {
    acc[node.id] = node
    return acc
  }, {})
  const rootMissingNodes = missingNodes.filter(node => !node.parentId || !missingNodesById[node.parentId])
  if (rootMissingNodes.length === 0) return syncTreeNodeSetDelta

  const oldNodesNode = createNode("waypoint", {
    title: "Old Nodes",
    description: "Contains nodes that were present in the previous waypoint subtree but are no longer present in the map subtree",
    nodeState: "active"
  }, rootWaypointId)
  oldNodesNode.childrenIds = rootMissingNodes.map(node => node.id)
  return {
    ...syncTreeNodeSetDelta,
    updated: {
      ...syncTreeNodeSetDelta.updated,
      [oldNodesNode.id]: oldNodesNode,
      ...rootMissingNodes.reduce<Record<string, TreeNode>>((acc, node) => {
        acc[node.id] = { ...node, parentId: oldNodesNode.id }
        return acc
      }, {})
    }
  }
}

/**
 * Synchronizes a waypoint subtree with its referenced map node subtree
 * This ensures the waypoint structure mirrors the map structure
 */
export const getWaypointSyncedToMap = (nodes: TreeNodeSet, waypointId: string): TreeNodeSetDelta => {
  const rootWaypoint = nodes[waypointId]
  if (!rootWaypoint?.metadata?.referenceMapNodeId) return { updated: {}, removed: {} } // no map reference, nothing to do

  const rootMap = nodes[rootWaypoint.metadata.referenceMapNodeId]
  if (!rootMap) return { updated: {}, removed: {} } // map not found, nothing to do

  // Get all descendants of the root waypoint
  const waypointSubtreeNodes = getAllDescendantNodes(nodes, waypointId)
  const waypointsByMapId = getNodesByReferencedMapId(waypointSubtreeNodes)

  return addOldNodesIfPresent(
    nodes,
    waypointId,
    getWaypointSubTreeBasedOnMapNode(nodes, rootWaypoint, rootMap, waypointsByMapId),
    waypointSubtreeNodes
  )
}
