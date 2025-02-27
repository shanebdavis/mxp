import React, { useState } from 'react'
import { Explore } from '@mui/icons-material'
import { TreeNodeSet, findPriorityNodes } from '../../TreeNode'
import { RlPill } from '../widgets/RlPill'

interface DashboardProps {
  nodes: TreeNodeSet
  rootMapId: string
  selectNodeAndFocus: (nodeId: string, type: string) => void
}

export const Dashboard: React.FC<DashboardProps> = ({
  nodes,
  rootMapId,
  selectNodeAndFocus
}) => {
  const priorityNodes = findPriorityNodes(nodes, rootMapId)
  const [expanded, setExpanded] = useState(false)

  // Limit to 3 when collapsed, 10 when expanded
  const displayNodes = expanded ? priorityNodes.slice(0, 10) : priorityNodes.slice(0, 3)
  const hasMoreNodes = priorityNodes.length > 3
  const remainingCount = expanded
    ? (priorityNodes.length > 10 ? priorityNodes.length - 10 : 0)
    : priorityNodes.length - 3

  return (
    <div style={{ padding: '12px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Explore style={{ fontSize: '18px' }} />
        Heading - Priority Problems
      </h3>
      <div style={{ marginLeft: '8px' }}>
        {displayNodes.map((node, index) => (
          <div
            key={node.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '6px 0',
              cursor: 'pointer',
              borderBottom: index < displayNodes.length - 1 ? '1px solid var(--border-color)' : 'none'
            }}
            onClick={() => selectNodeAndFocus(node.id, 'map')}
          >
            <div style={{
              minWidth: '24px',
              textAlign: 'center',
              marginRight: '8px',
              color: 'var(--text-secondary)'
            }}>
              {index + 1}.
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ fontWeight: 500 }}>{node.title}</div>
                <RlPill
                  level={node.calculatedMetrics.readinessLevel}
                  auto={node.setMetrics?.readinessLevel == null}
                />
              </div>
            </div>
          </div>
        ))}
        {priorityNodes.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            No priority nodes found in the Map.
          </div>
        )}
        {hasMoreNodes && (
          <div
            style={{
              marginTop: '12px',
              textAlign: 'center'
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                color: 'var(--text-primary)'
              }}
            >
              {expanded
                ? 'Show Less'
                : `Show More (${priorityNodes.length - 3})`}
            </button>
            {expanded && priorityNodes.length > 10 && (
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginTop: '8px'
              }}>
                {remainingCount} more items not shown
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}