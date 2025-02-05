import { PanelHeader } from "./PanelHeader"

const styles = {

  footer: {
    gridArea: 'footer',
    borderTop: '1px solid #e0e0e0',
    height: '200px',
    background: '#f8f9fa',
    transition: 'height 0.2s ease',
  },
  footerCollapsed: {
    height: '40px',
  },
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
  {!isFooterCollapsed && <div style={{ padding: '12px' }}>Panel content</div>}
</footer>)