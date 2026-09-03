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

export type AppView = 'products' | 'workbench' | 'import' | 'history' | 'ai'

interface SidebarProps {
  view: AppView
  product: Product | null
  onNavigate: (view: AppView) => void
}

export function Sidebar({ view, product, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="主导航">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><Leaf size={20} strokeWidth={2.2} /></div>
        <div>
          <div className="brand-name">Keyword Grove</div>
          <div className="brand-subtitle">Amazon keyword ops</div>
        </div>
      </div>

      <div className="sidebar-section-label">工作台</div>
      <nav className="sidebar-nav">
        <SidebarButton icon={<Boxes size={17} />} active={view === 'products'} onClick={() => onNavigate('products')}>
          产品中心
        </SidebarButton>
        <SidebarButton icon={<LayoutDashboard size={17} />} active={view === 'workbench'} onClick={() => onNavigate('workbench')}>
          当前词库
        </SidebarButton>
        <SidebarButton icon={<Upload size={17} />} active={view === 'import'} onClick={() => onNavigate('import')}>
          导入向导
        </SidebarButton>
        <SidebarButton icon={<Clock3 size={17} />} active={view === 'history'} onClick={() => onNavigate('history')}>
          导入记录
        </SidebarButton>
        <SidebarButton icon={<Bot size={17} />} active={view === 'ai'} onClick={() => onNavigate('ai')}>
          AI 语义设置
        </SidebarButton>
      </nav>

      <div className="sidebar-product-card">
        <div className="sidebar-product-kicker"><span className="status-dot status-dot-live" /> 当前产品</div>
        <div className="sidebar-product-name">{product?.name || '尚未选择产品'}</div>
        <div className="sidebar-product-asins">{product?.referenceAsin || '添加竞品样本后开始'}</div>
        <div className="sidebar-product-meta">
          <span><FileSpreadsheet size={13} /> {product?.keywordTotal.toLocaleString('en-US') || '0'} 词</span>
          <span><BarChart3 size={13} /> {product?.sourceCount || '0'} 来源</span>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="local-mode-note">
          <span className="local-mode-icon"><Settings2 size={14} /></span>
          <div>
            <strong>本地优先</strong>
            <span>未连接 Amazon</span>
          </div>
        </div>
        <div className="sidebar-version">v0.2.0 · US English</div>
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
