import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { HTable, DetailsPanel, CommentsPanel } from './client/partials'
import { Add, ArrowRight, ArrowDropDown, Delete } from '@mui/icons-material'
import { Tooltip } from '@mui/material'
import type { TreeNode, TreeNodeSet } from './TreeNode'
import { useApiForState } from './useApiForState'

const MIN_PANEL_WIDTH_PERCENTAGE = 10 // Minimum percentage of window width
const MAX_PANEL_WIDTH_PERCENTAGE = 67 // Maximum percentage of window width
const DEFAULT_PANEL_WIDTH_PERCENTAGE = 25 // Default percentage of window width

const styles = {
  layout: {
    display: 'grid',
    height: '100vh',
    gridTemplate: `
      "header header" auto
      "main right" 1fr
      "footer footer" auto
      / 1fr auto
    `,
  },
  header: {
    gridArea: 'header',
    borderBottom: '1px solid var(--border-color)',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    background: 'var(--background-primary)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    color: 'var(--text-primary)',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  main: {
    gridArea: 'main',
    overflow: 'auto',
    background: 'var(--background-primary)',
  },
} as const

const getParentMap = (nodes: TreeNodeSet): Record<string, TreeNode> => {
  const result: Record<string, TreeNode> = {}
  Object.values(nodes).forEach(node => {
    node.childrenIds.forEach(childId => {
      result[childId] = node
    })
  })
  return result
}

const getIndexInParentMap = (nodes: TreeNodeSet): Record<string, number> => {
  const result: Record<string, number> = {}
  Object.values(nodes).forEach(node => {
    node.childrenIds.forEach((childId, index) => {
      result[childId] = index
    })
  })
  return result
}

