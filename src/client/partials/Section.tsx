import React, { useState } from 'react'
import { SectionBar } from './SectionBar'
import { HierarchicalTable } from './HTable'
import { Dashboard } from './Dashboard'
import type { TreeNode, TreeNodeSet } from '../../TreeNode'
import { TreeStateMethods } from '../../useApiForState'
import { ViewStateMethods } from '../../ViewStateMethods'
import useSessionStorageState from 'use-session-storage-state'

type SectionName = 'dashboard' | 'map' | 'waypoints' | 'users'

interface SectionProps {
  sectionName: SectionName
  title: string
  icon: React.ReactElement
  isFocused: boolean
  showDrafts: boolean
  onDragStart?: (e: React.MouseEvent) => void
  onClose: () => void
  onFocus: () => void
  flex: number

  // Section resize state
  resizingSection?: {
    section: SectionName
    nextSection: SectionName
    startY: number
    initialHeight: number
    initialNextHeight: number
  } | null

  // Content props
  contentType: 'dashboard' | 'table'

  // Dashboard props (when contentType is 'dashboard')
  dashboardProps?: {
    nodes: TreeNodeSet
    rootMapId: string
    selectNodeAndFocus: (node: TreeNode | null | undefined) => void
  }

  // Table props (when contentType is 'table')
  tableProps?: {
    nodes: TreeNodeSet
    rootNodeId: string
    selectedNode: TreeNode | null
    viewStateMethods: ViewStateMethods
    treeNodesApi: TreeStateMethods
    editingNodeId: string | null
    indexInParentMap: Record<string, number>
    nameColumnHeader?: string
    readinessColumnHeader?: string
    draggedNode: TreeNode | null
    setDraggedNode: (node: TreeNode | null) => void
    expandedNodes?: Record<string, boolean>
    setExpandedNodes?: (newState: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
    dropPreview?: {
      dropParentId: string | null
      insertAtIndex: number | null
    }
    setDropPreview?: (preview: {
      dropParentId: string | null
      insertAtIndex: number | null
    }) => void
    clearDropPreview?: () => void
  }
}

const styles = {
  section: {
    borderTop: '1px solid var(--border-color)',
    borderRadius: '0',
    overflow: 'hidden',
    background: 'var(--background-primary)',
    minHeight: '100px',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,
  sectionContent: {
    padding: '0',
    overflow: 'auto',
    flex: 1,
  },
} as const

export const Section: React.FC<SectionProps> = ({
  sectionName,
  title,
  icon,
  isFocused,
  showDrafts,
  onDragStart,
  onClose,
  onFocus,
  flex,
  resizingSection,
  contentType,
  dashboardProps,
  tableProps
}) => {
  // Focus stack state - persisted per section
  const [focusStack, setFocusStack] = useSessionStorageState<string[]>(`${sectionName}.focusStack`, {
    defaultValue: []
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onFocus()
      e.preventDefault()
    }
  }

  // Focus stack operations
  const pushFocus = (nodeId: string) => {
    setFocusStack(prev => [...prev, nodeId])
  }

  const popFocus = () => {
    setFocusStack(prev => prev.slice(0, -1))
  }

  // Get the currently focused root node (peek of stack)
  const getFocusedRootNodeId = () => {
    if (focusStack.length === 0) {
      return tableProps?.rootNodeId || ''
    }
    return focusStack[focusStack.length - 1]
  }

  // Handle focus button click
  const handleFocusNode = () => {
    if (tableProps?.selectedNode && tableProps.selectedNode.id !== tableProps.rootNodeId) {
      pushFocus(tableProps.selectedNode.id)
    }
  }

  // Handle unfocus button click
  const handleUnfocusNode = () => {
    popFocus()
  }

  const renderContent = () => {
    if (contentType === 'dashboard' && dashboardProps) {
      return (
        <Dashboard
          nodes={dashboardProps.nodes}
          rootMapId={dashboardProps.rootMapId}
          selectNodeAndFocus={dashboardProps.selectNodeAndFocus}
        />
      )
    }

    if (contentType === 'table' && tableProps) {
      // Use the focused root node instead of the original root node
      const focusedRootNodeId = getFocusedRootNodeId()

      return (
        <HierarchicalTable
          key={`${sectionName}Table`}
          isFocused={isFocused}
          showDraft={showDrafts}
          {...tableProps}
          rootNodeId={focusedRootNodeId}
        />
      )
    }

    return (
      <div style={{ padding: '12px' }}>
        <p>No content available.</p>
      </div>
    )
  }

  // Determine if we can show the focus button
  const canFocus = tableProps?.selectedNode &&
    tableProps.selectedNode.id !== tableProps.rootNodeId &&
    !focusStack.includes(tableProps.selectedNode.id)

  return (
    <div
      data-section-type={sectionName}
      style={{
        ...styles.section,
        flex
      }}
      onClick={onFocus}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      aria-label={`${title} section`}
    >
      <SectionBar
        sectionName={sectionName}
        title={title}
        icon={icon}
        isFocused={isFocused}
        onDragStart={onDragStart}
        onClose={onClose}
        resizingSection={resizingSection}
        canFocus={canFocus ?? false}
        onFocus={handleFocusNode}
        canUnfocus={focusStack.length > 0}
        onUnfocus={handleUnfocusNode}
      />
      <div style={styles.sectionContent}>
        {renderContent()}
      </div>
    </div>
  )
}