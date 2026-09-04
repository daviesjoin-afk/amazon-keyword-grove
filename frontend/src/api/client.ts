import { mockApi } from './mock'
import type { AIConfig, AIConfigPayload, ApiResult, FieldMapping, ImportBatch, KeywordRecord, Product, ProductCopyPayload, ProductPayload } from '../types'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8765/api'
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export interface SemanticReviewResult {
  product_id?: number
  review_mode?: 'incremental' | 'full'
  status?: SemanticReviewStatus['status']
  total?: number
  pending?: number
  batches_total?: number
  batches_completed?: number
  successful_batches?: number
  reviewed: number
  batches: number
  failed_batches?: Array<{ batch: number; count: number; error: string }>
  partial?: boolean
  concurrency?: number
  already_reviewed?: boolean
  negative_phrase_promoted?: Array<{ id: number; keyword: string; root: string; affected_count: number; reason: string }>
  items: Array<Record<string, unknown>>
}

export interface SemanticReviewStatus {
  product_id: number
  status: 'idle' | 'running' | 'completed' | 'partial' | 'failed'
  reviewed: number
  total: number
  pending: number
  batches_total: number
  batches_completed: number
  successful_batches: number
  failed_batches: Array<{ batch: number; count: number; error: string }>
  started_at?: string | null
  updated_at?: string | null
  completed_at?: string | null
  error?: string | null
  negative_phrase_promoted?: Array<{ id: number; keyword: string; root: string; affected_count: number; reason: string }>
  review_mode?: 'incremental' | 'full'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...init?.headers },
  })
  if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`)
  return response.json() as Promise<T>
}

export interface KeywordApi {
  getProducts(): Promise<ApiResult<Product[]>>
  getKeywords(productId: string, product?: Product): Promise<ApiResult<KeywordRecord[]>>
  getBatches(productId: string): Promise<ApiResult<ImportBatch[]>>
  getFieldMappings(): Promise<ApiResult<FieldMapping[]>>
  createProduct(payload: ProductPayload): Promise<ApiResult<Product>>
  updateProduct(productId: string, payload: ProductCopyPayload): Promise<ApiResult<Product>>
  deleteProduct(productId: string): Promise<void>
  getAIConfig(): Promise<AIConfig>
  saveAIConfig(payload: AIConfigPayload): Promise<AIConfig>
  semanticReview(productId: string, limit?: number, background?: boolean, reviewMode?: 'incremental' | 'full'): Promise<SemanticReviewResult>
  getSemanticReviewStatus(productId: string): Promise<SemanticReviewStatus>
  importFile(productId: string, file: File): Promise<Record<string, unknown>>
}

type BackendProduct = Record<string, unknown>
type BackendKeyword = Record<string, unknown>

const strengthLabels: Record<string, KeywordRecord['match']> = { strong: '强匹配', medium: '中匹配', weak: '弱匹配', irrelevant: '不相关' }
const actionLabels: Record<string, KeywordRecord['suggestedAction']> = { exact: '精准投放', broad: '广泛探索', negative_exact: '否定精准', negative_phrase: '否定词组', observe: '观察', manual_review: '人工复核', insufficient_data: '人工复核' }
const trafficLabels: Record<string, KeywordRecord['trafficTypes'][number]> = { natural: '自然', sp: 'SP', brand: '品牌', video: '视频', hr: 'HR', ac: 'AC' }

function normalizeAIConfig(item: Record<string, unknown>): AIConfig {
  return {
    provider: String(item.provider || 'openrouter'), baseUrl: String(item.base_url || 'https://openrouter.ai/api/v1'),
    model: String(item.model || 'minimax/minimax-m3:free'), enabled: Boolean(item.enabled), timeoutSeconds: Number(item.timeout_seconds || 60),
    apiKeySet: Boolean(item.api_key_set), apiKeyHint: String(item.api_key_hint || ''), updatedAt: item.updated_at ? String(item.updated_at) : undefined,
  }
}

function normalizeProduct(item: BackendProduct, stats?: Record<string, unknown>): Product {
  const byStrength = (stats?.by_match_strength || {}) as Record<string, number>
  const sourceCount = Number(stats?.source_asins ?? item.source_asin_count ?? 0)
  const savedCoreTerms = Array.isArray(item.core_terms) ? item.core_terms.map((term) => String(term).trim().toLowerCase()).filter(Boolean) : []
  const title = String(item.product_title || '').toLowerCase()
  const coreTerms = [...new Set(savedCoreTerms)]
  const supportingRoots = [
    ...coreTerms.map((term) => term.split(' ').at(-1) || ''),
    ...['front door', 'indoor', 'outdoor', 'waterproof', 'uv resistant'].filter((term) => title.includes(term)),
  ].filter(Boolean)
  const roots = [...new Set([...coreTerms, ...supportingRoots])]
  return {
    id: String(item.id), name: String(item.name || '未命名产品'), selfAsin: item.asin ? String(item.asin) : undefined,
    referenceAsin: sourceCount > 0 ? '竞品集合' : '尚未导入', site: String(item.site || 'US'), language: String(item.language || 'en_US'), category: String(item.category || '未分类'),
    status: item.status === 'archived' ? '归档' : item.status === 'preparing' ? '准备中' : '在售', title: String(item.product_title || ''),
    bullets: (item.bullet_points || []) as string[], keywordTotal: Number(stats?.total_keywords ?? item.keyword_count ?? 0),
    strongCount: Number(byStrength.strong ?? item.strong_keyword_count ?? 0), mediumCount: Number(byStrength.medium ?? 0), weakCount: Number(byStrength.weak ?? 0),
    sourceCount, lastImportedAt: String(item.updated_at || '尚未导入'), importHealth: 100,
    coreTerms, roots,
  }
}

function normalizeKeyword(item: BackendKeyword, rootCandidates: string[], productCompetitorTotal = 0): KeywordRecord {
  const asins = (item.related_asins || []) as string[]
  const rawTraffic = (item.traffic_types || []) as string[]
  const match = strengthLabels[String(item.match_strength)] || '不相关'
  const action = actionLabels[String(item.suggested_action)] || actionLabels[String(item.suggested_action_auto)] || '人工复核'
  const confidence = Math.round(Number(item.advice_confidence || 0) * (Number(item.advice_confidence || 0) <= 1 ? 100 : 1))
  const riskRaw = String(item.advice_risk_level || 'medium')
  const normalizedText = String(item.keyword_normalized || '')
  const root = [...rootCandidates]
    .sort((left, right) => right.length - left.length)
    .find((candidate) => normalizedText.includes(candidate)) || ((item.matched_terms || []) as string[])[0] || normalizedText.split(' ')[0] || '未分类'
  const competitorCoverage = Number(item.competitor_coverage ?? item.related_product_count ?? asins.length)
  const competitorTotal = Number(item.competitor_total ?? productCompetitorTotal)
  return {
    id: String(item.id), keyword: String(item.keyword_raw || item.keyword_normalized || ''), translation: String(item.keyword_translation || ''), match,
    relevanceScore: Number(item.relevance_score || 0), relevanceReason: ((item.classification_reason || []) as string[]).join('；') || String(item.advice_reason || ''),
    monthlySearchVolume: item.monthly_search_volume == null ? null : Number(item.monthly_search_volume), abaRank: item.aba_weekly_rank == null ? null : Number(item.aba_weekly_rank),
    competitorCoverage, competitorTotal, trafficTypes: rawTraffic.map((value) => trafficLabels[value.toLowerCase()] || (value.includes('自然') ? '自然' : value.includes('SP') ? 'SP' : value.includes('品牌') ? '品牌' : value.includes('视频') ? '视频' : value.includes('HR') ? 'HR' : 'AC')),
    root, category: String(item.category || '待确认'), intent: String(item.category || '待确认'),
    suggestedAction: action, negativePhraseRoot: item.negative_phrase_root ? String(item.negative_phrase_root) : undefined, suggestionReason: String(item.advice_reason || '数据不足，等待人工复核'), confidence, risk: riskRaw === 'high' ? '高' : riskRaw === 'low' ? '低' : '中',
    approvalStatus: item.manual_locked ? '已接受' : '待审批', notes: item.notes ? String(item.notes) : undefined, sourceAsins: asins,
    ppcBid: item.ppc_bid == null ? null : Number(item.ppc_bid), titleDensity: item.title_density == null ? null : Number(item.title_density), demandSupplyRatio: item.demand_supply_ratio == null ? null : Number(item.demand_supply_ratio),
    isLocked: Boolean(item.manual_locked), semanticReviewed: Boolean(item.semantic_reviewed) || String(item.advice_reason || '').includes('语义审核：'), lastUpdated: String(item.updated_at || ''),
  }
}

export const api: KeywordApi = {
  async getProducts() {
    if (USE_MOCK) return { data: await mockApi.getProducts(), source: 'mock' }
    const page = await request<{ items: BackendProduct[] }>('/products')
    const products = await Promise.all(page.items.map(async (item) => normalizeProduct(item, await request<Record<string, unknown>>(`/products/${item.id}/stats`))))
    return { data: products, source: 'api' }
  },
  async getKeywords(productId, product) {
    if (USE_MOCK) return { data: await mockApi.getKeywords(), source: 'mock' }
    const all: BackendKeyword[] = []
    let page = 1
    for (;;) {
      const result = await request<{ items: BackendKeyword[]; pages: number }>(`/products/${encodeURIComponent(productId)}/keywords?page=${page}&page_size=200&sort_by=monthly_search_volume&sort_order=desc`)
      all.push(...result.items)
      if (page >= result.pages) break
      page += 1
    }
    return { data: all.map((item) => normalizeKeyword(item, product?.roots || [], product?.sourceCount || 0)), source: 'api' }
  },
  async getBatches(productId) {
    if (USE_MOCK) return { data: await mockApi.getBatches(), source: 'mock' }
    const result = await request<{ items: Array<Record<string, unknown>> }>(`/products/${encodeURIComponent(productId)}/imports`)
    return { data: result.items.map((item) => ({ id: String(item.id), productId, fileName: String(item.filename || item.file_name || ''), createdAt: String(item.created_at || ''), sourceAsins: (item.source_asins || []) as string[], totalRows: Number(item.total_rows || 0), addedRows: Number(item.inserted_rows || 0), updatedRows: Number(item.updated_rows || 0), skippedRows: Number(item.skipped_rows || 0), errorRows: Number(item.error_rows || 0), status: Number(item.error_rows || 0) ? '有错误' : '已完成' })) as ImportBatch[], source: 'api' }
  },
  async getFieldMappings() {
    if (USE_MOCK) return { data: await mockApi.getFieldMappings(), source: 'mock' }
    const result = await request<{ fields: Array<{ field: string; aliases: string[] }> }>('/field-mapping')
    return { data: result.fields.map((item) => ({ source: item.aliases[0] || item.field, target: item.field, status: '已识别', sample: '由上传文件预览' })), source: 'api' }
  },
  async createProduct(payload) {
    if (USE_MOCK) {
      const product: Product = {
        ...mockApiProductFromPayload(payload),
      }
      return { data: product, source: 'mock' }
    }
    const created = await request<BackendProduct>('/products', { method: 'POST', body: JSON.stringify({ name: payload.name, site: payload.site.replace('Amazon ', ''), category: payload.category, product_title: payload.title, bullet_points: payload.bullets }) })
    return { data: normalizeProduct(created), source: 'api' }
  },
  async updateProduct(productId, payload) {
    if (USE_MOCK) throw new Error('演示模式不保存产品资料')
    const updated = await request<BackendProduct>(`/products/${encodeURIComponent(productId)}`, { method: 'PATCH', body: JSON.stringify({ name: payload.name, product_title: payload.title, bullet_points: payload.bullets, core_terms: payload.coreTerms }) })
    const stats = await request<Record<string, unknown>>(`/products/${encodeURIComponent(productId)}/stats`)
    return { data: normalizeProduct(updated, stats), source: 'api' }
  },
  async deleteProduct(productId) {
    if (USE_MOCK) return
    await request<Record<string, unknown>>(`/products/${encodeURIComponent(productId)}`, { method: 'DELETE' })
  },
  async getAIConfig() {
    if (USE_MOCK) return normalizeAIConfig({})
    return normalizeAIConfig(await request<Record<string, unknown>>('/ai-config'))
  },
  async saveAIConfig(payload) {
    if (USE_MOCK) return normalizeAIConfig({ ...payload, base_url: payload.baseUrl, timeout_seconds: payload.timeoutSeconds, api_key_set: Boolean(payload.apiKey), api_key_hint: payload.apiKey ? `••••${payload.apiKey.slice(-4)}` : '' })
    const saved = await request<Record<string, unknown>>('/ai-config', { method: 'PUT', body: JSON.stringify({ provider: payload.provider, base_url: payload.baseUrl, model: payload.model, api_key: payload.apiKey || null, enabled: payload.enabled, timeout_seconds: payload.timeoutSeconds }) })
    return normalizeAIConfig(saved)
  },
  async semanticReview(productId, limit, background = false, reviewMode: 'incremental' | 'full' = 'incremental') {
    if (USE_MOCK) throw new Error('演示模式不调用 AI 语义审核')
    const body = { ...(limit == null ? {} : { limit }), background, review_mode: reviewMode }
    return request<SemanticReviewResult>(`/products/${encodeURIComponent(productId)}/semantic-review`, { method: 'POST', body: JSON.stringify(body) })
  },
  async getSemanticReviewStatus(productId) {
    if (USE_MOCK) {
      const mockKeywords = await mockApi.getKeywords()
      const total = mockKeywords.length
      return { product_id: Number(productId) || 0, status: 'completed', reviewed: total, total, pending: 0, batches_total: 0, batches_completed: 0, successful_batches: 0, failed_batches: [] }
    }
    return request<SemanticReviewStatus>(`/products/${encodeURIComponent(productId)}/semantic-review/status`)
  },
  async importFile(productId, file) {
    const form = new FormData()
    form.append('file', file)
    return request<Record<string, unknown>>(`/products/${encodeURIComponent(productId)}/imports`, { method: 'POST', body: form })
  },
}

function mockApiProductFromPayload(payload: ProductPayload): Product {
  return {
    id: `product-${Date.now()}`,
    name: payload.name,
    referenceAsin: '待添加',
    site: payload.site,
    language: payload.site.includes('US') ? 'English' : '待设置',
    category: payload.category || '待设置类目',
    status: '准备中',
    title: payload.title,
    bullets: payload.bullets,
    coreTerms: [],
    keywordTotal: 0,
    strongCount: 0,
    mediumCount: 0,
    weakCount: 0,
    sourceCount: 0,
    lastImportedAt: '尚未导入',
    importHealth: 0,
    roots: [],
  }
}