const App = () => {
  const [isRightPanelCollapsed, setRightPanelCollapsed] = useState(() => {
    const savedState = localStorage.getItem('detailsPanel.collapsed')
    return savedState !== null ? savedState === 'true' : false
  })

  const [isFooterCollapsed, setFooterCollapsed] = useState(() => {
    // Try to get saved state from localStorage, default to true (closed) if not found
    const savedState = localStorage.getItem('commentsPanel.collapsed')
    return savedState !== null ? savedState === 'true' : true
  })

  const [rightPanelWidthPercentage, setRightPanelWidthPercentage] = useState(() => {
    // Get saved panel width percentage from localStorage
    const savedWidth = localStorage.getItem('detailsPanel.widthPercentage')
    // Return saved width or default if not found
    return savedWidth !== null ? parseFloat(savedWidth) : DEFAULT_PANEL_WIDTH_PERCENTAGE
  })

  // Calculate pixel width from percentage
  const rightPanelWidth = useMemo(() => {
    return Math.round((window.innerWidth * rightPanelWidthPercentage) / 100)
  }, [rightPanelWidthPercentage])

  const [isResizing, setIsResizing] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  // Save panel states to localStorage when they change
  useEffect(() => {
    localStorage.setItem('commentsPanel.collapsed', String(isFooterCollapsed))
  }, [isFooterCollapsed])

  useEffect(() => {
    localStorage.setItem('detailsPanel.collapsed', String(isRightPanelCollapsed))
  }, [isRightPanelCollapsed])

  useEffect(() => {
    localStorage.setItem('detailsPanel.widthPercentage', String(rightPanelWidthPercentage))
  }, [rightPanelWidthPercentage])

  // Update panel width when window is resized
  useEffect(() => {
    const handleResize = () => {
      // No need to do anything as rightPanelWidth is derived from rightPanelWidthPercentage
      // This will cause a re-render with the correct width
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { nodes, rootNodeId, treeStateMethods, loading, error } = useApiForState()
  const [selectedNodeId, selectNodeById] = useState<string | undefined>(rootNodeId)

  // Update selectedNodeId when rootNodeId changes
  useEffect(() => {
    if (rootNodeId && !selectedNodeId) {
      selectNodeById(rootNodeId)
    }
  }, [rootNodeId, selectedNodeId])

  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null

  const indexInParentMap = useMemo(() =>
    getIndexInParentMap(nodes)
    , [nodes])

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const width = document.documentElement.clientWidth - e.clientX
      // Convert to percentage of window width
      const percentage = (width / window.innerWidth) * 100

      if (percentage >= MIN_PANEL_WIDTH_PERCENTAGE && percentage <= MAX_PANEL_WIDTH_PERCENTAGE) {
        setRightPanelWidthPercentage(percentage)
      }
    }
  }, [isResizing])

  const startResize = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    e.preventDefault()
  }, [])

  const stopResize = useCallback(() => {
    setIsResizing(false)
    document.body.style.cursor = ''
  }, [])

  // Add and remove event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', resize)
      document.addEventListener('mouseup', stopResize)
      return () => {
        document.removeEventListener('mousemove', resize)
        document.removeEventListener('mouseup', stopResize)
      }
    }
  }, [isResizing, resize, stopResize])

  // Add loading and error states
  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }

  if (error) {
    return <div style={{ padding: 20, color: 'red' }}>Error: {error.message}</div>
  }

  return (
    <div style={styles.layout}>
      <header style={styles.header}>
        <h1 style={styles.title}>Expedition Map</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <Tooltip title="Add Child">
              <span>
                <button
                  onClick={async () => {
                    if (selectedNode) {
                      const newNodeId = await treeStateMethods.addNode({
                        title: '',
                        setMetrics: { readinessLevel: 0 },
                      }, selectedNode.id)
                      selectNodeById(newNodeId)
                      setEditingNodeId(newNodeId)
                    }
                  }}
                  disabled={!selectedNode}
                  style={{
                    opacity: selectedNode ? 1 : 0.5,
                    cursor: selectedNode ? 'pointer' : 'default',
                    padding: 4,
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    position: 'relative'
                  }}
                >
                  <Add sx={{ fontSize: 14, position: 'absolute', right: 0, bottom: 0 }} />
                  <ArrowRight sx={{ fontSize: 18 }} />
                </button>
              </span>
            </Tooltip>
            <Tooltip title="Add Sibling">
              <span>
                <button
                  onClick={async () => {
                    if (selectedNode?.parentId) {
                      const newNodeId = await treeStateMethods.addNode({
                        title: '',
                        setMetrics: { readinessLevel: 0 },
                      }, selectedNode.parentId)
                      selectNodeById(newNodeId)
                      setEditingNodeId(newNodeId)
                    }
                  }}
                  disabled={!selectedNode?.parentId}
                  style={{
                    opacity: selectedNode?.parentId ? 1 : 0.5,
                    cursor: selectedNode?.parentId ? 'pointer' : 'default',
                    padding: 4,
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    position: 'relative'
                  }}
                >
                  <Add sx={{ fontSize: 14, position: 'absolute', right: 0, bottom: 0 }} />
                  <ArrowDropDown sx={{ fontSize: 18 }} />
                </button>
              </span>
            </Tooltip>
            <Tooltip title="Delete node">
              <span>
                <button
                  onClick={async () => selectedNode && await treeStateMethods.removeNode(selectedNode.id)}
                  disabled={!selectedNode || selectedNode.id === rootNodeId}
                  style={{
                    opacity: selectedNode && selectedNode.id !== rootNodeId ? 1 : 0.5,
                    cursor: selectedNode && selectedNode.id !== rootNodeId ? 'pointer' : 'default',
                    padding: 4,
                    background: 'none',
                    border: 'none',
                    color: '#666'
                  }}
                >
                  <Delete sx={{ fontSize: 18 }} />
                </button>
              </span>
            </Tooltip>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <div>
          {rootNodeId ? (
            <HTable
              nodes={nodes}
              rootNodeId={rootNodeId}
              selectedNode={selectedNode}
              selectNodeById={selectNodeById}
              treeStateMethods={treeStateMethods}
              editingNodeId={editingNodeId}
              setEditingNodeId={setEditingNodeId}
              indexInParentMap={indexInParentMap}
              nameColumnHeader="Problem"
              readinessColumnHeader="Solution Readiness"
            />
          ) : (
            <div style={{ padding: 20, color: 'var(--text-secondary)' }}>
              No nodes found. Create your first node to get started.
            </div>
          )}
        </div>
      </main>

      <DetailsPanel
        isRightPanelCollapsed={isRightPanelCollapsed}
        rightPanelWidth={rightPanelWidth}
        startResize={startResize}
        setRightPanelCollapsed={setRightPanelCollapsed}
        selectedNode={selectedNode}
        isResizing={isResizing}
        treeStateMethods={treeStateMethods}
        nameColumnHeader="Problem"
        readinessColumnHeader="Solution Readiness"
        nodes={nodes}
      />
      <CommentsPanel
        isFooterCollapsed={isFooterCollapsed}
        setFooterCollapsed={setFooterCollapsed}
      />
    </div>
  )
}

export default App
