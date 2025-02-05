import { ArrowLeft, ArrowRight, ArrowDropUp, ArrowDropDown } from '@mui/icons-material'
import { FC } from 'react'

const styles = {
  collapseButton: {
    padding: '8px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      color: '#333',
    }
  }
}

export const PanelHeader = ({ isCollapsed, label, onClick, isVertical = false }: {
  isCollapsed: boolean
  label: string
  onClick: () => void
  isVertical?: boolean
}) => (
  <button
    style={{
      ...styles.collapseButton,
      width: '100%',
      justifyContent: 'flex-start',
      gap: '4px'
    }}
    onClick={onClick}
  >
    {
      isVertical ? (
        // Details panel: left when collapsed, right when expanded
        isCollapsed ? (
          <ArrowLeft style={{ width: 20, height: 20 }} />
        ) : (
          <ArrowRight style={{ width: 20, height: 20 }} />
        )
      ) : (
        // Comments panel: up when collapsed, down when expanded
        isCollapsed ? (
          <ArrowDropUp style={{ width: 20, height: 20 }} />
        ) : (
          <ArrowDropDown style={{ width: 20, height: 20 }} />
        )
      )}
    {(!isCollapsed || !isVertical) && <span>{label} </span>}
  </button>
)