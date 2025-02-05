import { useState, type FC, useRef } from 'react'
import { ArrowDropDown, ArrowRight } from '@mui/icons-material'
import { formatReadinessLevel } from '../utils/formatting'
import React from 'react'

interface TreeNode {
  id: string
  name: string
  readinessLevel: number  // 0-9
  children: TreeNode[]
}

const dummyData: TreeNode = {
  id: 'root',
  name: 'Project Root',
  readinessLevel: 3,
  children: [
    {
      id: '1',
      name: 'Frontend Development',
      readinessLevel: 2,
      children: [
        {
          id: '1.1',
          name: 'User Interface',
          readinessLevel: 1,
          children: []
        },
        {
          id: '1.2',
          name: 'Authentication',
          readinessLevel: 0,
          children: []
        }
      ]
    },
    {
      id: '2',
      name: 'Backend Development',
      readinessLevel: 1,
      children: [
        {
          id: '2.1',
          name: 'API Design',
          readinessLevel: 2,
          children: []
        }
      ]
    }
  ]
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: '14px',
    lineHeight: '1.4',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    borderSpacing: 0,
    tableLayout: 'fixed' as const,
  },
  headerCell: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    borderBottom: '2px solid #e0e0e0',
    color: '#666',
    fontWeight: 600,
    fontSize: '13px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  cell: {
    padding: '6px 12px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
  },
  treeCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  toggleButton: {
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    color: '#666',
    userSelect: 'none' as const,
    fontSize: '10px',
    borderRadius: '12px',
  },
  readinessLevel: {
    fontFamily: 'Monaco, Consolas, monospace',
    fontSize: '13px',
    color: '#666',
  },
  row: {
    cursor: 'pointer',
  },
  nameColumn: {
    width: '70%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  levelColumn: {
    width: '30%',
  },
  dropIndicator: {
    position: 'absolute' as const,
    pointerEvents: 'none' as const,
    transition: 'opacity 0.1s',
    zIndex: -1,
  },
  dropLine: {
    position: 'absolute' as const,
    height: '2px',
    backgroundColor: '#2196f3',
    right: 0,
  },
  dropParent: {
    position: 'absolute' as const,
    height: '40px',
    backgroundColor: '#e3f2fd',
    width: '100%',
    transform: 'translateY(-50%)',
  },
} as const

interface TreeNodeProps {
  node: TreeNode
  level?: number
  expandedNodes: string[]
  toggleNode: (id: string) => void
  onSelect: (node: TreeNode) => void
  selectedNodeId?: string
  onMove: (sourceId: string, targetId: string, position: DropPosition) => void
  draggedNode: TreeNode | null
  setDraggedNode: (node: TreeNode | null) => void
  dragTarget: DragTarget
  onDragOver: (nodeId: string) => (e: React.DragEvent) => void
  onDragLeave: () => void
}

interface DragItem {
  id: string
  parentId: string | null
  sourceNode: TreeNode
}

type DropPosition = 'before' | 'after' | 'inside' | null

interface DragOverState {
  position: DropPosition
  isValid: boolean
}

interface DragTarget {
  nodeId: string | null
  position: DropPosition
}

interface DropIndicatorState {
  top: number
  show: boolean
  isLine: boolean
  parentTop?: number
  indentLevel?: number
}

const isDescendant = (node: TreeNode, targetId: string): boolean => {
  if (node.id === targetId) return true
  return node.children.some(child => isDescendant(child, targetId))
}

const TreeNode: FC<TreeNodeProps> = ({
  node,
  level = 0,
  expandedNodes,
  toggleNode,
  onSelect,
  selectedNodeId,
  onMove,
  draggedNode,
  setDraggedNode,
  dragTarget,
  onDragOver,
  onDragLeave
}) => {
  const isValidTarget = draggedNode && draggedNode.id !== node.id && !isDescendant(draggedNode, node.id)
  const isDragTarget = dragTarget.nodeId === node.id && isValidTarget

  const handleRowClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.toggle-button')) {
      if (selectedNodeId === node.id && node.children.length > 0) {
        toggleNode(node.id)
      } else {
        onSelect(node)
        if (node.children.length > 0 && !expandedNodes.includes(node.id)) {
          toggleNode(node.id)
        }
      }
    }
  }

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleNode(node.id)
  }

  const handleDragStart = (e: React.DragEvent) => {
    setDraggedNode(node)
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: node.id,
      parentId: null,
      sourceNode: node
    }))
  }

  const handleDragEnd = () => {
    setDraggedNode(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const data = JSON.parse(e.dataTransfer.getData('application/json')) as DragItem
    if (data.id !== node.id && !isDescendant(data.sourceNode, node.id)) {
      if (dragTarget.position === 'inside' &&
          node.children.length > 0 &&
          !expandedNodes.includes(node.id)) {
        toggleNode(node.id)
      }
      onMove(data.id, node.id, dragTarget.position)
    }
  }

  return (
    <>
      <tr
        className="table-row"
        style={{
          ...styles.row,
          backgroundColor: isDragTarget && dragTarget.position === 'inside'
            ? '#e3f2fd'
            : undefined,
        }}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={onDragOver(node.id)}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
      >
        <td style={styles.cell}>
          <div style={styles.treeCell}>
            <span style={{ paddingLeft: `${level * 16}px` }} />
            <span
              className={node.children.length > 0 ? "toggle-button" : undefined}
              onClick={node.children.length > 0 ? handleToggleClick : undefined}
              style={{
                ...styles.toggleButton,
                cursor: node.children.length > 0 ? 'pointer' : 'default',
                color: node.children.length > 0 ? '#666' : 'transparent',
              }}
            >
              {node.children.length > 0 ? (
                expandedNodes.includes(node.id)
                  ? <ArrowDropDown style={{ width: 16, height: 16 }} />
                  : <ArrowRight style={{ width: 16, height: 16 }} />
              ) : (
                <ArrowRight style={{ width: 16, height: 16, visibility: 'hidden' }} />
              )}
            </span>
            {node.name}
          </div>
        </td>
        <td style={{ ...styles.cell, ...styles.readinessLevel }}>
          {formatReadinessLevel(node.readinessLevel)}
        </td>
      </tr>
      {expandedNodes.includes(node.id) && node.children.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          level={level + 1}
          expandedNodes={expandedNodes}
          toggleNode={toggleNode}
          onSelect={onSelect}
          selectedNodeId={selectedNodeId}
          onMove={onMove}
          draggedNode={draggedNode}
          setDraggedNode={setDraggedNode}
          dragTarget={dragTarget}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        />
      ))}
    </>
  )
}

const HierarchicalTable: FC<{
  onSelect?: (node: TreeNode) => void
}> = ({ onSelect = () => {} }) => {
  const [data, setData] = useState(dummyData)
  const [expandedNodes, setExpandedNodes] = useState<string[]>(['root'])
  const [selectedNodeId, setSelectedNodeId] = useState<string>('root')
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

  const handleSelect = (node: TreeNode) => {
    setSelectedNodeId(node.id)
    onSelect(node)
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
          <TreeNode
            node={data}
            expandedNodes={expandedNodes}
            toggleNode={toggleNode}
            onSelect={handleSelect}
            selectedNodeId={selectedNodeId}
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

export default HierarchicalTable