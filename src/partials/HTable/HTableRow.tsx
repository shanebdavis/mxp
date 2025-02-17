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

  const handleInputBlur = () => {
    setIsEditing(false)
    if (editValue !== node.name) {
      treeStateMethods.updateNode(node.id, { name: editValue })
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()

      // Save current edits
      if (editValue !== node.name) {
        treeStateMethods.updateNode(node.id, { name: editValue })
      }

      // Handle node creation
      if (e.metaKey || e.ctrlKey) {  // Command/Ctrl + Enter - add child
        const newNodeId = treeStateMethods.addNode({
          name: 'New Item',
          readinessLevel: 0,
          parentId: node.id,
        })
        if (!expandedNodes[node.id]) {
          toggleNode(node.id)
        }
        selectNodeById(newNodeId)
        setEditingNodeId(newNodeId)
      } else {  // Regular Enter - add sibling
        if (parentNode) {  // Only if we have a parent (not root)
          const newNodeId = treeStateMethods.addNode({
            name: 'New Item',
            readinessLevel: 0,
            parentId: parentNode.id,
            afterId: node.id,
          })
          selectNodeById(newNodeId)
          setEditingNodeId(newNodeId)
        }
      }
    } else if (e.key === 'Escape') {
      setEditValue(node.name)
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

  const RLPill = ({ level }: { level: number }) => (
    <div style={{
      ...styles.readinessLevelPill,
      backgroundColor: styles.readinessLevelColors[level as keyof typeof styles.readinessLevelColors],
      // Darken text for yellow which needs better contrast
    }}>
      {formatReadinessLevel(level)}
    </div>
  )

  // Add this effect for keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSelected) return
      if (isEditing) return  // Add this line to prevent handling keys while editing

      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          if (e.metaKey || e.ctrlKey) {  // Command/Ctrl + Enter
            const newNodeId = treeStateMethods.addNode({
              name: 'New Item',
              readinessLevel: 0,
              parentId: node.id,
            })
            if (!expandedNodes[node.id]) {
              toggleNode(node.id)
            }
            selectNodeById(newNodeId)
            setEditingNodeId(newNodeId)
          } else {  // Regular Enter - add sibling
            if (parentNode) {  // Only if we have a parent (not root)
              const newNodeId = treeStateMethods.addNode({
                name: 'New Item',
                readinessLevel: 0,
                parentId: parentNode.id,
                afterId: node.id,
              })
              selectNodeById(newNodeId)
              setEditingNodeId(newNodeId)
            }
          }
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
            const nextSelectedId = displayOrder[currentIndex - 1]  // Get previous node
            treeStateMethods.removeNode(node.id)
            if (nextSelectedId) {
              selectNodeById(nextSelectedId)  // Select previous node
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
        <td
          style={{ ...styles.cell, ...styles.readinessLevel }}
          onClick={handleRLClick}
        >
          <div style={{ position: 'relative' }} ref={rlRef}>
            <RLPill level={node.readinessLevel} />
            {isEditingRL && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: 4,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 1000,
                padding: '4px',
                display: 'flex',
                flexDirection: 'column' as const,
                gap: '4px',
              }}>
                {[0, 1, 2, 3, 4, 5, 6].map(level => (
                  <div
                    key={level}
                    onClick={(e) => handleRLSelect(e, level)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '4px',
                      padding: '2px',
                    }}
                  >
                    <RLPill level={level} />
                  </div>
                ))}
              </div>
            )}
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
