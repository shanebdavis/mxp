import React from 'react'
import { Tooltip, Switch, FormControlLabel } from '@mui/material'
import { DragHandle, VisibilityOutlined, VisibilityOffOutlined } from '@mui/icons-material'

type SectionName = 'dashboard' | 'map' | 'waypoints' | 'users'

interface SectionBarProps {
  sectionName: SectionName
  title: string
  icon: React.ReactElement
  isFocused: boolean
  showDragHandle: boolean
  showDraftToggle?: boolean
  showDrafts?: boolean
  onDraftToggleChange?: (checked: boolean) => void
  onDragStart?: (e: React.MouseEvent) => void
  onClose: () => void
  hoverSection: SectionName | null
  setHoverSection: (section: SectionName | null) => void
  hoverCloseButton: SectionName | null
  setHoverCloseButton: (section: SectionName | null) => void
  resizingSection?: {
    section: SectionName
    nextSection: SectionName
    startY: number
    initialHeight: number
    initialNextHeight: number
  } | null
  draftToggleTooltip?: string
}

const styles = {
  sectionHeader: {
    padding: '6px 0 6px 12px',
    background: 'var(--background-secondary)',
    fontWeight: 600,
    fontSize: '13px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    position: 'relative',
    userSelect: 'none',
    cursor: 'default',
    minHeight: '28px',
  } as React.CSSProperties,
  sectionHeaderIcon: {
    fontSize: '16px',
    opacity: 0.8,
  },
  dragHandle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    cursor: 'row-resize',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  } as React.CSSProperties,
  dragHandleHover: {
    background: 'rgba(0, 0, 0, 0.05)',
  },
  dragHandleIcon: {
    fontSize: '16px',
    opacity: 0,
    transition: 'opacity 0.2s',
    pointerEvents: 'none',
  } as React.CSSProperties,
  dragHandleActive: {
    background: 'rgba(0, 0, 0, 0.1)',
  },
  closeButton: {
    cursor: 'pointer',
    opacity: 0.5,
    transition: 'opacity 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 20,
    height: '100%',
    width: '30px',
    fontSize: '16px',
  } as React.CSSProperties,
  closeButtonHover: {
    opacity: 0.8,
    background: 'rgba(0, 0, 0, 0.05)',
  },
} as const

export const SectionBar: React.FC<SectionBarProps> = ({
  sectionName,
  title,
  icon,
  isFocused,
  showDragHandle,
  showDraftToggle = false,
  showDrafts = true,
  onDraftToggleChange,
  onDragStart,
  onClose,
  hoverSection,
  setHoverSection,
  hoverCloseButton,
  setHoverCloseButton,
  resizingSection,
  draftToggleTooltip
}) => {
  const getSectionHeaderStyle = () => ({
    ...styles.sectionHeader,
    borderBottom: '1px solid ' + (isFocused
      ? 'var(--selected-color)'
      : 'var(--border-color)'),
    background: isFocused
      ? 'var(--selected-color-light, var(--background-secondary))'
      : 'var(--background-secondary)',
  })

  return (
    <div style={getSectionHeaderStyle()}>
      {React.cloneElement(icon, { sx: styles.sectionHeaderIcon })}
      {title}

      {/* Drag Handle */}
      {showDragHandle && onDragStart && (
        <div
          style={{
            ...styles.dragHandle,
            ...(resizingSection?.nextSection === sectionName ? styles.dragHandleActive : {}),
            ...(hoverSection === sectionName ? styles.dragHandleHover : {})
          }}
          onMouseDown={onDragStart}
          onMouseEnter={() => setHoverSection(sectionName)}
          onMouseLeave={() => setHoverSection(null)}
        >
          <DragHandle sx={{
            ...styles.dragHandleIcon,
            opacity: (resizingSection?.nextSection === sectionName || hoverSection === sectionName) ? 0.5 : 0,
          }} />
        </div>
      )}

      {/* Draft Toggle */}
      {showDraftToggle && onDraftToggleChange && (
        <Tooltip title={draftToggleTooltip || (showDrafts ? "Hide drafts" : "Show drafts")}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showDrafts}
                onChange={(e) => {
                  e.stopPropagation()
                  onDraftToggleChange(e.target.checked)
                }}
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
            style={{
              margin: 0,
              marginLeft: 'auto',
              marginRight: '0px',
              position: 'relative',
              zIndex: 25,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </Tooltip>
      )}

      {/* Close Button */}
      <div
        style={{
          ...styles.closeButton,
          ...(hoverCloseButton === sectionName ? styles.closeButtonHover : {})
        }}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        onMouseEnter={() => setHoverCloseButton(sectionName)}
        onMouseLeave={() => setHoverCloseButton(null)}
        title="Close section"
      >
        ✕
      </div>
    </div>
  )
}