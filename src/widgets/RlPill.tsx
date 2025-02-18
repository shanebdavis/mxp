import { formatReadinessLevel } from '../presenters/formatting'
import { styles } from '../partials/HTable/styles'
import { useEffect, useState, useRef } from 'react'
import { TreeNode, TreeNodeProperties } from '../models'

export const RlPill = ({ level }: { level: number }) => (
  <div style={{
    ...styles.readinessLevelPill,
    backgroundColor: styles.readinessLevelColors[level as keyof typeof styles.readinessLevelColors],
    // Darken text for yellow which needs better contrast
  }}>
    {formatReadinessLevel(level)}
  </div>
)

export const RlPillWithDropdown = ({ level, handleRLSelect }:
  { level: number, handleRLSelect: (e: React.MouseEvent, level: number) => void }) =>
  <div style={{
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    background: 'var(--background-secondary)',  // Replace hardcoded color with theme variable
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    zIndex: 1000,
    padding: '4px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    minWidth: '180px',  // Keep existing width
    whiteSpace: 'nowrap' as const,
  }}>
    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => (
      <div
        key={level}
        onClick={(e) => handleRLSelect(e, level)}
        style={{
          cursor: 'pointer',
          borderRadius: '4px',
          padding: '2px',
        }}
      >
        <RlPill level={level} />
      </div>
    ))}
  </div>

export const EditableRlPill = ({ node, updateNode }:
  { node: TreeNode, updateNode: (nodeId: string, properties: Partial<TreeNodeProperties>) => void }) => {
  const [isEditingRL, setIsEditingRL] = useState(false)
  const handleRLClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingRL(true)
  }
  const rlRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditingRL) {
      const handleClickOutside = (e: MouseEvent) => {
        if (rlRef.current && !rlRef.current.contains(e.target as Node)) {
          setIsEditingRL(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isEditingRL])


  const handleRLSelect = (e: React.MouseEvent, level: number) => {
    e.stopPropagation()  // Stop click from bubbling
    if (level !== node.readinessLevel) {  // Only update if value changed
      updateNode(node.id, { readinessLevel: level })
    }
    setIsEditingRL(false)  // Always close picker
  }

  return <div
    onClick={handleRLClick}
    style={{
      ...styles.readinessLevel,
      cursor: 'pointer',
    }}
  >
    <div style={{ position: 'relative' }} ref={rlRef}>
      <RlPill level={node.readinessLevel} />
      {isEditingRL && <RlPillWithDropdown level={node.readinessLevel} handleRLSelect={handleRLSelect} />}
    </div>
  </div>
}
