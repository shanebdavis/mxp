import React from 'react'
import type { TreeNode } from '../../TreeNode'

interface SolutionItemsProps {
  node: TreeNode
  children: TreeNode[]
}

const styles = {
  container: {
    gap: '4px',
    margin: '8px 0',
  },
  list: {
    margin: 0,
    paddingLeft: '1.5em',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  item: {
    alignItems: 'center',
    gap: '8px',
  },
  draftItem: {
    fontStyle: 'italic',
    opacity: 0.5,
  },
  priorityPill: {
    background: '#ff6b6b',
    color: 'white',
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '10px',
    fontWeight: 600,
  },
  label: {
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  priorityItem: {
    fontWeight: 600,
  },
  draftPill: {
    background: '#ddd',
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '10px',
    fontWeight: 600,
  },
  readinessCircle: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 600,
    color: 'rgba(0, 0, 0, 0.8)',
    marginLeft: '0px',
  },
  readinessLevelColors: {
    0: '#eee',  // grey
    1: '#FF878F',  // red
    2: '#ffbd3b',  // orange
    3: '#ffeb3b',  // yellow
    4: '#af0',  // yellow-green
    5: '#0f0',  // green
    6: '#0ff',  // cyan
    7: '#aaf',  // blue
    8: '#f7f',  //
    9: '#f000f0',  // aquamarine
  } as const,
}

export const SolutionItems = ({ node, children }: SolutionItemsProps) => {
  // Filter out draft items and find the minimum readiness level
  const nonDraftChildren = children.filter(child => child.nodeState !== "draft" && child.nodeState !== undefined)
  const childrenWithReadiness = nonDraftChildren.filter(child => child.calculatedMetrics.readinessLevel !== undefined)
  const minReadinessLevel = Math.min(
    ...childrenWithReadiness.map(child => child.calculatedMetrics.readinessLevel!)
  )

  // Find the first child with the minimum readiness level
  const priorityChild = nonDraftChildren.find(
    child => child.calculatedMetrics.readinessLevel === minReadinessLevel
  )

  return (
    <div style={styles.container}>
      <div style={styles.label}>Solution: {node.childrenIds.length} Sub-problems</div>
      <ol style={styles.list}>
        {children.map(child => {
          // Support legacy nodes with draft property
          const isDraft = child.nodeState === "draft";

          return (
            <li key={child.id} style={{
              ...styles.item,
              ...(isDraft ? styles.draftItem : {}),
              ...(child.id === priorityChild?.id ? styles.priorityItem : {}),
            }}>
              {!isDraft && <>
                <span style={{
                  ...styles.priorityPill,
                  color: 'black',
                  background: styles.readinessLevelColors[child.calculatedMetrics.readinessLevel as keyof typeof styles.readinessLevelColors],
                }}>
                  RL{child.calculatedMetrics.readinessLevel}
                </span>
                &nbsp;
              </>}
              {child.title}

              {child.id === priorityChild?.id && (
                <>
                  &nbsp;<span style={styles.priorityPill}>priority</span>
                </>
              )}
              {isDraft && (
                <>
                  &nbsp;<span style={styles.draftPill}>draft</span>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}