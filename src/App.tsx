import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { HTable, DetailsPanel, CommentsPanel, Dashboard, StatusBar } from './client/partials'
import {
  Add,
  ArrowRight,
  ArrowDropDown,
  Delete,
  Dashboard as DashboardIcon,
  Map as MapIcon,
  LocationOn,
  People,
  DragHandle,
  Explore,
  VisibilityOutlined,
  VisibilityOffOutlined
} from '@mui/icons-material'
import { Tooltip, Switch, FormControlLabel } from '@mui/material'
import type { TreeNode, TreeNodeSet, NodeType } from './TreeNode'
import { useApiForState } from './useApiForState'
import { ViewStateMethods } from './viewState'

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
    padding: '8px 8px',
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
    width: '40px',
    background: 'var(--background-secondary)',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '4px 0',
  },
  navButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '6px',
    margin: '4px 0',
    padding: 0,
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
    borderTop: '1px solid var(--border-color)',
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

// Add types for section names and focused section
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

  // State for "show draft" toggles
  const [showDraftMap, setShowDraftMap] = useState(() => {
    const savedValue = localStorage.getItem('showDraftMap')
    return savedValue === null ? true : savedValue === 'true'
  })

  const [showDraftWaypoints, setShowDraftWaypoints] = useState(() => {
    const savedValue = localStorage.getItem('showDraftWaypoints')
    return savedValue === null ? true : savedValue === 'true'
  })

  // Save active views to localStorage
  useEffect(() => {
    localStorage.setItem('activeViews', JSON.stringify(activeViews))
  }, [activeViews])

  // Save toggle states to localStorage
  useEffect(() => {
    localStorage.setItem('showDraftMap', showDraftMap.toString())
  }, [showDraftMap])

  useEffect(() => {
    localStorage.setItem('showDraftWaypoints', showDraftWaypoints.toString())
  }, [showDraftWaypoints])

  // Toggle a view on/off
  const toggleView = (view: keyof ActiveViews) => {
    const isFocusedSection = view === focusedSection;

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
        // We'll turn on dashboard, so set it as focused too
        setTimeout(() => setFocusedSection('dashboard'), 0);

        return {
          ...prev,
          dashboard: true,
          [view]: false // Only turn off if it's not dashboard
        }
      }

      // If we're hiding the currently focused section, focus another section
      if (isFocusedSection && !newState[view]) {
        // Calculate the current active sections in display order
        const currentActiveSections = (Object.entries(prev) as [SectionName, boolean][])
          .filter(([_, isActive]) => isActive)
          .map(([name]) => name);

        // Get the updated active sections (after hiding the current one)
        const updatedActiveSections = (Object.entries(newState) as [SectionName, boolean][])
          .filter(([_, isActive]) => isActive)
          .map(([name]) => name);

        // Find the index of the section being hidden
        const currentSectionIndex = currentActiveSections.indexOf(view);

        // Select the next section in order, or the previous if there is no next
        setTimeout(() => {
          // If the section being hidden is not found or it's the only section, use dashboard as fallback
          if (currentSectionIndex === -1 || updatedActiveSections.length === 0) {
            setFocusedSection('dashboard');
            return;
          }

          // Try to focus the next section in display order
          if (currentSectionIndex < currentActiveSections.length - 1) {
            // There is a next section
            const nextSection = currentActiveSections[currentSectionIndex + 1];
            // Check if it's still active in the new state
            if (newState[nextSection]) {
              setFocusedSection(nextSection);
              return;
            }
          }

          // Try to focus the previous section if there's no next or next is hidden
          if (currentSectionIndex > 0) {
            const prevSection = currentActiveSections[currentSectionIndex - 1];
            if (newState[prevSection]) {
              setFocusedSection(prevSection);
              return;
            }
          }

          // If neither next nor previous worked, use the first active section
          if (updatedActiveSections.length > 0) {
            setFocusedSection(updatedActiveSections[0]);
          } else {
            // Fallback to dashboard (should never happen due to allOff check)
            setFocusedSection('dashboard');
          }
        }, 0);
      }

      // Return the new state
      return newState;
    });
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

  const { nodes, rootNodesByType, treeNodesApi, loading, error } = useApiForState()

  // Track selected node ID for each type
  const [selectedNodeIds, setSelectedNodeIds] = useState<Record<string, string | undefined>>({})

  // Map of node types to section names
  const nodeTypeToSectionMap: Record<NodeType, SectionName> = {
    map: 'map',
    waypoint: 'waypoints',
    user: 'users'
  }

  // Get the current selected node
  const getSelectedNode = (type: NodeType): TreeNode | null => {
    const selectedId = selectedNodeIds[type]
    return selectedId ? nodes[selectedId] : null
  }

  // Add expanded nodes state for each node type
  const [expandedMapNodes, setExpandedMapNodes] = useState<Record<string, boolean>>({})
  const [expandedWaypointNodes, setExpandedWaypointNodes] = useState<Record<string, boolean>>({})
  const [expandedUserNodes, setExpandedUserNodes] = useState<Record<string, boolean>>({})

  // Function to get all parent node IDs for a given node
  const getAllParentNodeIds = (nodeId: string, nodes: TreeNodeSet): string[] => {
    const result: string[] = []
    let currentNode = nodes[nodeId]

    while (currentNode && currentNode.parentId) {
      result.push(currentNode.parentId)
      currentNode = nodes[currentNode.parentId]
    }

    return result
  }

  // Function to expand all parent nodes of a selected node
  const expandParentNodes = (nodeId: string, nodeType: NodeType) => {
    const parentIds = getAllParentNodeIds(nodeId, nodes)

    if (parentIds.length === 0) return // No parents to expand

    // Create an object with all parent IDs set to true
    const expansionUpdates = parentIds.reduce((acc, parentId) => {
      acc[parentId] = true
      return acc
    }, {} as Record<string, boolean>)

    // Update the appropriate expanded nodes state based on node type
    switch (nodeType) {
      case 'map':
        setExpandedMapNodes(prev => ({ ...prev, ...expansionUpdates }))
        break
      case 'waypoint':
        setExpandedWaypointNodes(prev => ({ ...prev, ...expansionUpdates }))
        break
      case 'user':
        setExpandedUserNodes(prev => ({ ...prev, ...expansionUpdates }))
        break
    }
  }

  /**
   * Select the specified node, make sure it is visible on screen and focused
   * @param nodeId
   * @param nodeTypeOverride
   * @returns
   */
  const selectNodeAndFocus = (node: TreeNode | null | undefined) => {
    if (!node) return;
    const nodeId = node.id;
    const nodeType = node.type;

    // 1. Set the selected node to that node-id
    setSelectedNodeIds(prev => {
      if (prev[nodeType] !== nodeId) {
        return {
          ...prev,
          [nodeType]: nodeId
        }
      }

      // else we need to force scrolling to the node by temporarily deselecting it
      setTimeout(() => {
        // restore the selected node
        setSelectedNodeIds(prevState => ({
          ...prevState,
          [nodeType]: nodeId
        }));
      }, 10);

      // temporarily deselect the node
      return { ...prev, [nodeType]: '' }
    })

    // 2. Make sure appropriate section is shown
    const sectionName = nodeTypeToSectionMap[nodeType]
    if (!activeViews[sectionName]) {
      setActiveViews(prev => ({
        ...prev,
        [sectionName]: true
      }))
    }

    // 3. Focus the appropriate section
    setFocusedSection(sectionName)

    // 4. Expand the tree if needed so the item is visible
    expandParentNodes(nodeId, nodeType)

  }

  const viewStateMethods: ViewStateMethods = {
    selectNodeAndFocus
  }

  // Update selectedNodeIds when rootNodesByType changes
  useEffect(() => {
    if (Object.keys(rootNodesByType).length > 0) {
      // Initialize selected nodes with root nodes if not already selected
      setSelectedNodeIds(prev => {
        const newSelection = { ...prev }
        Object.entries(rootNodesByType).forEach(([type, node]) => {
          if (!prev[type]) {
            newSelection[type] = node.id
          }
        })
        return newSelection
      })
    }
  }, [rootNodesByType])

  // Add state to track which section is currently focused
  const [focusedSection, setFocusedSection] = useState<SectionName>(() => {
    // Default to the first active section, preferring map
    if (activeViews.map) return 'map'
    if (activeViews.dashboard) return 'dashboard'
    if (activeViews.waypoints) return 'waypoints'
    if (activeViews.users) return 'users'
    return 'map' // Default to map as fallback
  })

  // Add a mapping between section names and node types
  const sectionToNodeType = {
    dashboard: 'dashboard',
    map: 'map',
    waypoints: 'waypoint',
    users: 'user'
  } as const

  // Get the currently selected node (for details panel) - modified to use focused section with mapping
  const selectedNode = useMemo(() => {
    // Map the focused section to its corresponding node type
    const nodeType = sectionToNodeType[focusedSection] as NodeType
    // Use the selected node from the focused section's corresponding node type
    const selectedNodeId = selectedNodeIds[nodeType]
    return selectedNodeId ? nodes[selectedNodeId] : null
  }, [selectedNodeIds, nodes, focusedSection])

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

  // Add helper to generate section header styles based on focus
  const getSectionHeaderStyle = (section: SectionName) => ({
    ...styles.sectionHeader,
    borderBottom: '1px solid ' + (focusedSection === section
      ? 'var(--selected-color)'
      : 'var(--border-color)'),
    background: focusedSection === section
      ? 'var(--selected-color-light, var(--background-secondary))'
      : 'var(--background-secondary)',
  })

  // Update the global keyboard handler to check if we should handle the event
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Debug logging for all keyboard events

    // Skip if defaultPrevented - this means some other handler has handled it
    if (e.defaultPrevented) return;

    // Check if we're in an input element - if so, don't handle keyboard shortcuts
    if (e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Skip if in editing mode or if an element in the focused section is focused
    const activeElement = document.activeElement;
    const focusedSectionElement = document.getElementById(focusedSection);
    if (
      activeElement &&
      focusedSectionElement &&
      (focusedSectionElement === activeElement || focusedSectionElement.contains(activeElement))
    ) {
      // Let the focused section handle its own keyboard events
      return;
    }

    // Changed from metaKey/ctrlKey to altKey for section toggling
    if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.key >= '1' && e.key <= '4') {
      e.preventDefault();
      const sectionIndex = parseInt(e.key) - 1;
      const sections = ['dashboard', 'map', 'waypoints', 'users'];
      if (sectionIndex < sections.length) {
        const section = sections[sectionIndex] as SectionName;

        if (activeViews[section]) {
          // If the view is active, focus on it
          setFocusedSection(section);
        } else {
          // If the view is not active, toggle it on
          toggleView(section);
        }
      }
    }
  }, [activeViews, focusedSection, toggleView]);

  // Add keyboard shortcut handler for add child and add sibling
  useEffect(() => {
    const handleNodeOperationShortcuts = async (e: KeyboardEvent) => {
      // Only handle if an event hasn't been handled yet
      if (e.defaultPrevented) return;

      // Handle Command+Enter (add child) and Shift+Enter (add sibling)
      if (e.key === 'Enter') {
        const nodeType = sectionToNodeType[focusedSection] as NodeType;
        const selectedNodeId = selectedNodeIds[nodeType];
        const currentNode = selectedNodeId ? nodes[selectedNodeId] : null;

        if (!currentNode) return;

        if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
          // Command/Ctrl + Enter - Add Child
          e.preventDefault(); // Prevent default browser behavior

          // If this is the first child, clear parent's setMetrics
          if (currentNode.childrenIds.length === 0) {
            await treeNodesApi.updateNode(currentNode.id, { setMetrics: {} });
          }

          const newNode = await treeNodesApi.addNode({
            title: '',
          }, currentNode.id);

          selectNodeAndFocus(newNode);
          setEditingNodeId(newNode.id);
        } else if (e.shiftKey && !e.metaKey && !e.ctrlKey && currentNode.parentId) {
          // Shift + Enter - Add Sibling (only if not root node)
          e.preventDefault(); // Prevent default browser behavior

          const newNode = await treeNodesApi.addNode({
            title: '',
          }, currentNode.parentId);

          selectNodeAndFocus(newNode);
          setEditingNodeId(newNode.id);
        }
      }
    };

    window.addEventListener('keydown', handleNodeOperationShortcuts);
    return () => window.removeEventListener('keydown', handleNodeOperationShortcuts);
  }, [nodes, selectedNodeIds, focusedSection, treeNodesApi, setEditingNodeId, sectionToNodeType, selectNodeAndFocus]);

  // Add the event listener for the keyboard handler
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]); // Dependency includes the memoized handler

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
        <img
          src="/expedition-logo-256-alpha.png"
          alt="Expedition Logo"
          style={{ height: '24px', marginRight: '16px' }}
        />
        <h1 style={styles.title}>MXP: Method Expedition</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <Tooltip title="Add Child">
              <span>
                <button
                  onClick={async () => {
                    if (selectedNode) {
                      const newNode = await treeNodesApi.addNode({
                        title: '',
                      }, selectedNode.id)
                      selectNodeAndFocus(newNode)
                      setEditingNodeId(newNode.id)
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
                      const newNode = await treeNodesApi.addNode({
                        title: '',
                      }, selectedNode.parentId)
                      selectNodeAndFocus(newNode)
                      setEditingNodeId(newNode.id)
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
                  onClick={async () => selectedNode && await treeNodesApi.removeNode(selectedNode.id)}
                  disabled={!selectedNode || Object.values(rootNodesByType).some(rootNode => rootNode.id === selectedNode?.id)}
                  style={{
                    opacity: selectedNode && !Object.values(rootNodesByType).some(rootNode => rootNode.id === selectedNode?.id) ? 1 : 0.5,
                    cursor: selectedNode && !Object.values(rootNodesByType).some(rootNode => rootNode.id === selectedNode?.id) ? 'pointer' : 'default',
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
        <Tooltip title="Dashboard (Option+1)" placement="right">
          <button
            style={{
              ...styles.navButton,
              ...(activeViews.dashboard ? styles.navButtonActive : {})
            }}
            onClick={() => toggleView('dashboard')}
          >
            <DashboardIcon />
          </button>
        </Tooltip>

        <Tooltip title="Map (Option+2)" placement="right">
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

        <Tooltip title="Waypoints (Option+3)" placement="right">
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

        <Tooltip title="Contributors (Option+4)" placement="right">
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
            onClick={() => setFocusedSection('dashboard')}
          >
            <div style={getSectionHeaderStyle('dashboard')}>
              <DashboardIcon sx={styles.sectionHeaderIcon} />
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
              {rootNodesByType.map ? (
                <Dashboard
                  nodes={nodes}
                  rootMapId={rootNodesByType.map.id}
                  selectNodeAndFocus={selectNodeAndFocus}
                />
              ) : (
                <div style={{ padding: '12px' }}>
                  <p>No Map data available.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeViews.map && rootNodesByType.map && (
          <div
            data-section-type="map"
            style={{
              ...styles.section,
              flex: getSectionFlex('map')
            }}
            onClick={() => setFocusedSection('map')}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setFocusedSection('map');
                e.preventDefault();
              }
            }}
            onFocus={() => {
              // When tabbed to, focus this section just like when clicked
              setFocusedSection('map');
            }}
            aria-label="Map section"
          >
            <div style={getSectionHeaderStyle('map')}>
              <MapIcon sx={styles.sectionHeaderIcon} />
              Problem / Solution Map

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


              {/* Add toggle for show/hide drafts */}
              <Tooltip title={showDraftMap ? "Hide draft problems" : "Show draft problems"}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={showDraftMap}
                      onChange={(e) => {
                        e.stopPropagation(); // Prevent event from reaching drag handlers
                        setShowDraftMap(e.target.checked);
                      }}
                    />
                  }
                  label={
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {showDraftMap ?
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <VisibilityOutlined sx={{ fontSize: 14 }} /> Drafts
                        </span> :
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <VisibilityOffOutlined sx={{ fontSize: 14 }} /> Drafts
                        </span>
                      }
                    </span>
                  }
                  style={{
                    margin: 0,
                    marginLeft: 'auto', // Push to right
                    marginRight: '0px', // No space before close button
                    position: 'relative',
                    zIndex: 25, // Higher than both drag handle and close button
                  }}
                  onClick={(e) => e.stopPropagation()} // Prevent triggering parent click events
                  onMouseDown={(e) => e.stopPropagation()} // Also prevent drag handle activation
                />
              </Tooltip>

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
              <HTable
                nodes={nodes}
                rootNodeId={rootNodesByType.map.id}
                selectedNode={getSelectedNode('map')}
                viewStateMethods={viewStateMethods}
                treeNodesApi={treeNodesApi}
                editingNodeId={editingNodeId}
                setEditingNodeId={setEditingNodeId}
                indexInParentMap={indexInParentMap}
                nameColumnHeader="Problem"
                readinessColumnHeader="Solution Readiness"
                isFocused={focusedSection === 'map'}
                expandedNodes={expandedMapNodes}
                setExpandedNodes={setExpandedMapNodes}
                showDraft={showDraftMap}
              />
            </div>
          </div>
        )}

        {activeViews.waypoints && rootNodesByType.waypoint && (
          <div
            data-section-type="waypoints"
            style={{
              ...styles.section,
              flex: getSectionFlex('waypoints')
            }}
            onClick={() => setFocusedSection('waypoints')}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setFocusedSection('waypoints');
                e.preventDefault();
              }
            }}
            onFocus={() => {
              // When tabbed to, focus this section just like when clicked
              setFocusedSection('waypoints');
            }}
            aria-label="Waypoints section"
          >
            <div style={getSectionHeaderStyle('waypoints')}>
              <LocationOn sx={styles.sectionHeaderIcon} />
              Waypoints (Deliverables & Milestones)

              {/* Add toggle for show/hide drafts */}
              <Tooltip title={showDraftWaypoints ? "Hide draft waypoints" : "Show draft waypoints"}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={showDraftWaypoints}
                      onChange={(e) => {
                        e.stopPropagation(); // Prevent event from reaching drag handlers
                        setShowDraftWaypoints(e.target.checked);
                      }}
                    />
                  }
                  label={
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {showDraftWaypoints ?
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <VisibilityOutlined sx={{ fontSize: 14 }} /> Drafts
                        </span> :
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <VisibilityOffOutlined sx={{ fontSize: 14 }} /> Drafts
                        </span>
                      }
                    </span>
                  }
                  style={{
                    margin: 0,
                    marginLeft: 'auto', // Push to right
                    marginRight: '0px', // No space before close button
                    position: 'relative',
                    zIndex: 25, // Higher than both drag handle and close button
                  }}
                  onClick={(e) => e.stopPropagation()} // Prevent triggering parent click events
                  onMouseDown={(e) => e.stopPropagation()} // Also prevent drag handle activation
                />
              </Tooltip>

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
              <HTable
                nodes={nodes}
                rootNodeId={rootNodesByType.waypoint.id}
                selectedNode={getSelectedNode('waypoint')}
                viewStateMethods={viewStateMethods}
                treeNodesApi={treeNodesApi}
                editingNodeId={editingNodeId}
                setEditingNodeId={setEditingNodeId}
                indexInParentMap={indexInParentMap}
                nameColumnHeader="Waypoint"
                readinessColumnHeader="Completion Level"
                isFocused={focusedSection === 'waypoints'}
                expandedNodes={expandedWaypointNodes}
                setExpandedNodes={setExpandedWaypointNodes}
                showDraft={showDraftWaypoints}
              />
            </div>
          </div>
        )}

        {activeViews.users && rootNodesByType.user && (
          <div
            data-section-type="users"
            style={{
              ...styles.section,
              flex: getSectionFlex('users')
            }}
            onClick={() => setFocusedSection('users')}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setFocusedSection('users');
                e.preventDefault();
              }
            }}
            onFocus={() => {
              // When tabbed to, focus this section just like when clicked
              setFocusedSection('users');
            }}
            aria-label="Contributors section"
          >
            <div style={getSectionHeaderStyle('users')}>
              <People sx={styles.sectionHeaderIcon} />
              Contributors
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
              <HTable
                nodes={nodes}
                rootNodeId={rootNodesByType.user.id}
                selectedNode={getSelectedNode('user')}
                viewStateMethods={viewStateMethods}
                treeNodesApi={treeNodesApi}
                editingNodeId={editingNodeId}
                setEditingNodeId={setEditingNodeId}
                indexInParentMap={indexInParentMap}
                nameColumnHeader="User"
                readinessColumnHeader="Status"
                isFocused={focusedSection === 'users'}
                expandedNodes={expandedUserNodes}
                setExpandedNodes={setExpandedUserNodes}
              />
            </div>
          </div>
        )}
      </main>

      {/* Details Panel - show focused section's selected node */}
      <DetailsPanel
        isRightPanelCollapsed={isRightPanelCollapsed}
        rightPanelWidth={rightPanelWidth}
        startResize={startResize}
        setRightPanelCollapsed={setRightPanelCollapsed}
        selectedNode={selectedNode}
        isResizing={isResizing}
        viewStateMethods={viewStateMethods}
        treeNodesApi={treeNodesApi}
        nameColumnHeader={
          focusedSection === 'map' ? "Problem" :
            focusedSection === 'waypoints' ? "Waypoint" :
              focusedSection === 'users' ? "User" : "Name"
        }
        readinessColumnHeader={
          focusedSection === 'map' ? "Solution Readiness" :
            focusedSection === 'waypoints' ? "Completion Level" :
              focusedSection === 'users' ? "Status" : "Readiness Level"
        }
        nodes={nodes}
      />

      {/* Comments Panel - always present regardless of active views */}
      <CommentsPanel
        isFooterCollapsed={isFooterCollapsed}
        setFooterCollapsed={setFooterCollapsed}
      />

      {/* Status Bar */}
      <StatusBar nodes={nodes} />
    </div>
  )
}

export default App
