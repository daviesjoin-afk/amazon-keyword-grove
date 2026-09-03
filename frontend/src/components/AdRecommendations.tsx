import { CheckCircle2, Download, Eye, FileDown, Megaphone, RefreshCw, ShieldAlert, Target, Waves } from 'lucide-react'
import type { SemanticReviewStatus } from '../api/client'
import type { KeywordRecord, Product, SuggestedAction } from '../types'
import { ConfidencePill } from './StatusPill'
import { relevanceRatio } from '../keywordMetrics'
import { useI18n } from '../i18n'

interface AdRecommendationsProps {
  product: Product
  keywords: KeywordRecord[]
  onSelectKeyword: (keyword: KeywordRecord) => void
  onSemanticReview: () => Promise<void>
  semanticReviewing: boolean
  reviewProgress: SemanticReviewStatus | null
}

type RecommendationGroup = {
  key: SuggestedAction
  title: string
  eyebrow: string
  description: string
  icon: typeof Target
  tone: 'exact' | 'broad' | 'negative-exact' | 'negative-phrase'
}

export function AdRecommendations({ product, keywords, onSelectKeyword, onSemanticReview, semanticReviewing, reviewProgress }: AdRecommendationsProps) {
  const { text, numberLocale } = useI18n()
  const groups: RecommendationGroup[] = [
    { key: '精准投放', title: text('精准投放', 'Exact targeting'), eyebrow: 'Exact targeting', description: text('高意向长尾与明确属性词，按搜索词原样承接。', 'High-intent long-tail and explicit attribute queries, kept as exact search terms.'), icon: Target, tone: 'exact' },
    { key: '广泛探索', title: text('广泛投放', 'Broad targeting'), eyebrow: 'Broad roots', description: text('只保留产品级核心词根，用于发现新的搜索组合。', 'Only constrained product-level core roots are allowed for search-term discovery.'), icon: Waves, tone: 'broad' },
    { key: '否定精准', title: text('否定精准', 'Negative exact'), eyebrow: 'Negative exact', description: text('完整搜索词不适配产品，只排除这一条搜索词。', 'The complete query is incompatible; exclude only that exact search term.'), icon: ShieldAlert, tone: 'negative-exact' },
    { key: '否定词组', title: text('否定词组', 'Negative phrase'), eyebrow: 'Negative phrase', description: text('同一无效词根已通过误伤检查，仍需人工确认后使用。', 'A repeated invalid phrase root passed conflict checks, but still requires human approval.'), icon: ShieldAlert, tone: 'negative-phrase' },
  ]

  const productReview = reviewProgress && String(reviewProgress.product_id) === product.id ? reviewProgress : null
  const total = productReview?.total ?? keywords.length
  const pending = productReview?.pending ?? keywords.filter((keyword) => !keyword.semanticReviewed).length
  const reviewed = productReview?.reviewed ?? total - pending
  const pendingBroad = keywords.filter((keyword) => !keyword.semanticReviewed && keyword.suggestedAction === '广泛探索').length
  const pendingNegativePhrase = keywords.filter((keyword) => !keyword.semanticReviewed && keyword.suggestedAction === '否定词组').length

  function download(group: RecommendationGroup, rows: KeywordRecord[]) {
    const headers = [
      text('关键词', 'Keyword'),
      text('相关性（竞品占比）', 'Relevance (competitor coverage)'),
      text('语义评分', 'Semantic score'),
      text('置信度', 'Confidence'),
      text('风险', 'Risk'),
      text('理由', 'Reason'),
      text('月搜索量', 'Monthly search volume'),
    ]
    const values = rows.map((item) => [item.keyword, relevanceRatio(item), item.relevanceScore, item.confidence, item.risk, item.suggestionReason, item.monthlySearchVolume ?? ''])
    const csv = [headers, ...values].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    link.download = `${product.name}-${group.title}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const statusDetail = semanticReviewing && productReview
    ? text(
        `正在处理第 ${Math.min(productReview.batches_completed + 1, productReview.batches_total)} / ${productReview.batches_total} 批（已完成 ${productReview.batches_completed} 批）`,
        `Processing batch ${Math.min(productReview.batches_completed + 1, productReview.batches_total)} / ${productReview.batches_total} (${productReview.batches_completed} completed)`,
      )
    : productReview?.status === 'partial'
      ? text(`审核完成但有 ${productReview.failed_batches.length} 批失败，可继续增量重试`, `Review completed with ${productReview.failed_batches.length} failed batch(es); incremental retry is available`)
      : productReview?.status === 'failed'
        ? text(`审核失败：${productReview.error || '请检查 AI 设置'}`, `Review failed: ${productReview.error || 'check AI settings'}`)
        : pending
          ? text(`待 MiMo 二审 ${pending.toLocaleString(numberLocale)} 条`, `${pending.toLocaleString(numberLocale)} awaiting MiMo review`)
          : text('双重审核完成，已形成建议', 'Two-stage review complete; recommendations are ready')

  return <div className="ad-recommendation-page">
    <header className="ad-recommendation-head">
      <div><span className="panel-kicker">{text('Advertising playbook / 双重审核', 'Advertising playbook / Two-stage review')}</span><h1>{text('广告建议', 'Ad Suggestions')}</h1><p>{text('内置规则先筛选，MiMo 再结合标题、五点和词根做语义复核。这里仅展示可导出的最终动作草稿。', 'Deterministic rules screen first; MiMo then reviews title, bullets, roots, and rule evidence. Only exportable final-action drafts appear here.')}</p></div>
      <div className="ad-recommendation-actions"><button className="button button-primary compact-button" type="button" disabled={semanticReviewing || pending === 0} title={text('一次处理全部尚未完成 MiMo 二审的关键词；服务端按有界批次并发调用，不重复审核已完成结果', 'Review all keywords still pending MiMo review using bounded concurrent batches without reprocessing completed results')} onClick={() => void onSemanticReview()}><RefreshCw size={15} />{semanticReviewing ? text('增量审核中…', 'Reviewing…') : pending ? text('增量审核', 'Incremental review') : text('已全部审核', 'All reviewed')}</button><div className="ad-review-status"><span className={pending ? 'status-dot status-dot-pending' : 'status-dot status-dot-live'} /><strong>{text(`已审核 ${reviewed.toLocaleString(numberLocale)} / ${total.toLocaleString(numberLocale)}`, `Reviewed ${reviewed.toLocaleString(numberLocale)} / ${total.toLocaleString(numberLocale)}`)}</strong><span>{statusDetail}</span></div></div>
    </header>
    {pending > 0 && <div className="ad-pending-banner"><Eye size={17} /><span>{semanticReviewing && productReview ? <>{text('MiMo 正在审核：已完成', 'MiMo review in progress:')} <strong>{productReview.batches_completed}</strong> / <strong>{productReview.batches_total}</strong> {text('批，已审核', 'batches; reviewed')} <strong>{reviewed.toLocaleString(numberLocale)} / {total.toLocaleString(numberLocale)}</strong>. {text('页面刷新后会自动恢复进度。', 'Progress is restored after refresh.')}</> : <>{text('当前还有', 'There are')} <strong>{pending.toLocaleString(numberLocale)}</strong> {text('条只有内置规则预审，暂不进入四类导出清单。规则预审已标出', 'keywords with deterministic pre-review only; they are excluded from export lists. Rule pre-review currently marks')} <strong>{pendingBroad.toLocaleString(numberLocale)}</strong> {text('条广泛候选、', 'broad candidate(s) and')} <strong>{pendingNegativePhrase.toLocaleString(numberLocale)}</strong> {text('条否定词组候选；点击“增量审核”可继续处理。', 'negative-phrase candidate(s). Run incremental review to continue.')}</>}</span></div>}
    <div className="ad-recommendation-grid">
      {groups.map((group) => {
        const rows = keywords.filter((item) => item.suggestedAction === group.key && item.semanticReviewed).sort((left, right) => (right.monthlySearchVolume ?? -1) - (left.monthlySearchVolume ?? -1))
        const Icon = group.icon
        return <section className={`ad-recommendation-card ad-tone-${group.tone}`} key={group.key}>
          <div className="ad-card-head"><div className="ad-card-title"><span className="ad-card-icon"><Icon size={17} /></span><div><span className="panel-kicker">{group.eyebrow}</span><h2>{group.title}</h2></div></div><button className="icon-button small" type="button" title={text(`下载${group.title}建议`, `Download ${group.title} suggestions`)} aria-label={text(`下载${group.title}建议`, `Download ${group.title} suggestions`)} onClick={() => download(group, rows)}><Download size={15} /></button></div>
          <p className="ad-card-description">{group.description}</p>
          <div className="ad-card-meta"><strong>{rows.length.toLocaleString(numberLocale)}</strong><span>{text('条建议词', 'suggestions')}</span><button className="text-button" type="button" onClick={() => download(group, rows)}><FileDown size={13} />{text('下载 CSV', 'Download CSV')}</button></div>
          <div className="ad-suggestion-list">{rows.length ? rows.map((item) => <button className="ad-suggestion-row" type="button" key={item.id} onClick={() => onSelectKeyword(item)}><span className="ad-suggestion-main"><strong>{item.keyword}</strong><small>{item.suggestionReason.replace(/^MiMo 语义审核：/, '')}</small></span><span className="ad-suggestion-metric"><b>{relevanceRatio(item)}</b><small>{text('相关性', 'relevance')}</small></span><ConfidencePill value={item.confidence} /></button>) : <div className="ad-empty"><CheckCircle2 size={17} /><span>{pending > 0 ? text('完成 MiMo 二审后，符合条件的建议会显示在这里。', 'Eligible suggestions will appear here after MiMo review.') : text('本次双重审核没有通过该动作的安全门槛，当前无可导出建议词。', 'No keyword passed the safety threshold for this action in the current two-stage review.')}</span></div>}</div>
        </section>
      })}
    </div>
    <div className="ad-footer-note"><Megaphone size={15} /><span>{text('下载内容是广告工作流草稿，不会自动连接或修改 Amazon。否定词组必须结合受影响关键词人工确认后再使用。', 'Downloads are advertising-workflow drafts and never modify Amazon. Negative phrases require manual review of potentially affected queries before use.')}</span></div>
  </div>
}
