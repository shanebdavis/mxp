import { FC, useState, useRef, useMemo } from 'react'
import React from 'react'
import type { TreeNode, TreeNodeSet, NodeType } from '../../../TreeNode'
import { styles } from './styles'
import { DragTarget, DropIndicatorState, DropPosition } from './types'
import { HTableRow } from './HTableRow'
import { TreeStateMethods } from '../../../useApiForState'

interface HTableProps {
  nodes: TreeNodeSet
  rootNodeId: string
  selectedNode: TreeNode | null
  selectNodeById: (nodeId: string) => void
  selectNodeWithoutFocus?: (nodeId: string) => void
  treeNodesApi: TreeStateMethods
  editingNodeId?: string | null
  setEditingNodeId: (id: string | null) => void
  indexInParentMap: Record<string, number>
  nameColumnHeader?: string
  readinessColumnHeader?: string
  nodeType?: NodeType
  isFocused?: boolean
  expandedNodes?: Record<string, boolean>
  setExpandedNodes?: (newState: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
}

const getDisplayOrder = (
  nodes: TreeNodeSet,
  rootNodeId: string,
  expandedNodes: Record<string, boolean>
): { nodeId: string, level: number, itemNumber: number }[] => {
  const displayOrder: { nodeId: string, level: number, itemNumber: number }[] = []
  let itemNumbers: Record<string, number> = {}

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

  itemNumbers[rootNodeId] = 1
  processNode(rootNodeId, 0)

  return displayOrder
}

export const HTable: FC<HTableProps> = ({
  nodes,
  rootNodeId,
  selectNodeById,
  selectNodeWithoutFocus,
  selectedNode,
  treeNodesApi,
  editingNodeId,
  setEditingNodeId,
  indexInParentMap,
  nameColumnHeader = "Name",
  readinessColumnHeader = "Readiness Level",
  nodeType, // Now optional and not used for filtering. Each tree is controlled by its own rootNodeId.
  isFocused = true, // Default to true for backward compatibility
  expandedNodes: externalExpandedNodes,
  setExpandedNodes: externalSetExpandedNodes
}) => {
  // Use internal state if external state is not provided
  const [internalExpandedNodes, setInternalExpandedNodes] = useState<Record<string, boolean>>({})

  // Choose between external and internal state
  const expandedNodes = externalExpandedNodes || internalExpandedNodes
  const setExpandedNodes = externalSetExpandedNodes || setInternalExpandedNodes

  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null)
  const [dragTarget, setDragTarget] = useState<DragTarget>({ nodeId: null, position: null, indexInParent: null })
  const lastDragUpdate = useRef({ timestamp: 0 })
  const tableRef = useRef<HTMLDivElement>(null)
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState>({
    top: 0,
    show: false,
    isLine: false,
  })

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const displayOrder = useMemo(() =>
    getDisplayOrder(nodes, rootNodeId, expandedNodes),
    [nodes, rootNodeId, expandedNodes]
  )

  const handleDragOver = (nodeId: string, indexInParent: number, level: number) => (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedNode || !tableRef.current) return

    const now = Date.now()
    if (now - lastDragUpdate.current.timestamp < 50) return

    const rect = e.currentTarget.getBoundingClientRect()
    const tableRect = tableRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height

    let position: DropPosition
    if (y < height * 0.25) {
      position = 'before'
      setDropIndicator({
        top: rect.top - tableRect.top,
        show: true,
        isLine: true,
        parentTop: rect.top - tableRect.top,
        indentLevel: level
      })
    } else if (y > height * 0.75) {
      position = 'after'
      setDropIndicator({
        top: rect.bottom - tableRect.top,
        show: true,
        isLine: true,
        parentTop: rect.top - tableRect.top,
        indentLevel: level
      })
    } else {
      position = 'inside'
      setDropIndicator({
        top: rect.top - tableRect.top,
        show: true,
        isLine: false
      })
    }

    if (dragTarget.nodeId !== nodeId || dragTarget.position !== position) {
      lastDragUpdate.current.timestamp = now
      setDragTarget({ nodeId, position, indexInParent })
    }
  }

  const handleDragLeave = () => {
    setDragTarget({ nodeId: null, position: null, indexInParent: null })
    setDropIndicator(prev => ({ ...prev, show: false }))
  }

  const shouldShowDropIndicator = (x: DragTarget) => {
    // ... existing code ...
  }

  let draftNodesVisited: Record<string, boolean> = {}

  return (
    <div ref={tableRef} style={{ ...styles.container, position: 'relative' }}>
      {dropIndicator.show && (
        <>
          {dropIndicator.isLine ? (
            <>
              <div
                style={{
                  ...styles.dropIndicator,
                  ...styles.dropParent,
                  top: dropIndicator.parentTop,
                  opacity: 0.5,
                }}
              />
              <div
                style={{
                  ...styles.dropIndicator,
                  ...styles.dropLine,
                  top: dropIndicator.top,
                  left: (dropIndicator.indentLevel || 0) * 16 + 40,
                }}
              />
            </>
          ) : (
            <div
              style={{
                ...styles.dropIndicator,
                ...styles.dropParent,
                top: dropIndicator.top,
              }}
            />
          )}
        </>
      )}
      <table style={styles.table}>
        <colgroup>
          <col style={styles.nameColumn} />
          <col style={styles.levelColumn} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...styles.headerCell, ...styles.nameColumn }} className="field-label">{nameColumnHeader === 'User' ? 'Group/Contributor' : nameColumnHeader}</th>
            <th style={{ ...styles.headerCell, ...styles.levelColumn }} className="field-label">{readinessColumnHeader}</th>
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
                  selectNodeById,
                  selectNodeWithoutFocus,
                  selectedNode,
                  treeNodesApi,
                  draggedNode,
                  setDraggedNode,
                  dragTarget,
                  handleDragOver: handleDragOver(nodeId, index, level),
                  handleDragLeave,
                  editingNodeId,
                  setEditingNodeId,
                  displayOrder: displayOrder.map(x => x.nodeId),
                  indexInParentMap,
                  isDraftSubtree,
                  isFocused,
                }}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}