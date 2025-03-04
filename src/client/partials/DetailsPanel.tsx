import React, { useState, useRef, useEffect, FC } from 'react'
import { Switch, FormControlLabel } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import { EditableRlPill } from '../widgets'
import { SolutionItems } from '../widgets/SolutionItems'
import type { TreeNode, TreeNodeSet, UpdateTreeNodeProperties } from '../../TreeNode'
import { PanelHeader } from "./PanelHeader"
import { useRef as useReactRef } from 'react'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Components } from 'react-markdown'
import type { CSSProperties } from 'react'

interface CodeProps {
  node?: unknown
  inline?: boolean
  className?: string
  children?: React.ReactNode
}

interface MarkdownNodePosition {
  start: { offset: number }
  end: { offset: number }
}

interface MarkdownNode {
  position?: MarkdownNodePosition
  parent?: { position?: MarkdownNodePosition }
}

interface MarkdownProps {
  node?: MarkdownNode
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
    overflow: 'auto',
    color: 'var(--text-primary)',
  },
  description: {
    fontFamily: 'inherit',
    resize: 'none' as const,
    flex: 1,
    minHeight: 0,
    fontSize: '13px',
  },
  descriptionContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    minHeight: 0,
    overflow: 'visible',
  },
  descriptionPreview: {
    flex: 1,
    overflow: 'visible',
    padding: 0,
    fontSize: '13px',
  },
  markdownParagraph: {
    margin: '0.5em 0',
    fontSize: '13px',
  },
  markdownFirstParagraph: {
    margin: '0 0 0.5em 0',
  },
  markdownLastParagraph: {
    margin: '0.5em 0 0 0',
  },
  fieldLabel: {
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '13px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  heading: {
    margin: '0.5em 0',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  h1: {
    fontSize: '16px',
  },
  h2: {
    fontSize: '14px',
  },
  h3: {
    fontSize: '13px',
  },
  h4: {
    fontSize: '12px',
  },
  h5: {
    fontSize: '12px',
    fontWeight: 500,
  },
  h6: {
    fontSize: '12px',
    fontWeight: 500,
    fontStyle: 'italic',
  },
  draftToggle: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    fontSize: '13px',
  },
  draftLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  table: {
    borderCollapse: 'collapse' as const,
    width: '100%',
    margin: '0.5em 0',
    fontSize: '13px',
  },
  tableCell: {
    border: '1px solid var(--border-color)',
    padding: '6px 8px',
  },
  tableHeader: {
    backgroundColor: 'var(--background-secondary)',
    fontWeight: 600,
  },
} satisfies Record<string, CSSProperties>

export const DetailsPanel = ({
  isRightPanelCollapsed,
  rightPanelWidth,
  startResize,
  setRightPanelCollapsed,
  selectedNode,
  isResizing,
  treeNodesApi,
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
  treeNodesApi: { updateNode: (id: string, props: UpdateTreeNodeProperties) => Promise<void> }
  nameColumnHeader?: string
  readinessColumnHeader?: string
  nodes: TreeNodeSet
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
      await treeNodesApi.updateNode(selectedNode.id, { description: descriptionDraft })
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
    },
  }

  // Determine if we should show the readiness section based on node type
  const showReadinessSection = selectedNode && selectedNode.type === 'map';

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
              <FormControlLabel
                style={styles.draftToggle}
                control={
                  <Switch
                    size="small"
                    checked={selectedNode.nodeState !== "draft"}
                    onChange={async (e) => {
                      if (selectedNode) {
                        await treeNodesApi.updateNode(selectedNode.id, {
                          nodeState: e.target.checked ? "active" : "draft"
                        })
                      }
                    }}
                  />
                }
                label={<span style={styles.draftLabel}>{selectedNode.nodeState === "draft" ? 'draft' : 'active'}</span>}
                labelPlacement="start"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="field-label">{nameColumnHeader}</div>
                <h3 style={{ margin: 0 }}>{selectedNode.title}</h3>
              </div>
              {showReadinessSection && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', margin: '8px 0' }}>
                  <div className="field-label">{readinessColumnHeader}</div>
                  <EditableRlPill
                    readinessLevel={selectedNode.calculatedMetrics.readinessLevel}
                    auto={selectedNode.setMetrics?.readinessLevel == null}
                    onChange={async level => {
                      await treeNodesApi.updateNode(selectedNode.id, {
                        setMetrics: { readinessLevel: level ?? null }
                      })
                    }}
                  />
                </div>
              )}
              {selectedNode.childrenIds.length > 0 && (
                <SolutionItems
                  node={selectedNode}
                  children={selectedNode.childrenIds.map(id => nodes[id]).filter(Boolean)}
                />
              )}
              <div style={styles.descriptionContainer}>
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
                    className="markdown-content"
                    style={styles.descriptionPreview}
                  >
                    {selectedNode.description ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {selectedNode.description}
                      </ReactMarkdown>
                    ) : (
                      <span>Add a description... (Markdown supported)</span>
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