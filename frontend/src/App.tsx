import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Leaf, RefreshCw, X } from 'lucide-react'
import { api, USE_MOCK, type SemanticReviewStatus } from './api/client'
import type { FieldMapping, ImportBatch, KeywordRecord, Product, ProductCopyPayload, ProductPayload } from './types'
import { relevanceRatio } from './keywordMetrics'
import { ImportWizard } from './components/ImportWizard'
import { AISettingsPage } from './components/AISettingsPage'
import { KeywordDrawer } from './components/KeywordDrawer'
import { ProductsView } from './components/ProductsView'
import { Sidebar, type AppView } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Workbench } from './components/Workbench'

const SELECTED_PRODUCT_STORAGE_KEY = 'keyword-grove:selected-product-id'

function readStoredProductId(): string | null {
  try {
    return window.localStorage.getItem(SELECTED_PRODUCT_STORAGE_KEY)
  } catch {
    return null
  }
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string | null>(() => readStoredProductId())
  const [keywords, setKeywords] = useState<KeywordRecord[]>([])
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [view, setView] = useState<AppView>('workbench')
  const [drawerKeyword, setDrawerKeyword] = useState<KeywordRecord | null>(null)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reviewProgress, setReviewProgress] = useState<SemanticReviewStatus | null>(null)
  const [reviewPollNonce, setReviewPollNonce] = useState(0)
  const selectedProductIdRef = useRef<string | null>(selectedProductId)
  const productDataLoadRef = useRef(0)
  const reviewStatusRef = useRef<SemanticReviewStatus['status'] | null>(null)
  const isMock = USE_MOCK

  const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId) || products[0] || null, [products, selectedProductId])
  const semanticReviewing = Boolean(selectedProduct && reviewProgress?.status === 'running' && String(reviewProgress.product_id) === selectedProduct.id)

  function selectProduct(productId: string | null) {
    selectedProductIdRef.current = productId
    setSelectedProductId(productId)
  }

  const loadProductData = useCallback(async (product: Product) => {
    const loadId = ++productDataLoadRef.current
    const [keywordResult, batchResult] = await Promise.all([api.getKeywords(product.id, product), api.getBatches(product.id)])
    if (loadId !== productDataLoadRef.current) return
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
        const storedId = selectedProductIdRef.current
        const initialProduct = productResult.data.find((product) => product.id === storedId) || productResult.data[0] || null
        selectProduct(initialProduct?.id || null)
        setMappings(mappingResult.data)
        if (initialProduct) await loadProductData(initialProduct)
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
    try {
      if (selectedProductId) window.localStorage.setItem(SELECTED_PRODUCT_STORAGE_KEY, selectedProductId)
      else if (!products.length) window.localStorage.removeItem(SELECTED_PRODUCT_STORAGE_KEY)
    } catch {
      // Private browsing or a restricted storage context should not block the app.
    }
  }, [products.length, selectedProductId])

  useEffect(() => {
    if (!selectedProduct) {
      setReviewProgress(null)
      reviewStatusRef.current = null
      return
    }
    let active = true
    let timer: number | undefined
    reviewStatusRef.current = null
    const product = selectedProduct
    async function pollReviewStatus() {
      try {
        const status = await api.getSemanticReviewStatus(product.id)
        if (!active) return
        const previous = reviewStatusRef.current
        reviewStatusRef.current = status.status
        setReviewProgress(status)
        if (status.status !== 'running' && status.completed_at && (previous === 'running' || previous === null)) {
          await loadProductData(product)
        }
        if (status.status === 'running') timer = window.setTimeout(() => void pollReviewStatus(), 800)
      } catch {
        if (active) setReviewProgress(null)
      }
    }
    void pollReviewStatus()
    return () => {
      active = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [loadProductData, reviewPollNonce, selectedProduct?.id])

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
    const previousId = selectedProductIdRef.current
    selectProduct(product.id)
    setView('workbench')
    if (product.id !== previousId) {
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
      selectProduct(result.data.id)
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

  async function runSemanticReview(reviewMode: 'incremental' | 'full' = 'incremental') {
    if (!selectedProduct || semanticReviewing) return
    if (!keywords.length) {
      setToast('当前产品还没有关键词，请先导入关键词表后再进行 AI 审核。')
      return
    }
    if (reviewMode === 'full' && !window.confirm('重新审核会重新处理所有未人工锁定的关键词，并产生新的模型调用。确定继续吗？')) return
    const reviewProduct = selectedProduct
    try {
      await api.semanticReview(reviewProduct.id, undefined, true, reviewMode)
      const status = await api.getSemanticReviewStatus(reviewProduct.id)
      if (selectedProductIdRef.current === reviewProduct.id) {
        setReviewProgress(status)
        setReviewPollNonce((current) => current + 1)
      }
      if (status.status === 'completed' && status.pending === 0) setToast(reviewMode === 'full' ? '当前产品已完成重新审核，人工锁定记录未改变。' : '当前产品全部关键词已经完成 AI 审核。')
      else if (status.status === 'running') setToast(`已开始${reviewMode === 'full' ? '重新' : '增量'}审核，当前进度 ${status.reviewed.toLocaleString('en-US')} / ${status.total.toLocaleString('en-US')}；刷新后会继续显示进度。`)
      else setToast('AI 审核状态已更新，请查看广告建议页的进度。')
    } catch (error) {
      setToast(error instanceof Error ? `AI 审核未完成：${error.message}` : 'AI 审核未完成，请检查全局 AI 设置。')
    }
  }

  async function updateKeywords(ids: string[], patch: Partial<KeywordRecord>) {
    setKeywords((current) => current.map((item) => ids.includes(item.id) ? { ...item, ...patch } : item))
    if (drawerKeyword && ids.includes(drawerKeyword.id)) setDrawerKeyword((current) => current ? { ...current, ...patch } : current)
    if (!selectedProduct || USE_MOCK) {
      setToast(`已更新 ${ids.length} 条关键词，人工锁定字段不会被重新导入覆盖。`)
      return
    }
    try {
      await api.bulkUpdateKeywords(selectedProduct.id, ids, {
        locked: patch.isLocked,
        ...(patch.notes === undefined ? {} : { notes: patch.notes }),
      })
      await loadProductData(selectedProduct)
      setToast(`已保存 ${ids.length} 条关键词的人工审批，刷新后仍会保留。`)
    } catch (error) {
      try { await loadProductData(selectedProduct) } catch { /* keep the last known local state */ }
      setToast(error instanceof Error ? `关键词保存失败：${error.message}` : '关键词保存失败，请检查本地 API。')
    }
  }

  async function saveKeyword(patch: Partial<KeywordRecord>) {
    if (!drawerKeyword) return
    if (!selectedProduct || USE_MOCK) {
      updateKeywords([drawerKeyword.id], patch)
      return
    }
    const actionMap: Record<string, string> = { '精准投放': 'exact', '广泛探索': 'broad', '否定精准': 'negative_exact', '否定词组': 'negative_phrase', '观察': 'observe', '人工复核': 'manual_review' }
    const payload: { action?: string | null; locked?: boolean; notes?: string } = {}
    if (patch.suggestedAction) payload.action = patch.approvalStatus === '已驳回' ? null : actionMap[patch.suggestedAction]
    if (patch.approvalStatus) payload.locked = patch.approvalStatus !== '已驳回'
    if (patch.notes !== undefined) payload.notes = patch.notes
    try {
      const updated = await api.updateKeyword(selectedProduct.id, drawerKeyword.id, payload)
      setKeywords((current) => current.map((item) => item.id === updated.id ? updated : item))
      setDrawerKeyword(updated)
      setToast('关键词人工判断已保存，刷新后仍会保留。')
    } catch (error) {
      setToast(error instanceof Error ? `关键词保存失败：${error.message}` : '关键词保存失败，请检查本地 API。')
    }
  }

  function exportKeywords() {
    const headers = ['关键词', '翻译', '相关性（竞品占比）', '语义评分', '搜索量', '流量类型', '建议动作', '置信度', '风险', '审批状态']
    const rows = [...keywords].sort((left, right) => (right.monthlySearchVolume ?? -1) - (left.monthlySearchVolume ?? -1)).map((item) => [item.keyword, item.translation, relevanceRatio(item), item.relevanceScore, item.monthlySearchVolume ?? '', item.trafficTypes.join('/'), item.suggestedAction, item.confidence, item.risk, item.approvalStatus])
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
      try {
        const productResult = await api.getProducts()
        setProducts(productResult.data)
        const refreshedProduct = productResult.data.find((product) => product.id === selectedProduct.id)
        if (refreshedProduct) await loadProductData(refreshedProduct)
        else await loadProductData(selectedProduct)
      } catch {
        /* 保留导入报告 */
      }
    }
    setToast(isMock ? '演示导入流程已完成。' : '关键词已写入本地词库并重新加载。')
  }

  if (loading) return <div className="app-loading"><div className="loading-mark"><Leaf size={22} /></div><strong>正在打开关键词空间</strong><span>加载本地演示数据…</span></div>
  if (!selectedProduct) return <div className="app-loading"><div className="loading-mark"><Leaf size={22} /></div><strong>还没有产品</strong><span>进入产品中心创建第一个关键词空间。</span><button className="button button-primary" type="button" onClick={() => setView('products')}>打开产品中心</button></div>

  const workbench = <Workbench product={selectedProduct} keywords={keywords} batches={batches} onOpenImport={() => navigate('import')} onSelectKeyword={setDrawerKeyword} onUpdateKeywords={updateKeywords} onSaveProduct={updateProductCopy} onExport={exportKeywords} onSemanticReview={runSemanticReview} semanticReviewing={semanticReviewing} reviewProgress={reviewProgress} />
  const content = view === 'products' ? <ProductsView products={products} onOpen={openProduct} onImport={() => navigate('import')} onCreate={createProduct} /> : view === 'import' ? <ImportWizard product={selectedProduct} mappings={mappings} onImport={(file) => api.importFile(selectedProduct.id, file)} onFinish={finishImport} /> : view === 'ai' ? <AISettingsPage /> : workbench

  return <div className="app-shell"><Sidebar view={view} product={selectedProduct} onNavigate={navigate} /><div className="app-main"><Topbar view={view} product={selectedProduct} isMock={isMock} onNavigate={navigate} /><main id="main-content" tabIndex={-1}>{loadError && <div className="global-alert"><RefreshCw size={15} /><span>{loadError}</span><button type="button" onClick={() => setLoadError('')} aria-label="关闭错误提示"><X size={15} /></button></div>}{content}</main></div>{drawerKeyword && <KeywordDrawer keyword={drawerKeyword} onClose={() => setDrawerKeyword(null)} onSave={saveKeyword} />}{toast && <div className="toast" role="status" aria-live="polite"><CheckCircle2 size={16} /><span>{toast}</span><button type="button" aria-label="关闭提示" onClick={() => setToast('')}><X size={14} /></button></div>}</div>
}
