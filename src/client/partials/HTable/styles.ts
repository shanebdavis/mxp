export const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: '14px',
    lineHeight: '1.4',
    position: 'relative',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    borderSpacing: 0,
    tableLayout: 'fixed' as const,
  },
  headerCell: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color)',
  },
  cell: {
    padding: '6px 12px',
    borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
  },
  treeCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    userSelect: 'none' as const,
  },
  toggleButton: {
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    color: '#666',
    userSelect: 'none' as const,
    fontSize: '10px',
    borderRadius: '12px',
    background: 'none',
    border: 'none',
  },
  row: {
    cursor: 'pointer',
    position: 'relative' as const,
  },
  selectedRow: {
    backgroundColor: 'var(--selected-color)',
  },
  dragTargetRow: {
    outline: '2px solid #2196f3',
    outlineOffset: '-2px',
    borderRadius: '3px',
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    userSelect: 'none' as const,
  },
  input: {
    border: 'none',
    background: 'var(--background-primary)',
    color: 'var(--text-primary)',
    padding: '1px 4px',
    margin: '-2px 0',
    width: '100%',
    fontSize: 'inherit',
    fontFamily: 'inherit',
  },
  nameColumn: {
    width: '70%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  levelColumn: {
    width: '30%',
  },
  dropIndicator: {
    position: 'absolute' as const,
    pointerEvents: 'none' as const,
    transition: 'opacity 0.1s',
    zIndex: -1,
  },
  dropLine: {
    position: 'absolute' as const,
    height: '2px',
    border: '1px solid orange',
    borderRadius: '3px',
    right: 0,
  },
  dropParent: {
    position: 'absolute' as const,
    height: '40px',
    width: '100%',
    transform: 'translateY(-50%)',
    borderRadius: '3px',
    border: '2px solid red',
  },
  dropTarget: {
    inside: {
      outline: '2px solid #2196f3',
      outlineOffset: '-2px',
      borderRadius: '3px',
    }
  },
  readinessLevel: {
    color: '#000',
    fontWeight: 600,
  },
  readinessLevelColors: {
    0: '#aaa',  // grey
    1: '#FF878F',  // red
    2: '#ffbd3b',  // orange
    3: '#ffeb3b',  // yellow
    4: '#af0',  // yellow-green
    5: '#0f0',  // green
    6: '#0ff',  // cyan
    7: '#aaf',  // blue
    8: '#f7f',  //
    9: '#f000f0',  // aquamarine
  },
  readinessLevelPill: {
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: '11px',
    color: 'rgba(0, 0, 0, 0.8)',
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: '10px',
    textAlign: 'center' as const,
    minWidth: '32px',
  },
} as const
