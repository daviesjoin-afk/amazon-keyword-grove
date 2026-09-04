export type ProductStatus = '在售' | '准备中' | '归档'
export type MatchStrength = '强匹配' | '中匹配' | '弱匹配' | '不相关'
export type SuggestedAction =
  | '精准投放'
  | '广泛探索'
  | '否定精准'
  | '否定词组'
  | '观察'
  | '人工复核'
export type ActionFilter = 'all' | 'exact' | 'broad' | 'negative_exact' | 'negative_phrase' | 'review'
export type ApprovalStatus = '待审批' | '已接受' | '已修改' | '已驳回'
export type TrafficType = '自然' | 'SP' | '品牌' | '视频' | 'HR' | 'AC'

export interface Product {
  id: string
  name: string
  selfAsin?: string
  referenceAsin: string
  site: string
  language: string
  category: string
  status: ProductStatus
  title: string
  bullets: string[]
  coreTerms: string[]
  keywordTotal: number
  strongCount: number
  mediumCount: number
  weakCount: number
  sourceCount: number
  lastImportedAt: string
  importHealth: number
  roots: string[]
  isReferenceOnly?: boolean
}

export interface KeywordRecord {
  id: string
  keyword: string
  translation: string
  match: MatchStrength
  relevanceScore: number
  relevanceReason: string
  monthlySearchVolume: number | null
  abaRank: number | null
  competitorCoverage: number
  competitorTotal: number
  trafficTypes: TrafficType[]
  root: string
  category: string
  intent: string
  suggestedAction: SuggestedAction
  negativePhraseRoot?: string
  suggestionReason: string
  confidence: number
  risk: '低' | '中' | '高'
  approvalStatus: ApprovalStatus
  notes?: string
  sourceAsins: string[]
  ppcBid: number | null
  titleDensity: number | null
  demandSupplyRatio: number | null
  isLocked?: boolean
  semanticReviewed?: boolean
  lastUpdated: string
}

export interface ImportBatch {
  id: string
  productId: string
  fileName: string
  createdAt: string
  sourceAsins: string[]
  totalRows: number
  addedRows: number
  updatedRows: number
  skippedRows: number
  errorRows: number
  status: '已完成' | '处理中' | '有错误'
}

export interface ProductPayload {
  name: string
  site: string
  category: string
  title: string
  bullets: string[]
}

export interface ProductCopyPayload {
  name: string
  title: string
  bullets: string[]
  coreTerms: string[]
}

export interface AIConfig {
  provider: string
  baseUrl: string
  model: string
  enabled: boolean
  timeoutSeconds: number
  apiKeySet: boolean
  apiKeyHint: string
  updatedAt?: string
}

export interface AIConfigPayload {
  provider: string
  baseUrl: string
  model: string
  apiKey?: string
  enabled: boolean
  timeoutSeconds: number
}

export interface KeywordFilters {
  query: string
  match: '全部' | MatchStrength
  action: ActionFilter
  category: string
  root: string
  approval: '全部' | ApprovalStatus
}

export interface ApiResult<T> {
  data: T
  source: 'mock' | 'api'
}

export interface FieldMapping {
  source: string
  target: string
  status: '已识别' | '需确认' | '忽略'
  sample: string
}
