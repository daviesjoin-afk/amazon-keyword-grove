import type { FieldMapping, ImportBatch, KeywordRecord, Product } from '../types'

const sourceAsins = [
  'B0SAMPLE01',
  'B0SAMPLE02',
  'B0SAMPLE03',
  'B0SAMPLE04',
  'B0SAMPLE05',
]

export const mockProduct: Product = {
  id: 'product-sample-001',
  name: '示例黄杨木花环',
  referenceAsin: 'B0SAMPLE01',
  site: 'Amazon US',
  language: 'English',
  category: 'Home & Kitchen / Seasonal Décor',
  status: '准备中',
  title: 'Artificial Boxwood Wreath for Front Door, Waterproof Greenery Decor for Indoor and Outdoor Use',
  bullets: [
    'Full Display - Dense artificial boxwood leaves create a natural-looking wreath for everyday decorating.',
    'Lifelike Greenery - Layered green leaves add a fresh look to farmhouse, rustic, and modern spaces.',
    'Weather Resistant - Waterproof materials support indoor and outdoor display.',
    'Flexible Decor - Suitable for seasonal decorating, events, and everyday use.',
    'Easy Shaping - Adjust the branches and leaves after unpacking before hanging.',
  ],
  keywordTotal: 2000,
  strongCount: 486,
  mediumCount: 731,
  weakCount: 608,
  sourceCount: 20,
  lastImportedAt: '2026-08-27 14:32',
  importHealth: 83,
  coreTerms: ['boxwood wreath', 'front door wreath', 'artificial wreath'],
  roots: ['boxwood wreath', 'front door wreath', 'wreath', 'artificial', 'greenery', 'front door'],
  isReferenceOnly: true,
}

