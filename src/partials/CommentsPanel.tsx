import { PanelHeader } from "./PanelHeader"

const styles = {
  footer: {
    gridArea: 'footer',
    borderTop: '1px solid var(--border-color)',
    height: '200px',
    background: 'var(--background-secondary)',
    transition: 'height 0.2s ease',
  },
  footerCollapsed: {
    height: '40px',
  },
  content: {
    color: 'var(--text-primary)',
  }
}

export const CommentsPanel = ({ isFooterCollapsed, setFooterCollapsed }: {
  isFooterCollapsed: boolean
  setFooterCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void
}) => (<footer style={{
  ...styles.footer,
  ...(isFooterCollapsed && styles.footerCollapsed)
}}>
  <PanelHeader
    isCollapsed={isFooterCollapsed}
    label="Comments"
    onClick={() => setFooterCollapsed(prev => !prev)}
    isVertical={false}
  />
  {!isFooterCollapsed && <div style={{ padding: '12px', ...styles.content }}>Panel content</div>}
</footer>)