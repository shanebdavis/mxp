import React, { useState } from 'react'
import { DragHandle, ZoomOutMap, ZoomInMap } from '@mui/icons-material'

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

  // Focus functionality
  canFocus?: boolean
  onFocus?: () => void
  canUnfocus?: boolean
  onUnfocus?: () => void
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
  rightButtonsContainer: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto',
  } as React.CSSProperties,
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
  focusButton: {
    cursor: 'pointer',
    opacity: 0.7,
    transition: 'opacity 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 20,
    height: '100%',
    width: '28px',
    fontSize: '16px',
  } as React.CSSProperties,
  focusButtonHover: {
    opacity: 1,
    background: 'rgba(0, 0, 0, 0.05)',
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
  resizingSection,
  canFocus = false,
  onFocus,
  canUnfocus = false,
  onUnfocus
}) => {
  const draggable = onDragStart !== undefined

  // Local hover state
  const [hoverDragHandle, setHoverDragHandle] = useState(false)
  const [hoverCloseButton, setHoverCloseButton] = useState(false)
  const [hoverFocusButton, setHoverFocusButton] = useState(false)
  const [hoverUnfocusButton, setHoverUnfocusButton] = useState(false)

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

      {/* Right-aligned buttons container */}
      <div style={styles.rightButtonsContainer}>
        {/* Focus Button (Zoom Out Map - expand view) */}
        <div
          style={{
            ...styles.focusButton,
            ...(canFocus && hoverFocusButton ? styles.focusButtonHover : {}),
            opacity: canFocus ? 0.7 : 0.3,
            cursor: canFocus ? 'pointer' : 'default'
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (canFocus && onFocus) {
              onFocus()
            }
          }}
          onMouseEnter={() => canFocus && setHoverFocusButton(true)}
          onMouseLeave={() => setHoverFocusButton(false)}
          title={canFocus ? "Focus on selected node" : "Select a sub-node in the tree to zoom in"}
        >
          <ZoomOutMap sx={{ fontSize: '16px' }} />
        </div>

        {/* Unfocus Button (Zoom In Map - contract view) */}
        <div
          style={{
            ...styles.focusButton,
            ...(canUnfocus && hoverUnfocusButton ? styles.focusButtonHover : {}),
            opacity: canUnfocus ? 0.7 : 0.3,
            cursor: canUnfocus ? 'pointer' : 'default'
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (canUnfocus && onUnfocus) {
              onUnfocus()
            }
          }}
          onMouseEnter={() => canUnfocus && setHoverUnfocusButton(true)}
          onMouseLeave={() => setHoverUnfocusButton(false)}
          title={canUnfocus ? "Zoom out to parent view" : "Zoom in first to enable zoom out"}
        >
          <ZoomInMap sx={{ fontSize: '16px' }} />
        </div>

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
    </div>
  )
}