import React from 'react'
import type { TreeNodeSet, NodeType } from '../../TreeNode'

// Import version from package.json
const APP_VERSION = '0.3.0' // Hardcoded from package.json

const styles = {
  footer: {
    gridArea: 'footer',
    borderTop: '1px solid var(--border-color)',
    height: '30px',
    background: 'var(--background-secondary)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    justifyContent: 'space-between',
  },
  nodeCount: {
    display: 'flex',
    gap: '16px',
  },
  countItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  version: {
    fontStyle: 'italic',
  }
}

type NodeCountsProps = {
  nodes: TreeNodeSet
}

// Function to count nodes by type
const getNodeCounts = (nodes: TreeNodeSet) => {
  const counts: Record<NodeType, number> = {
    map: 0,
    waypoint: 0,
    user: 0
  }

  Object.values(nodes).forEach(node => {
    if (counts[node.type] !== undefined) {
      counts[node.type]++
    }
  })

  return counts
}

export const StatusBar = ({ nodes }: NodeCountsProps) => {
  const nodeCounts = getNodeCounts(nodes)

  return (
    <footer style={styles.footer}>
      <div style={styles.nodeCount}>
        <div style={styles.countItem}>
          Problems: {nodeCounts.map}
        </div>
        <div style={styles.countItem}>
          Waypoints: {nodeCounts.waypoint}
        </div>
        <div style={styles.countItem}>
          Contributors: {nodeCounts.user}
        </div>
      </div>
      <div style={styles.version}>
        MXP v{APP_VERSION}
      </div>
    </footer>
  )
}