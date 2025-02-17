import React, { useState, useCallback, useEffect } from 'react'
import { HTable, DetailsPanel, CommentsPanel } from './partials'
import { createNode, TreeNode } from './models'
import { useTreeState } from './useTreeState'
import { Undo, Redo } from '@mui/icons-material'

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
    borderBottom: '1px solid #e0e0e0',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#333',
  },
  main: {
    gridArea: 'main',
    overflow: 'auto',
    background: '#fff',
  },
} as const

const App = () => {
  const [isRightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [isFooterCollapsed, setFooterCollapsed] = useState(false)
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [isResizing, setIsResizing] = useState(false)

  const { rootNode, nodesById, treeStateMethods } = useTreeState(createNode({ name: 'Root', readinessLevel: 0 }, [
    createNode({ name: 'Customer can order products', readinessLevel: 1 }, [
      createNode({ name: 'Customer can add product to cart', readinessLevel: 2 }),
      createNode({ name: 'Customer can remove product from cart', readinessLevel: 2 }),
      createNode({ name: 'Customer can view cart', readinessLevel: 2 }),
    ]),
    createNode({ name: 'Fulfillment can process orders', readinessLevel: 1 }, [
      createNode({ name: 'Fulfillment can process orders', readinessLevel: 2 }),
      createNode({ name: 'Fulfillment can view order history', readinessLevel: 2 }),
    ]),
  ]))
  const { undo, redo, undosAvailable, redosAvailable } = treeStateMethods
  const [selectedNodeId, selectNodeById] = useState<string | null>(null)

  const selectedNode = selectedNodeId ? nodesById[selectedNodeId] : null

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

  return (
    <div style={styles.layout}>
      <header style={styles.header}>
        <h1 style={styles.title}>Expedition Status</h1>
      </header>

      <main style={styles.main}>
        <div className="App">
          <div style={{
            position: 'absolute',
            top: 12,  // Adjusted to align better with header
            right: 20,  // Match header padding
            display: 'flex',
            gap: 4  // Reduced gap
          }}>
            <button
              onClick={undo}
              disabled={!undosAvailable}
              style={{
                opacity: undosAvailable ? 1 : 0.5,
                cursor: undosAvailable ? 'pointer' : 'default',
                padding: 4,  // Reduced padding
                background: 'none',
                border: 'none',
                color: '#666'  // More subtle color
              }}
            >
              <Undo sx={{ fontSize: 18 }} />  {/* Smaller icon */}
            </button>
            <button
              onClick={redo}
              disabled={!redosAvailable}
              style={{
                opacity: redosAvailable ? 1 : 0.5,
                cursor: redosAvailable ? 'pointer' : 'default',
                padding: 4,  // Reduced padding
                background: 'none',
                border: 'none',
                color: '#666'  // More subtle color
              }}
            >
              <Redo sx={{ fontSize: 18 }} />  {/* Smaller icon */}
            </button>
          </div>
          <HTable
            rootNode={rootNode}
            selectedNode={selectedNode}
            selectNodeById={selectNodeById}
            treeStateMethods={treeStateMethods}
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
      />
      <CommentsPanel
        isFooterCollapsed={isFooterCollapsed}
        setFooterCollapsed={setFooterCollapsed}
      />

    </div>
  )
}

export default App
