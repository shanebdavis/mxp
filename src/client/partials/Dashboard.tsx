import React from 'react'
import { Explore } from '@mui/icons-material'
import { TreeNodeSet, findPriorityNodes } from '../../TreeNode'

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

  return (
    <div style={{ padding: '12px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Explore style={{ fontSize: '18px' }} />
        Heading
      </h3>
      <div style={{ marginLeft: '8px' }}>
        {priorityNodes
          .slice(0, 3) // Show only top 3
          .map((node, index) => (
            <div
              key={node.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '6px 0',
                cursor: 'pointer',
                borderBottom: index < 2 ? '1px solid var(--border-color)' : 'none'
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
              <div>
                <div style={{ fontWeight: 500 }}>{node.title}</div>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  marginTop: '2px'
                }}>
                  Readiness Level: {node.calculatedMetrics.readinessLevel}
                </div>
              </div>
            </div>
          ))}
        {priorityNodes.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            No priority nodes found in the Map.
          </div>
        )}
      </div>
    </div>
  )
}