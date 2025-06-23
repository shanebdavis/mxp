import React, { useState } from 'react'
import { DragHandle } from '@mui/icons-material'

type SectionName = 'dashboard' | 'map' | 'waypoints' | 'users'

interface SectionBarProps {
  sectionName: SectionName
  title: string
  icon: React.ReactElement
  isFocused: boolean
  onDragStart?: (e: React.MouseEvent) => void
  onClose: () => void
  resizingSection?: {
    section: SectionName
    nextSection: SectionName
    startY: number
    initialHeight: number
    initialNextHeight: number
  } | null
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
  onDragStart,
  onClose,
  resizingSection
}) => {
  const draggable = onDragStart !== undefined

  // Local hover state
  const [hoverDragHandle, setHoverDragHandle] = useState(false)
  const [hoverCloseButton, setHoverCloseButton] = useState(false)
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
      {draggable && onDragStart && (
        <div
          style={{
            ...styles.dragHandle,
            ...(resizingSection?.nextSection === sectionName ? styles.dragHandleActive : {}),
            ...(hoverDragHandle ? styles.dragHandleHover : {})
          }}
          onMouseDown={onDragStart}
          onMouseEnter={() => setHoverDragHandle(true)}
          onMouseLeave={() => setHoverDragHandle(false)}
        >
          <DragHandle sx={{
            ...styles.dragHandleIcon,
            opacity: (resizingSection?.nextSection === sectionName || hoverDragHandle) ? 0.5 : 0,
          }} />
        </div>
      )}

      {/* Close Button */}
      <div
        style={{
          ...styles.closeButton,
          ...(hoverCloseButton ? styles.closeButtonHover : {})
        }}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        onMouseEnter={() => setHoverCloseButton(true)}
        onMouseLeave={() => setHoverCloseButton(false)}
        title="Close section"
      >
        ✕
      </div>
    </div>
  )
}