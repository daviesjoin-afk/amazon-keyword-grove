import { Archive, ArrowUpRight, Boxes, CheckCircle2, MoreHorizontal, Plus, Search, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import type { Product, ProductPayload } from '../types'
import { useI18n } from '../i18n'

interface ProductsViewProps {
  products: Product[]
  selectedProductId?: string | null
  onOpen: (product: Product) => void
  onDelete: (product: Product) => void | Promise<void>
  onImport: () => void
  onCreate: (payload: ProductPayload) => void
}

export function ProductsView({ products, selectedProductId, onOpen, onDelete, onImport, onCreate }: ProductsViewProps) {
  const { text, numberLocale } = useI18n()
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const filtered = products.filter((product) => !query || [product.name, product.referenceAsin, product.site].some((value) => value.toLowerCase().includes(query.toLowerCase())))
  const totalKeywords = products.reduce((sum, product) => sum + product.keywordTotal, 0)
  const totalSources = products.reduce((sum, product) => sum + product.sourceCount, 0)

  return <div className="products-page">
    <div className="page-heading-row products-heading">
      <div>
        <span className="panel-kicker">{text('Product registry / 多产品', 'Product registry / Multi-product')}</span>
        <h1>{text('产品中心', 'Products')}</h1>
        <p>{text('为每个自有产品隔离词库、分类与投放判断。竞品 ASIN 仅作为来源，不会被当作自有产品。', 'Keep keyword libraries, classifications, and targeting decisions isolated per owned product. Competitor ASINs are evidence sources, not owned products.')}</p>
      </div>
      <div className="page-heading-actions">
        <button className="button button-secondary" type="button" onClick={onImport}><Upload size={16} />{text('导入关键词表', 'Import keywords')}</button>
        <button className="button button-primary" type="button" onClick={() => setShowCreate(true)}><Plus size={17} />{text('新建产品', 'New product')}</button>
      </div>
    </div>
    <section className="products-overview-strip">
      <div><span className="strip-label">{text('产品词库', 'Product libraries')}</span><strong>{products.length}</strong><small>{text('个产品', 'products')}</small></div>
      <div><span className="strip-label">{text('关键词资产', 'Keyword assets')}</span><strong>{totalKeywords.toLocaleString(numberLocale)}</strong><small>{text('去重后', 'deduplicated')}</small></div>
      <div><span className="strip-label">{text('竞品来源', 'Competitor sources')}</span><strong>{totalSources}</strong><small>{text('个 ASIN 关系', 'ASIN relationships')}</small></div>
      <div className="strip-aside"><CheckCircle2 size={16} /><span>{text('数据保存在本机 · 未连接 Amazon', 'Stored locally · Amazon not connected')}</span></div>
    </section>
    <div className="products-toolbar">
      <label className="search-field"><Search size={16} /><span className="sr-only">{text('搜索产品', 'Search products')}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text('搜索产品名称、ASIN 或站点', 'Search product name, ASIN, or marketplace')} /></label>
      <span className="products-count">{filtered.length} / {products.length} {text('个产品', 'products')}</span>
    </div>
    <div className="product-grid">
      {filtered.map((product) => <ProductCard key={product.id} product={product} isSelected={product.id === selectedProductId} onOpen={() => onOpen(product)} onDelete={() => onDelete(product)} />)}
      <button className="new-product-card" type="button" onClick={() => setShowCreate(true)}><span><Plus size={20} /></span><strong>{text('建立下一个产品词库', 'Create another product library')}</strong><small>{text('录入标题和五点后即可导入竞品反查表', 'Add title and bullets, then import competitor reverse-ASIN sheets')}</small></button>
    </div>
    {showCreate && <CreateProductModal onClose={() => setShowCreate(false)} onCreate={(payload) => { onCreate(payload); setShowCreate(false) }} />}
  </div>
}

