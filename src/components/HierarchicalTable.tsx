import { useState, type FC } from 'react'
import { ArrowDropDown, ArrowRight } from '@mui/icons-material'
import { formatReadinessLevel } from '../utils/formatting'

interface TreeNode {
  id: string
  name: string
  readinessLevel: number  // 0-9
  children: TreeNode[]
}

const dummyData: TreeNode = {
  id: 'root',
  name: 'Project Root',
  readinessLevel: 3,
  children: [
    {
      id: '1',
      name: 'Frontend Development',
      readinessLevel: 2,
      children: [
        {
          id: '1.1',
          name: 'User Interface',
          readinessLevel: 1,
          children: []
        },
        {
          id: '1.2',
          name: 'Authentication',
          readinessLevel: 0,
          children: []
        }
      ]
    },
    {
      id: '2',
      name: 'Backend Development',
      readinessLevel: 1,
      children: [
        {
          id: '2.1',
          name: 'API Design',
          readinessLevel: 2,
          children: []
        }
      ]
    }
  ]
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: '14px',
    lineHeight: '1.4',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    borderSpacing: 0,
  },
  headerCell: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    borderBottom: '2px solid #e0e0e0',
    color: '#666',
    fontWeight: 600,
    fontSize: '13px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  cell: {
    padding: '6px 12px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
  },
  treeCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  toggleButton: {
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    color: '#666',
    userSelect: 'none' as const,
    fontSize: '10px',
    borderRadius: '12px',
  },
  readinessLevel: {
    fontFamily: 'Monaco, Consolas, monospace',
    fontSize: '13px',
    color: '#666',
  },
  row: {
    cursor: 'pointer',
  }
} as const

interface TreeNodeProps {
  node: TreeNode
  level?: number
  expandedNodes: string[]
  toggleNode: (id: string) => void
  onSelect: (node: TreeNode) => void
  selectedNodeId?: string
}

const TreeNode: FC<TreeNodeProps> = ({ node, level = 0, expandedNodes, toggleNode, onSelect, selectedNodeId }) => {
  const hasChildren = node.children?.length > 0
  const isExpanded = expandedNodes.includes(node.id)
  const isSelected = node.id === selectedNodeId

  const handleRowClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.toggle-button')) {
      if (isSelected && hasChildren) {
        toggleNode(node.id)
      } else {
        onSelect(node)
        if (hasChildren && !isExpanded) {
          toggleNode(node.id)
        }
      }
    }
  }

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleNode(node.id)
  }

  return (
    <>
      <tr
        className="table-row"
        style={styles.row}
        onClick={handleRowClick}
      >
        <td style={styles.cell}>
          <div style={styles.treeCell}>
            <span style={{ paddingLeft: `${level * 16}px` }} />
            {hasChildren && (
              <span
                className="toggle-button"
                onClick={handleToggleClick}
                style={styles.toggleButton}
              >
                {isExpanded
                  ? <ArrowDropDown style={{ width: 16, height: 16 }} />
                  : <ArrowRight style={{ width: 16, height: 16 }} />
                }
              </span>
            )}
            {!hasChildren && <span style={{ width: 24 }} />}
            {node.name}
          </div>
        </td>
        <td style={{ ...styles.cell, ...styles.readinessLevel }}>
          {formatReadinessLevel(node.readinessLevel)}
        </td>
      </tr>
      {isExpanded && node.children?.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          level={level + 1}
          expandedNodes={expandedNodes}
          toggleNode={toggleNode}
          onSelect={onSelect}
          selectedNodeId={selectedNodeId}
        />
      ))}
    </>
  )
}

const HierarchicalTable: FC<{
  onSelect?: (node: TreeNode) => void
}> = ({ onSelect = () => {} }) => {
  const [expandedNodes, setExpandedNodes] = useState<string[]>(['root'])
  const [selectedNodeId, setSelectedNodeId] = useState<string>('root')

  const toggleNode = (id: string) => {
    setExpandedNodes(prev =>
      prev.includes(id)
        ? prev.filter(nodeId => nodeId !== id)
        : [...prev, id]
    )
  }

  const handleSelect = (node: TreeNode) => {
    setSelectedNodeId(node.id)
    onSelect(node)
  }

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.headerCell}>Name</th>
            <th style={styles.headerCell}>Readiness Level</th>
          </tr>
        </thead>
        <tbody>
          <TreeNode
            node={dummyData}
            expandedNodes={expandedNodes}
            toggleNode={toggleNode}
            onSelect={handleSelect}
            selectedNodeId={selectedNodeId}
          />
        </tbody>
      </table>
    </div>
  )
}

export default HierarchicalTable