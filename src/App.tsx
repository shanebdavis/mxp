import React, { useState, useCallback, useEffect } from 'react'
import { HTable, DetailsPanel, CommentsPanel } from './partials'
import { createNode, TreeNode } from './models'
import { useTreeState } from './useTreeState'

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

  const [rootNode, treeStateMethods] = useTreeState(createNode({ name: 'Root', readinessLevel: 0 }, [
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
  const [selectedNode, selectNode] = useState<TreeNode | null>(null)

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

  return (
    <div style={styles.layout}>
      <header style={styles.header}>
        <h1 style={styles.title}>Expedition Status</h1>
      </header>

      <main style={styles.main}>
        <HTable {...{ selectNode, treeStateMethods, rootNode }} />
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
