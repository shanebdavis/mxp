import { FC, useState, useRef, useMemo } from 'react'
import React from 'react'
import type { TreeNode, TreeNodeSet } from '../../../TreeNode'
import { styles } from './styles'
import { HTableRow } from './HTableRow'
import { TreeStateMethods } from '../../../useApiForState'
import { ViewStateMethods } from '../../../ViewStateMethods'
interface HTableProps {
  nodes: TreeNodeSet
  rootNodeId: string
  selectedNode: TreeNode | null
  viewStateMethods: ViewStateMethods
  treeNodesApi: TreeStateMethods
  editingNodeId: string | null
  indexInParentMap: Record<string, number>
  nameColumnHeader?: string
  readinessColumnHeader?: string
  isFocused?: boolean
  draggedNode: TreeNode | null
  setDraggedNode: (node: TreeNode | null) => void
  expandedNodes?: Record<string, boolean>
  setExpandedNodes?: (newState: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
  showDraft?: boolean
  dropPreview?: {
    dropParentId: string | null;
    insertAtIndex: number | null;
  }
  setDropPreview?: (preview: {
    dropParentId: string | null;
    insertAtIndex: number | null;
  }) => void
  clearDropPreview?: () => void
}

const getDisplayOrder = (
  nodes: TreeNodeSet,
  rootNodeId: string,
  expandedNodes: Record<string, boolean>,
  showDraft: boolean = true
): { nodeId: string, level: number, itemNumber: number }[] => {
  const displayOrder: { nodeId: string, level: number, itemNumber: number }[] = []
  let itemNumbers: Record<string, number> = {}

  // If showDraft is false, we need to filter out draft nodes and their children
  if (!showDraft) {
    // First pass: identify all draft nodes
    const draftParents = new Set<string>()

    // First pass: identify direct draft nodes
    Object.values(nodes).forEach(node => {
      if (node.nodeState === "draft") {
        draftParents.add(node.id)
      }
    })

    // Second pass: identify children of draft nodes
    let hasNewDraftParents = true
    while (hasNewDraftParents) {
      hasNewDraftParents = false
      Object.values(nodes).forEach(node => {
        if (node.parentId && draftParents.has(node.parentId) && !draftParents.has(node.id)) {
          draftParents.add(node.id)
          hasNewDraftParents = true
        }
      })
    }

    // Now filter the nodes to only include non-draft nodes
    const allNodes = Object.values(nodes).filter(node => !draftParents.has(node.id))
    const filteredNodes: TreeNodeSet = {}
    allNodes.forEach(node => {
      filteredNodes[node.id] = node
    })

    // Process only non-draft nodes
    const processNode = (nodeId: string, level: number): void => {
      const node = filteredNodes[nodeId]
      if (!node) return

      displayOrder.push({
        nodeId,
        level,
        itemNumber: itemNumbers[nodeId] || 0
      })

      if (expandedNodes[nodeId] && node.childrenIds.length > 0) {
        node.childrenIds
          .filter(childId => filteredNodes[childId]) // Only include children that aren't drafts
          .forEach((childId, index) => {
            itemNumbers[childId] = index + 1
            processNode(childId, level + 1)
          })
      }
    }

    processNode(rootNodeId, 0)
    return displayOrder
  }

  // Original code for showing drafts
  const processNode = (nodeId: string, level: number): void => {
    const node = nodes[nodeId]
    if (!node) return

    displayOrder.push({
      nodeId,
      level,
      itemNumber: itemNumbers[nodeId] || 0
    })

    if (expandedNodes[nodeId] && node.childrenIds.length > 0) {
      node.childrenIds.forEach((childId, index) => {
        itemNumbers[childId] = index + 1
        processNode(childId, level + 1)
      })
    }
  }

  processNode(rootNodeId, 0)
  return displayOrder
}

export const HTable: FC<HTableProps> = ({
  nodes,
  rootNodeId,
  selectedNode,
  viewStateMethods,
  treeNodesApi,
  editingNodeId,
  indexInParentMap,
  nameColumnHeader = "Name",
  draggedNode,
  setDraggedNode,
  readinessColumnHeader = "Readiness Level",
  isFocused = true, // Default to true for backward compatibility
  expandedNodes: externalExpandedNodes,
  setExpandedNodes: externalSetExpandedNodes,
  showDraft = true, // Default to showing drafts
  dropPreview = { dropParentId: null, insertAtIndex: null },
  setDropPreview = () => { },
  clearDropPreview = () => { }
}) => {
  // Use internal state if external state is not provided
  const [internalExpandedNodes, setInternalExpandedNodes] = useState<Record<string, boolean>>({})

  // Choose between external and internal state
  const expandedNodes = externalExpandedNodes || internalExpandedNodes
  const setExpandedNodes = externalSetExpandedNodes || setInternalExpandedNodes

  const tableRef = useRef<HTMLDivElement>(null)

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Get the display order and filter out draft nodes if showDraft is false
  const displayOrder = useMemo(() => getDisplayOrder(nodes, rootNodeId, expandedNodes, showDraft), [
    nodes,
    rootNodeId,
    expandedNodes,
    showDraft
  ])

  const handleDragOver = (nodeId: string) => (dragEvent: React.DragEvent) => {
    if (!draggedNode) return

    const rect = dragEvent.currentTarget.getBoundingClientRect()
    const y = dragEvent.clientY - rect.top
    const percentage = y / rect.height

    const node = nodes[nodeId]

    const parent = node?.parentId ? nodes[node.parentId] : null
    const nodeIndex = parent?.childrenIds.indexOf(nodeId) ?? -1

    if (draggedNode.type === 'map' && node.type === 'waypoint') {
      dragEvent.preventDefault()
      setDropPreview({ dropParentId: nodeId, insertAtIndex: node.childrenIds.length })
    } else {
      if (draggedNode.type !== node.type) return // ignore drag if type mismatch
      dragEvent.preventDefault()

      if (percentage < 0.25 && node.parentId) { // drop as peer before node
        setDropPreview({
          dropParentId: node.parentId,
          insertAtIndex: nodeIndex
        })
      } else if (percentage > 0.75 && node.parentId) { // drop as peer after node
        // Special case: if node is expanded and has children, insert as first child
        if (expandedNodes[nodeId] && node.childrenIds?.length > 0)
          setDropPreview({ dropParentId: nodeId, insertAtIndex: 0 })
        else {
          setDropPreview({ dropParentId: node.parentId, insertAtIndex: nodeIndex + 1 })
        }
      }
      else
        setDropPreview({ dropParentId: nodeId, insertAtIndex: node.childrenIds.length })
    }
  }

  const handleDragLeave = () => {
    clearDropPreview()
  }

  let draftNodesVisited: Record<string, boolean> = {}

  // Determine the node type from the root node
  const rootNodeType = nodes[rootNodeId]?.type || 'map'

  // Flag to determine if we should show the readiness column
  // Only show readiness column for 'map' type, hide for 'user' and 'waypoint'
  const showReadinessColumn = rootNodeType === 'map'

  // Flag to determine if we should show the waypoint-specific columns
  const showWaypointColumns = rootNodeType === 'waypoint'

  // Clear drop preview when dragging ends
  const handleDragEnd = () => {
    setDraggedNode(null);
    handleDragLeave();
    clearDropPreview();
  }

  return (
    <div ref={tableRef} style={{ ...styles.container, position: 'relative' }}>
      <table style={styles.table}>
        <colgroup>
          <col style={styles.nameColumn} />
          {showReadinessColumn && <col style={styles.levelColumn} />}
          {showWaypointColumns && <col style={styles.levelColumn} />}
          {showWaypointColumns && <col style={styles.levelColumn} />}
          {showWaypointColumns && <col style={styles.levelColumn} />}
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...styles.headerCell, ...styles.nameColumn }} className="field-label">{nameColumnHeader === 'User' ? 'Group/Contributor' : nameColumnHeader}</th>
            {showReadinessColumn && <th style={{ ...styles.headerCell, ...styles.levelColumn }} className="field-label">{readinessColumnHeader}</th>}
            {showWaypointColumns && <th style={{ ...styles.headerCell, ...styles.levelColumn }} className="field-label">Current RL</th>}
            {showWaypointColumns && <th style={{ ...styles.headerCell, ...styles.levelColumn }} className="field-label">Target RL</th>}
            {showWaypointColumns && <th style={{ ...styles.headerCell, ...styles.levelColumn }} className="field-label">Work Remaining</th>}
          </tr>
        </thead>
        <tbody>
          {displayOrder.map(({ nodeId, level, itemNumber }: { nodeId: string, level: number, itemNumber: number }, index: number) => {
            const node = nodes[nodeId]
            const isDraftSubtree = node.nodeState === "draft" || draftNodesVisited[node.parentId ?? ""]
            if (isDraftSubtree) draftNodesVisited[nodeId] = true

            return (
              <HTableRow
                key={nodeId}
                {...{
                  nodes,
                  nodeId,
                  level,
                  itemNumber,
                  expandedNodes,
                  toggleNode,
                  viewStateMethods,
                  selectedNode,
                  treeNodesApi,
                  draggedNode,
                  setDraggedNode,
                  handleDragOver: handleDragOver(nodeId),
                  handleDragLeave,
                  handleDragEnd,
                  editingNodeId,
                  displayOrder: displayOrder.map(x => x.nodeId),
                  indexInParentMap,
                  isDraftSubtree,
                  isFocused,
                  showReadinessColumn,
                  showWaypointColumns,
                  dropPreview,
                }}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}