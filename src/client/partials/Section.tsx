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
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onFocus()
      e.preventDefault()
    }
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
      return (
        <HierarchicalTable
          key={`${sectionName}Table`}
          isFocused={isFocused}
          showDraft={showDrafts}
          {...tableProps}
        />
      )
    }

    return (
      <div style={{ padding: '12px' }}>
        <p>No content available.</p>
      </div>
    )
  }

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
      />
      <div style={styles.sectionContent}>
        {renderContent()}
      </div>
    </div>
  )
}