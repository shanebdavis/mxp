import React, { useState } from 'react'

const dummyData = {
  id: 'root',
  name: 'Project Root',
  status: 'In Progress',
  children: [
    {
      id: '1',
      name: 'Frontend Development',
      status: 'Active',
      children: [
        {
          id: '1.1',
          name: 'User Interface',
          status: 'In Progress',
          children: []
        },
        {
          id: '1.2',
          name: 'Authentication',
          status: 'Pending',
          children: []
        }
      ]
    },
    {
      id: '2',
      name: 'Backend Development',
      status: 'Planning',
      children: [
        {
          id: '2.1',
          name: 'API Design',
          status: 'Active',
          children: []
        }
      ]
    }
  ]
}

const TreeNode = ({ node, level = 0, expandedNodes, toggleNode }) => {
  const hasChildren = node.children?.length > 0
  const isExpanded = expandedNodes.includes(node.id)

  return (
    <>
      <tr>
        <td>
          <span style={{ paddingLeft: `${level * 20}px` }}>
            {hasChildren && (
              <span
                onClick={() => toggleNode(node.id)}
                style={{ cursor: 'pointer', display: 'inline-block', width: '20px' }}
              >
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            {!hasChildren && <span style={{ display: 'inline-block', width: '20px' }} />}
            {node.name}
          </span>
        </td>
        <td>{node.status}</td>
      </tr>
      {isExpanded && node.children?.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          level={level + 1}
          expandedNodes={expandedNodes}
          toggleNode={toggleNode}
        />
      ))}
    </>
  )
}

const HierarchicalTable = () => {
  const [expandedNodes, setExpandedNodes] = useState(['root'])

  const toggleNode = id => {
    setExpandedNodes(prev =>
      prev.includes(id)
        ? prev.filter(nodeId => nodeId !== id)
        : [...prev, id]
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Name</th>
            <th style={{ textAlign: 'left' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          <TreeNode
            node={dummyData}
            expandedNodes={expandedNodes}
            toggleNode={toggleNode}
          />
        </tbody>
      </table>
    </div>
  )
}

export default HierarchicalTable