function ProductCard({ product, isSelected, onOpen, onDelete }: { product: Product; isSelected: boolean; onOpen: () => void; onDelete: () => void | Promise<void> }) {
  const { text, numberLocale } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  function handleDelete() {
    setMenuOpen(false)
    void onDelete()
  }
  return <article className={`product-card${isSelected ? ' is-current' : ''}`}><button className="product-card-main" type="button" onClick={onOpen} aria-current={isSelected ? 'true' : undefined}><div className="product-card-top"><span className="product-card-icon"><Boxes size={20} /></span><span className="product-status"><i />{product.status}</span></div><h2>{product.name}</h2><p>{product.category}</p><div className="product-reference"><span>{text('竞品参考', 'Competitor reference')}</span><code>{product.referenceAsin}</code><small>{product.site}</small></div><div className="product-card-metrics"><span><strong>{product.keywordTotal.toLocaleString(numberLocale)}</strong><small>{text('关键词', 'keywords')}</small></span><span><strong>{product.strongCount.toLocaleString(numberLocale)}</strong><small>{text('强匹配', 'strong match')}</small></span><span><strong>{product.sourceCount}</strong><small>{text('来源 ASIN', 'source ASINs')}</small></span></div><div className="product-card-footer"><span>{text(`最近导入 ${product.lastImportedAt}`, `Last import ${product.lastImportedAt}`)}</span><ArrowUpRight size={15} /></div></button><div className="product-card-actions"><button className="product-more-button" type="button" aria-label={text(`打开${product.name}操作菜单`, `Open actions for ${product.name}`)} aria-expanded={menuOpen} title={text('更多操作', 'More actions')} onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open) }}><MoreHorizontal size={18} /></button>{menuOpen && <div className="product-action-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpen() }}><ArrowUpRight size={15} />{text('打开产品', 'Open product')}</button><button className="is-danger" type="button" role="menuitem" onClick={handleDelete}><Trash2 size={15} />{text('删除产品', 'Delete product')}</button></div>}</div></article>
}

function CreateProductModal({ onClose, onCreate }: { onClose: () => void; onCreate: (payload: ProductPayload) => void }) {
  const { text } = useI18n()
  const [name, setName] = useState('')
  const [site, setSite] = useState('Amazon US')
  const [category, setCategory] = useState('Home & Kitchen / Seasonal Décor')
  const [title, setTitle] = useState('')
  const [bulletText, setBulletText] = useState('')
  return <div className="modal-layer"><button className="drawer-scrim" type="button" aria-label={text('关闭新建产品窗口', 'Close new product dialog')} onClick={onClose} /><section className="modal-card product-create-modal" role="dialog" aria-modal="true" aria-labelledby="new-product-title"><div className="modal-heading"><div><span className="panel-kicker">{text('New product / 新建产品', 'New product')}</span><h2 id="new-product-title">{text('建立独立关键词空间', 'Create an isolated keyword workspace')}</h2></div><button className="icon-button" type="button" aria-label={text('关闭', 'Close')} onClick={onClose}>×</button></div><p className="modal-intro">{text('自有 ASIN 可稍后补充。标题和五点会作为判断竞品反查词相关性的产品语料。', 'An owned ASIN can be added later. Title and bullet points are used as product evidence for judging competitor reverse-ASIN keywords.')}</p><div className="form-grid"><label className="form-field full-field"><span>{text('产品名称', 'Product name')} <em>*</em></span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={text('例如：26 英寸人造黄杨木花环', 'e.g. 26-inch artificial boxwood wreath')} /></label><label className="form-field"><span>{text('站点', 'Marketplace')} <em>*</em></span><select value={site} onChange={(event) => setSite(event.target.value)}><option>Amazon US</option><option>Amazon UK</option><option>Amazon JP</option><option>Amazon DE</option></select></label><label className="form-field"><span>{text('类目', 'Category')}</span><input value={category} onChange={(event) => setCategory(event.target.value)} /></label><label className="form-field full-field"><span>{text('产品标题', 'Product title')} <em>*</em></span><textarea value={title} onChange={(event) => setTitle(event.target.value)} rows={3} placeholder={text('用于相关性判断的完整英文标题', 'Full English title used for relevance judgment')} /></label><label className="form-field full-field"><span>{text('五点描述', 'Bullet points')}</span><textarea value={bulletText} onChange={(event) => setBulletText(event.target.value)} rows={7} placeholder={text('每行填写一条五点描述，最多读取 5 行', 'One bullet per line, up to 5 lines')} /><small>{text('每行一条，创建后仍可在“产品资料”中修改。', 'One bullet per line. You can edit these later in Product Details.')}</small></label></div><div className="modal-note"><Archive size={15} /><span>{text('新产品默认处于「准备中」，不会自动连接 Amazon 或创建广告活动。', 'New products start in a preparing state and never auto-connect to Amazon or create ad campaigns.')}</span></div><div className="modal-footer"><button className="button button-secondary" type="button" onClick={onClose}>{text('取消', 'Cancel')}</button><button className="button button-primary" type="button" disabled={!name.trim() || !title.trim()} onClick={() => onCreate({ name: name.trim(), site, category, title: title.trim(), bullets: bulletText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 5) })}>{text('创建产品', 'Create product')}<ArrowUpRight size={15} /></button></div></section></div>
}
