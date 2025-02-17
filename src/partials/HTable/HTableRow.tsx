import { FC, useState, useRef, useEffect } from 'react'
import { DragTarget, DragItem } from './types'
import { styles } from './styles'
import { ArrowDropDown, ArrowRight } from '@mui/icons-material'
import { TreeStateMethods, TreeNode } from '../../useTreeState'
import { RlPill, RlPillWithDropdown } from '../../widgets'

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
  editingNodeId?: string | null
  setEditingNodeId: (id: string | null) => void
  displayOrder: string[]
  parentMap: Record<string, TreeNode>
  indexInParentMap: Record<string, number>
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
  editingNodeId,
  setEditingNodeId,
  displayOrder,
  parentMap,
  indexInParentMap,
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

  const [isEditingRL, setIsEditingRL] = useState(false)
  const rlRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (editingNodeId === node.id) {
      setIsEditing(true)
      setEditingNodeId(null)
    }
  }, [editingNodeId, node.id])

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

  const handleBlankName = () => {
    if (editValue.trim() === '') {
      if (node.children.length > 0) {
        treeStateMethods.updateNode(node.id, { name: '(blank)' })
      } else {
        const currentIndex = displayOrder.indexOf(node.id)
        const nextSelectedId = displayOrder[currentIndex - 1]
        treeStateMethods.removeNode(node.id)
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
    if (!handleBlankName() && editValue !== node.name) {
      treeStateMethods.updateNode(node.id, { name: editValue })
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()

      // Handle blank name first
      if (!handleBlankName()) {
        // Save current edits if needed
        if (editValue !== node.name) {
          treeStateMethods.updateNode(node.id, { name: editValue })
        }

        // For root node, just close the edit box
        if (isRoot) {
          setIsEditing(false)
          return
        }

        // Handle node creation for non-root nodes
        if (e.metaKey || e.ctrlKey) {  // Command/Ctrl + Enter - add child
          const newNodeId = treeStateMethods.addNode({
            name: '',
            readinessLevel: 0,
          }, node.id)
          if (!expandedNodes[node.id]) {
            toggleNode(node.id)
          }
          selectNodeById(newNodeId)
          setEditingNodeId(newNodeId)
        } else if (parentNode) {  // Regular Enter - add sibling (only if we have a parent)
          const newNodeId = treeStateMethods.addNode({
            name: '',
            readinessLevel: 0,
          }, parentNode.id)
          selectNodeById(newNodeId)
          setEditingNodeId(newNodeId)
        }
      }
    } else if (e.key === 'Escape') {
      handleBlankName()  // Handle blank name on escape
      setIsEditing(false)
    }
  }

  const handleRLClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingRL(true)
  }

  const handleRLSelect = (e: React.MouseEvent, level: number) => {
    e.stopPropagation()  // Stop click from bubbling
    if (level !== node.readinessLevel) {  // Only update if value changed
      treeStateMethods.updateNode(node.id, { readinessLevel: level })
    }
    setIsEditingRL(false)  // Always close picker
  }

  useEffect(() => {
    if (isEditingRL) {
      const handleClickOutside = (e: MouseEvent) => {
        if (rlRef.current && !rlRef.current.contains(e.target as Node)) {
          setIsEditingRL(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isEditingRL])


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
          e.preventDefault()
          const level = parseInt(e.key)
          if (level !== node.readinessLevel) {
            treeStateMethods.updateNode(node.id, { readinessLevel: level })
          }
          break

        case 'Enter':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {  // Command/Ctrl + Enter
            const newNodeId = treeStateMethods.addNode({
              name: '',
              readinessLevel: 0,
            }, node.id)

            if (!expandedNodes[node.id]) {
              toggleNode(node.id)
            }
            selectNodeById(newNodeId)
            setEditingNodeId(newNodeId)
          } else {  // Regular Enter - add sibling
            if (parentNode) {  // Only if we have a parent (not root)
              const newNodeId = treeStateMethods.addNode({
                name: '',
                readinessLevel: 0,
              }, parentNode.id)

              selectNodeById(newNodeId)
              setEditingNodeId(newNodeId)
            }
          }
          break

        case 'Escape':
          setEditValue(node.name)
          setIsEditing(false)
          break

        case ' ':  // Space key
          e.preventDefault()
          setIsEditing(true)
          break

        case 'ArrowLeft':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {  // Command/Ctrl + Left
            // Only if we have a parent and grandparent
            if (parentNode && parentMap[parentNode.id]) {
              const grandparentId = parentMap[parentNode.id].id
              const parentIndex = indexInParentMap[parentNode.id]
              setNodeParent(node.id, grandparentId, parentIndex + 1)
            }
          } else {  // Regular left arrow behavior
            if (node.children.length > 0 && expanded) {
              toggleNode(node.id)
            } else if (parentNode) {
              selectNodeById(parentNode.id)
            }
          }
          break

        case 'ArrowRight':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {  // Command/Ctrl + Right
            if (parentNode && indexInParent > 0) {
              const prevSibling = parentNode.children[indexInParent - 1]
              setNodeParent(node.id, prevSibling.id)  // No index = add to end
              if (!expandedNodes[prevSibling.id]) {
                toggleNode(prevSibling.id)  // Expand the target node
              }
            }
          } else {  // Regular right arrow behavior
            if (node.children.length > 0) {
              if (!expanded) {
                toggleNode(node.id)
              } else {
                selectNodeById(node.children[0].id)
              }
            } else {
              const idx = displayOrder.indexOf(node.id)
              if (idx < displayOrder.length - 1) {
                selectNodeById(displayOrder[idx + 1])
              }
            }
          }
          break

        case 'ArrowUp':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {  // Command/Ctrl + Up
            if (parentNode && indexInParent > 0) {
              setNodeParent(node.id, parentNode.id, indexInParent - 1)
            }
          } else {  // Regular up arrow behavior
            const currentIndex = displayOrder.indexOf(node.id)
            if (currentIndex > 0) {
              selectNodeById(displayOrder[currentIndex - 1])
            }
          }
          break

        case 'ArrowDown':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {  // Command/Ctrl + Down
            if (parentNode && indexInParent < parentNode.children.length - 1) {
              setNodeParent(node.id, parentNode.id, indexInParent + 1)  // Move to next position
            }
          } else {  // Regular down arrow behavior
            const idx = displayOrder.indexOf(node.id)
            if (idx < displayOrder.length - 1) {
              selectNodeById(displayOrder[idx + 1])
            }
          }
          break

        case 'Delete':
        case 'Backspace':  // Add both keys for better UX
          e.preventDefault()
          if (!isRoot) {  // Prevent deleting root node
            const currentIndex = displayOrder.indexOf(node.id)
            const nextSelectedId = displayOrder[currentIndex + 1]  // Get next node instead of previous
            treeStateMethods.removeNode(node.id)
            if (nextSelectedId) {
              selectNodeById(nextSelectedId)  // Select next node
            } else if (currentIndex > 0) {
              // If there is no next node (we're at the end), select the previous node
              selectNodeById(displayOrder[currentIndex - 1])
            }
          }
          break
      }
    }

    if (isSelected) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSelected, isEditing, node, expanded, parentNode, toggleNode, selectNodeById, displayOrder])

  return (
    <>
      <tr
        className="table-row"
        style={{
          ...styles.row,
          ...(isDragTarget && dragTarget.position === 'inside' ? styles.dropTarget.inside : {}),
          ...(isDragTarget && dragTarget.position === 'before' ? { boxShadow: '0 -1px 0 #2196f3, inset 0 1px 0 #2196f3' } : {}),
          ...(isDragTarget && dragTarget.position === 'after' ? { boxShadow: '0 1px 0 #2196f3, inset 0 -1px 0 #2196f3' } : {}),
          backgroundColor: isSelected ? 'var(--selected-color)' : undefined,
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
                  background: 'var(--background-primary)',
                  color: 'var(--text-primary)',
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
        <td
          style={{ ...styles.cell, ...styles.readinessLevel }}
          onClick={handleRLClick}
        >
          <div style={{ position: 'relative' }} ref={rlRef}>
            <RlPill level={node.readinessLevel} />
            {isEditingRL && <RlPillWithDropdown level={node.readinessLevel} handleRLSelect={handleRLSelect} />}
          </div>
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
          editingNodeId={editingNodeId}
          setEditingNodeId={setEditingNodeId}
          displayOrder={displayOrder}
          parentMap={parentMap}
          indexInParentMap={indexInParentMap}
        />
      ))}
    </>
  )
}
