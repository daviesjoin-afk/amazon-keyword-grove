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
  products: Product[]
  selectedProductId: string | null
  onSelectProduct: (product: Product) => void | Promise<void>
  onNavigate: (view: AppView) => void
}

export function Sidebar({ view, products, selectedProductId, onSelectProduct, onNavigate }: SidebarProps) {
  const selectedProduct = products.find((product) => product.id === selectedProductId)
  const visibleProducts = products.slice(0, 3)
  if (selectedProduct && !visibleProducts.some((product) => product.id === selectedProduct.id)) {
    visibleProducts.pop()
    visibleProducts.unshift(selectedProduct)
  }

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

      <section className="sidebar-products" aria-labelledby="sidebar-products-title">
        <div className="sidebar-products-header">
          <span className="sidebar-products-label" id="sidebar-products-title">产品快捷切换</span>
          {products.length > 3 && <button className="sidebar-products-all" type="button" onClick={() => onNavigate('products')}>查看全部 <span aria-hidden="true">→</span></button>}
        </div>
        {visibleProducts.length > 0 ? <div className="sidebar-product-list">
          {visibleProducts.map((item) => {
            const isCurrent = item.id === selectedProductId
            const statusClass = item.status === '准备中' ? 'preparing' : item.status === '归档' ? 'archived' : 'live'
            return <button
              className={`sidebar-product-card${isCurrent ? ' is-current' : ''}`}
              type="button"
              key={item.id}
              onClick={() => void onSelectProduct(item)}
              aria-pressed={isCurrent}
              aria-label={`切换到产品：${item.name}${isCurrent ? '（当前产品）' : ''}`}
            >
              <div className="sidebar-product-kicker"><span className={`status-dot status-dot-${statusClass}`} /> {isCurrent ? '当前产品' : item.status}</div>
              <div className="sidebar-product-name">{item.name}</div>
              <div className="sidebar-product-asins">{item.referenceAsin || '添加竞品样本后开始'} · {item.site}</div>
              <div className="sidebar-product-meta">
                <span><FileSpreadsheet size={13} /> {item.keywordTotal.toLocaleString('en-US')} 词</span>
                <span><BarChart3 size={13} /> {item.sourceCount.toLocaleString('en-US')} 来源</span>
              </div>
            </button>
          })}
        </div> : <div className="sidebar-products-empty">尚未创建产品</div>}
      </section>

      <div className="sidebar-footer">
        <div className="local-mode-note">
          <span className="local-mode-icon"><Settings2 size={14} /></span>
          <div>
            <strong>本地优先</strong>
            <span>未连接 Amazon</span>
          </div>
        </div>
        <div className="sidebar-version">v0.3.2 · US English</div>
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
