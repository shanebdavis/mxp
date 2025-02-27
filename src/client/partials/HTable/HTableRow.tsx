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
  selectNodeWithoutFocus?: (nodeId: string) => void
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
  isFocused?: boolean
}

export const HTableRow: FC<TreeNodeProps> = ({
  nodes,
  nodeId,
  level = 0,
  itemNumber,
  expandedNodes,
  toggleNode,
  selectNodeById,
  selectNodeWithoutFocus,
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
  isFocused = true,
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
  const wasFocusedRef = useRef(isFocused)
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLTableRowElement>(null)

  // Update the wasFocused ref after each render
  useEffect(() => {
    wasFocusedRef.current = isFocused;
  });

  // Add styles for unfocused selected rows
  const unfocusedSelectedStyle = {
    backgroundColor: 'rgba(var(--selected-color-rgb, 0, 120, 255), 0.15)',
    color: 'var(--text-secondary)',
  }

  // Local selection function for keyboard navigation that doesn't change focus
  const localSelectNode = (id: string) => {
    if (isFocused) {
      if (selectNodeWithoutFocus) {
        // Use the selectNodeWithoutFocus prop if available
        selectNodeWithoutFocus(id);
      } else {
        // Fall back to the original behavior
        selectNodeById(id);
      }
    }
  }

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
      // Focus the row when selected to ensure it receives keyboard events
      rowRef.current.focus()
    }
  }, [isSelected])

  const handleRowClick = (e: React.MouseEvent) => {
    // Ignore clicks on the toggle button
    if ((e.target as HTMLElement).closest('.toggle-button')) {
      return;
    }

    // Only enter edit mode if the row was already selected AND the section was already focused
    if (isSelected && wasFocusedRef.current) {
      setIsEditing(true);
    }
    // Otherwise just select the row (don't start editing)
    else {
      // For mouse clicks, use selectNodeById which will change focus to this section
      selectNodeById(nodeId);
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
    if (editValue.trim() === '') {
      // If empty, use 'TBD' as a placeholder
      await treeNodesApi.updateNode(nodeId, { title: 'TBD' })
    } else if (editValue !== node.title) {
      // Save changes if the title has been modified
      await treeNodesApi.updateNode(nodeId, { title: editValue })
    }

    // Clear justCreated flag since we're saving changes
    if (justCreated) {
      setJustCreated(false)
    }

    setIsEditing(false)
  }

  const handleInputKeyDown = async (e: React.KeyboardEvent) => {
    console.log(`Input keydown: ${e.key}, meta: ${e.metaKey}, shift: ${e.shiftKey}`);

    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        e.stopPropagation();

        // Handle special Enter key combinations even in edit mode
        if (e.metaKey || e.ctrlKey) {
          // First save current edits
          const newTitle = editValue.trim() || 'TBD'
          if (newTitle !== node.title) {
            await treeNodesApi.updateNode(nodeId, { title: newTitle })
          }
          setIsEditing(false)

          // Then add child node
          if (node.childrenIds.length === 0) {
            await treeNodesApi.updateNode(nodeId, { setMetrics: {} })
          }
          const newNodeId = await treeNodesApi.addNode({
            title: '',
            setMetrics: { readinessLevel: 0 },
          }, nodeId)

          if (newNodeId) {
            if (!expandedNodes[nodeId]) {
              toggleNode(nodeId)
            }
            localSelectNode(newNodeId)
            setEditingNodeId(newNodeId)
          }
          return
        }

        if (e.shiftKey && node.parentId) {
          // First save current edits
          const newTitle = editValue.trim() || 'TBD'
          if (newTitle !== node.title) {
            await treeNodesApi.updateNode(nodeId, { title: newTitle })
          }
          setIsEditing(false)

          // Then add sibling node
          const newNodeId = await treeNodesApi.addNode({
            title: '',
            setMetrics: { readinessLevel: 0 },
          }, node.parentId)

          if (newNodeId) {
            localSelectNode(newNodeId)
            setEditingNodeId(newNodeId)
          }
          return
        }

        // Default behavior for Enter - save edits
        const newTitle = editValue.trim()
        if (newTitle) {
          if (newTitle !== node.title) {
            await treeNodesApi.updateNode(nodeId, { title: newTitle })
          }
        } else {
          // If title is blank, set to 'TBD'
          await treeNodesApi.updateNode(nodeId, { title: 'TBD' })
        }

        // Stop editing for root nodes
        if (isRoot) {
          setIsEditing(false)
        } else {
          // For non-root nodes, find and select the next node
          const nextIndex = displayOrder.indexOf(nodeId) + 1
          if (nextIndex < displayOrder.length) {
            localSelectNode(displayOrder[nextIndex])
          }
          setIsEditing(false)
        }
        break
      }

      case 'Escape': {
        e.preventDefault()
        setEditValue(node.title)
        setIsEditing(false)
        // If this was a new node (empty title), remove it on cancel
        if (!node.title && !isRoot) {
          await treeNodesApi.removeNode(nodeId)
          if (node.parentId) {
            localSelectNode(node.parentId)
          }
        }
        break
      }

      default:
        // Allow all other keys to be processed normally
        break
    }
  }

  // Handle keyboard events for this row when focused and selected
  useEffect(() => {
    // Only attach the handler if the section is focused, row is selected, and not in edit mode
    if (wasFocusedRef.current && isSelected && !isEditing) {
      const handleKeyDown = async (e: KeyboardEvent) => {
        // Only handle if not already handled and the event isn't from an input element
        if (e.defaultPrevented ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement) {
          return;
        }

        console.log(`HTableRow keydown: ${e.key}, meta: ${e.metaKey}, shift: ${e.shiftKey}, ctrl: ${e.ctrlKey}`);

        switch (e.key) {
          case 'Enter': {
            // Different Enter key combinations
            if (e.metaKey || e.ctrlKey) {
              // Command/Ctrl + Enter = Add child
              e.preventDefault();
              e.stopPropagation();
              console.log('Adding child node via keyboard');
              if (node.childrenIds.length === 0) {
                await treeNodesApi.updateNode(nodeId, { setMetrics: {} });
              }
              const newNodeId = await treeNodesApi.addNode({
                title: '',
                setMetrics: { readinessLevel: 0 },
              }, nodeId);

              if (newNodeId) {
                if (!expandedNodes[nodeId]) {
                  toggleNode(nodeId);
                }
                localSelectNode(newNodeId);
                setEditingNodeId(newNodeId);
              }
            }
            else if (e.shiftKey && node.parentId) {
              // Shift + Enter = Add sibling (if not root)
              e.preventDefault();
              e.stopPropagation();
              console.log('Adding sibling node via keyboard');
              const newNodeId = await treeNodesApi.addNode({
                title: '',
                setMetrics: { readinessLevel: 0 },
              }, node.parentId);

              if (newNodeId) {
                localSelectNode(newNodeId);
                setEditingNodeId(newNodeId);
              }
            }
            else {
              // Just Enter = Edit mode
              e.preventDefault();
              e.stopPropagation();
              console.log('Starting edit mode via keyboard');
              setIsEditing(true);
            }
            break;
          }

          // Rest of keyboard shortcuts from original handler
          case '0':
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
          case '8':
          case '9': {
            e.preventDefault();
            const level = parseInt(e.key);
            if (level !== node.calculatedMetrics.readinessLevel) {
              await treeNodesApi.updateNode(nodeId, { setMetrics: { readinessLevel: level } });
            }
            break;
          }

          case ' ': {  // Space key - start editing current node
            e.preventDefault();
            setIsEditing(true);
            break;
          }

          case 'Escape': {
            setEditValue(node.title);
            setIsEditing(false);
            break;
          }

          case 'ArrowUp': {
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) {
              // Move node up in current parent
              if (node.parentId && nodes[node.parentId]) {
                const parent = nodes[node.parentId];
                const currentIndex = parent.childrenIds.indexOf(nodeId);
                if (currentIndex > 0) {
                  try {
                    await treeNodesApi.setNodeParent(nodeId, node.parentId, currentIndex - 1);
                  } catch (error) {
                    console.error('Error moving node:', error);
                  }
                }
              }
            } else {
              const prevIndex = displayOrder.indexOf(nodeId) - 1;
              if (prevIndex >= 0) {
                localSelectNode(displayOrder[prevIndex]);
              }
            }
            break;
          }

          case 'ArrowDown': {
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) {
              // Move node down in current parent
              if (node.parentId && nodes[node.parentId]) {
                const parent = nodes[node.parentId];
                const currentIndex = parent.childrenIds.indexOf(nodeId);
                if (currentIndex < parent.childrenIds.length - 1) {
                  try {
                    await treeNodesApi.setNodeParent(nodeId, node.parentId, currentIndex + 1);
                  } catch (error) {
                    console.error('Error moving node:', error);
                  }
                }
              }
            } else {
              const nextIndex = displayOrder.indexOf(nodeId) + 1;
              if (nextIndex < displayOrder.length) {
                localSelectNode(displayOrder[nextIndex]);
              }
            }
            break;
          }

          case 'ArrowLeft': {
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) {
              // Move node up one level to join its siblings
              if (node.parentId && nodes[node.parentId]) {
                const parent = nodes[node.parentId];
                if (parent.parentId) {
                  await treeNodesApi.setNodeParent(nodeId, parent.parentId);
                }
              }
            } else if (expanded) {
              toggleNode(nodeId);
            } else if (node.parentId) {
              localSelectNode(node.parentId);
            }
            break;
          }

          case 'ArrowRight': {
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) {
              // Make this node a child of its previous sibling
              if (node.parentId && nodes[node.parentId]) {
                const currentIndex = indexInParentMap[nodeId];
                if (currentIndex > 0) {
                  const prevSiblingId = nodes[node.parentId].childrenIds[currentIndex - 1];
                  await treeNodesApi.setNodeParent(nodeId, prevSiblingId);
                  if (!expandedNodes[prevSiblingId]) {
                    toggleNode(prevSiblingId);
                  }
                }
              }
            } else if (!expanded && node.childrenIds.length > 0) {
              toggleNode(nodeId);
            } else if (node.childrenIds.length > 0) {
              localSelectNode(node.childrenIds[0]);
            }
            break;
          }

          case 'Delete':
          case 'Backspace': {
            e.preventDefault();
            if (!isRoot) {  // Prevent deleting root node
              const currentIndex = displayOrder.indexOf(nodeId);
              const nextSelectedId = displayOrder[currentIndex - 1];
              await treeNodesApi.removeNode(nodeId);
              if (nextSelectedId) {
                localSelectNode(nextSelectedId);
              }
            }
            break;
          }

          // For all other keys, also stop propagation and log
          default: {
            // We're adding stopPropagation to all handled keyboard cases
            if (e.key.startsWith('Arrow') ||
              e.key === 'Delete' ||
              e.key === 'Backspace' ||
              e.key === 'Escape' ||
              e.key === ' ' ||
              // Only stop propagation for number keys when Alt is NOT pressed
              // This allows Option+1-4 shortcuts to reach the global handler
              (!e.altKey && e.key >= '0' && e.key <= '9')) {
              e.stopPropagation();
            }
          }
        }
      };

      // Use capture phase to get the event before other handlers
      document.addEventListener('keydown', handleKeyDown, true);

      return () => {
        document.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [
    wasFocusedRef.current,
    isSelected,
    isEditing,
    nodeId,
    node,
    toggleNode,
    expandedNodes,
    localSelectNode,
    setEditingNodeId,
    expanded,
    nodes,
    displayOrder,
    indexInParentMap,
    isRoot,
    setEditValue
  ]);

  return (
    <tr
      ref={rowRef}
      style={{
        ...styles.row,
        ...(isSelected ? (isFocused ? styles.selectedRow : unfocusedSelectedStyle) : {}),
        ...(isDragTarget ? styles.dragTargetRow : {}),
      }}
      onClick={handleRowClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      tabIndex={0} // Make row focusable for keyboard events
    >
      <td style={styles.cell}>
        <div style={{ ...styles.nameCell, paddingLeft: level * 21 }}>
          <div style={{ width: 24, display: 'inline-flex', justifyContent: 'center' }}>
            {node.childrenIds.length > 0 && (
              <button
                className="toggle-button"
                onClick={handleToggleClick}
                style={styles.toggleButton}
                tabIndex={-1}
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
              autoFocus
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
