import { CircleHelp, CloudOff, ExternalLink, Leaf, Search } from 'lucide-react'
import type { Product } from '../types'
import type { AppView } from './Sidebar'
import { API_BASE_URL } from '../api/client'

interface TopbarProps {
  view: AppView
  product: Product | null
  isMock: boolean
  onNavigate: (view: AppView) => void
}

export function Topbar({ view, product, isMock, onNavigate }: TopbarProps) {
  const viewName = view === 'products' ? '产品中心' : view === 'import' ? '导入向导' : view === 'history' ? '导入记录' : view === 'ai' ? 'AI 语义设置' : '产品工作台'
  return (
    <header className="topbar">
      <div className="breadcrumb" aria-label="当前位置">
        <button className="breadcrumb-root" type="button" onClick={() => onNavigate('products')}>Keyword Grove</button>
        <span className="breadcrumb-slash">/</span>
        <span>{viewName}</span>
        {view === 'workbench' && product && <><span className="breadcrumb-slash">/</span><strong>{product.name}</strong></>}
      </div>
      <div className="topbar-actions">
        <div className="topbar-search" role="search">
          <Search size={16} aria-hidden="true" />
          <input aria-label="全局搜索关键词或 ASIN" placeholder="搜索关键词 / ASIN" />
          <kbd>⌘ K</kbd>
        </div>
        <div className={`data-mode-pill${isMock ? ' is-mock' : ''}`} title={isMock ? '当前使用本地演示数据' : `已连接 API：${API_BASE_URL}`}>
          {isMock ? <CloudOff size={14} /> : <Leaf size={14} />}
          <span>{isMock ? '演示数据' : '本地 API'}</span>
        </div>
        <button className="icon-button" type="button" aria-label="帮助中心" title="帮助中心"><CircleHelp size={18} /></button>
        <button className="profile-chip" type="button" aria-label="打开账户菜单"><span>KW</span><strong>运营</strong></button>
      </div>
    </header>
  )
}
