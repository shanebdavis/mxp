import { FC } from 'react'
import { TreeNode, isDescendant } from '../../models'
import { DropPosition, DragTarget, DragItem } from './types'
import { styles } from './styles'
import { ArrowDropDown, ArrowRight } from '@mui/icons-material'
import { formatReadinessLevel } from '../../utils/formatting'

interface TreeNodeProps {
  node: TreeNode
  level?: number
  expandedNodes: string[]
  toggleNode: (id: string) => void
  selectNode: (node: TreeNode) => void
  selectedNode?: TreeNode
  onMove: (sourceId: string, targetId: string, position: DropPosition) => void
  draggedNode: TreeNode | null
  setDraggedNode: (node: TreeNode | null) => void
  dragTarget: DragTarget
  onDragOver: (nodeId: string) => (e: React.DragEvent) => void
  onDragLeave: () => void
}

export const HTableRow: FC<TreeNodeProps> = ({
  node,
  level = 0,
  expandedNodes,
  toggleNode,
  selectNode,
  selectedNode,
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
      if (selectedNode?.id === node.id && node.children.length > 0) {
        toggleNode(node.id)
      } else {
        selectNode(node)
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
        onClick={handleRowClick}
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
        <HTableRow
          key={child.id}
          node={child}
          level={level + 1}
          expandedNodes={expandedNodes}
          toggleNode={toggleNode}
          selectNode={selectNode}
          selectedNode={selectedNode}
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
