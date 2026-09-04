import { Archive, ArrowUpRight, Boxes, CheckCircle2, MoreHorizontal, Plus, Search, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import type { Product, ProductPayload } from '../types'

interface ProductsViewProps {
  products: Product[]
  selectedProductId?: string | null
  onOpen: (product: Product) => void
  onDelete: (product: Product) => void | Promise<void>
  onImport: () => void
  onCreate: (payload: ProductPayload) => void
}

export function ProductsView({ products, selectedProductId, onOpen, onDelete, onImport, onCreate }: ProductsViewProps) {
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const filtered = products.filter((product) => !query || [product.name, product.referenceAsin, product.site].some((value) => value.toLowerCase().includes(query.toLowerCase())))
  const totalKeywords = products.reduce((sum, product) => sum + product.keywordTotal, 0)
  const totalSources = products.reduce((sum, product) => sum + product.sourceCount, 0)

  return <div className="products-page">
    <div className="page-heading-row products-heading"><div><span className="panel-kicker">Product registry / 多产品</span><h1>产品中心</h1><p>为每个自有产品隔离词库、分类与投放判断。竞品 ASIN 仅作为来源，不会被当作自有产品。</p></div><div className="page-heading-actions"><button className="button button-secondary" type="button" onClick={onImport}><Upload size={16} />导入关键词表</button><button className="button button-primary" type="button" onClick={() => setShowCreate(true)}><Plus size={17} />新建产品</button></div></div>
    <section className="products-overview-strip"><div><span className="strip-label">产品词库</span><strong>{products.length}</strong><small>个产品</small></div><div><span className="strip-label">关键词资产</span><strong>{totalKeywords.toLocaleString('en-US')}</strong><small>去重后</small></div><div><span className="strip-label">竞品来源</span><strong>{totalSources}</strong><small>个 ASIN 关系</small></div><div className="strip-aside"><CheckCircle2 size={16} /><span>数据保存在本机 · 未连接 Amazon</span></div></section>
    <div className="products-toolbar"><label className="search-field"><Search size={16} /><span className="sr-only">搜索产品</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索产品名称、ASIN 或站点" /></label><span className="products-count">{filtered.length} / {products.length} 个产品</span></div>
    <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} isSelected={product.id === selectedProductId} onOpen={() => onOpen(product)} onDelete={() => onDelete(product)} />)}<button className="new-product-card" type="button" onClick={() => setShowCreate(true)}><span><Plus size={20} /></span><strong>建立下一个产品词库</strong><small>录入标题和五点后即可导入竞品反查表</small></button></div>
    {showCreate && <CreateProductModal onClose={() => setShowCreate(false)} onCreate={(payload) => { onCreate(payload); setShowCreate(false) }} />}
  </div>
}

function ProductCard({ product, isSelected, onOpen, onDelete }: { product: Product; isSelected: boolean; onOpen: () => void; onDelete: () => void | Promise<void> }) {
  const [menuOpen, setMenuOpen] = useState(false)

  function handleDelete() {
    setMenuOpen(false)
    void onDelete()
  }

  return <article className={`product-card${isSelected ? ' is-current' : ''}`}><button className="product-card-main" type="button" onClick={onOpen} aria-current={isSelected ? 'true' : undefined}><div className="product-card-top"><span className="product-card-icon"><Boxes size={20} /></span><span className="product-status"><i />{product.status}</span></div><h2>{product.name}</h2><p>{product.category}</p><div className="product-reference"><span>竞品参考</span><code>{product.referenceAsin}</code><small>{product.site}</small></div><div className="product-card-metrics"><span><strong>{product.keywordTotal.toLocaleString('en-US')}</strong><small>关键词</small></span><span><strong>{product.strongCount.toLocaleString('en-US')}</strong><small>强匹配</small></span><span><strong>{product.sourceCount}</strong><small>来源 ASIN</small></span></div><div className="product-card-footer"><span>最近导入 {product.lastImportedAt}</span><ArrowUpRight size={15} /></div></button><div className="product-card-actions"><button className="product-more-button" type="button" aria-label={`打开${product.name}操作菜单`} aria-expanded={menuOpen} title="更多操作" onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open) }}><MoreHorizontal size={18} /></button>{menuOpen && <div className="product-action-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpen() }}><ArrowUpRight size={15} />打开产品</button><button className="is-danger" type="button" role="menuitem" onClick={handleDelete}><Trash2 size={15} />删除产品</button></div>}</div></article>
}

function CreateProductModal({ onClose, onCreate }: { onClose: () => void; onCreate: (payload: ProductPayload) => void }) {
  const [name, setName] = useState('')
  const [site, setSite] = useState('Amazon US')
  const [category, setCategory] = useState('Home & Kitchen / Seasonal Décor')
  const [title, setTitle] = useState('')
  const [bulletText, setBulletText] = useState('')
  return <div className="modal-layer"><button className="drawer-scrim" type="button" aria-label="关闭新建产品窗口" onClick={onClose} /><section className="modal-card product-create-modal" role="dialog" aria-modal="true" aria-labelledby="new-product-title"><div className="modal-heading"><div><span className="panel-kicker">New product / 新建产品</span><h2 id="new-product-title">建立独立关键词空间</h2></div><button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>×</button></div><p className="modal-intro">自有 ASIN 可稍后补充。标题和五点会作为判断竞品反查词相关性的产品语料。</p><div className="form-grid"><label className="form-field full-field"><span>产品名称 <em>*</em></span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：26 英寸人造黄杨木花环" /></label><label className="form-field"><span>站点 <em>*</em></span><select value={site} onChange={(event) => setSite(event.target.value)}><option>Amazon US</option><option>Amazon UK</option><option>Amazon JP</option><option>Amazon DE</option></select></label><label className="form-field"><span>类目</span><input value={category} onChange={(event) => setCategory(event.target.value)} /></label><label className="form-field full-field"><span>产品标题 <em>*</em></span><textarea value={title} onChange={(event) => setTitle(event.target.value)} rows={3} placeholder="用于相关性判断的完整英文标题" /></label><label className="form-field full-field"><span>五点描述</span><textarea value={bulletText} onChange={(event) => setBulletText(event.target.value)} rows={7} placeholder="每行填写一条五点描述，最多读取 5 行" /><small>每行一条，创建后仍可在“产品资料与 AI”中修改。</small></label></div><div className="modal-note"><Archive size={15} /><span>新产品默认处于「准备中」，不会自动连接 Amazon 或创建广告活动。</span></div><div className="modal-footer"><button className="button button-secondary" type="button" onClick={onClose}>取消</button><button className="button button-primary" type="button" disabled={!name.trim() || !title.trim()} onClick={() => onCreate({ name: name.trim(), site, category, title: title.trim(), bullets: bulletText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 5) })}>创建产品<ArrowUpRight size={15} /></button></div></section></div>
}
