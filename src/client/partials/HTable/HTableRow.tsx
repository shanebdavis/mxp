import { FC, useState, useRef, useEffect } from 'react'
import { DragTarget, DragItem } from './types'
import { styles } from './styles'
import { ArrowDropDown, ArrowRight, Map, CheckCircle, AutoMode } from '@mui/icons-material'
import { TreeStateMethods } from '../../../useApiForState'
import { EditableRlPill, RlPill } from '../../widgets'
import type { TreeNode, TreeNodeSet, TreeNodeProperties } from '../../../TreeNode/TreeNodeTypes'
import { Tooltip } from '@mui/material'
import { ViewStateMethods } from '../../../ViewStateMethods'
import { timeout } from '../../../ArtStandardLib'

interface TreeNodeProps {
  nodes: TreeNodeSet
  nodeId: string
  level?: number
  itemNumber: number
  expandedNodes: Record<string, boolean>
  toggleNode: (id: string) => void
  selectedNode: TreeNode | null
  treeNodesApi: TreeStateMethods
  viewStateMethods: ViewStateMethods
  draggedNode: TreeNode | null
  setDraggedNode: (node: TreeNode | null) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: () => void
  handleDragEnd?: () => void
  editingNodeId?: string | null
  displayOrder: string[]
  indexInParentMap: Record<string, number>
  isDraftSubtree?: boolean
  isFocused?: boolean
  showReadinessColumn?: boolean
  showWaypointColumns?: boolean
  dropPreview?: {
    dropParentId: string | null;
    insertAtIndex: number | null;
  }
}

