import { formatReadinessLevel } from '../presenters/formatting'
import { styles } from '../partials/HTable/styles'
import { useEffect, useState, useRef } from 'react'
import { AutoMode } from '@mui/icons-material'
import { Tooltip } from '@mui/material'

// Add CSS for auto pill text color that adapts to theme changes
const autoTextStyle = {
  // Will be light in dark mode and dark in light mode through CSS
  '--auto-text-color': 'var(--text-primary, currentColor)'
} as React.CSSProperties

export const RlPill = ({ level, auto }: { level?: number, auto?: boolean }) => (
  <div style={{
    ...styles.readinessLevelPill,
    backgroundColor: level != null ? styles.readinessLevelColors[level as keyof typeof styles.readinessLevelColors] : 'var(--background-secondary)',
    color: level == null ? 'var(--auto-text-color, currentColor)' : styles.readinessLevelPill.color,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }}>
    {level != null ? formatReadinessLevel(level) : 'auto'}
    {auto && (
      <Tooltip title="automatically calculated from children">
        <AutoMode sx={{ fontSize: 14, opacity: 0.7 }} />
      </Tooltip>
    )}
  </div>
)

export const RlPillWithDropdown = ({ level, handleRLSelect }:
  { level?: number, handleRLSelect: (e: React.MouseEvent, level: number | undefined) => void }) => {
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 4px)',
      left: 0,
      background: 'var(--background-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 4,
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      zIndex: 1000,
      padding: '4px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '4px',
      minWidth: '180px',
      whiteSpace: 'nowrap' as const,
      ...autoTextStyle
    }}>
      <div
        onClick={(e) => handleRLSelect(e, undefined)}
        style={{
          cursor: 'pointer',
          borderRadius: '4px',
          padding: '2px',
          background: level == null ? 'var(--selected-color)' : undefined,
        }}
      >
        <RlPill auto />
      </div>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => (
        <div
          key={l}
          onClick={(e) => handleRLSelect(e, l)}
          style={{
            cursor: 'pointer',
            borderRadius: '4px',
            padding: '2px',
            background: level === l ? 'var(--selected-color)' : undefined,
          }}
        >
          <RlPill level={l} />
        </div>
      ))}
    </div>
  )
}

interface EditableRlPillProps {
  readinessLevel: number | undefined
  auto?: boolean
  onChange: (level: number | undefined) => Promise<void>
}

export const EditableRlPill: React.FC<EditableRlPillProps> = ({ readinessLevel, auto, onChange }) => {
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

  const handleRLSelect = async (e: React.MouseEvent, level: number | undefined) => {
    e.stopPropagation()
    await onChange(level)
    setIsEditingRL(false)
  }

  return <div
    onClick={handleRLClick}
    style={{
      ...styles.readinessLevel,
      cursor: 'pointer',
    }}
    data-has-click-handler="true"
  >
    <div style={{ position: 'relative' }} ref={rlRef}>
      <RlPill level={readinessLevel} auto={auto} />
      {isEditingRL && <RlPillWithDropdown level={readinessLevel} handleRLSelect={handleRLSelect} />}
    </div>
  </div>
}
