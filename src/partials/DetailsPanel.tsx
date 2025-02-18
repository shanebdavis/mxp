import { TreeNode, TreeNodeProperties } from "../models"
import { PanelHeader } from "./PanelHeader"
import { formatReadinessLevel } from '../presenters'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { EditableRlPill } from '../widgets'

const styles = {
  rightPanel: {
    gridArea: 'right',
    width: '300px',
    borderLeft: '1px solid var(--border-color)',
    background: 'var(--background-secondary)',
    transition: 'width 0.2s ease',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  rightPanelCollapsed: {
    width: '40px',
  },
  resizeHandle: {
    position: 'absolute' as const,
    left: -4,
    top: 0,
    bottom: 0,
    width: 8,
    cursor: 'col-resize',
  },
  content: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    color: 'var(--text-primary)',
  },
  description: {
    fontFamily: 'inherit',
    resize: 'none' as const,
  },
}

export const DetailsPanel = ({
  isRightPanelCollapsed,
  rightPanelWidth,
  startResize,
  setRightPanelCollapsed,
  selectedNode,
  isResizing,
  treeStateMethods,
}: {
  isRightPanelCollapsed: boolean
  rightPanelWidth: number
  startResize: (e: React.MouseEvent) => void
  setRightPanelCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void
  selectedNode: TreeNode | null
  isResizing: boolean
  treeStateMethods: { updateNode: (id: string, props: Partial<TreeNodeProperties>) => void }
}) => {
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')

  const handleDescriptionClick = () => {
    if (!isEditingDescription && selectedNode) {
      setDescriptionDraft(selectedNode.description || '')
      setIsEditingDescription(true)
    }
  }

  const handleDescriptionBlur = () => {
    if (selectedNode && descriptionDraft !== selectedNode.description) {
      treeStateMethods.updateNode(selectedNode.id, { description: descriptionDraft })
    }
    setIsEditingDescription(false)
  }

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
  }

  return (
    <aside style={{
      ...styles.rightPanel,
      width: isRightPanelCollapsed ? '40px' : `${rightPanelWidth}px`,
      transition: isResizing ? 'none' : 'width 0.2s ease',
    }}>
      {!isRightPanelCollapsed && (
        <div
          onMouseDown={startResize}
          style={styles.resizeHandle}
        />
      )}
      <PanelHeader
        isCollapsed={isRightPanelCollapsed}
        label="Details"
        onClick={() => setRightPanelCollapsed(prev => !prev)}
        isVertical={true}
      />
      {!isRightPanelCollapsed && (
        <div style={{ padding: '12px', ...styles.content }}>
          {selectedNode ? (
            <>
              <h3>{selectedNode.name}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', margin: '8px 0' }}>
                <div style={{ fontWeight: 600 }}>Readiness Level:</div>
                <EditableRlPill
                  node={selectedNode}
                  updateNode={treeStateMethods.updateNode}
                />
              </div>
              {isEditingDescription ? (
                <textarea
                  value={descriptionDraft}
                  onChange={e => setDescriptionDraft(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  onKeyDown={handleDescriptionKeyDown}
                  className="details-text-container"
                  style={styles.description}
                  placeholder="Add a description... (Markdown supported)"
                  autoFocus
                />
              ) : (
                <div
                  onClick={handleDescriptionClick}
                  className={`details-text-container preview${!selectedNode.description ? ' empty' : ''}`}
                >
                  {selectedNode.description ? (
                    <div className="markdown-content">
                      <ReactMarkdown>{selectedNode.description}</ReactMarkdown>
                    </div>
                  ) : (
                    'Click to add description... (Markdown supported)'
                  )}
                </div>
              )}
            </>
          ) : (
            <p>Select an item to view details</p>
          )}
        </div>
      )}
    </aside>
  )
}