export const HTableRow: FC<TreeNodeProps> = ({
  displayOrder,
  draggedNode,
  editingNodeId,
  expandedNodes,
  handleDragLeave,
  handleDragOver,
  indexInParentMap,
  isDraftSubtree = false,
  isFocused = true,
  itemNumber,
  level = 0,
  nodeId,
  nodes,
  selectedNode,
  setDraggedNode,
  toggleNode,
  treeNodesApi,
  viewStateMethods,
  dropPreview = { dropParentId: null, insertAtIndex: null },
  handleDragEnd: externalHandleDragEnd
}) => {
  const node = nodes[nodeId]
  const isValidTarget = draggedNode && draggedNode.id !== nodeId && !treeNodesApi.isParentOf(nodeId, draggedNode.id)
  const isDragTarget = dropPreview.dropParentId === nodeId && isValidTarget
  const showAsDraft = isDraftSubtree || node.nodeState === "draft"

  const expanded = expandedNodes[nodeId]
  const isRoot = !node.parentId
  const isSelected = selectedNode?.id === nodeId
  const isEditing = editingNodeId === nodeId
  const [editValue, setEditValue] = useState(node.title)
  const [justCreated, setJustCreated] = useState(false)
  const [isEditingWorkRemaining, setIsEditingWorkRemaining] = useState(false)
  const [workRemainingValue, setWorkRemainingValue] = useState('')
  const [isWorkRemainingHovered, setIsWorkRemainingHovered] = useState(false)
  const wasFocusedRef = useRef(isFocused)
  const inputRef = useRef<HTMLInputElement>(null)
  const workRemainingInputRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLTableRowElement>(null)
  const [isMapRefHovered, setIsMapRefHovered] = useState(false)

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
    // Only call selectNodeAndFocus if the node is not already selected
    if (isFocused && (!selectedNode || selectedNode.id !== id)) {
      viewStateMethods.selectNodeAndFocus(nodes[id]);
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
      setJustCreated(true)
    }
  }, [editingNodeId, nodeId, viewStateMethods])

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      // Focus the row when selected to ensure it receives keyboard events
      rowRef.current.focus()
    }
  }, [isSelected])

  const handleRowClick = (e: React.MouseEvent) => {

    // Ignore clicks on the toggle button or any cell with a click handler
    if ((e.target as HTMLElement).closest('.toggle-button') ||
      (e.target as HTMLElement).closest('[data-has-click-handler="true"]')) {
      return;
    }

    // Already selected node, and suitable for editing (focused and no reference node)
    if (isSelected && wasFocusedRef.current && !node.metadata?.referenceMapNodeId) {
      e.stopPropagation(); // Prevent event from bubbling up
      e.preventDefault(); // Prevent default behavior
      viewStateMethods.setEditingNodeId(nodeId)
      return;
    }

    // Not selected yet, select the node first
    if (!isSelected) {
      localSelectNode(nodeId);
    }
  }

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleNode(nodeId)
  }

  const handleMapReferenceClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.metadata?.referenceMapNodeId) {
      viewStateMethods.selectNodeAndFocus(nodes[node.metadata.referenceMapNodeId])
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    setDraggedNode(node)
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: nodeId,
      parentId: null,
      type: node.type
    }))
  }

  const handleDragEnd = () => {
    setDraggedNode(null)
    handleDragLeave()
    // Call external handler if provided
    if (externalHandleDragEnd) {
      externalHandleDragEnd()
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const dragItem = JSON.parse(e.dataTransfer.getData('application/json')) as DragItem
    if (dragItem.id !== nodeId && !treeNodesApi.isParentOf(dragItem.id, nodeId)) {
      const rect = e.currentTarget.getBoundingClientRect()

      // Check if we're dropping a map node onto a waypoint node
      const draggedNode = nodes[dragItem.id]
      if (draggedNode && (dragItem.type === "map" || draggedNode.type === "map") && node.type === "waypoint") {
        // Calculate target readiness level: source map node's readiness level + 1 (max of 9)
        const sourceReadinessLevel = draggedNode.calculatedMetrics.readinessLevel;
        const targetReadinessLevel = typeof sourceReadinessLevel === 'number' && sourceReadinessLevel >= 0
          ? Math.min(sourceReadinessLevel + 1, 9)
          : undefined;

        // Create a new waypoint node with reference to the map node
        const newWaypointProperties: TreeNodeProperties = {
          title: draggedNode.title,
          metadata: {
            referenceMapNodeId: draggedNode.id
          },
          setMetrics: {
            targetReadinessLevel,
            workRemaining: 1 // Default to 1 unit of work remaining
          }
        }

        // Use dropPreview to determine target parent and position
        if (dropPreview.dropParentId !== null) {
          // Add node based on the dropPreview state
          await treeNodesApi.addNode(
            newWaypointProperties,
            dropPreview.dropParentId,
            dropPreview.insertAtIndex ?? undefined
          );

          // Ensure parent node is expanded if needed
          if (!expandedNodes[dropPreview.dropParentId] &&
            nodes[dropPreview.dropParentId].childrenIds?.length > 0) {
            toggleNode(dropPreview.dropParentId);
          }
        }
      } else {
        // Regular node movement (not map-to-waypoint)
        // Use dropPreview to determine target parent and position
        if (dropPreview.dropParentId !== null) {
          // Move node based on the dropPreview state
          await treeNodesApi.setNodeParent(
            dragItem.id,
            dropPreview.dropParentId,
            dropPreview.insertAtIndex ?? undefined
          );

          // Ensure parent node is expanded if needed
          if (!expandedNodes[dropPreview.dropParentId] &&
            nodes[dropPreview.dropParentId].childrenIds?.length > 0) {
            toggleNode(dropPreview.dropParentId);
          }
        }
      }
      handleDragLeave()
    }
  }

  const handleInputBlur = async () => {

    try {
      if (editValue.trim() === '') {
        // If empty, use 'TBD' as a placeholder
        await treeNodesApi.updateNode(nodeId, { title: 'TBD' });
      } else if (editValue !== node.title) {
        // Save changes if the title has been modified
        await treeNodesApi.updateNode(nodeId, { title: editValue });
      }

      // Clear justCreated flag since we're saving changes
      if (justCreated) {
        setJustCreated(false);
      }
    } catch (error) {
      console.error('Error saving title:', error);
    } finally {
      // Always exit edit mode
      if (editingNodeId !== nodeId) {
        clearEditing()
      }
    }
  }

  const clearEditing = () => viewStateMethods.setEditingNodeId(null)

  const handleInputKeyDown = async (e: React.KeyboardEvent) => {
    e.stopPropagation();

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
          clearEditing()

          await timeout(10)

          await viewStateMethods.addAndFocusNode({ title: '' }, nodeId)
          return
        }

        if (e.shiftKey && node.parentId) {
          // First save current edits
          const newTitle = editValue.trim() || 'TBD'
          if (newTitle !== node.title) {
            await treeNodesApi.updateNode(nodeId, { title: newTitle })
          }
          clearEditing()

          await timeout(10)

          await viewStateMethods.addAndFocusNode({ title: '' }, node.parentId)
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
        if (!isRoot) {
          // For non-root nodes, find and select the next node
          const nextIndex = displayOrder.indexOf(nodeId) + 1
          if (nextIndex < displayOrder.length) {
            localSelectNode(displayOrder[nextIndex])
          }
        }
        clearEditing()
        break
      }

      case 'Escape': {
        e.preventDefault();
        setEditValue(node.title);
        clearEditing()
        // If this was a new node (empty title), remove it on cancel
        if (!node.title && !isRoot) {
          await treeNodesApi.removeNode(nodeId)
          if (node.parentId) {
            localSelectNode(node.parentId)
          }
        }
        break;
      }

      default:
        // Allow all other keys to be processed normally
        break
    }
  }

  // Handle work remaining input blur
  const handleWorkRemainingBlur = async () => {

    try {
      if (workRemainingValue === '') {
        // If empty, clear the workRemaining property
        await treeNodesApi.updateNode(nodeId, {
          setMetrics: { workRemaining: null }
        });
      } else {
        const parsedValue = parseInt(workRemainingValue, 10);
        if (!isNaN(parsedValue) && parsedValue >= 0) {
          await treeNodesApi.updateNode(nodeId, {
            setMetrics: { workRemaining: parsedValue }
          });
        }
      }
    } catch (error) {
      console.error('Error saving work remaining:', error);
    } finally {
      // Always exit edit mode
      setIsEditingWorkRemaining(false);
    }
  }

  // Handle work remaining key down
  const handleWorkRemainingKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();

    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        handleWorkRemainingBlur();
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setIsEditingWorkRemaining(false);
        break;
      }
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

        switch (e.key) {
          case 'Enter': {
            // Different Enter key combinations
            if (e.metaKey || e.ctrlKey) {
              // Command/Ctrl + Enter = Add child
              e.preventDefault();
              e.stopPropagation();
              if (node.childrenIds.length === 0) {
                await treeNodesApi.updateNode(nodeId, { setMetrics: {} });
              }
              await viewStateMethods.addAndFocusNode({ title: '' }, nodeId)
            }
            else if (e.shiftKey && node.parentId) {
              // Shift + Enter = Add sibling (if not root)
              e.preventDefault();
              e.stopPropagation();
              await viewStateMethods.addAndFocusNode({ title: '' }, node.parentId)
            }
            else {
              // Just Enter = Edit mode
              e.preventDefault();
              e.stopPropagation();
              viewStateMethods.setEditingNodeId(nodeId)
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

            if (node.type === 'waypoint') {
              // For waypoints, set targetReadinessLevel
              if (level !== node.calculatedMetrics.targetReadinessLevel) {
                await treeNodesApi.updateNode(nodeId, { setMetrics: { targetReadinessLevel: level } });
              }
            } else {
              // For maps, set readinessLevel
              if (level !== node.calculatedMetrics.readinessLevel) {
                await treeNodesApi.updateNode(nodeId, { setMetrics: { readinessLevel: level } });
              }
            }
            break;
          }

          case ' ': {  // Space key - start editing current node
            e.preventDefault();
            viewStateMethods.setEditingNodeId(nodeId)
            break;
          }

          case 'Escape': {
            setEditValue(node.title);
            clearEditing()
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
    expanded,
    nodes,
    displayOrder,
    indexInParentMap,
    isRoot,
    setEditValue
  ]);

  // Add effect to focus work remaining input when editing starts
  useEffect(() => {
    if (isEditingWorkRemaining) {
      const currentValue = node.setMetrics?.workRemaining;
      setWorkRemainingValue(currentValue !== undefined ? currentValue.toString() : '');
      workRemainingInputRef.current?.focus();
      workRemainingInputRef.current?.select();
    }
  }, [isEditingWorkRemaining, node.setMetrics?.workRemaining]);

  const isWayPoint = node.type === 'waypoint'
  const showReadinessLevel = node.type === 'map' || (node.type === 'waypoint' && node.parentId != null)
  const hasMapReference = node.metadata?.referenceMapNodeId != null

  // Get child nodes if this is the drop parent
  const isDropParent = dropPreview.dropParentId === nodeId;

  // These checks only make sense if this node is a child of the drop parent
  const isChildOfDropParent = node.parentId === dropPreview.dropParentId;

  // Determine if this node is the child that will be before or after the insertion point
  const isInsertBefore = isChildOfDropParent &&
    dropPreview.insertAtIndex !== null &&
    // This node's index in parent must exactly match the insert index
    node.parentId && nodes[node.parentId]?.childrenIds.indexOf(nodeId) === dropPreview.insertAtIndex;

  const isInsertAfter = isChildOfDropParent &&
    dropPreview.insertAtIndex !== null &&
    // This node's index in parent must be exactly one before the insert index
    node.parentId && nodes[node.parentId]?.childrenIds.indexOf(nodeId) === (dropPreview.insertAtIndex - 1);

  // Create gradient styles for insertion indicator
  const insertBeforeGradientStyle = {
    background: 'linear-gradient(to top, transparent 90%, rgba(25, 118, 210, 0.4) 100%)'
  };

  const insertAfterGradientStyle = {
    background: 'linear-gradient(to bottom, transparent 90%, rgba(25, 118, 210, 0.4) 100%)'
  };

  // Get the appropriate style based on the node's relationship to the insert position
  const getDropHighlightStyle = () => {
    if (isDropParent) {
      return { backgroundColor: 'rgba(25, 118, 210, 0.1)' };
    } else if (isInsertBefore) {
      return insertBeforeGradientStyle;
    } else if (isInsertAfter) {
      return insertAfterGradientStyle;
    }
    return {};
  };

  return (
    <tr
      ref={rowRef}
      style={{
        ...styles.row,
        ...(isSelected ? (isFocused ? styles.selectedRow : unfocusedSelectedStyle) : {}),
        ...(isDragTarget ? styles.dragTargetRow : {}),
        outline: 'none',
        ...getDropHighlightStyle()
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
          {itemNumber > 0 ? <span style={{ marginRight: 8, opacity: 0.5 }}>{itemNumber}</span> : null}
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              style={styles.input}
              autoFocus
              data-editing="true"
            />
          ) : (
            <>
              {node.metadata?.referenceMapNodeId && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    marginRight: 6,
                    color: isMapRefHovered ? '#1976d2' : '#666',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    backgroundColor: isMapRefHovered ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                  onClick={handleMapReferenceClick}
                  onMouseEnter={() => setIsMapRefHovered(true)}
                  onMouseLeave={() => setIsMapRefHovered(false)}
                >
                  <Tooltip title="Click to navigate to the referenced map">
                    <Map sx={{ fontSize: 18 }} />
                  </Tooltip>
                </span>
              )}
              <span style={{
                color: showAsDraft ? '#777' : 'var(--text-primary)',
                fontStyle: showAsDraft ? 'italic' : 'normal'
              }}>{node.metadata?.referenceMapNodeId ?
                (nodes[node.metadata.referenceMapNodeId]?.title || '(referenced map not found)') :
                (node.title || '(blank)')}</span>
            </>
          )}
        </div>
      </td>
      {showReadinessLevel && [
        /* Readiness Level Cell */
        <td key="readiness" style={styles.cell}>
          <EditableRlPill
            readinessLevel={node.calculatedMetrics.readinessLevel}
            auto={node.setMetrics?.readinessLevel == null}
            onChange={async level => {
              await treeNodesApi.updateNode(
                isWayPoint && node.metadata?.referenceMapNodeId || nodeId,
                { setMetrics: { readinessLevel: level ?? null } })
            }}
          />
        </td>
      ]}
      {isWayPoint && [
        /* Target Readiness Level Cell */
        !showReadinessLevel && <td key="empty" style={styles.cell}></td>,
        <td key="target" style={styles.cell}>
          <EditableRlPill
            readinessLevel={node.calculatedMetrics.targetReadinessLevel}
            auto={node.setMetrics?.targetReadinessLevel == null}
            onChange={async level => {
              await treeNodesApi.updateNode(nodeId, {
                setMetrics: { targetReadinessLevel: level ?? null }
              })
            }}
          />
        </td>,
        <td key="work-remaining" style={styles.cell}>
          {(
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--background-secondary)',
                minWidth: '40px',
                justifyContent: 'center'
              }}
              data-has-click-handler="true"
              onMouseEnter={() => setIsWorkRemainingHovered(true)}
              onMouseLeave={() => setIsWorkRemainingHovered(false)}
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditingWorkRemaining) {
                  setIsEditingWorkRemaining(true);
                }
              }}
            >
              {isEditingWorkRemaining ? (
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input
                    ref={workRemainingInputRef}
                    value={workRemainingValue}
                    onChange={(e) => setWorkRemainingValue(e.target.value)}
                    onBlur={handleWorkRemainingBlur}
                    onKeyDown={handleWorkRemainingKeyDown}
                    style={{
                      ...styles.input,
                      width: '100%',
                      textAlign: 'center',
                      padding: '0',
                    }}
                    data-editing="true"
                  />
                  <Tooltip title="Set to auto (calculated from children)">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setWorkRemainingValue('');
                        handleWorkRemainingBlur();
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: '2px',
                        borderRadius: '4px',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                    </div>
                  </Tooltip>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    {node.calculatedMetrics?.workRemaining === 0
                      ? (
                        <CheckCircle sx={{ color: 'green', fontSize: 20 }} />
                      ) : (
                        <span>{node.calculatedMetrics.workRemaining !== undefined ? node.calculatedMetrics.workRemaining : 'auto'}</span>
                      )
                    }
                  </div>

                  {/* Auto icon for auto-calculated work remaining */}
                  {node.setMetrics?.workRemaining === undefined && (
                    <Tooltip title="Automatically calculated from children">
                      <AutoMode sx={{
                        fontSize: 14,
                        opacity: 0.7,
                        position: 'absolute',
                        right: 0
                      }} />
                    </Tooltip>
                  )}

                  {/* Reset to auto icon on hover for manually set work remaining */}
                  {isWorkRemainingHovered && node.setMetrics?.workRemaining !== undefined && (
                    <Tooltip title="Reset to automatic calculation">
                      <AutoMode
                        sx={{
                          fontSize: 14,
                          opacity: 0.7,
                          cursor: 'pointer',
                          position: 'absolute',
                          right: 0
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          treeNodesApi.updateNode(nodeId, {
                            setMetrics: { workRemaining: null }
                          });
                        }}
                      />
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          )}
        </td>
      ]}
    </tr>
  )
}
