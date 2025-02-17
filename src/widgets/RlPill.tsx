import { formatReadinessLevel } from '../presenters/formatting'
import { styles } from '../partials/HTable/styles'

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
    background: '#2D2D2D',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    zIndex: 1000,
    padding: '4px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
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
