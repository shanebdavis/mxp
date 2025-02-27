import { FC, useState, useRef, useEffect } from 'react'
import { DragTarget, DragItem } from './types'
import { styles } from './styles'
import { ArrowDropDown, ArrowRight } from '@mui/icons-material'
import { TreeStateMethods } from '../../../useApiForState'
import { EditableRlPill } from '../../widgets'
import type { TreeNode, TreeNodeSet } from '../../../TreeNode'

interface TreeNodeProps {
  nodes: TreeNodeSet
  nodeId: string
  level?: number
  itemNumber: number
  expandedNodes: Record<string, boolean>
  toggleNode: (id: string) => void
  selectNodeById: (nodeId: string) => void
  selectedNode: TreeNode | null
  treeNodesApi: TreeStateMethods
  draggedNode: TreeNode | null
  setDraggedNode: (node: TreeNode | null) => void
  dragTarget: DragTarget
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: () => void
  editingNodeId?: string | null
  setEditingNodeId: (id: string | null) => void
  displayOrder: string[]
  indexInParentMap: Record<string, number>
  isDraftSubtree?: boolean
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
  treeNodesApi,
  draggedNode,
  setDraggedNode,
  dragTarget,
  handleDragOver,
  handleDragLeave,
  editingNodeId,
  setEditingNodeId,
  displayOrder,
  indexInParentMap,
  isDraftSubtree = false,
}) => {
  const node = nodes[nodeId]
  const isValidTarget = draggedNode && draggedNode.id !== nodeId && !treeNodesApi.isParentOf(nodeId, draggedNode.id)
  const isDragTarget = dragTarget.nodeId === nodeId && isValidTarget
  const showAsDraft = isDraftSubtree || node.nodeState === "draft"

  const expanded = expandedNodes[nodeId]
  const isRoot = !node.parentId
  const isSelected = selectedNode?.id === nodeId

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(node.title)
  const [justCreated, setJustCreated] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    if (isEditing) {
      setEditValue(node.title)  // Reset to current title when starting edit
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing, node.title])

  useEffect(() => {
    if (editingNodeId === nodeId) {
      setIsEditing(true)
      setJustCreated(true)
      setEditingNodeId(null)
    }
  }, [editingNodeId, nodeId, setEditingNodeId])

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [isSelected])

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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const dragItem = JSON.parse(e.dataTransfer.getData('application/json')) as DragItem
    if (dragItem.id !== nodeId && !treeNodesApi.isParentOf(dragItem.id, nodeId)) {
      const rect = e.currentTarget.getBoundingClientRect()

      if (dragTarget.position === 'inside') {
        if (node.childrenIds.length > 0 && !expanded) {
          toggleNode(nodeId)
        }
        await treeNodesApi.setNodeParent(dragItem.id, nodeId, 0)
      } else if (!isRoot && node.parentId) {
        const parent = nodes[node.parentId]
        const indexInParent = parent.childrenIds.indexOf(nodeId)
        await treeNodesApi.setNodeParent(
          dragItem.id,
          node.parentId,
          dragTarget.position === 'before' ? indexInParent : indexInParent + 1
        )
      }
      handleDragLeave()
    }
  }

  const handleInputBlur = async () => {
    if (justCreated && editValue.trim() === '') {
      await treeNodesApi.updateNode(nodeId, { title: 'TBD' })
    }
    setIsEditing(false)
  }

  const handleInputKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()

      // Handle blank title
      if (editValue.trim() === '') {
        await treeNodesApi.updateNode(nodeId, { title: 'TBD' })
      } else if (editValue !== node.title) {
        // Save current edits if needed
        await treeNodesApi.updateNode(nodeId, { title: editValue })
      }

      // Clear justCreated since we're saving changes
      setJustCreated(false)

      // For root node, just close the edit box
      if (isRoot) {
        setIsEditing(false)
        return
      }

      // Handle node creation based on modifier keys
      if (e.shiftKey && node.parentId) {  // Shift + Enter - add sibling
        const newNodeId = await treeNodesApi.addNode({
          title: '',
          setMetrics: { readinessLevel: 0 },
        }, node.parentId)
        selectNodeById(newNodeId)
        setEditingNodeId(newNodeId)
      } else if ((e.metaKey || e.ctrlKey)) {  // Command/Ctrl + Enter - add child
        // If this is the first child, clear parent's setMetrics
        if (node.childrenIds.length === 0) {
          await treeNodesApi.updateNode(nodeId, { setMetrics: {} })
        }
        const newNodeId = await treeNodesApi.addNode({
          title: '',
          setMetrics: { readinessLevel: 0 },
        }, nodeId)
        if (!expandedNodes[nodeId]) {
          toggleNode(nodeId)
        }
        selectNodeById(newNodeId)
        setEditingNodeId(newNodeId)
      } else {  // Normal Enter - just save and exit editing
        setIsEditing(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (justCreated) {
        const currentIndex = displayOrder.indexOf(nodeId)
        const nextSelectedId = displayOrder[currentIndex - 1]
        await treeNodesApi.removeNode(nodeId)
        if (nextSelectedId) {
          selectNodeById(nextSelectedId)
        }
      } else {
        setEditValue(node.title)  // Restore original title
        setIsEditing(false)
      }
    }
  }

  // Add this effect for keyboard handling
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
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
            await treeNodesApi.updateNode(nodeId, { setMetrics: { readinessLevel: level } })
          }
          break

        case ' ':  // Space key - start editing current node
          e.preventDefault()
          setIsEditing(true)
          break

        case 'Enter':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {  // Command/Ctrl + Enter - add child
            // If this is the first child, clear parent's setMetrics
            if (node.childrenIds.length === 0) {
              await treeNodesApi.updateNode(nodeId, { setMetrics: {} })
            }
            const newNodeId = await treeNodesApi.addNode({
              title: '',
              setMetrics: { readinessLevel: 0 },
            }, nodeId)

            if (!expandedNodes[nodeId]) {
              toggleNode(nodeId)
            }
            selectNodeById(newNodeId)
            setEditingNodeId(newNodeId)
          } else if (node.parentId) {  // Regular Enter - add sibling (if not root)
            const newNodeId = await treeNodesApi.addNode({
              title: '',
              setMetrics: { readinessLevel: 0 },
            }, node.parentId)

            selectNodeById(newNodeId)
            setEditingNodeId(newNodeId)
          }
          break

        case 'Escape':
          setEditValue(node.title)
          setIsEditing(false)
          break

        case 'ArrowUp':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {
            // Move node up in current parent
            if (node.parentId && nodes[node.parentId]) {
              const parent = nodes[node.parentId]
              const currentIndex = parent.childrenIds.indexOf(nodeId)
              if (currentIndex > 0) {
                try {
                  const result = await treeNodesApi.setNodeParent(nodeId, node.parentId, currentIndex - 1)
                } catch (error) {
                  console.error('Error moving node:', error)
                }
              }
            }
          } else {
            const prevIndex = displayOrder.indexOf(nodeId) - 1
            if (prevIndex >= 0) {
              selectNodeById(displayOrder[prevIndex])
            }
          }
          break

        case 'ArrowDown':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {
            // Move node down in current parent
            if (node.parentId && nodes[node.parentId]) {
              const parent = nodes[node.parentId]
              const currentIndex = parent.childrenIds.indexOf(nodeId)
              if (currentIndex < parent.childrenIds.length - 1) {
                try {
                  await treeNodesApi.setNodeParent(nodeId, node.parentId, currentIndex + 1)
                } catch (error) {
                  console.error('Error moving node:', error)
                }
              }
            }
          } else {
            const nextIndex = displayOrder.indexOf(nodeId) + 1
            if (nextIndex < displayOrder.length) {
              selectNodeById(displayOrder[nextIndex])
            }
          }
          break

        case 'ArrowLeft':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {
            // Move node up one level to join its siblings
            if (node.parentId && nodes[node.parentId]) {
              const parent = nodes[node.parentId]
              if (parent.parentId) {
                await treeNodesApi.setNodeParent(nodeId, parent.parentId)
              }
            }
          } else if (expanded) {
            toggleNode(nodeId)
          } else if (node.parentId) {
            selectNodeById(node.parentId)
          }
          break

        case 'ArrowRight':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {
            // Make this node a child of its previous sibling
            if (node.parentId && nodes[node.parentId]) {
              const currentIndex = indexInParentMap[nodeId]
              if (currentIndex > 0) {
                const prevSiblingId = nodes[node.parentId].childrenIds[currentIndex - 1]
                await treeNodesApi.setNodeParent(nodeId, prevSiblingId)
                if (!expandedNodes[prevSiblingId]) {
                  toggleNode(prevSiblingId)
                }
              }
            }
          } else if (!expanded && node.childrenIds.length > 0) {
            toggleNode(nodeId)
          } else if (node.childrenIds.length > 0) {
            selectNodeById(node.childrenIds[0])
          }
          break

        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          if (!isRoot) {  // Prevent deleting root node
            const currentIndex = displayOrder.indexOf(nodeId)
            const nextSelectedId = displayOrder[currentIndex - 1]
            await treeNodesApi.removeNode(nodeId)
            if (nextSelectedId) {
              selectNodeById(nextSelectedId)
            }
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isSelected,
    isEditing,
    nodeId,
    node,
    expandedNodes,
    toggleNode,
    selectNodeById,
    displayOrder,
    setEditingNodeId,
    treeNodesApi,
    nodes,
    indexInParentMap,
    isRoot
  ])

  return (
    <tr
      ref={rowRef}
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
        <div style={{ ...styles.nameCell, paddingLeft: level * 21 }}>
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
            <span style={{
              color: showAsDraft ? '#777' : 'var(--text-primary)',
              fontStyle: showAsDraft ? 'italic' : 'normal'
            }}>{node.title || '(blank)'}</span>
          )}
        </div>
      </td>
      <td style={styles.cell}>
        <EditableRlPill
          readinessLevel={node.calculatedMetrics.readinessLevel}
          auto={node.setMetrics?.readinessLevel == null}
          onChange={async level => {
            await treeNodesApi.updateNode(nodeId, {
              setMetrics: { readinessLevel: level ?? null }
            })
          }}
        />
      </td>
    </tr>
  )
}