const keywordSeeds: Array<Omit<KeywordRecord, 'id' | 'lastUpdated'>> = [
  {
    keyword: 'artificial boxwood wreath', translation: '人造黄杨木花环', match: '强匹配', relevanceScore: 98,
    relevanceReason: '命中产品类型与材质；出现在标题和五点', monthlySearchVolume: 14800, abaRank: 2220,
    competitorCoverage: 18, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'boxwood', category: '核心产品词', intent: '购买型',
    suggestedAction: '精准投放', suggestionReason: '核心品类词，建议用精准匹配承接高意向流量', confidence: 96, risk: '低', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 4), ppcBid: 2.38, titleDensity: 28, demandSupplyRatio: 3.4, notes: '优先建立核心广告组',
  },
  {
    keyword: 'front door wreath', translation: '前门花环', match: '强匹配', relevanceScore: 94,
    relevanceReason: '使用场景与产品用途高度一致；标题命中', monthlySearchVolume: 33100, abaRank: 980,
    competitorCoverage: 20, competitorTotal: 20, trafficTypes: ['自然', 'SP', '视频'], root: 'front door', category: '使用场景词', intent: '购买型',
    suggestedAction: '精准投放', suggestionReason: '高需求且场景明确，先以精准词控制预算', confidence: 94, risk: '低', approvalStatus: '已接受',
    sourceAsins: sourceAsins.slice(0, 5), ppcBid: 2.81, titleDensity: 35, demandSupplyRatio: 2.1,
  },
  {
    keyword: '26 inch wreath', translation: '26 英寸花环', match: '强匹配', relevanceScore: 96,
    relevanceReason: '尺寸属性与产品规格一致，命中标题和首条五点', monthlySearchVolume: 2900, abaRank: 8410,
    competitorCoverage: 13, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'wreath', category: '尺寸/规格词', intent: '购买型',
    suggestedAction: '精准投放', suggestionReason: '尺寸+品类意图具体，适合精准承接转化', confidence: 91, risk: '低', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 3), ppcBid: 1.76, titleDensity: 14, demandSupplyRatio: 3.8,
  },
  {
    keyword: 'large green wreath for front door', translation: '前门大号绿色花环', match: '强匹配', relevanceScore: 92,
    relevanceReason: '命中尺寸、颜色、场景与品类属性', monthlySearchVolume: 4100, abaRank: 6500,
    competitorCoverage: 10, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'front door', category: '属性组合词', intent: '购买型',
    suggestedAction: '精准投放', suggestionReason: '长尾属性完整，适合作为高意图精准词', confidence: 88, risk: '低', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 2), ppcBid: 1.95, titleDensity: 11, demandSupplyRatio: 2.8,
  },
  {
    keyword: 'greenery wreath', translation: '绿植花环', match: '强匹配', relevanceScore: 88,
    relevanceReason: '产品外观与用户给出的 greenery 关键词一致', monthlySearchVolume: 12100, abaRank: 3110,
    competitorCoverage: 15, competitorTotal: 20, trafficTypes: ['自然', 'SP', '品牌'], root: 'greenery', category: '核心产品词', intent: '购买型',
    suggestedAction: '精准投放', suggestionReason: '核心词根边界清晰，建议精准投放；广泛仅用于核心词根池', confidence: 86, risk: '低', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 4), ppcBid: 2.12, titleDensity: 19, demandSupplyRatio: 2.7,
  },
  {
    keyword: 'waterproof outdoor wreath', translation: '防水户外花环', match: '强匹配', relevanceScore: 90,
    relevanceReason: '防水与户外属性同时命中五点描述', monthlySearchVolume: 3600, abaRank: 7930,
    competitorCoverage: 8, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'wreath', category: '功能/用途词', intent: '购买型',
    suggestedAction: '精准投放', suggestionReason: '功能属性具体，适合隔离成高相关精准组', confidence: 85, risk: '低', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 2), ppcBid: 1.64, titleDensity: 9, demandSupplyRatio: 3.1,
  },
  {
    keyword: 'farmhouse wreath', translation: '农舍风花环', match: '中匹配', relevanceScore: 76,
    relevanceReason: '风格词命中标题与五点，但未限定材质和尺寸', monthlySearchVolume: 8900, abaRank: 4590,
    competitorCoverage: 16, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'wreath', category: '款式词', intent: '风格探索',
    suggestedAction: '精准投放', suggestionReason: '风格相关，作为精准测试组控制竞价', confidence: 78, risk: '中', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 3), ppcBid: 1.41, titleDensity: 24, demandSupplyRatio: 1.7,
  },
  {
    keyword: 'all season wreath', translation: '四季花环', match: '中匹配', relevanceScore: 72,
    relevanceReason: '季节属性与五点描述一致，购买意图较泛', monthlySearchVolume: 5400, abaRank: 10400,
    competitorCoverage: 7, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'wreath', category: '季节/节日词', intent: '场景探索',
    suggestedAction: '广泛探索', suggestionReason: '季节概念可拓展，但意图较泛，建议低价测试', confidence: 69, risk: '中', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 2), ppcBid: 1.03, titleDensity: 12, demandSupplyRatio: 1.5,
  },
  {
    keyword: 'wedding greenery decor', translation: '婚礼绿植装饰', match: '中匹配', relevanceScore: 68,
    relevanceReason: '婚礼场景命中五点，可作为装饰用途拓展', monthlySearchVolume: 2700, abaRank: 12280,
    competitorCoverage: 5, competitorTotal: 20, trafficTypes: ['自然', '视频'], root: 'greenery', category: '使用场景词', intent: '场景探索',
    suggestedAction: '精准投放', suggestionReason: '场景明确但非核心购买意图，放入独立精准测试组', confidence: 63, risk: '中', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 2), ppcBid: 0.92, titleDensity: 8, demandSupplyRatio: 2.2,
  },
  {
    keyword: 'boxwood wall decor', translation: '黄杨木墙面装饰', match: '中匹配', relevanceScore: 64,
    relevanceReason: '材质一致且用途相邻；产品可挂墙但非首要场景', monthlySearchVolume: 4800, abaRank: 11200,
    competitorCoverage: 9, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'boxwood', category: '使用场景词', intent: '场景探索',
    suggestedAction: '广泛探索', suggestionReason: '用途相邻，适合低价发现更具体的墙饰长尾', confidence: 60, risk: '中', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 2), ppcBid: 1.22, titleDensity: 16, demandSupplyRatio: 1.9,
  },
  {
    keyword: 'rustic door hanger', translation: '乡村风门挂饰', match: '弱匹配', relevanceScore: 43,
    relevanceReason: '风格和场景相邻，但产品类型并非 door hanger', monthlySearchVolume: 7600, abaRank: 7430,
    competitorCoverage: 3, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'wreath', category: '泛词', intent: '探索',
    suggestedAction: '观察', suggestionReason: '存在风格重叠但品类不精确，先观察搜索词表现', confidence: 52, risk: '中', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 1), ppcBid: 1.18, titleDensity: 20, demandSupplyRatio: 1.1,
  },
  {
    keyword: 'spring flower wreath', translation: '春季花朵花环', match: '弱匹配', relevanceScore: 38,
    relevanceReason: '季节与花环相关，但当前产品为纯绿色黄杨木设计', monthlySearchVolume: 10200, abaRank: 5200,
    competitorCoverage: 4, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'wreath', category: '季节/节日词', intent: '季节探索',
    suggestedAction: '观察', suggestionReason: '季节词可能带来流量，但花朵属性与当前产品不一致', confidence: 48, risk: '中', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 1), ppcBid: 1.32, titleDensity: 18, demandSupplyRatio: 1.3,
  },
  {
    keyword: 'christmas red wreath', translation: '圣诞红色花环', match: '不相关', relevanceScore: 12,
    relevanceReason: '颜色和节日装饰方向与绿色四季产品冲突', monthlySearchVolume: 18600, abaRank: 3650,
    competitorCoverage: 2, competitorTotal: 20, trafficTypes: ['自然', 'SP', '视频'], root: 'wreath', category: '不相关词', intent: '冲突属性',
    suggestedAction: '否定精准', suggestionReason: '完整搜索词存在红色冲突，但不否定 wreath 词根', confidence: 92, risk: '低', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 1), ppcBid: 1.87, titleDensity: 22, demandSupplyRatio: 0.9,
  },
  {
    keyword: 'taylor swift wreath', translation: 'Taylor Swift 花环', match: '不相关', relevanceScore: 4,
    relevanceReason: '品牌/人物词与产品无关，且无内容命中', monthlySearchVolume: 2400, abaRank: null,
    competitorCoverage: 1, competitorTotal: 20, trafficTypes: ['SP'], root: 'wreath', category: '品牌词', intent: '品牌冲突',
    suggestedAction: '否定精准', suggestionReason: '品牌词误触发，建议仅否定完整搜索词', confidence: 87, risk: '低', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 1), ppcBid: 0.84, titleDensity: null, demandSupplyRatio: null,
  },
  {
    keyword: 'artificial wreath with lights', translation: '带灯人造花环', match: '弱匹配', relevanceScore: 32,
    relevanceReason: '品类相关但灯饰功能未在产品资料中出现', monthlySearchVolume: 3200, abaRank: 14100,
    competitorCoverage: 2, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'artificial', category: '功能/用途词', intent: '功能探索',
    suggestedAction: '人工复核', suggestionReason: '关键词含未验证功能，需确认产品是否包含灯饰', confidence: 41, risk: '高', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 2), ppcBid: null, titleDensity: null, demandSupplyRatio: 0.8,
  },
  {
    keyword: 'boxwood wreath for fireplace', translation: '壁炉用黄杨木花环', match: '强匹配', relevanceScore: 86,
    relevanceReason: '材质、品类和五点中的 fireplace 场景同时命中', monthlySearchVolume: 1800, abaRank: 17100,
    competitorCoverage: 6, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'boxwood', category: '使用场景词', intent: '购买型',
    suggestedAction: '精准投放', suggestionReason: '场景清晰、竞争覆盖适中，适合单独精准词', confidence: 83, risk: '低', approvalStatus: '已修改',
    sourceAsins: sourceAsins.slice(0, 2), ppcBid: 1.36, titleDensity: 7, demandSupplyRatio: 2.9, notes: '已将竞价上限调整为 1.55',
  },
  {
    keyword: 'outdoor greenery wreath uv resistant', translation: '防紫外线户外绿植花环', match: '强匹配', relevanceScore: 91,
    relevanceReason: '户外、绿植和 UV resistant 均命中标题/五点', monthlySearchVolume: 1200, abaRank: null,
    competitorCoverage: 4, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'greenery', category: '功能/用途词', intent: '购买型',
    suggestedAction: '精准投放', suggestionReason: '卖点具体且与详情页证据一致，适合高相关精准组', confidence: 79, risk: '低', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 2), ppcBid: 1.14, titleDensity: 6, demandSupplyRatio: 3.8,
  },
  {
    keyword: 'blue artificial wreath', translation: '蓝色人造花环', match: '不相关', relevanceScore: 9,
    relevanceReason: '颜色属性与产品绿色设计冲突', monthlySearchVolume: 3600, abaRank: 13800,
    competitorCoverage: 2, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'artificial', category: '不相关词', intent: '冲突属性',
    suggestedAction: '否定词组', suggestionReason: '蓝色属性在本产品语境中普遍不适用，但需先查看受影响词', confidence: 58, risk: '高', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 1), ppcBid: 0.98, titleDensity: 12, demandSupplyRatio: 0.7,
  },
  {
    keyword: 'front door greenery decor', translation: '前门绿植装饰', match: '强匹配', relevanceScore: 89,
    relevanceReason: '场景、外观与产品用途三项覆盖', monthlySearchVolume: 6400, abaRank: 6060,
    competitorCoverage: 11, competitorTotal: 20, trafficTypes: ['自然', 'SP', '视频'], root: 'front door', category: '使用场景词', intent: '购买型',
    suggestedAction: '精准投放', suggestionReason: '购买场景明确，建议精准承接', confidence: 84, risk: '低', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 3), ppcBid: 1.72, titleDensity: 13, demandSupplyRatio: 2.4,
  },
  {
    keyword: 'fake plant wall panel', translation: '仿真植物墙板', match: '弱匹配', relevanceScore: 27,
    relevanceReason: '人工绿植概念相邻，但产品不是墙板', monthlySearchVolume: 7200, abaRank: 8950,
    competitorCoverage: 1, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'artificial', category: '泛词', intent: '品类冲突',
    suggestedAction: '否定精准', suggestionReason: '完整词指向墙板品类，排除整词即可避免误杀 artificial 相关长尾', confidence: 75, risk: '低', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 1), ppcBid: 1.05, titleDensity: 15, demandSupplyRatio: 1.0,
  },
  {
    keyword: 'summer front door wreath', translation: '夏季前门花环', match: '中匹配', relevanceScore: 73,
    relevanceReason: '季节与场景均有覆盖，产品支持四季展示', monthlySearchVolume: 3900, abaRank: 9720,
    competitorCoverage: 8, competitorTotal: 20, trafficTypes: ['自然', 'SP'], root: 'front door', category: '季节/节日词', intent: '场景探索',
    suggestedAction: '精准投放', suggestionReason: '场景和季节都可验证，建议以精准测试相邻表达', confidence: 66, risk: '中', approvalStatus: '待审批',
    sourceAsins: sourceAsins.slice(0, 2), ppcBid: 1.16, titleDensity: 10, demandSupplyRatio: 1.8,
  },
]

