import React from 'react'
import { Tooltip, Switch, FormControlLabel } from '@mui/material'
import {
  Add,
  ArrowRight,
  ArrowDropDown,
  Delete,
  VisibilityOutlined,
  VisibilityOffOutlined
} from '@mui/icons-material'
import type { TreeNode, TreeNodeSet } from '../../TreeNode'
import { TreeStateMethods } from '../../useApiForState'

interface AppHeaderBarProps {
  config: {
    projectTitle?: string
    workUnits?: string
    iconPath?: string
  }
  showDrafts: boolean
  setShowDrafts: (show: boolean) => void
  selectedNode: TreeNode | null
  addAndFocusNode: (nodeProperties: any, parentId: string, insertAtIndex?: number) => Promise<TreeNode>
  treeNodesApi: TreeStateMethods
  rootNodesByType: Record<string, TreeNode>
}

const styles = {
  header: {
    gridArea: 'header',
    borderBottom: '1px solid var(--border-color)',
    padding: '8px 8px',
    display: 'flex',
    alignItems: 'center',
    background: 'var(--background-primary)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    color: 'var(--text-primary)',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
} as const

export const AppHeaderBar: React.FC<AppHeaderBarProps> = ({
  config,
  showDrafts,
  setShowDrafts,
  selectedNode,
  addAndFocusNode,
  treeNodesApi,
  rootNodesByType
}) => {
  return (
    <header style={styles.header}>
      <img
        src={config.iconPath || "/expedition-logo-256-alpha.png"}
        alt="Project Logo"
        style={{ height: '24px', marginRight: '16px' }}
      />
      <h1 style={styles.title}>
        {config.projectTitle || "MXP: Method Expedition"}
      </h1>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Global drafts toggle */}
        <Tooltip title={showDrafts ? "Hide draft items" : "Show draft items"}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showDrafts}
                onChange={(e) => setShowDrafts(e.target.checked)}
              />
            }
            label={
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {showDrafts ?
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <VisibilityOutlined sx={{ fontSize: 14 }} /> Drafts
                  </span> :
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <VisibilityOffOutlined sx={{ fontSize: 14 }} /> Drafts
                  </span>
                }
              </span>
            }
            style={{ margin: 0 }}
          />
        </Tooltip>

        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="Add Child (⌘+Enter / Ctrl+Enter)">
            <span>
              <button
                onClick={async () => {
                  if (selectedNode) {
                    await addAndFocusNode({ title: '' }, selectedNode.id)
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
          <Tooltip title="Add Sibling (Shift+Enter)">
            <span>
              <button
                onClick={async () => {
                  if (selectedNode?.parentId) {
                    await addAndFocusNode({ title: '' }, selectedNode.parentId)
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
          <Tooltip title="Delete node (Delete / Backspace)">
            <span>
              <button
                onClick={async () => selectedNode && await treeNodesApi.removeNode(selectedNode.id)}
                disabled={!selectedNode || Object.values(rootNodesByType).some(rootNode => rootNode.id === selectedNode?.id)}
                style={{
                  opacity: selectedNode && !Object.values(rootNodesByType).some(rootNode => rootNode.id === selectedNode?.id) ? 1 : 0.5,
                  cursor: selectedNode && !Object.values(rootNodesByType).some(rootNode => rootNode.id === selectedNode?.id) ? 'pointer' : 'default',
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
    </header>
  )
}