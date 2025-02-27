import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { HTable, DetailsPanel, CommentsPanel } from './client/partials'
import {
  Add,
  ArrowRight,
  ArrowDropDown,
  Delete,
  Dashboard,
  Map as MapIcon,
  LocationOn,
  People,
  DragHandle
} from '@mui/icons-material'
import { Tooltip } from '@mui/material'
import type { TreeNode, TreeNodeSet } from './TreeNode'
import { useApiForState } from './useApiForState'

const MIN_PANEL_WIDTH_PERCENTAGE = 10 // Minimum percentage of window width
const MAX_PANEL_WIDTH_PERCENTAGE = 67 // Maximum percentage of window width
const DEFAULT_PANEL_WIDTH_PERCENTAGE = 25 // Default percentage of window width
const MIN_SECTION_WEIGHT = 0.2 // Minimum relative weight for a section

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
    overflow: 'hidden',
    background: 'var(--background-primary)',
    flex: '1',
    minHeight: '100px',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionHeader: {
    padding: '6px 0 6px 12px',
    background: 'var(--background-secondary)',
    fontWeight: 600,
    fontSize: '13px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    position: 'relative',
    userSelect: 'none',
    cursor: 'default',
    minHeight: '28px',
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
  dragHandle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    cursor: 'row-resize',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  dragHandleHover: {
    background: 'rgba(0, 0, 0, 0.05)',
  },
  dragHandleIcon: {
    fontSize: '16px',
    opacity: 0,
    transition: 'opacity 0.2s',
    pointerEvents: 'none',
  },
  dragHandleActive: {
    background: 'rgba(0, 0, 0, 0.1)',
  },
  closeButton: {
    marginLeft: 'auto',
    cursor: 'pointer',
    opacity: 0.5,
    transition: 'opacity 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 20,
    height: '100%',
    width: '30px',
    fontSize: '16px',
  },
  closeButtonHover: {
    opacity: 0.8,
    background: 'rgba(0, 0, 0, 0.05)',
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

// Add a type for section weights
type SectionName = 'dashboard' | 'map' | 'waypoints' | 'users'
interface SectionWeights {
  dashboard: number;
  map: number;
  waypoints: number;
  users: number;
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
    setActiveViews(prev => {
      // Calculate what the new state would be
      const newState = {
        ...prev,
        [view]: !prev[view]
      }

      // Check if all sections would be turned off
      const allOff = Object.values(newState).every(isActive => !isActive)

      // If all would be off, turn on dashboard instead
      if (allOff) {
        return {
          ...prev,
          dashboard: true,
          [view]: false // Only turn off if it's not dashboard
        }
      }

      // Otherwise return the new state as planned
      return newState
    })
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

  // Add state for section weights
  const [sectionWeights, setSectionWeights] = useState<SectionWeights>(() => {
    const savedWeights = localStorage.getItem('sectionWeights')
    return savedWeights ? JSON.parse(savedWeights) : {
      dashboard: 1.0,
      map: 1.0,
      waypoints: 1.0,
      users: 1.0
    }
  })

  // Save section weights to localStorage
  useEffect(() => {
    localStorage.setItem('sectionWeights', JSON.stringify(sectionWeights))
  }, [sectionWeights])

  // Track which section is being resized
  const [resizingSection, setResizingSection] = useState<{
    section: SectionName,
    nextSection: SectionName,
    startY: number,
    initialHeight: number,
    initialNextHeight: number
  } | null>(null)

  // Ref for the main container to get section elements
  const mainRef = useRef<HTMLDivElement>(null)

  // Get the active sections in display order
  const activeSections = useMemo(() =>
    (Object.entries(activeViews) as [SectionName, boolean][])
      .filter(([_, isActive]) => isActive)
      .map(([name]) => name),
    [activeViews]
  )

  // Calculate flex values for each section based on weights
  const getSectionFlex = useCallback((section: SectionName) => {
    // If there's only one section active, it should take full space
    if (activeSections.length === 1) return 1

    // Calculate the total weight of all active sections
    const totalWeight = activeSections.reduce(
      (sum, name) => sum + sectionWeights[name],
      0
    )

    // Return the proportional flex value
    return sectionWeights[section] / totalWeight
  }, [activeSections, sectionWeights])

  // Completely revise the startSectionResize function
  const startSectionResize = useCallback((e: React.MouseEvent, section: SectionName) => {
    // The error was here - when dragging section at index 1, we need to resize sections at index 0 and 1

    // We need to find the previous section (the one being resized)
    const sectionIndex = activeSections.indexOf(section)
    if (sectionIndex === 0) return // Cannot resize the first section (no previous section)

    // Get the previous section (the one above the drag handle)
    const previousSection = activeSections[sectionIndex - 1]

    // Get section elements to calculate heights
    if (!mainRef.current) return

    // Get all visible section elements
    const sections = Array.from(mainRef.current.children).filter(el => {
      return el.tagName === 'DIV' &&
        el.getAttribute('data-section-type') &&
        activeSections.includes(el.getAttribute('data-section-type') as SectionName)
    }) as HTMLElement[]

    // Find the previous section and current section elements
    const previousSectionElement = sections.find(el => el.getAttribute('data-section-type') === previousSection)
    const currentSectionElement = sections.find(el => el.getAttribute('data-section-type') === section)

    if (!previousSectionElement || !currentSectionElement) return

    // Store initial information for the resize operation
    setResizingSection({
      section: previousSection, // Save previous section
      nextSection: section,     // Save current section
      startY: e.clientY,
      initialHeight: previousSectionElement.offsetHeight,
      initialNextHeight: currentSectionElement.offsetHeight
    })

    // Set cursor and prevent default
    document.body.style.cursor = 'row-resize'
    e.preventDefault()
    e.stopPropagation()
  }, [activeSections])

  // Update the handleSectionResize function to use data-section-type
  const handleSectionResize = useCallback((e: MouseEvent) => {
    if (!resizingSection || !mainRef.current) return

    const { section, nextSection, startY, initialHeight, initialNextHeight } = resizingSection

    // Calculate the delta movement
    const deltaY = e.clientY - startY

    // Total height of both sections
    const totalHeight = initialHeight + initialNextHeight

    // Calculate new weights based on new heights
    let newSectionWeight = ((initialHeight + deltaY) / totalHeight) * (sectionWeights[section] + sectionWeights[nextSection])
    let newNextSectionWeight = ((initialNextHeight - deltaY) / totalHeight) * (sectionWeights[section] + sectionWeights[nextSection])

    // Enforce minimum weights
    if (newSectionWeight < MIN_SECTION_WEIGHT) {
      newSectionWeight = MIN_SECTION_WEIGHT
      newNextSectionWeight = sectionWeights[section] + sectionWeights[nextSection] - MIN_SECTION_WEIGHT
    } else if (newNextSectionWeight < MIN_SECTION_WEIGHT) {
      newNextSectionWeight = MIN_SECTION_WEIGHT
      newSectionWeight = sectionWeights[section] + sectionWeights[nextSection] - MIN_SECTION_WEIGHT
    }

    // Update weights
    setSectionWeights(prev => ({
      ...prev,
      [section]: newSectionWeight,
      [nextSection]: newNextSectionWeight
    }))
  }, [resizingSection, sectionWeights])

  // End resizing
  const endSectionResize = useCallback(() => {
    setResizingSection(null)
    document.body.style.cursor = ''
  }, [])

  // Add and remove event listeners for section resizing
  useEffect(() => {
    if (resizingSection) {
      document.addEventListener('mousemove', handleSectionResize)
      document.addEventListener('mouseup', endSectionResize)
      return () => {
        document.removeEventListener('mousemove', handleSectionResize)
        document.removeEventListener('mouseup', endSectionResize)
      }
    }
  }, [resizingSection, handleSectionResize, endSectionResize])

  // Add state for hover detection
  const [hoverSection, setHoverSection] = useState<SectionName | null>(null)

  // Add state for close button hover
  const [hoverCloseButton, setHoverCloseButton] = useState<SectionName | null>(null)

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

      <main ref={mainRef} style={styles.main}>
        {activeViews.dashboard && (
          <div
            data-section-type="dashboard"
            style={{
              ...styles.section,
              flex: getSectionFlex('dashboard')
            }}
          >
            <div style={styles.sectionHeader}>
              <Dashboard sx={styles.sectionHeaderIcon} />
              Dashboard
              <div
                style={{
                  ...styles.closeButton,
                  ...(hoverCloseButton === 'dashboard' ? styles.closeButtonHover : {})
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleView('dashboard');
                }}
                onMouseEnter={() => setHoverCloseButton('dashboard')}
                onMouseLeave={() => setHoverCloseButton(null)}
                title="Close section"
              >
                ✕
              </div>
            </div>
            <div style={styles.sectionContent}>
              <div style={{ padding: '12px' }}>
                <p>Dashboard content will go here.</p>
              </div>
            </div>
          </div>
        )}

        {activeViews.map && (
          <div
            data-section-type="map"
            style={{
              ...styles.section,
              flex: getSectionFlex('map')
            }}
          >
            <div style={styles.sectionHeader}>
              <MapIcon sx={styles.sectionHeaderIcon} />
              Map
              {/* Add drag handle if not the first section */}
              {activeSections.indexOf('map') > 0 && (
                <div
                  style={{
                    ...styles.dragHandle,
                    ...(resizingSection?.nextSection === 'map' ? styles.dragHandleActive : {}),
                    ...(hoverSection === 'map' ? styles.dragHandleHover : {})
                  }}
                  onMouseDown={(e) => startSectionResize(e, 'map')}
                  onMouseEnter={() => setHoverSection('map')}
                  onMouseLeave={() => setHoverSection(null)}
                >
                  <DragHandle sx={{
                    ...styles.dragHandleIcon,
                    opacity: (resizingSection?.nextSection === 'map' || hoverSection === 'map') ? 0.5 : 0,
                  }} />
                </div>
              )}
              <div
                style={{
                  ...styles.closeButton,
                  ...(hoverCloseButton === 'map' ? styles.closeButtonHover : {})
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleView('map');
                }}
                onMouseEnter={() => setHoverCloseButton('map')}
                onMouseLeave={() => setHoverCloseButton(null)}
                title="Close section"
              >
                ✕
              </div>
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
          <div
            data-section-type="waypoints"
            style={{
              ...styles.section,
              flex: getSectionFlex('waypoints')
            }}
          >
            <div style={styles.sectionHeader}>
              <LocationOn sx={styles.sectionHeaderIcon} />
              Waypoints
              {/* Add drag handle if not the first section */}
              {activeSections.indexOf('waypoints') > 0 && (
                <div
                  style={{
                    ...styles.dragHandle,
                    ...(resizingSection?.nextSection === 'waypoints' ? styles.dragHandleActive : {}),
                    ...(hoverSection === 'waypoints' ? styles.dragHandleHover : {})
                  }}
                  onMouseDown={(e) => startSectionResize(e, 'waypoints')}
                  onMouseEnter={() => setHoverSection('waypoints')}
                  onMouseLeave={() => setHoverSection(null)}
                >
                  <DragHandle sx={{
                    ...styles.dragHandleIcon,
                    opacity: (resizingSection?.nextSection === 'waypoints' || hoverSection === 'waypoints') ? 0.5 : 0,
                  }} />
                </div>
              )}
              <div
                style={{
                  ...styles.closeButton,
                  ...(hoverCloseButton === 'waypoints' ? styles.closeButtonHover : {})
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleView('waypoints');
                }}
                onMouseEnter={() => setHoverCloseButton('waypoints')}
                onMouseLeave={() => setHoverCloseButton(null)}
                title="Close section"
              >
                ✕
              </div>
            </div>
            <div style={styles.sectionContent}>
              <div style={{ padding: '12px' }}>
                <p>Waypoints content will go here.</p>
              </div>
            </div>
          </div>
        )}

        {activeViews.users && (
          <div
            data-section-type="users"
            style={{
              ...styles.section,
              flex: getSectionFlex('users')
            }}
          >
            <div style={styles.sectionHeader}>
              <People sx={styles.sectionHeaderIcon} />
              Users
              {/* Add drag handle if not the first section */}
              {activeSections.indexOf('users') > 0 && (
                <div
                  style={{
                    ...styles.dragHandle,
                    ...(resizingSection?.nextSection === 'users' ? styles.dragHandleActive : {}),
                    ...(hoverSection === 'users' ? styles.dragHandleHover : {})
                  }}
                  onMouseDown={(e) => startSectionResize(e, 'users')}
                  onMouseEnter={() => setHoverSection('users')}
                  onMouseLeave={() => setHoverSection(null)}
                >
                  <DragHandle sx={{
                    ...styles.dragHandleIcon,
                    opacity: (resizingSection?.nextSection === 'users' || hoverSection === 'users') ? 0.5 : 0,
                  }} />
                </div>
              )}
              <div
                style={{
                  ...styles.closeButton,
                  ...(hoverCloseButton === 'users' ? styles.closeButtonHover : {})
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleView('users');
                }}
                onMouseEnter={() => setHoverCloseButton('users')}
                onMouseLeave={() => setHoverCloseButton(null)}
                title="Close section"
              >
                ✕
              </div>
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
