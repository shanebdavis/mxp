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

// Readiness level descriptions
const getRlTooltip = (level?: number) => {
  if (level === undefined) return "Automatically calculated from children"

  const tooltips: Record<number, string> = {
    0: "RL0: Plan - Initial planning and tech stack selection",
    1: "RL1: Spike - Core technical risks proven feasible",
    2: "RL2: Prototype - Basic demo-able functionality",
    3: "RL3: Alpha - Core functionality works, rough edges",
    4: "RL4: Beta - Feature complete, needs polish",
    5: "RL5: Industry-Standard - Solid, reliable product",
    6: "RL6: Industry-Leading - Exceptional quality and polish - delightful",
    7: "RL7: World-Leading - Revolutionizing the industry",
    8: "RL8: World-Changing - Revolutionary impact beyond the industry",
    9: "RL9: Epic - Making history"
  }

  return tooltips[level] || `RL${level}`
}

export const RlPill = ({ level, auto }: { level?: number, auto?: boolean }) => {
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const baseLevel = level != null ? Math.floor(level) : null
  const progress = level != null ? level - baseLevel! : null
  const nextLevel = baseLevel != null ? baseLevel + 1 : null

  // Close tooltip on click
  const handleClick = (e: React.MouseEvent) => {
    setTooltipOpen(false)
  }

  return (
    <Tooltip
      title={getRlTooltip(level)}
      enterDelay={1000}
      open={tooltipOpen}
      onOpen={() => setTooltipOpen(true)}
      onClose={() => setTooltipOpen(false)}
    >
      <div
        style={{
          ...styles.readinessLevelPill,
          backgroundColor: 'transparent',
          color: level == null ? 'var(--auto-text-color, currentColor)' : styles.readinessLevelPill.color,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          position: 'relative',
          overflow: 'hidden',
        }}
        onClick={handleClick}
      >
        {/* Base color background */}
        {baseLevel != null && (
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            right: 0,
            backgroundColor: styles.readinessLevelColors[baseLevel as keyof typeof styles.readinessLevelColors],
            zIndex: 0,
          }} />
        )}
        {/* Progress bar for fractional RLs */}
        {progress != null && nextLevel != null && progress > 0 && (
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progress * 100}%`,
            backgroundColor: styles.readinessLevelColors[nextLevel as keyof typeof styles.readinessLevelColors],
            zIndex: 1,
            transition: 'width 0.3s ease',
          }} />
        )}
        {/* Content above backgrounds */}
        <div style={{ position: 'relative', zIndex: 2, width: '100%', display: 'flex', alignItems: 'center', gap: 4 }}>
          {level != null ? `RL${baseLevel}` : 'auto'}
          {auto && (
            <Tooltip title="automatically calculated from children" enterDelay={1000}>
              <AutoMode sx={{ fontSize: 14, opacity: 0.7 }} />
            </Tooltip>
          )}
        </div>
      </div>
    </Tooltip>
  )
}

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
      minWidth: '120px',
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
