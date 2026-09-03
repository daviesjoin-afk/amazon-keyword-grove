import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Leaf, RefreshCw, X } from 'lucide-react'
import { api, USE_MOCK, type SemanticReviewStatus } from './api/client'
import type { FieldMapping, ImportBatch, KeywordRecord, Product, ProductCopyPayload, ProductPayload } from './types'
import { relevanceRatio } from './keywordMetrics'
import { useI18n } from './i18n'
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
  const { text, numberLocale } = useI18n()
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
        if (active) setLoadError(error instanceof Error ? error.message : text('数据加载失败', 'Failed to load data'))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
    // Initial data loading should not repeat when only the display language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setToast(text('关键词数据暂时无法加载，已保留当前页面。', 'Keyword data could not be loaded. The current page has been preserved.'))
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
      setToast(text('产品空间已创建，可以开始导入关键词表。', 'Product workspace created. You can now import a keyword sheet.'))
    } catch {
      setToast(text('产品创建失败，请检查本地 API。', 'Failed to create product. Please check the local API.'))
    }
  }

  async function updateProductCopy(payload: ProductCopyPayload) {
    if (!selectedProduct) return
    const result = await api.updateProduct(selectedProduct.id, payload)
    setProducts((current) => current.map((item) => item.id === result.data.id ? result.data : item))
    await loadProductData(result.data)
    setToast(text('自定义名字和产品资料已保存。', 'Custom name and product details saved.'))
  }

  async function runSemanticReview() {
    if (!selectedProduct || semanticReviewing) return
    if (!keywords.length) {
      setToast(text('当前产品还没有关键词，请先导入关键词表后再进行 MiMo 审核。', 'This product has no keywords yet. Import a keyword sheet before running MiMo review.'))
      return
    }
    const reviewProduct = selectedProduct
    try {
      await api.semanticReview(reviewProduct.id, undefined, true)
      const status = await api.getSemanticReviewStatus(reviewProduct.id)
      if (selectedProductIdRef.current === reviewProduct.id) {
        setReviewProgress(status)
        setReviewPollNonce((current) => current + 1)
      }
      if (status.status === 'completed' && status.pending === 0) {
        setToast(text('当前产品全部关键词已经完成 MiMo 审核。', 'MiMo review is complete for all keywords in this product.'))
      } else if (status.status === 'running') {
        setToast(text(
          `已开始 MiMo 增量审核，当前进度 ${status.reviewed.toLocaleString(numberLocale)} / ${status.total.toLocaleString(numberLocale)}；刷新后会继续显示进度。`,
          `MiMo incremental review started: ${status.reviewed.toLocaleString(numberLocale)} / ${status.total.toLocaleString(numberLocale)} reviewed. Progress remains visible after refresh.`,
        ))
      } else {
        setToast(text('MiMo 审核状态已更新，请查看广告建议页的进度。', 'MiMo review status updated. Check the Ad Suggestions page for progress.'))
      }
    } catch (error) {
      setToast(error instanceof Error
        ? text(`MiMo 审核未完成：${error.message}`, `MiMo review did not complete: ${error.message}`)
        : text('MiMo 审核未完成，请检查全局 AI 设置。', 'MiMo review did not complete. Please check the global AI settings.'))
    }
  }

  function updateKeywords(ids: string[], patch: Partial<KeywordRecord>) {
    setKeywords((current) => current.map((item) => ids.includes(item.id) ? { ...item, ...patch } : item))
    if (drawerKeyword && ids.includes(drawerKeyword.id)) setDrawerKeyword((current) => current ? { ...current, ...patch } : current)
    setToast(text(
      `已更新 ${ids.length} 条关键词，人工锁定字段不会被重新导入覆盖。`,
      `Updated ${ids.length} keyword${ids.length === 1 ? '' : 's'}. Manually locked fields will not be overwritten by re-imports.`,
    ))
  }

  function saveKeyword(patch: Partial<KeywordRecord>) {
    if (!drawerKeyword) return
    updateKeywords([drawerKeyword.id], patch)
    setDrawerKeyword((current) => current ? { ...current, ...patch } : current)
  }

  function exportKeywords() {
    const headers = [
      text('关键词', 'Keyword'),
      text('翻译', 'Translation'),
      text('相关性（竞品占比）', 'Relevance (competitor share)'),
      text('语义评分', 'Semantic score'),
      text('搜索量', 'Search volume'),
      text('流量类型', 'Traffic type'),
      text('建议动作', 'Suggested action'),
      text('置信度', 'Confidence'),
      text('风险', 'Risk'),
      text('审批状态', 'Approval status'),
    ]
    const rows = [...keywords].sort((left, right) => (right.monthlySearchVolume ?? -1) - (left.monthlySearchVolume ?? -1)).map((item) => [item.keyword, item.translation, relevanceRatio(item), item.relevanceScore, item.monthlySearchVolume ?? '', item.trafficTypes.join('/'), item.suggestedAction, item.confidence, item.risk, item.approvalStatus])
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedProduct?.name || 'keyword-grove'}-keyword-export.csv`
    link.click()
    URL.revokeObjectURL(url)
    setToast(text('已导出当前关键词库为 CSV，未执行任何 Amazon 操作。', 'Keyword library exported to CSV. No Amazon action was executed.'))
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
        /* Keep the import report visible if refresh fails. */
      }
    }
    setToast(isMock
      ? text('演示导入流程已完成。', 'Demo import flow completed.')
      : text('关键词已写入本地词库并重新加载。', 'Keywords were written to the local library and reloaded.'))
  }

  if (loading) return <div className="app-loading"><div className="loading-mark"><Leaf size={22} /></div><strong>{text('正在打开关键词空间', 'Opening keyword workspace')}</strong><span>{text('加载本地演示数据…', 'Loading local data…')}</span></div>
  if (!selectedProduct) return <div className="app-loading"><div className="loading-mark"><Leaf size={22} /></div><strong>{text('还没有产品', 'No products yet')}</strong><span>{text('进入产品中心创建第一个关键词空间。', 'Create your first keyword workspace in Products.')}</span><button className="button button-primary" type="button" onClick={() => setView('products')}>{text('打开产品中心', 'Open Products')}</button></div>

  const workbench = <Workbench product={selectedProduct} keywords={keywords} batches={batches} onOpenImport={() => navigate('import')} onSelectKeyword={setDrawerKeyword} onUpdateKeywords={updateKeywords} onSaveProduct={updateProductCopy} onExport={exportKeywords} onSemanticReview={runSemanticReview} semanticReviewing={semanticReviewing} reviewProgress={reviewProgress} />
  const content = view === 'products' ? <ProductsView products={products} onOpen={openProduct} onImport={() => navigate('import')} onCreate={createProduct} /> : view === 'import' ? <ImportWizard product={selectedProduct} mappings={mappings} onImport={(file) => api.importFile(selectedProduct.id, file)} onFinish={finishImport} /> : view === 'ai' ? <AISettingsPage /> : workbench

  return <div className="app-shell"><Sidebar view={view} product={selectedProduct} onNavigate={navigate} /><div className="app-main"><Topbar view={view} product={selectedProduct} isMock={isMock} onNavigate={navigate} /><main id="main-content" tabIndex={-1}>{loadError && <div className="global-alert"><RefreshCw size={15} /><span>{loadError}</span><button type="button" onClick={() => setLoadError('')} aria-label={text('关闭错误提示', 'Dismiss error')}><X size={15} /></button></div>}{content}</main></div>{drawerKeyword && <KeywordDrawer keyword={drawerKeyword} onClose={() => setDrawerKeyword(null)} onSave={saveKeyword} />}{toast && <div className="toast" role="status" aria-live="polite"><CheckCircle2 size={16} /><span>{toast}</span><button type="button" aria-label={text('关闭提示', 'Dismiss notification')} onClick={() => setToast('')}><X size={14} /></button></div>}</div>
}
