import {
  BarChart3,
  Bot,
  Boxes,
  Clock3,
  FileSpreadsheet,
  LayoutDashboard,
  Leaf,
  Settings2,
  Upload,
} from 'lucide-react'
import type { Product } from '../types'
import { useI18n } from '../i18n'

export type AppView = 'products' | 'workbench' | 'import' | 'history' | 'ai'

interface SidebarProps {
  view: AppView
  product: Product | null
  onNavigate: (view: AppView) => void
}

export function Sidebar({ view, product, onNavigate }: SidebarProps) {
  const { text, numberLocale } = useI18n()

  return (
    <aside className="sidebar" aria-label={text('主导航', 'Main navigation')}>
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><Leaf size={20} strokeWidth={2.2} /></div>
        <div>
          <div className="brand-name">Keyword Grove</div>
          <div className="brand-subtitle">Amazon keyword ops</div>
        </div>
      </div>

      <div className="sidebar-section-label">{text('工作台', 'Workspace')}</div>
      <nav className="sidebar-nav">
        <SidebarButton icon={<Boxes size={17} />} active={view === 'products'} onClick={() => onNavigate('products')}>
          {text('产品中心', 'Products')}
        </SidebarButton>
        <SidebarButton icon={<LayoutDashboard size={17} />} active={view === 'workbench'} onClick={() => onNavigate('workbench')}>
          {text('当前词库', 'Current Library')}
        </SidebarButton>
        <SidebarButton icon={<Upload size={17} />} active={view === 'import'} onClick={() => onNavigate('import')}>
          {text('导入向导', 'Import Wizard')}
        </SidebarButton>
        <SidebarButton icon={<Clock3 size={17} />} active={view === 'history'} onClick={() => onNavigate('history')}>
          {text('导入记录', 'Import History')}
        </SidebarButton>
        <SidebarButton icon={<Bot size={17} />} active={view === 'ai'} onClick={() => onNavigate('ai')}>
          {text('AI 语义设置', 'AI Settings')}
        </SidebarButton>
      </nav>

      <div className="sidebar-product-card">
        <div className="sidebar-product-kicker"><span className="status-dot status-dot-live" /> {text('当前产品', 'Current product')}</div>
        <div className="sidebar-product-name">{product?.name || text('尚未选择产品', 'No product selected')}</div>
        <div className="sidebar-product-asins">{product?.referenceAsin || text('添加竞品样本后开始', 'Add competitor samples to begin')}</div>
        <div className="sidebar-product-meta">
          <span><FileSpreadsheet size={13} /> {product?.keywordTotal.toLocaleString(numberLocale) || '0'} {text('词', 'keywords')}</span>
          <span><BarChart3 size={13} /> {product?.sourceCount || '0'} {text('来源', 'sources')}</span>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="local-mode-note">
          <span className="local-mode-icon"><Settings2 size={14} /></span>
          <div>
            <strong>{text('本地优先', 'Local-first')}</strong>
            <span>{text('未连接 Amazon', 'Amazon not connected')}</span>
          </div>
        </div>
        <div className="sidebar-version">v0.3.2 · {text('中文 / English', 'English / 中文')}</div>
      </div>
    </aside>
  )
}

function SidebarButton({ icon, children, active, onClick }: { icon: React.ReactNode; children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button className={`sidebar-nav-button${active ? ' is-active' : ''}`} type="button" onClick={onClick} aria-current={active ? 'page' : undefined}>
      <span className="sidebar-nav-icon">{icon}</span>
      <span>{children}</span>
      {active && <span className="nav-active-line" aria-hidden="true" />}
    </button>
  )
}
