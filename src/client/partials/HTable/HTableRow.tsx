import { FC, useState, useRef, useEffect } from 'react'
import { DragTarget, DragItem } from './types'
import { styles } from './styles'
import { ArrowDropDown, ArrowRight } from '@mui/icons-material'
import { TreeStateMethods } from '../../../useTreeState'
import { EditableRlPill } from '../../widgets'
import type { TreeNode, TreeNodeMap, TreeNodeProperties } from '../../../models'

interface TreeNodeProps {
  nodes: TreeNodeMap
  nodeId: string
  level?: number
  itemNumber: number
  expandedNodes: Record<string, boolean>
  toggleNode: (id: string) => void
  selectNodeById: (nodeId: string) => void
  selectedNode: TreeNode | null
  treeStateMethods: TreeStateMethods
  draggedNode: TreeNode | null
  setDraggedNode: (node: TreeNode | null) => void
  dragTarget: DragTarget
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: () => void
  indexInParent: number
  editingNodeId?: string | null
  setEditingNodeId: (id: string | null) => void
  displayOrder: string[]
  parentMap: Record<string, TreeNode>
  indexInParentMap: Record<string, number>
}

export const HTableRow: FC<TreeNodeProps> = ({
  nodes,
  nodeId,
  level = 0,
  itemNumber,
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
  editingNodeId,
  setEditingNodeId,
  displayOrder,
  parentMap,
  indexInParentMap,
}) => {
  const node = nodes[nodeId]
  const { setNodeParent, isParentOf } = treeStateMethods
  const isValidTarget = draggedNode && draggedNode.id !== nodeId && !isParentOf(nodeId, draggedNode.id)
  const isDragTarget = dragTarget.nodeId === nodeId && isValidTarget

  const expanded = expandedNodes[nodeId]
  const isRoot = !node.parentId
  const isSelected = selectedNode?.id === nodeId

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(node.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (editingNodeId === nodeId) {
      setIsEditing(true)
      setEditingNodeId(null)
    }
  }, [editingNodeId, nodeId, setEditingNodeId])

  const handleRowClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.toggle-button')) {
      if (isSelected) {
        setIsEditing(true)
      } else {
        selectNodeById(nodeId)
      }
    }
  }

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleNode(nodeId)
  }

  const handleDragStart = (e: React.DragEvent) => {
    setDraggedNode(node)
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: nodeId,
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
    if (dragItem.id !== nodeId && !isParentOf(dragItem.id, nodeId)) {
      if (dragTarget.position === 'inside' && node.childrenIds.length > 0 && !expanded) {
        toggleNode(nodeId)
      }

      if (dragTarget.position === 'inside' || isRoot || (expanded && dragTarget.position !== 'before')) {
        setNodeParent(dragItem.id, nodeId, 0)
      } else if (node.parentId) {
        setNodeParent(
          dragItem.id,
          node.parentId,
          dragTarget.position === 'before' ? indexInParent : indexInParent + 1
        )
      }
      handleDragLeave()
    }
  }

  const handleBlankName = () => {
    if (editValue.trim() === '') {
      if (node.childrenIds.length > 0) {
        treeStateMethods.updateNode(nodeId, { title: '(blank)' })
      } else {
        const currentIndex = displayOrder.indexOf(nodeId)
        const nextSelectedId = displayOrder[currentIndex - 1]
        treeStateMethods.removeNode(nodeId)
        if (nextSelectedId) {
          selectNodeById(nextSelectedId)
        }
      }
      return true
    }
    return false
  }

  const handleInputBlur = () => {
    setIsEditing(false)
    if (!handleBlankName() && editValue !== node.title) {
      treeStateMethods.updateNode(nodeId, { title: editValue })
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()

      // Handle blank name first
      if (!handleBlankName()) {
        // Save current edits if needed
        if (editValue !== node.title) {
          treeStateMethods.updateNode(nodeId, { title: editValue })
        }

        // For root node, just close the edit box
        if (isRoot) {
          setIsEditing(false)
          return
        }

        // Handle node creation for non-root nodes
        if (e.metaKey || e.ctrlKey) {  // Command/Ctrl + Enter - add child
          const newNodeId = treeStateMethods.addNode({
            title: '',
            setMetrics: { readinessLevel: 0 },
          }, nodeId)
          if (!expandedNodes[nodeId]) {
            toggleNode(nodeId)
          }
          selectNodeById(newNodeId)
          setEditingNodeId(newNodeId)
        } else if (node.parentId) {  // Regular Enter - add sibling (only if we have a parent)
          const newNodeId = treeStateMethods.addNode({
            title: '',
            setMetrics: { readinessLevel: 0 },
          }, node.parentId)
          selectNodeById(newNodeId)
          setEditingNodeId(newNodeId)
        }
      }
    } else if (e.key === 'Escape') {
      handleBlankName()  // Handle blank name on escape
      setIsEditing(false)
    }
  }

  // Add this effect for keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSelected) return
      if (isEditing) return  // Add this line to prevent handling keys while editing

      switch (e.key) {
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault()
          const level = parseInt(e.key)
          if (level !== node.calculatedMetrics.readinessLevel) {
            treeStateMethods.updateNode(nodeId, { setMetrics: { readinessLevel: level } })
          }
          break

        case 'Enter':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {  // Command/Ctrl + Enter
            const newNodeId = treeStateMethods.addNode({
              title: '',
              setMetrics: { readinessLevel: 0 },
            }, nodeId)

            if (!expandedNodes[nodeId]) {
              toggleNode(nodeId)
            }
            selectNodeById(newNodeId)
            setEditingNodeId(newNodeId)
          } else {  // Regular Enter - add sibling
            if (node.parentId) {  // Only if we have a parent (not root)
              const newNodeId = treeStateMethods.addNode({
                title: '',
                setMetrics: { readinessLevel: 0 },
              }, node.parentId)

              selectNodeById(newNodeId)
              setEditingNodeId(newNodeId)
            }
          }
          break

        case 'Escape':
          setEditValue(node.title)
          setIsEditing(false)
          break

        case ' ':  // Space key
          e.preventDefault()
          toggleNode(nodeId)
          break

        case 'ArrowUp':
          e.preventDefault()
          const prevIndex = displayOrder.indexOf(nodeId) - 1
          if (prevIndex >= 0) {
            selectNodeById(displayOrder[prevIndex])
          }
          break

        case 'ArrowDown':
          e.preventDefault()
          const nextIndex = displayOrder.indexOf(nodeId) + 1
          if (nextIndex < displayOrder.length) {
            selectNodeById(displayOrder[nextIndex])
          }
          break

        case 'ArrowLeft':
          e.preventDefault()
          if (expanded) {
            toggleNode(nodeId)
          } else if (node.parentId) {
            selectNodeById(node.parentId)
          }
          break

        case 'ArrowRight':
          e.preventDefault()
          if (!expanded && node.childrenIds.length > 0) {
            toggleNode(nodeId)
          } else if (node.childrenIds.length > 0) {
            selectNodeById(node.childrenIds[0])
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelected, isEditing, nodeId, node, expandedNodes, toggleNode, selectNodeById, displayOrder, setEditingNodeId, treeStateMethods])

  return (
    <tr
      style={{
        ...styles.row,
        ...(isSelected ? styles.selectedRow : {}),
        ...(isDragTarget ? styles.dragTargetRow : {}),
      }}
      onClick={handleRowClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <td style={styles.cell}>
        <div style={{ ...styles.nameCell, paddingLeft: level * 16 }}>
          <div style={{ width: 24, display: 'inline-flex', justifyContent: 'center' }}>
            {node.childrenIds.length > 0 && (
              <button
                className="toggle-button"
                onClick={handleToggleClick}
                style={styles.toggleButton}
              >
                {expanded ? <ArrowDropDown /> : <ArrowRight />}
              </button>
            )}
          </div>
          <span style={{ marginRight: 8, opacity: 0.5 }}>{itemNumber}</span>
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              style={styles.input}
            />
          ) : (
            <span>{node.title || '(blank)'}</span>
          )}
        </div>
      </td>
      <td style={styles.cell}>
        <EditableRlPill
          readinessLevel={node.calculatedMetrics.readinessLevel}
          onChange={(level: number) => treeStateMethods.updateNode(nodeId, { setMetrics: { readinessLevel: level } })}
        />
      </td>
    </tr>
  )
}
