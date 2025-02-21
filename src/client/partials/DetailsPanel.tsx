import { TreeNodeProperties } from "../../models"
import type { TreeNode, TreeNodeMap } from "../../models"
import { PanelHeader } from "./PanelHeader"
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { EditableRlPill } from '../widgets'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Components } from 'react-markdown'

interface CodeProps {
  node?: unknown
  inline?: boolean
  className?: string
  children?: React.ReactNode
}

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
  fieldLabel: {
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '13px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
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
  nameColumnHeader = "Name",
  readinessColumnHeader = "Readiness Level",
  nodes,
}: {
  isRightPanelCollapsed: boolean
  rightPanelWidth: number
  startResize: (e: React.MouseEvent) => void
  setRightPanelCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void
  selectedNode: TreeNode | null
  isResizing: boolean
  treeStateMethods: { updateNode: (id: string, props: Partial<TreeNodeProperties>) => Promise<void> }
  nameColumnHeader?: string
  readinessColumnHeader?: string
  nodes: TreeNodeMap
}) => {
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')

  const handleDescriptionClick = () => {
    if (!isEditingDescription && selectedNode) {
      setDescriptionDraft(selectedNode.description || '')
      setIsEditingDescription(true)
    }
  }

  const handleDescriptionBlur = async () => {
    if (selectedNode && descriptionDraft !== selectedNode.description) {
      await treeStateMethods.updateNode(selectedNode.id, { description: descriptionDraft })
    }
    setIsEditingDescription(false)
  }

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
  }

  const markdownComponents: Components = {
    code: ({ inline, className, children, ...props }: CodeProps) => {
      const match = /language-(\w+)/.exec(className || '')
      return !inline && match ? (
        <SyntaxHighlighter
          {...props}
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code {...props} className={className}>
          {children}
        </code>
      )
    }
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="field-label">{nameColumnHeader}</div>
                <h3 style={{ margin: 0 }}>{selectedNode.title}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', margin: '8px 0' }}>
                <div className="field-label">{readinessColumnHeader}</div>
                <EditableRlPill
                  readinessLevel={selectedNode.calculatedMetrics.readinessLevel}
                  auto={!selectedNode.setMetrics?.readinessLevel}
                  onChange={async level => {
                    await treeStateMethods.updateNode(selectedNode.id, {
                      setMetrics: { readinessLevel: level ?? null }
                    })
                  }}
                />
              </div>
              {selectedNode.childrenIds.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '8px 0' }}>
                  <div className="field-label">Solution: {selectedNode.childrenIds.length} Sub-problems</div>
                  <ol style={{ margin: 0, paddingLeft: '1.5em', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {selectedNode.childrenIds
                      .filter(childId => nodes[childId])
                      .map(childId => (
                        <li key={childId}>{nodes[childId].title}</li>
                      ))}
                  </ol>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="field-label">Description</div>
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
                      <ReactMarkdown components={markdownComponents}>
                        {selectedNode.description}
                      </ReactMarkdown>
                    ) : (
                      <span className="placeholder">Add a description... (Markdown supported)</span>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: '12px', color: 'var(--text-secondary)' }}>
              Select a node to view details
            </div>
          )}
        </div>
      )}
    </aside>
  )
}