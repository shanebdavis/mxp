import { useState, type FC, useRef, useMemo } from 'react'
import React from 'react'
import { TreeNode, TreeNodeProperties } from '../../models'
import { styles } from './styles'
import { DragTarget, DropIndicatorState, DropPosition } from './types'
import { HTableRow } from './HTableRow'
import { TreeStateMethods } from '../../useTreeState'

interface HTableProps {
  rootNode: TreeNode
  selectedNode: TreeNode | null
  selectNodeById: (nodeId: string) => void
  treeStateMethods: TreeStateMethods
  editingNodeId?: string | null
  setEditingNodeId: (id: string | null) => void
  expandedNodes: Record<string, boolean>
  toggleNode: (id: string) => void
}

type NonFlattenedIdList = (NonFlattenedIdList | string | null | undefined)[]

const getDisplayOrder = (node: TreeNode, expandedNodes: Record<string, boolean>): string[] => {
  if (expandedNodes[node.id]) {
    return [node.id, ...node.children.map(child => getDisplayOrder(child, expandedNodes)).flat()]
  }
  return [node.id]
}

const getParentMap = (node: TreeNode, parentNode: TreeNode | undefined = undefined, out: Record<string, TreeNode> = {}): Record<string, TreeNode> => {
  if (parentNode) out[node.id] = parentNode
  node.children.forEach(child => getParentMap(child, node, out))
  return out
}

const getIndexInParentMap = (node: TreeNode, indexInParent: number = 0, out: Record<string, number> = {}): Record<string, number> => {
  out[node.id] = indexInParent
  node.children.forEach((child, index) => getIndexInParentMap(child, index, out))
  return out
}

export const HTable: FC<HTableProps> = ({ rootNode, selectNodeById, selectedNode, treeStateMethods, editingNodeId, setEditingNodeId, expandedNodes, toggleNode }) => {
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null)
  const [dragTarget, setDragTarget] = useState<DragTarget>({ nodeId: null, position: null, indexInParent: null })
  const lastDragUpdate = useRef({ timestamp: 0 })
  const tableRef = useRef<HTMLDivElement>(null)

  const [displayOrder, parentMap, indexInParentMap] = useMemo(() => {
    return [
      getDisplayOrder(rootNode, expandedNodes),
      getParentMap(rootNode),
      getIndexInParentMap(rootNode)
    ]
  }, [rootNode, expandedNodes])

  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState>({
    top: 0,
    show: false,
    isLine: false,
  })

  const handleDragOver = (nodeId: string, indexInParent: number) => (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedNode || !tableRef.current) return

    const now = Date.now()
    if (now - lastDragUpdate.current.timestamp < 50) return

    const rect = e.currentTarget.getBoundingClientRect()
    const tableRect = tableRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height
    const level = getNodeLevel(rootNode, nodeId)

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

  const getNodeLevel = (root: TreeNode, targetId: string, level = 0): number => {
    if (root.id === targetId) return level
    for (const child of root.children) {
      const foundLevel = getNodeLevel(child, targetId, level + 1)
      if (foundLevel !== -1) return foundLevel
    }
    return -1
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
            <th style={{ ...styles.headerCell, ...styles.nameColumn }}>Name</th>
            <th style={{ ...styles.headerCell, ...styles.levelColumn }}>Readiness Level</th>
          </tr>
        </thead>
        <tbody>
          <HTableRow
            {...{
              node: rootNode,
              expandedNodes,
              toggleNode,
              selectNodeById,
              selectedNode,
              treeStateMethods,
              draggedNode,
              setDraggedNode,
              dragTarget,
              handleDragOver,
              handleDragLeave,
              indexInParent: 0,
              editingNodeId,
              setEditingNodeId,
              displayOrder,
              parentMap,
              indexInParentMap,
            }}
          />
        </tbody>
      </table>
    </div>
  )
}