import React, { useState, useCallback, useEffect } from 'react'
import { HTable } from './components'
import { TreeNode } from './models'
import { ArrowDropDown, ArrowDropUp, ArrowLeft, ArrowRight } from '@mui/icons-material'
import { formatReadinessLevel } from './utils/formatting'

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
  rightPanel: {
    gridArea: 'right',
    width: '300px',
    borderLeft: '1px solid #e0e0e0',
    background: '#f8f9fa',
    transition: 'width 0.2s ease',
    position: 'relative' as const,
  },
  rightPanelCollapsed: {
    width: '40px',
  },
  footer: {
    gridArea: 'footer',
    borderTop: '1px solid #e0e0e0',
    height: '200px',
    background: '#f8f9fa',
    transition: 'height 0.2s ease',
  },
  footerCollapsed: {
    height: '40px',
  },
  collapseButton: {
    padding: '8px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      color: '#333',
    }
  },
  resizeHandle: {
    position: 'absolute' as const,
    left: -4,
    top: 0,
    bottom: 0,
    width: 8,
    cursor: 'col-resize',
  },
} as const

const PanelHeader = ({ isCollapsed, label, onClick, isVertical = false }: {
  isCollapsed: boolean
  label: string
  onClick: () => void
  isVertical?: boolean
}) => (
  <button
    style={{
      ...styles.collapseButton,
      width: '100%',
      justifyContent: 'flex-start',
      gap: '4px'
    }}
    onClick={onClick}
  >
    {isVertical ? (
      // Details panel: left when collapsed, right when expanded
      isCollapsed ? (
        <ArrowLeft style={{ width: 20, height: 20 }} />
      ) : (
        <ArrowRight style={{ width: 20, height: 20 }} />
      )
    ) : (
      // Comments panel: up when collapsed, down when expanded
      isCollapsed ? (
        <ArrowDropUp style={{ width: 20, height: 20 }} />
      ) : (
        <ArrowDropDown style={{ width: 20, height: 20 }} />
      )
    )}
    {(!isCollapsed || !isVertical) && <span>{label}</span>}
  </button>
)

const App = () => {
  const [isRightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [isFooterCollapsed, setFooterCollapsed] = useState(false)
  const [selectedNode, selectNode] = useState<TreeNode | null>(null)
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [isResizing, setIsResizing] = useState(false)

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
        <HTable {...{ selectNode }} />
      </main>

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
          <div style={{ padding: '12px' }}>
            {selectedNode ? (
              <>
                <h3>{selectedNode.name}</h3>
                <p>Readiness Level: {formatReadinessLevel(selectedNode.readinessLevel)}</p>
              </>
            ) : (
              <p>Select an item to view details</p>
            )}
          </div>
        )}
      </aside>

      <footer style={{
        ...styles.footer,
        ...(isFooterCollapsed && styles.footerCollapsed)
      }}>
        <PanelHeader
          isCollapsed={isFooterCollapsed}
          label="Comments"
          onClick={() => setFooterCollapsed(prev => !prev)}
          isVertical={false}
        />
        {!isFooterCollapsed && <div style={{ padding: '12px' }}>Panel content</div>}
      </footer>
    </div>
  )
}

export default App
