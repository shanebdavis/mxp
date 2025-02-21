import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { HTable, DetailsPanel, CommentsPanel } from './client/partials'
import { Add, ArrowRight, ArrowDropDown, Delete } from '@mui/icons-material'
import { Tooltip } from '@mui/material'
import type { TreeNode, TreeNodeMap } from './models'
import { useApiForState } from './useApiForState'

const MIN_PANEL_WIDTH = 200
const MAX_PANEL_WIDTH = 800
const DEFAULT_PANEL_WIDTH = 300

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

const getParentMap = (nodes: TreeNodeMap): Record<string, TreeNode> => {
  const result: Record<string, TreeNode> = {}
  Object.values(nodes).forEach(node => {
    node.childrenIds.forEach(childId => {
      result[childId] = node
    })
  })
  return result
}

const getIndexInParentMap = (nodes: TreeNodeMap): Record<string, number> => {
  const result: Record<string, number> = {}
  Object.values(nodes).forEach(node => {
    node.childrenIds.forEach((childId, index) => {
      result[childId] = index
    })
  })
  return result
}

const App = () => {
  const [isRightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [isFooterCollapsed, setFooterCollapsed] = useState(false)
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  const { nodes, rootNodeId, treeStateMethods, loading, error } = useApiForState()
  const [selectedNodeId, selectNodeById] = useState<string | null>(rootNodeId)

  // Update selectedNodeId when rootNodeId changes
  useEffect(() => {
    if (rootNodeId && !selectedNodeId) {
      selectNodeById(rootNodeId)
    }
  }, [rootNodeId, selectedNodeId])

  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null

  const [parentMap, indexInParentMap] = useMemo(() => {
    return [
      getParentMap(nodes),
      getIndexInParentMap(nodes)
    ]
  }, [nodes])

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const width = document.documentElement.clientWidth - e.clientX
      if (width >= MIN_PANEL_WIDTH && width <= MAX_PANEL_WIDTH) {
        setRightPanelWidth(width)
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
          <HTable
            nodes={nodes}
            rootNodeId={rootNodeId}
            selectedNode={selectedNode}
            selectNodeById={selectNodeById}
            treeStateMethods={treeStateMethods}
            editingNodeId={editingNodeId}
            setEditingNodeId={setEditingNodeId}
            parentMap={parentMap}
            indexInParentMap={indexInParentMap}
            nameColumnHeader="Problem"
            readinessColumnHeader="Solution Readiness"
          />
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