export const mockKeywords: KeywordRecord[] = keywordSeeds.map((item, index) => ({
  ...item,
  id: `kw-${String(index + 1).padStart(3, '0')}`,
  lastUpdated: `2026-08-${String(27 - Math.floor(index / 7)).padStart(2, '0')}`,
}))

export const mockBatches: ImportBatch[] = [
  {
    id: 'batch-20260827-793919', productId: mockProduct.id,
    fileName: 'seller-sprite-demo-batch.xlsx', createdAt: '2026-08-27 14:32',
    sourceAsins, totalRows: 2000, addedRows: 2000, updatedRows: 0, skippedRows: 0, errorRows: 0, status: '已完成',
  },
  {
    id: 'batch-20260820-771104', productId: mockProduct.id,
    fileName: 'seller-sprite-demo-previous-batch.xlsx', createdAt: '2026-08-20 09:18',
    sourceAsins: sourceAsins.slice(0, 4), totalRows: 1894, addedRows: 1894, updatedRows: 0, skippedRows: 0, errorRows: 0, status: '已完成',
  },
]

export const mockFieldMappings: FieldMapping[] = [
  { source: '关键词', target: 'keyword_raw', status: '已识别', sample: 'artificial boxwood wreath' },
  { source: '关键词翻译', target: 'keyword_translation', status: '已识别', sample: '人造黄杨木花环' },
  { source: '流量词类型', target: 'traffic_types', status: '已识别', sample: '自然 / SP' },
  { source: '相关产品', target: 'related_product_count', status: '已识别', sample: '18' },
  { source: '相关ASIN', target: 'related_asins', status: '已识别', sample: 'B0SAMPLE01 / B0SAMPLE02' },
  { source: 'ABA周排名', target: 'aba_weekly_rank', status: '已识别', sample: '2,220' },
  { source: '月搜索量', target: 'monthly_search_volume', status: '已识别', sample: '14,800' },
  { source: 'PPC竞价', target: 'ppc_bid', status: '需确认', sample: '$2.38' },
  { source: 'AC推荐词', target: 'raw_extension.ac_recommendation', status: '需确认', sample: '79' },
  { source: '前十ASIN', target: 'raw_extension.top_10_asins', status: '忽略', sample: 'B0SAMPLE01, …' },
]

export const mockApi = {
  getProducts: async (): Promise<Product[]> => [mockProduct],
  getKeywords: async (): Promise<KeywordRecord[]> => mockKeywords,
  getBatches: async (): Promise<ImportBatch[]> => mockBatches,
  getFieldMappings: async (): Promise<FieldMapping[]> => mockFieldMappings,
}
