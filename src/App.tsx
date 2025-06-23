import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { DetailsPanel, CommentsPanel, StatusBar, Section, AppHeaderBar } from './client/partials'
import {
  Dashboard as DashboardIcon,
  Map as MapIcon,
  LocationOn,
  People,
} from '@mui/icons-material'
import { Tooltip } from '@mui/material'
import { TreeNode, TreeNodeSet, NodeType, TreeNodeProperties, getAllParentNodeIds, getIndexInParentMap } from './TreeNode'
import { useApiForState } from './useApiForState'
import { ViewStateMethods } from './ViewStateMethods'
import { timeout } from './ArtStandardLib'
import useSessionStorageState from 'use-session-storage-state'

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


} as const

// Add a type for the active views state
interface ActiveViews {
  dashboard: boolean;
  map: boolean;
  waypoints: boolean;
  users: boolean;
}

// Add types for section names and focused section
type SectionName = 'dashboard' | 'map' | 'waypoints' | 'users'

// Map of node types to section names
const nodeTypeToSectionMap: Record<NodeType, SectionName> = {
  map: 'map',
  waypoint: 'waypoints',
  user: 'users'
}

interface SectionWeights {
  dashboard: number;
  map: number;
  waypoints: number;
  users: number;
}

// State for drop preview
interface DropPreview {
  dropParentId: string | null;
  insertAtIndex: number | null;
}

