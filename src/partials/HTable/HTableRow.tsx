import { FC, useState, useRef, useEffect } from 'react'
import { DragTarget, DragItem } from './types'
import { styles } from './styles'
import { ArrowDropDown, ArrowRight } from '@mui/icons-material'
import { formatReadinessLevel } from '../../presenters/formatting'
import { TreeStateMethods, TreeNode } from '../../useTreeState'

interface TreeNodeProps {
  node: TreeNode
  level?: number
  expandedNodes: Record<string, boolean>
  toggleNode: (id: string) => void
  selectNodeById: (nodeId: string) => void
  selectedNode: TreeNode | null
  treeStateMethods: TreeStateMethods
  draggedNode: TreeNode | null
  setDraggedNode: (node: TreeNode | null) => void
  dragTarget: DragTarget
  handleDragOver: (nodeId: string, indexInParent: number) => (e: React.DragEvent) => void
  handleDragLeave: () => void
  indexInParent: number,
  parentNode?: TreeNode // if undefined, this is the root node
}

export const HTableRow: FC<TreeNodeProps> = ({
  node,
  level = 0,
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
  indexInParent,
  parentNode,
}) => {
  const { setNodeParent, isParentOf } = treeStateMethods
  const isValidTarget = draggedNode && draggedNode.id !== node.id && !isParentOf(node.id, draggedNode.id) // isParentOf will eventually be async
  const isDragTarget = dragTarget.nodeId === node.id && isValidTarget

  const expanded = expandedNodes[node.id]
  const isRoot = !parentNode
  const isSelected = selectedNode?.id === node.id

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(node.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const handleRowClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.toggle-button')) {
      if (isSelected) {
        setIsEditing(true)
      } else {
        selectNodeById(node.id)
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
    }))
  }

  const handleDragEnd = () => {
    setDraggedNode(null)
    handleDragLeave()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dragItem = JSON.parse(e.dataTransfer.getData('application/json')) as DragItem
    if (dragItem.id !== node.id && !isParentOf(dragItem.id, node.id)) {
      if (dragTarget.position === 'inside' && node.children.length > 0 && !expanded) {
        toggleNode(node.id)
      }

      if (dragTarget.position === 'inside' || isRoot || (expanded && dragTarget.position !== 'before')) {
        setNodeParent(dragItem.id, node.id, 0)
      } else {
        setNodeParent(
          dragItem.id,
          parentNode?.id,
          dragTarget.position === 'before' ? indexInParent : indexInParent + 1
        )
      }
      handleDragLeave()
    }
  }

  const handleInputBlur = () => {
    setIsEditing(false)
    if (editValue !== node.name) {
      treeStateMethods.updateNode(node.id, { name: editValue })
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur()
    } else if (e.key === 'Escape') {
      setEditValue(node.name)
      setIsEditing(false)
    }
  }

  return (
    <>
      <tr
        className="table-row"
        style={{
          ...styles.row,
          ...(isDragTarget && dragTarget.position === 'inside' ? styles.dropTarget.inside : {}),
          ...(isDragTarget && dragTarget.position === 'before' ? { boxShadow: '0 -1px 0 #2196f3, inset 0 1px 0 #2196f3' } : {}),
          ...(isDragTarget && dragTarget.position === 'after' ? { boxShadow: '0 1px 0 #2196f3, inset 0 -1px 0 #2196f3' } : {}),
          ...(isSelected ? { backgroundColor: '#e3f2fd' } : {}),
        }}
        onClick={handleRowClick}
        draggable={!isRoot}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver(node.id, indexInParent)}
        onDragLeave={handleDragLeave}
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
                expanded
                  ? <ArrowDropDown style={{ width: 16, height: 16 }} />
                  : <ArrowRight style={{ width: 16, height: 16 }} />
              ) : (
                <ArrowRight style={{ width: 16, height: 16, visibility: 'hidden' }} />
              )}
            </span>
            <span style={{ fontSize: '0.8em', color: '#666', marginRight: '2px' }}>{indexInParent + 1}</span>
            {isEditing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                style={{
                  border: 'none',
                  background: 'white',
                  padding: '1px 4px',
                  margin: '-2px 0',
                  width: '100%',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              node.name
            )}
          </div>
        </td>
        <td style={{ ...styles.cell, ...styles.readinessLevel }}>
          {formatReadinessLevel(node.readinessLevel)}
        </td>
      </tr>
      {expanded && node.children.map((child, index) => (
        <HTableRow
          key={child.id}
          node={child}
          level={level + 1}
          expandedNodes={expandedNodes}
          toggleNode={toggleNode}
          selectNodeById={selectNodeById}
          selectedNode={selectedNode}
          treeStateMethods={treeStateMethods}
          draggedNode={draggedNode}
          setDraggedNode={setDraggedNode}
          dragTarget={dragTarget}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          indexInParent={index}
          parentNode={node}
        />
      ))}
    </>
  )
}
