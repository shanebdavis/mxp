import { TreeNode } from "../models"
import { PanelHeader } from "./PanelHeader"
import { formatReadinessLevel } from '../presenters'

const styles = {
  rightPanel: {
    gridArea: 'right',
    width: '300px',
    borderLeft: '1px solid var(--border-color)',
    background: 'var(--background-secondary)',
    transition: 'width 0.2s ease',
    position: 'relative' as const,
  },
  rightPanelCollapsed: {
    width: '40px',
  },
  resizeHandle: {
    position: 'absolute' as const,
    left: -4,
    top: 0,
    bottom: 0,
    width: 8,
    cursor: 'col-resize',
  },
  content: {
    color: 'var(--text-primary)',
  }
}

export const DetailsPanel = ({ isRightPanelCollapsed, rightPanelWidth, startResize, setRightPanelCollapsed, selectedNode, isResizing }: {
  isRightPanelCollapsed: boolean
  rightPanelWidth: number
  startResize: (e: React.MouseEvent) => void
  setRightPanelCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void
  selectedNode: TreeNode | null
  isResizing: boolean
}) => (
  < aside style={{
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
    {
      !isRightPanelCollapsed && (
        <div style={{ padding: '12px', ...styles.content }}>
          {selectedNode ? (
            <>
              <h3>{selectedNode.name}</h3>
              <p>Readiness Level: {formatReadinessLevel(selectedNode.readinessLevel)}</p>
            </>
          ) : (
            <p>Select an item to view details</p>
          )}
        </div>
      )
    }
  </aside >)