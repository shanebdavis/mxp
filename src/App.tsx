import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { HTable, DetailsPanel, CommentsPanel } from './client/partials'
import { createNode } from './models/TreeNode2'
import { useTreeState } from './useTreeState'
import {
  Undo, Redo, Add,
  ArrowRight, ArrowDropDown,
  Delete
} from '@mui/icons-material'
import { Tooltip } from '@mui/material'
import type { TreeNode2, TreeNodeMap } from './models/TreeNode2'

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

const getParentMap = (nodes: TreeNodeMap): Record<string, TreeNode2> => {
  const result: Record<string, TreeNode2> = {}
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

  // Create initial tree structure
  const initialNodes: TreeNodeMap = useMemo(() => {
    const root = createNode({ title: 'Delight with Roll Hexfinity' })
    const child1 = createNode({ title: 'Customer can order products' }, root.id)
    const child2 = createNode({ title: 'Fulfillment can process orders' }, root.id)

    const child1_1 = createNode({ title: 'Customer can add product to cart', setMetrics: { readinessLevel: 3 } }, child1.id)
    const child1_2 = createNode({ title: 'Customer can remove product from cart', setMetrics: { readinessLevel: 5 } }, child1.id)
    const child1_3 = createNode({ title: 'Customer can view cart', setMetrics: { readinessLevel: 4 } }, child1.id)

    const child2_1 = createNode({ title: 'Fulfillment can process orders', setMetrics: { readinessLevel: 3 } }, child2.id)
    const child2_2 = createNode({ title: 'Fulfillment can view order history', setMetrics: { readinessLevel: 2 } }, child2.id)

    // Create the nodes map with proper childrenIds
    const nodes: TreeNodeMap = {
      [root.id]: { ...root, childrenIds: [child1.id, child2.id] },
      [child1.id]: { ...child1, childrenIds: [child1_1.id, child1_2.id, child1_3.id] },
      [child2.id]: { ...child2, childrenIds: [child2_1.id, child2_2.id] },
      [child1_1.id]: { ...child1_1, childrenIds: [] },
      [child1_2.id]: { ...child1_2, childrenIds: [] },
      [child1_3.id]: { ...child1_3, childrenIds: [] },
      [child2_1.id]: { ...child2_1, childrenIds: [] },
      [child2_2.id]: { ...child2_2, childrenIds: [] },
    }

    // Calculate metrics from bottom up
    const calculateMetrics = (nodeId: string): number => {
      const node = nodes[nodeId]
      if (node.childrenIds.length === 0) {
        return node.setMetrics?.readinessLevel ?? 0
      }
      const childLevels = node.childrenIds.map(calculateMetrics)
      const minLevel = Math.min(...childLevels)
      node.calculatedMetrics = { readinessLevel: minLevel }
      return minLevel
    }

    calculateMetrics(root.id)
    return nodes
  }, [])

  const { nodes, rootNodeId, treeStateMethods } = useTreeState(initialNodes)
  const { undo, redo, undosAvailable, redosAvailable } = treeStateMethods
  const [selectedNodeId, selectNodeById] = useState<string | null>(rootNodeId)

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {  // metaKey is Command on Mac
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        e.preventDefault()  // Prevent browser's default undo/redo
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  const selectedNodeParent = selectedNode && parentMap[selectedNode.id]

  return (
    <div style={styles.layout}>
      <header style={styles.header}>
        <h1 style={styles.title}>Expedition Status</h1>
      </header>

      <main style={styles.main}>
        <div className="App">
          <div style={{
            position: 'absolute',
            top: 12,
            right: 20,
            display: 'flex',
            gap: 8,  // Increased gap for visual grouping
            alignItems: 'center'
          }}>
            {/* First group: Undo/Redo */}
            <div style={{ display: 'flex', gap: 4 }}>
              <Tooltip title="Undo">
                <span>
                  <button
                    onClick={undo}
                    disabled={!undosAvailable}
                    style={{
                      opacity: undosAvailable ? 1 : 0.5,
                      cursor: undosAvailable ? 'pointer' : 'default',
                      padding: 4,
                      background: 'none',
                      border: 'none',
                      color: '#666'
                    }}
                  >
                    <Undo sx={{ fontSize: 18 }} />
                  </button>
                </span>
              </Tooltip>
              <Tooltip title="Redo">
                <span>
                  <button
                    onClick={redo}
                    disabled={!redosAvailable}
                    style={{
                      opacity: redosAvailable ? 1 : 0.5,
                      cursor: redosAvailable ? 'pointer' : 'default',
                      padding: 4,
                      background: 'none',
                      border: 'none',
                      color: '#666'
                    }}
                  >
                    <Redo sx={{ fontSize: 18 }} />
                  </button>
                </span>
              </Tooltip>
            </div>

            {/* Second group: Node operations */}
            <div style={{ display: 'flex', gap: 4 }}>
              <Tooltip title="Add Child">
                <span>
                  <button
                    onClick={() => {
                      if (selectedNode) {
                        const newNodeId = treeStateMethods.addNode({
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
                    onClick={() => {
                      if (selectedNode?.parentId) {
                        const newNodeId = treeStateMethods.addNode({
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
                    onClick={() => selectedNode && treeStateMethods.removeNode(selectedNode.id)}
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
