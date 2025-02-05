import { useState, type FC, useRef } from 'react'
import React from 'react'
import { TreeNode, dummyData } from '../../models'
import { styles } from './styles'
import { DragTarget, DropIndicatorState, DropPosition } from './types'
import { HTableRow } from './HTableRow'

type HTableProps = {
  selectNode?: (node: TreeNode) => void
  selectedNode?: TreeNode
}

export const HTable: FC<HTableProps> = ({ selectNode = () => { }, selectedNode }) => {
  const [data, setData] = useState(dummyData)
  const [expandedNodes, setExpandedNodes] = useState<string[]>(['root'])
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null)
  const [dragTarget, setDragTarget] = useState<DragTarget>({ nodeId: null, position: null })
  const lastDragUpdate = useRef({ timestamp: 0 })
  const tableRef = useRef<HTMLDivElement>(null)
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState>({
    top: 0,
    show: false,
    isLine: false,
  })

  const toggleNode = (id: string) => {
    setExpandedNodes(prev =>
      prev.includes(id)
        ? prev.filter(nodeId => nodeId !== id)
        : [...prev, id]
    )
  }

  const handleMove = (sourceId: string, targetId: string, position: DropPosition) => {
    setData(prevData => {
      // Helper function to find and remove node from tree
      const removeNode = (nodes: TreeNode[]): [TreeNode | null, TreeNode[]] => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === sourceId) {
            const node = nodes[i]
            const newNodes = [...nodes.slice(0, i), ...nodes.slice(i + 1)]
            return [node, newNodes]
          }
          if (nodes[i].children.length) {
            const [found, newChildren] = removeNode(nodes[i].children)
            if (found) {
              const newNode = { ...nodes[i], children: newChildren }
              return [found, [...nodes.slice(0, i), newNode, ...nodes.slice(i + 1)]]
            }
          }
        }
        return [null, nodes]
      }

      // Modified add logic
      const addNode = (nodes: TreeNode[], node: TreeNode, targetId: string, position: DropPosition): TreeNode[] => {
        if (targetId === 'root') {
          return position === 'after'
            ? [...nodes, node]
            : [node, ...nodes]
        }

        return nodes.map((n, i) => {
          if (n.id === targetId) {
            if (position === 'inside') {
              return { ...n, children: [...n.children, node] }
            }
            // Instead of returning arrays, we'll handle before/after at the parent level
            return n
          }
          if (n.children.length) {
            return { ...n, children: addNode(n.children, node, targetId, position) }
          }
          return n
        }).reduce((acc: TreeNode[], curr, i) => {
          if (nodes[i].id === targetId) {
            if (position === 'before') {
              return [...acc, node, curr]
            }
            if (position === 'after') {
              return [...acc, curr, node]
            }
          }
          return [...acc, curr]
        }, [])
      }

      // Find and remove the node from its current location
      const [nodeToMove, newChildren] = removeNode(prevData.children)
      if (!nodeToMove) return prevData

      // If dropping on root, add to root's children
      return {
        ...prevData,
        children: addNode(newChildren, nodeToMove, targetId, position)
      }
    })
  }

  const handleDragOver = (nodeId: string) => (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedNode || !tableRef.current) return

    const now = Date.now()
    if (now - lastDragUpdate.current.timestamp < 50) return

    const rect = e.currentTarget.getBoundingClientRect()
    const tableRect = tableRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height
    const level = getNodeLevel(data, nodeId)

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
      setDragTarget({ nodeId, position })
    }
  }

  const handleDragLeave = () => {
    setDragTarget({ nodeId: null, position: null })
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
            node={data}
            expandedNodes={expandedNodes}
            toggleNode={toggleNode}
            selectNode={selectNode}
            selectedNode={selectedNode}
            onMove={handleMove}
            draggedNode={draggedNode}
            setDraggedNode={setDraggedNode}
            dragTarget={dragTarget}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          />
        </tbody>
      </table>
    </div>
  )
}