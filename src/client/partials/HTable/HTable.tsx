import { useState, type FC, useRef, useMemo } from 'react'
import React from 'react'
import type { TreeNode, TreeNodeSet } from '../../../models'
import { styles } from './styles'
import { DragTarget, DropIndicatorState, DropPosition } from './types'
import { HTableRow } from './HTableRow'
import { TreeStateMethods } from '../../../useApiForState'

interface HTableProps {
  nodes: TreeNodeSet
  rootNodeId: string
  selectedNode: TreeNode | null
  selectNodeById: (nodeId: string) => void
  treeStateMethods: TreeStateMethods
  editingNodeId?: string | null
  setEditingNodeId: (id: string | null) => void
  indexInParentMap: Record<string, number>
  nameColumnHeader?: string
  readinessColumnHeader?: string
}

const getDisplayOrder = (nodes: TreeNodeSet, rootNodeId: string, expandedNodes: Record<string, boolean>): Array<{ nodeId: string, level: number, itemNumber: number }> => {
  const result: Array<{ nodeId: string, level: number, itemNumber: number }> = []

  const addToResult = (nodeId: string, level: number) => {
    const node = nodes[nodeId]
    if (!node) return
    result.push({ nodeId, level, itemNumber: node.parentId && nodes[node.parentId] ? nodes[node.parentId].childrenIds.indexOf(nodeId) + 1 : 1 })
    if (expandedNodes[nodeId]) {
      node.childrenIds.forEach(childId => addToResult(childId, level + 1))
    }
  }
  addToResult(rootNodeId, 0)
  return result
}

export const HTable: FC<HTableProps> = ({
  nodes,
  rootNodeId,
  selectNodeById,
  selectedNode,
  treeStateMethods,
  editingNodeId,
  setEditingNodeId,
  indexInParentMap,
  nameColumnHeader = "Name",
  readinessColumnHeader = "Readiness Level"
}) => {
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null)
  const [dragTarget, setDragTarget] = useState<DragTarget>({ nodeId: null, position: null, indexInParent: null })
  const lastDragUpdate = useRef({ timestamp: 0 })
  const tableRef = useRef<HTMLDivElement>(null)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState>({
    top: 0,
    show: false,
    isLine: false,
  })

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
            <th style={{ ...styles.headerCell, ...styles.nameColumn }} className="field-label">{nameColumnHeader}</th>
            <th style={{ ...styles.headerCell, ...styles.levelColumn }} className="field-label">{readinessColumnHeader}</th>
          </tr>
        </thead>
        <tbody>
          {displayOrder.map(({ nodeId, level, itemNumber }, index) => {
            const node = nodes[nodeId]
            const parentNode = node.parentId ? nodes[node.parentId] : null
            const isDraftSubtree = Boolean(node.draft || (parentNode?.draft))

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
                  selectedNode,
                  treeStateMethods,
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
                }}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}