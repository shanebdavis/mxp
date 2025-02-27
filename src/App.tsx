import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { HTable, DetailsPanel, CommentsPanel } from './client/partials'
import {
  Add,
  ArrowRight,
  ArrowDropDown,
  Delete,
  Dashboard,
  Map as MapIcon,
  LocationOn,
  People
} from '@mui/icons-material'
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
      "header header header" auto
      "nav main right" 1fr
      "footer footer footer" auto
      / auto 1fr auto
    `,
  },
  header: {
    gridArea: 'header',
    borderBottom: '1px solid var(--border-color)',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    background: 'var(--background-primary)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    color: 'var(--text-primary)',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  main: {
    gridArea: 'main',
    overflow: 'hidden',
    background: 'var(--background-primary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    padding: '0',
  },
  nav: {
    gridArea: 'nav',
    width: '60px',
    background: 'var(--background-secondary)',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 0',
  },
  navButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    margin: '8px 0',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  navButtonActive: {
    background: 'var(--selected-color)',
    color: 'var(--text-primary)',
  },
  section: {
    border: 'none',
    borderRadius: '0',
    overflow: 'auto',
    background: 'var(--background-primary)',
    flex: '1',
    minHeight: '100px',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionHeader: {
    padding: '6px 12px',
    background: 'var(--background-secondary)',
    fontWeight: 600,
    fontSize: '13px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  sectionHeaderIcon: {
    fontSize: '16px',
    opacity: 0.8,
  },
  sectionContent: {
    padding: '0',
    overflow: 'auto',
    flex: 1,
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

// Add a type for the active views state
interface ActiveViews {
  dashboard: boolean;
  map: boolean;
  waypoints: boolean;
  users: boolean;
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

  // Replace activeNav with activeViews to track which views are visible
  const [activeViews, setActiveViews] = useState<ActiveViews>(() => {
    const savedViews = localStorage.getItem('activeViews')
    return savedViews ? JSON.parse(savedViews) : {
      dashboard: false,
      map: true,     // Map view enabled by default
      waypoints: false,
      users: false
    }
  })

  // Save active views to localStorage
  useEffect(() => {
    localStorage.setItem('activeViews', JSON.stringify(activeViews))
  }, [activeViews])

  // Toggle a view on/off
  const toggleView = (view: keyof ActiveViews) => {
    setActiveViews(prev => ({
      ...prev,
      [view]: !prev[view]
    }))
  }

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

      <nav style={styles.nav}>
        <Tooltip title="Dashboard" placement="right">
          <button
            style={{
              ...styles.navButton,
              ...(activeViews.dashboard ? styles.navButtonActive : {})
            }}
            onClick={() => toggleView('dashboard')}
          >
            <Dashboard />
          </button>
        </Tooltip>

        <Tooltip title="Map" placement="right">
          <button
            style={{
              ...styles.navButton,
              ...(activeViews.map ? styles.navButtonActive : {})
            }}
            onClick={() => toggleView('map')}
          >
            <MapIcon />
          </button>
        </Tooltip>

        <Tooltip title="Waypoints" placement="right">
          <button
            style={{
              ...styles.navButton,
              ...(activeViews.waypoints ? styles.navButtonActive : {})
            }}
            onClick={() => toggleView('waypoints')}
          >
            <LocationOn />
          </button>
        </Tooltip>

        <Tooltip title="Users" placement="right">
          <button
            style={{
              ...styles.navButton,
              ...(activeViews.users ? styles.navButtonActive : {})
            }}
            onClick={() => toggleView('users')}
          >
            <People />
          </button>
        </Tooltip>
      </nav>

      <main style={styles.main}>
        {activeViews.dashboard && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <Dashboard sx={styles.sectionHeaderIcon} />
              Dashboard
            </div>
            <div style={styles.sectionContent}>
              <div style={{ padding: '12px' }}>
                <p>Dashboard content will go here.</p>
              </div>
            </div>
          </div>
        )}

        {activeViews.map && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <MapIcon sx={styles.sectionHeaderIcon} />
              Map
            </div>
            <div style={styles.sectionContent}>
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
                <div style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                  No nodes found. Create your first node to get started.
                </div>
              )}
            </div>
          </div>
        )}

        {activeViews.waypoints && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <LocationOn sx={styles.sectionHeaderIcon} />
              Waypoints
            </div>
            <div style={styles.sectionContent}>
              <div style={{ padding: '12px' }}>
                <p>Waypoints content will go here.</p>
              </div>
            </div>
          </div>
        )}

        {activeViews.users && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <People sx={styles.sectionHeaderIcon} />
              Users
            </div>
            <div style={styles.sectionContent}>
              <div style={{ padding: '12px' }}>
                <p>Users content will go here.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Details Panel - always present regardless of active views */}
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

      {/* Comments Panel - always present regardless of active views */}
      <CommentsPanel
        isFooterCollapsed={isFooterCollapsed}
        setFooterCollapsed={setFooterCollapsed}
      />
    </div>
  )
}

export default App
