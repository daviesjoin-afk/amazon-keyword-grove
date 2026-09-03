import { BrainCircuit, Download, FileClock, LayoutDashboard, Library, Megaphone, Settings2, Split, TreePine, Upload } from 'lucide-react'
import { useState } from 'react'
import type { SemanticReviewStatus } from '../api/client'
import type { ImportBatch, KeywordRecord, Product, ProductCopyPayload } from '../types'
import { useI18n } from '../i18n'
import { ImportHistory } from './ImportHistory'
import { KeywordLibrary } from './KeywordLibrary'
import { OverviewPanel } from './OverviewPanel'
import { ProductSettings } from './ProductSettings'
import { RootAnalysis } from './RootAnalysis'
import { AdRecommendations } from './AdRecommendations'

export type WorkbenchTab = 'overview' | 'keywords' | 'roots' | 'ads' | 'imports' | 'settings'

interface WorkbenchProps {
  product: Product
  keywords: KeywordRecord[]
  batches: ImportBatch[]
  onOpenImport: () => void
  onSelectKeyword: (keyword: KeywordRecord) => void
  onUpdateKeywords: (ids: string[], patch: Partial<KeywordRecord>) => void
  onSaveProduct: (payload: ProductCopyPayload) => Promise<void>
  onExport: () => void
  onSemanticReview: () => Promise<void>
  semanticReviewing: boolean
  reviewProgress: SemanticReviewStatus | null
}

export function Workbench({ product, keywords, batches, onOpenImport, onSelectKeyword, onUpdateKeywords, onSaveProduct, onExport, onSemanticReview, semanticReviewing, reviewProgress }: WorkbenchProps) {
  const { text, numberLocale } = useI18n()
  const [tab, setTab] = useState<WorkbenchTab>('overview')
  const hasKeywords = product.keywordTotal > 0 || keywords.length > 0
  const reviewButtonLabel = semanticReviewing && reviewProgress
    ? text(
        `MiMo 审核中 ${reviewProgress.reviewed.toLocaleString(numberLocale)} / ${reviewProgress.total.toLocaleString(numberLocale)}`,
        `MiMo reviewing ${reviewProgress.reviewed.toLocaleString(numberLocale)} / ${reviewProgress.total.toLocaleString(numberLocale)}`,
      )
    : hasKeywords ? text('MiMo 全量审核', 'Run MiMo review') : text('暂无关键词', 'No keywords')
  const reviewButtonTitle = hasKeywords
    ? text(
        '发送当前产品资料与全部关键词到 MiMo，分批生成投放和否词草稿；人工锁定结果只记录审核不覆盖',
        'Send the current product context and keywords to MiMo in bounded batches. Manual locks are reviewed but never overwritten.',
      )
    : text('请先导入关键词表，再进行 MiMo 语义审核', 'Import a keyword sheet before running MiMo semantic review')

  return <div className="workbench-page">
    <div className="workbench-head">
      <div className="workbench-product">
        <div className="product-symbol"><TreePine size={21} /></div>
        <div>
          <div className="workbench-kicker"><span className="status-dot status-dot-live" />{text('产品工作台', 'Product workbench')} <span className="slash">/</span> {product.site}</div>
          <h1>{product.name}</h1>
          <div className="workbench-submeta">
            <span>{text('竞品参考', 'Competitor reference')} <code>{product.referenceAsin}</code></span><span>·</span><span>{product.category}</span><span className="reference-badge">{text('竞品样本', 'Competitor sample')}</span>
          </div>
        </div>
      </div>
      <div className="workbench-actions">
        <button className="button button-secondary compact-button" type="button" disabled={semanticReviewing || !hasKeywords} title={reviewButtonTitle} onClick={() => void onSemanticReview()}><BrainCircuit size={15} />{reviewButtonLabel}</button>
        <button className="button button-secondary compact-button" type="button" onClick={onExport}><Download size={15} />{text('导出', 'Export')}</button>
        <button className="button button-primary compact-button" type="button" onClick={onOpenImport}><Upload size={15} />{text('导入新批次', 'Import batch')}</button>
      </div>
    </div>
    <nav className="workbench-tabs" aria-label={text('产品工作台分页', 'Product workbench tabs')}>
      <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} icon={<LayoutDashboard size={15} />}>{text('概览', 'Overview')}</TabButton>
      <TabButton active={tab === 'keywords'} onClick={() => setTab('keywords')} icon={<Library size={15} />}>{text('关键词库', 'Keyword Library')} <span>{product.keywordTotal.toLocaleString(numberLocale)}</span></TabButton>
      <TabButton active={tab === 'roots'} onClick={() => setTab('roots')} icon={<Split size={15} />}>{text('词根分析', 'Root Analysis')}</TabButton>
      <TabButton active={tab === 'ads'} onClick={() => setTab('ads')} icon={<Megaphone size={15} />}>{text('广告建议', 'Ad Suggestions')}</TabButton>
      <TabButton active={tab === 'imports'} onClick={() => setTab('imports')} icon={<FileClock size={15} />}>{text('导入记录', 'Import History')} <span>{batches.length}</span></TabButton>
      <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon={<Settings2 size={15} />}>{text('产品资料', 'Product Details')}</TabButton>
    </nav>
    {tab === 'overview' && <OverviewPanel product={product} keywords={keywords} batches={batches} onOpenKeywords={() => setTab('keywords')} onOpenImport={onOpenImport} onSelectKeyword={onSelectKeyword} />}
    {tab === 'keywords' && <KeywordLibrary product={product} keywords={keywords} onSelectKeyword={onSelectKeyword} onUpdateKeywords={onUpdateKeywords} onExport={onExport} />}
    {tab === 'roots' && <RootAnalysis product={product} keywords={keywords} onSelectKeyword={onSelectKeyword} />}
    {tab === 'ads' && <AdRecommendations product={product} keywords={keywords} onSelectKeyword={onSelectKeyword} onSemanticReview={onSemanticReview} semanticReviewing={semanticReviewing} reviewProgress={reviewProgress} />}
    {tab === 'imports' && <ImportHistory batches={batches} onOpenImport={onOpenImport} />}
    {tab === 'settings' && <ProductSettings product={product} onSaveProduct={onSaveProduct} />}
  </div>
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button className={`workbench-tab ${active ? 'is-active' : ''}`} type="button" onClick={onClick} aria-current={active ? 'page' : undefined}>{icon}<span>{children}</span>{active && <i />}</button>
}