// Add debounce utility for optimization
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const App = () => {
  //*************************************************
  // <APP STATE>
  //*************************************************

  //*************************************************
  // Persisted View State that actually belongs here, in App state
  //*************************************************

  const [isDetailsPanelActive, setDetailsPanelActive] = useSessionStorageState<boolean>('detailsPanel.collapsed', {
    defaultValue: true
  })

  // show/hide sections
  const [activeSectionsByName, setActiveSectionsByName] = useSessionStorageState<ActiveViews>('activeViews', {
    defaultValue: {
      dashboard: false,
      map: true,
      waypoints: false,
      users: false
    }
  })

  // Right Panel Positioning
  const [rightPanelWidthPercentage, setRightPanelWidthPercentage] = useSessionStorageState<number>('detailsPanel.widthPercentage', {
    defaultValue: DEFAULT_PANEL_WIDTH_PERCENTAGE
  })

  // Track selected node ID for each type
  const [selectedNodeIds, setSelectedNodeIds] = useSessionStorageState<Record<string, string | undefined>>('selectedNodeIds', {
    defaultValue: {}
  })

  // Add state to track which section is currently focused
  const [focusedSection, setFocusedSection] = useSessionStorageState<SectionName>('focusedSection', {
    defaultValue: 'map'
  })

  // Add expanded nodes state for each node type
  const [expandedNodes, setExpandedNodes] = useSessionStorageState<Record<string, boolean>>('expandedMapNodes', {
    defaultValue: {}
  })

  // Section Positioning
  const [sectionWeights, setSectionWeights] = useSessionStorageState<SectionWeights>('sectionWeights', {
    defaultValue: {
      dashboard: 1.0,
      map: 1.0,
      waypoints: 1.0,
      users: 1.0
    }
  })

  //*************************************************
  // Temporary View State
  //*************************************************
  const [isResizing, setIsResizing] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [preserveEditing, setPreserveEditing] = useState<boolean>(false)

  // Track which section is being resized
  const [resizingSection, setResizingSection] = useState<{
    section: SectionName,
    nextSection: SectionName,
    startY: number,
    initialHeight: number,
    initialNextHeight: number
  } | null>(null)

  //*************************************************
  // Temporary State for drag and drop
  //*************************************************
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null)

  // Add state for drop preview
  const [dropPreview, setDropPreview] = useState<DropPreview>({
    dropParentId: null,
    insertAtIndex: null
  });





  // Global show drafts toggle
  const [showDrafts, setShowDrafts] = useSessionStorageState<boolean>('showDrafts', {
    defaultValue: true
  })

  //*************************************************
  // Belongs in useApiForState
  //*************************************************
  const [config, setConfig] = useState<{ projectTitle?: string, workUnits?: string, iconPath?: string }>({})

  useEffect(() => {
    fetch('/api/config')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then(config => { console.log({ config }); return config })
      .then(setConfig)
      .catch(error => {
        console.error('Error fetching config:', error)
      })
  }, [])

  //*************************************************
  // </APP STATE>
  //*************************************************
  //*************************************************
  // <APP STATE UPDATES>
  //*************************************************
  const { nodes, rootNodesByType, treeNodesApi, loading, error } = useApiForState()

  // Add this near your other state declarations
  const latestNodesRef = useRef<TreeNodeSet>(nodes);

  // Update the ref whenever nodes changes
  useEffect(() => {
    latestNodesRef.current = nodes;
  }, [nodes]);

  // Update the effect that clears edit mode to be more selective
  useEffect(() => {
    // Only clear edit mode if:
    // 1. We're not preserving edit mode
    // 2. The currently editing node is not the selected node for its type
    if (!preserveEditing) {
      const editingNode = editingNodeId ? nodes[editingNodeId] : null;
      if (editingNode) {
        const selectedId = selectedNodeIds[editingNode.type];
        if (selectedId !== editingNodeId) {
          setEditingNodeId(null);
        }
      }
    }
  }, [selectedNodeIds, preserveEditing, editingNodeId, nodes])

  //*************************************************
  // </APP STATE UPDATES>
  //*************************************************
  useEffect(() => {
    const baseTitle = "Expedition"
    document.title = config.projectTitle
      ? `${config.projectTitle} - ${baseTitle}`
      : baseTitle
  }, [config.projectTitle])

  // Toggle a view on/off
  const toggleView = (view: keyof ActiveViews) => {
    const isFocusedSection = view === focusedSection;

    setActiveSectionsByName((prev: ActiveViews) => {
      // Calculate what the new state would be
      const newState = {
        ...prev,
        [view]: !prev[view]
      }

      // Check if all sections would be turned off
      const allOff = Object.values(newState).every((isActive: boolean) => !isActive)

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

  // Calculate pixel width from percentage
  const rightPanelWidth = useMemo(() => {
    return Math.round((window.innerWidth * rightPanelWidthPercentage) / 100)
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

  // Get the current selected node
  const getSelectedNode = (type: NodeType): TreeNode | null => {
    const selectedId = selectedNodeIds[type]
    return selectedId ? nodes[selectedId] : null
  }

  // Ensure root nodes are expanded by default once they're available
  useEffect(() => {
    if (Object.keys(rootNodesByType).length > 0) {
      setExpandedNodes((prev: Record<string, boolean>) => {
        const newExpandedNodes = { ...prev }
        Object.values(rootNodesByType).forEach(node => newExpandedNodes[node.id] = true)
        return newExpandedNodes
      })
    }
  }, [rootNodesByType]);


  // Function to expand all parent nodes of a selected node
  const expandParentNodes = (nodeId: string) => {
    const parentIds = getAllParentNodeIds(nodeId, latestNodesRef.current)

    if (parentIds.length === 0) return // No parents to expand

    // Create an object with all parent IDs set to true
    const expansionUpdates = parentIds.reduce((acc, parentId) => {
      acc[parentId] = true
      return acc
    }, {} as Record<string, boolean>)

    // Update the appropriate expanded nodes state based on node type
    setExpandedNodes((prev: Record<string, boolean>) => ({ ...prev, ...expansionUpdates }))
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
    setSelectedNodeIds((prev: Record<string, string | undefined>) => {
      if (prev[nodeType] !== nodeId) {
        return {
          ...prev,
          [nodeType]: nodeId
        }
      }

      // else we need to force scrolling to the node by temporarily deselecting it
      timeout(10).then(() => {
        // restore the selected node
        setSelectedNodeIds((prevState: Record<string, string | undefined>) => ({
          ...prevState,
          [nodeType]: nodeId
        }));
      });

      // temporarily deselect the node
      return { ...prev, [nodeType]: '' }
    })

    // 2. Make sure appropriate section is shown
    const sectionName = nodeTypeToSectionMap[nodeType]
    if (!activeSectionsByName[sectionName]) {
      setActiveSectionsByName((prev: ActiveViews) => ({
        ...prev,
        [sectionName]: true
      }))
    }

    // 3. Focus the appropriate section
    setFocusedSection(sectionName)

    // 4. Expand the tree if needed so the item is visible
    expandParentNodes(nodeId)
  }

  const addAndFocusNode = async (nodeProperties: TreeNodeProperties, parentId: string, insertAtIndex?: number) => {
    const newNode = await treeNodesApi.addNode(nodeProperties, parentId, insertAtIndex);
    setPreserveEditing(true);
    setEditingNodeId(newNode.id);
    selectNodeAndFocus(newNode);
    setPreserveEditing(false);
    return newNode;
  }

  // Create a debounced version of setEditingNodeId to reduce re-renders
  const debouncedSetEditingNodeId = useMemo(() =>
    debounce((id: string | null) => {
      setEditingNodeId(id);
    }, 5), // Small delay to batch updates without affecting UX
    []);

  // Create an optimized version of viewStateMethods that uses the debounced function
  const viewStateMethods: ViewStateMethods = useMemo(() => ({
    expandParentNodes: (nodeId: string) => {
      // Expand all parent nodes to ensure the target node is visible
      const parentIds = getAllParentNodeIds(nodeId, nodes);
      if (parentIds.length > 0) {
        setExpandedNodes((prev) => {
          const newState = { ...prev };
          parentIds.forEach(id => {
            newState[id] = true;
          });
          return newState;
        });
      }
    },

    selectNodeAndFocus,

    setEditingNodeId: debouncedSetEditingNodeId, // Use the debounced version

    addAndFocusNode
  }), [nodes, setExpandedNodes, selectNodeAndFocus, debouncedSetEditingNodeId, addAndFocusNode]);

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

  // Ref for the main container to get section elements
  const mainRef = useRef<HTMLDivElement>(null)

  // Get the active sections in display order
  const activeSectionList =
    (Object.entries(activeSectionsByName) as [SectionName, boolean][])
      .filter(([_, isActive]) => isActive)
      .map(([name]) => name)

  // Calculate flex values for each section based on weights
  const getSectionFlex = useCallback((section: SectionName) => {
    // If there's only one section active, it should take full space
    if (activeSectionList.length === 1) return 1

    // Calculate the total weight of all active sections
    const totalWeight = activeSectionList.reduce(
      (sum: number, name: SectionName) => sum + sectionWeights[name],
      0
    )

    // Return the proportional flex value
    return sectionWeights[section] / totalWeight
  }, [activeSectionList, sectionWeights])

  // Completely revise the startSectionResize function
  const startSectionResize = useCallback((e: React.MouseEvent, section: SectionName) => {
    // The error was here - when dragging section at index 1, we need to resize sections at index 0 and 1

    // We need to find the previous section (the one being resized)
    const sectionIndex = activeSectionList.indexOf(section)
    if (sectionIndex === 0) return // Cannot resize the first section (no previous section)

    // Get the previous section (the one above the drag handle)
    const previousSection = activeSectionList[sectionIndex - 1]

    // Get section elements to calculate heights
    if (!mainRef.current) return

    // Get all visible section elements
    const sections = Array.from(mainRef.current.children).filter(el => {
      return el.tagName === 'DIV' &&
        el.getAttribute('data-section-type') &&
        activeSectionList.includes(el.getAttribute('data-section-type') as SectionName)
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
  }, [activeSectionList])

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
    setSectionWeights((prev: SectionWeights) => ({
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

        if (activeSectionsByName[section]) {
          // If the view is active, focus on it
          setFocusedSection(section);
        } else {
          // If the view is not active, toggle it on
          toggleView(section);
        }
      }
    }
  }, [activeSectionsByName, focusedSection, toggleView]);

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

          // If this is the first child, clear parent's setMetrics (default to auto metrics when there are children)
          if (currentNode.childrenIds.length === 0) {
            await treeNodesApi.updateNode(currentNode.id, { setMetrics: {} });
          }

          // Ensure parent node is expanded
          if (!expandedNodes[currentNode.id]) {
            setExpandedNodes(prev => ({ ...prev, [currentNode.id]: true }));
          }

          await addAndFocusNode({ title: '' }, currentNode.id)
        } else if (e.shiftKey && !e.metaKey && !e.ctrlKey && currentNode.parentId) {
          // Shift + Enter - Add Sibling (only if not root node)
          e.preventDefault(); // Prevent default browser behavior

          await addAndFocusNode({ title: '' }, currentNode.parentId)
        }
      }
    };

    window.addEventListener('keydown', handleNodeOperationShortcuts);
    return () => window.removeEventListener('keydown', handleNodeOperationShortcuts);
  }, [nodes, selectedNodeIds, focusedSection, treeNodesApi, setEditingNodeId, sectionToNodeType, selectNodeAndFocus, expandedNodes, setExpandedNodes]);

  // Add the event listener for the keyboard handler
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]); // Dependency includes the memoized handler

  // Function to clear drop preview
  const clearDropPreview = () => {
    setDropPreview({
      dropParentId: null,
      insertAtIndex: null
    });
  };

  // Add loading and error states
  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }

  if (error) {
    return <div style={{ padding: 20, color: 'red' }}>Error: {error.message}</div>
  }

  const commonProps = {
    clearDropPreview,
    dropPreview,
    editingNodeId,
    expandedNodes,
    indexInParentMap,
    nodes,
    setDropPreview,
    setExpandedNodes,
    treeNodesApi,
    viewStateMethods,
    draggedNode,
    setDraggedNode
  }

  return (
    <div style={styles.layout}>
      <AppHeaderBar
        config={config}
        showDrafts={showDrafts}
        setShowDrafts={setShowDrafts}
        selectedNode={selectedNode}
        addAndFocusNode={addAndFocusNode}
        treeNodesApi={treeNodesApi}
        rootNodesByType={rootNodesByType}
      />

      <nav style={styles.nav}>
        <Tooltip title="Dashboard (⌥+1 / Alt+1)">
          <button
            style={{
              ...styles.navButton,
              ...(activeSectionsByName.dashboard ? styles.navButtonActive : {})
            }}
            onClick={() => toggleView('dashboard')}
          >
            <DashboardIcon />
          </button>
        </Tooltip>

        <Tooltip title="Map (⌥+2 / Alt+2)">
          <button
            style={{
              ...styles.navButton,
              ...(activeSectionsByName.map ? styles.navButtonActive : {})
            }}
            onClick={() => toggleView('map')}
          >
            <MapIcon />
          </button>
        </Tooltip>

        <Tooltip title="Waypoints (⌥+3 / Alt+3)">
          <button
            style={{
              ...styles.navButton,
              ...(activeSectionsByName.waypoints ? styles.navButtonActive : {})
            }}
            onClick={() => toggleView('waypoints')}
          >
            <LocationOn />
          </button>
        </Tooltip>

        <Tooltip title="Users (⌥+4 / Alt+4)">
          <button
            style={{
              ...styles.navButton,
              ...(activeSectionsByName.users ? styles.navButtonActive : {})
            }}
            onClick={() => toggleView('users')}
          >
            <People />
          </button>
        </Tooltip>
      </nav>

      <main ref={mainRef} style={styles.main}>
        {activeSectionsByName.dashboard && (
          <Section
            sectionName="dashboard"
            title="Dashboard"
            icon={<DashboardIcon />}
            isFocused={focusedSection === 'dashboard'}
            showDrafts={showDrafts}
            onClose={() => toggleView('dashboard')}
            onFocus={() => setFocusedSection('dashboard')}
            flex={getSectionFlex('dashboard')}
            resizingSection={resizingSection}
            contentType="dashboard"
            dashboardProps={rootNodesByType.map ? {
              nodes,
              rootMapId: rootNodesByType.map.id,
              selectNodeAndFocus
            } : undefined}
          />
        )}

        {activeSectionsByName.map && rootNodesByType.map && (
          <Section
            sectionName="map"
            title="Problem to Solution Map"
            icon={<MapIcon />}
            isFocused={focusedSection === 'map'}
            showDrafts={showDrafts}
            onDragStart={(e) => startSectionResize(e, 'map')}
            onClose={() => toggleView('map')}
            onFocus={() => setFocusedSection('map')}
            flex={getSectionFlex('map')}
            resizingSection={resizingSection}
            contentType="table"
            tableProps={{
              rootNodeId: rootNodesByType.map.id,
              selectedNode: getSelectedNode('map'),
              ...commonProps
            }}
          />
        )}

        {activeSectionsByName.waypoints && rootNodesByType.waypoint && (
          <Section
            sectionName="waypoints"
            title="Waypoints (Deliverables & Milestones)"
            icon={<LocationOn />}
            isFocused={focusedSection === 'waypoints'}
            showDrafts={showDrafts}
            onDragStart={(e) => startSectionResize(e, 'waypoints')}
            onClose={() => toggleView('waypoints')}
            onFocus={() => setFocusedSection('waypoints')}
            flex={getSectionFlex('waypoints')}
            resizingSection={resizingSection}
            contentType="table"
            tableProps={{
              rootNodeId: rootNodesByType.waypoint.id,
              selectedNode: getSelectedNode('waypoint'),
              nameColumnHeader: "Waypoint",
              readinessColumnHeader: "Completion Level",
              ...commonProps
            }}
          />
        )}

        {activeSectionsByName.users && rootNodesByType.user && (
          <Section
            sectionName="users"
            title="Contributors"
            icon={<People />}
            isFocused={focusedSection === 'users'}
            showDrafts={showDrafts}
            onDragStart={(e) => startSectionResize(e, 'users')}
            onClose={() => toggleView('users')}
            onFocus={() => setFocusedSection('users')}
            flex={getSectionFlex('users')}
            resizingSection={resizingSection}
            contentType="table"
            tableProps={{
              rootNodeId: rootNodesByType.user.id,
              selectedNode: getSelectedNode('user'),
              nameColumnHeader: "User",
              ...commonProps
            }}
          />
        )}
      </main>

      {/* Details Panel - show focused section's selected node */}
      <DetailsPanel
        isDetailsPanelActive={isDetailsPanelActive}
        rightPanelWidth={rightPanelWidth}
        startResize={startResize}
        setDetailsPanelActive={setDetailsPanelActive}
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

      {/* Status Bar */}
      <StatusBar nodes={nodes} />
    </div>
  )
}

export default App
