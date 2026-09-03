import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Leaf, RefreshCw, X } from 'lucide-react'
import { api, USE_MOCK } from './api/client'
import type { FieldMapping, ImportBatch, KeywordRecord, Product, ProductCopyPayload, ProductPayload } from './types'
import { ImportWizard } from './components/ImportWizard'
import { AISettingsPage } from './components/AISettingsPage'
import { KeywordDrawer } from './components/KeywordDrawer'
import { ProductsView } from './components/ProductsView'
import { Sidebar, type AppView } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Workbench } from './components/Workbench'

export default function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [keywords, setKeywords] = useState<KeywordRecord[]>([])
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [view, setView] = useState<AppView>('workbench')
  const [drawerKeyword, setDrawerKeyword] = useState<KeywordRecord | null>(null)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [semanticReviewing, setSemanticReviewing] = useState(false)
  const isMock = USE_MOCK

  const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId) || products[0] || null, [products, selectedProductId])

  const loadProductData = useCallback(async (product: Product) => {
    const [keywordResult, batchResult] = await Promise.all([api.getKeywords(product.id, product), api.getBatches(product.id)])
    setKeywords(keywordResult.data)
    setBatches(batchResult.data)
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [productResult, mappingResult] = await Promise.all([api.getProducts(), api.getFieldMappings()])
        if (!active) return
        setProducts(productResult.data)
        setSelectedProductId(productResult.data[0]?.id || null)
        setMappings(mappingResult.data)
        if (productResult.data[0]) await loadProductData(productResult.data[0])
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : '数据加载失败')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [loadProductData])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  function navigate(nextView: AppView) {
    setView(nextView)
    setDrawerKeyword(null)
  }

  async function openProduct(product: Product) {
    setSelectedProductId(product.id)
    setView('workbench')
    if (product.id !== selectedProduct?.id) {
      try {
        await loadProductData(product)
      } catch {
        setToast('关键词数据暂时无法加载，已保留当前页面。')
      }
    }
  }

  async function createProduct(payload: ProductPayload) {
    try {
      const result = await api.createProduct(payload)
      setProducts((current) => [...current, result.data])
      setSelectedProductId(result.data.id)
      setView('workbench')
      setKeywords([])
      setBatches([])
      setToast('产品空间已创建，可以开始导入关键词表。')
    } catch {
      setToast('产品创建失败，请检查本地 API。')
    }
  }

  async function updateProductCopy(payload: ProductCopyPayload) {
    if (!selectedProduct) return
    const result = await api.updateProduct(selectedProduct.id, payload)
    setProducts((current) => current.map((item) => item.id === result.data.id ? result.data : item))
    await loadProductData(result.data)
    setToast('自定义名字和产品资料已保存。')
  }

  async function runSemanticReview() {
    if (!selectedProduct || semanticReviewing) return
    setSemanticReviewing(true)
    try {
      const result = await api.semanticReview(selectedProduct.id)
      await loadProductData(selectedProduct)
      setToast(result.already_reviewed ? '当前产品全部关键词已经完成 MiMo 审核，本次未重复调用。' : `MiMo 已完成全部 ${result.reviewed} 条语义审核；结果均为待人工确认草稿。`)
    } catch (error) {
      setToast(error instanceof Error ? `MiMo 审核未完成：${error.message}` : 'MiMo 审核未完成，请检查全局 AI 设置。')
    } finally {
      setSemanticReviewing(false)
    }
  }

  function updateKeywords(ids: string[], patch: Partial<KeywordRecord>) {
    setKeywords((current) => current.map((item) => ids.includes(item.id) ? { ...item, ...patch } : item))
    if (drawerKeyword && ids.includes(drawerKeyword.id)) setDrawerKeyword((current) => current ? { ...current, ...patch } : current)
    setToast(`已更新 ${ids.length} 条关键词，人工锁定字段不会被重新导入覆盖。`)
  }

  function saveKeyword(patch: Partial<KeywordRecord>) {
    if (!drawerKeyword) return
    updateKeywords([drawerKeyword.id], patch)
    setDrawerKeyword((current) => current ? { ...current, ...patch } : current)
  }

  function exportKeywords() {
    const headers = ['关键词', '翻译', '相关性', '搜索量', '竞品覆盖', '流量类型', '建议动作', '置信度', '风险', '审批状态']
    const rows = [...keywords].sort((left, right) => (right.monthlySearchVolume ?? -1) - (left.monthlySearchVolume ?? -1)).map((item) => [item.keyword, item.translation, item.relevanceScore, item.monthlySearchVolume ?? '', `${item.competitorCoverage}/${item.competitorTotal}`, item.trafficTypes.join('/'), item.suggestedAction, item.confidence, item.risk, item.approvalStatus])
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedProduct?.name || 'keyword-grove'}-keyword-export.csv`
    link.click()
    URL.revokeObjectURL(url)
    setToast('已导出当前关键词库为 CSV，未执行任何 Amazon 操作。')
  }

  async function finishImport() {
    setView('workbench')
    if (selectedProduct) {
      try { await loadProductData(selectedProduct) } catch { /* 保留导入报告 */ }
    }
    setToast(isMock ? '演示导入流程已完成。' : '关键词已写入本地词库并重新加载。')
  }

  if (loading) return <div className="app-loading"><div className="loading-mark"><Leaf size={22} /></div><strong>正在打开关键词空间</strong><span>加载本地演示数据…</span></div>
  if (!selectedProduct) return <div className="app-loading"><div className="loading-mark"><Leaf size={22} /></div><strong>还没有产品</strong><span>进入产品中心创建第一个关键词空间。</span><button className="button button-primary" type="button" onClick={() => setView('products')}>打开产品中心</button></div>

  const workbench = <Workbench product={selectedProduct} keywords={keywords} batches={batches} onOpenImport={() => navigate('import')} onSelectKeyword={setDrawerKeyword} onUpdateKeywords={updateKeywords} onSaveProduct={updateProductCopy} onExport={exportKeywords} onSemanticReview={runSemanticReview} semanticReviewing={semanticReviewing} />
  const content = view === 'products' ? <ProductsView products={products} onOpen={openProduct} onImport={() => navigate('import')} onCreate={createProduct} /> : view === 'import' ? <ImportWizard product={selectedProduct} mappings={mappings} onImport={(file) => api.importFile(selectedProduct.id, file)} onFinish={finishImport} /> : view === 'ai' ? <AISettingsPage /> : workbench

  return <div className="app-shell"><Sidebar view={view} product={selectedProduct} onNavigate={navigate} /><div className="app-main"><Topbar view={view} product={selectedProduct} isMock={isMock} onNavigate={navigate} /><main id="main-content" tabIndex={-1}>{loadError && <div className="global-alert"><RefreshCw size={15} /><span>{loadError}</span><button type="button" onClick={() => setLoadError('')} aria-label="关闭错误提示"><X size={15} /></button></div>}{content}</main></div>{drawerKeyword && <KeywordDrawer keyword={drawerKeyword} onClose={() => setDrawerKeyword(null)} onSave={saveKeyword} />}{toast && <div className="toast" role="status" aria-live="polite"><CheckCircle2 size={16} /><span>{toast}</span><button type="button" aria-label="关闭提示" onClick={() => setToast('')}><X size={14} /></button></div>}</div>
}
