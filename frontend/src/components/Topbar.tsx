import { CircleHelp, CloudOff, Languages, Leaf, Search } from 'lucide-react'
import type { Product } from '../types'
import type { AppView } from './Sidebar'
import { API_BASE_URL } from '../api/client'
import { useI18n } from '../i18n'

interface TopbarProps {
  view: AppView
  product: Product | null
  isMock: boolean
  onNavigate: (view: AppView) => void
}

export function Topbar({ view, product, isMock, onNavigate }: TopbarProps) {
  const { language, text, toggleLanguage } = useI18n()
  const viewName = view === 'products'
    ? text('产品中心', 'Products')
    : view === 'import'
      ? text('导入向导', 'Import Wizard')
      : view === 'history'
        ? text('导入记录', 'Import History')
        : view === 'ai'
          ? text('AI 语义设置', 'AI Settings')
          : text('产品工作台', 'Product Workbench')

  return (
    <header className="topbar">
      <div className="breadcrumb" aria-label={text('当前位置', 'Current location')}>
        <button className="breadcrumb-root" type="button" onClick={() => onNavigate('products')}>Keyword Grove</button>
        <span className="breadcrumb-slash">/</span>
        <span>{viewName}</span>
        {view === 'workbench' && product && <><span className="breadcrumb-slash">/</span><strong>{product.name}</strong></>}
      </div>
      <div className="topbar-actions">
        <div className="topbar-search" role="search">
          <Search size={16} aria-hidden="true" />
          <input aria-label={text('全局搜索关键词或 ASIN', 'Search keywords or ASINs')} placeholder={text('搜索关键词 / ASIN', 'Search keyword / ASIN')} />
          <kbd>⌘ K</kbd>
        </div>
        <div className={`data-mode-pill${isMock ? ' is-mock' : ''}`} title={isMock ? text('当前使用本地演示数据', 'Using local demo data') : text(`已连接 API：${API_BASE_URL}`, `API connected: ${API_BASE_URL}`)}>
          {isMock ? <CloudOff size={14} /> : <Leaf size={14} />}
          <span>{isMock ? text('演示数据', 'Demo data') : text('本地 API', 'Local API')}</span>
        </div>
        <button className="button button-secondary compact-button" type="button" onClick={toggleLanguage} aria-label={text('切换到英文', 'Switch to Chinese')} title={text('切换到英文界面', 'Switch to Chinese interface')}>
          <Languages size={15} />{language === 'zh-CN' ? 'EN' : '中文'}
        </button>
        <button className="icon-button" type="button" aria-label={text('帮助中心', 'Help center')} title={text('帮助中心', 'Help center')}><CircleHelp size={18} /></button>
        <button className="profile-chip" type="button" aria-label={text('打开账户菜单', 'Open account menu')}><span>KW</span><strong>{text('运营', 'Ops')}</strong></button>
      </div>
    </header>
  )
}
