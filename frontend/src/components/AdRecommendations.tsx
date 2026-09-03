import { CheckCircle2, Download, Eye, FileDown, Megaphone, RefreshCw, ShieldAlert, Target, Waves } from 'lucide-react'
import type { KeywordRecord, Product, SuggestedAction } from '../types'
import { ConfidencePill } from './StatusPill'

interface AdRecommendationsProps {
  product: Product
  keywords: KeywordRecord[]
  onSelectKeyword: (keyword: KeywordRecord) => void
  onSemanticReview: () => Promise<void>
  semanticReviewing: boolean
}

type RecommendationGroup = {
  key: SuggestedAction
  title: string
  eyebrow: string
  description: string
  icon: typeof Target
  tone: 'exact' | 'broad' | 'negative-exact' | 'negative-phrase'
}

const groups: RecommendationGroup[] = [
  { key: '精准投放', title: '精准投放', eyebrow: 'Exact targeting', description: '高意向长尾与明确属性词，按搜索词原样承接。', icon: Target, tone: 'exact' },
  { key: '广泛探索', title: '广泛投放', eyebrow: 'Broad roots', description: '只保留产品级核心词根，用于发现新的搜索组合。', icon: Waves, tone: 'broad' },
  { key: '否定精准', title: '否定精准', eyebrow: 'Negative exact', description: '完整搜索词不适配产品，只排除这一条搜索词。', icon: ShieldAlert, tone: 'negative-exact' },
  { key: '否定词组', title: '否定词组', eyebrow: 'Negative phrase', description: '同一无效词根已通过误伤检查，仍需人工确认后使用。', icon: ShieldAlert, tone: 'negative-phrase' },
]

export function AdRecommendations({ product, keywords, onSelectKeyword, onSemanticReview, semanticReviewing }: AdRecommendationsProps) {
  const total = keywords.length
  const pending = keywords.filter((keyword) => !keyword.semanticReviewed).length
  const reviewed = keywords.length - pending
  const pendingBroad = keywords.filter((keyword) => !keyword.semanticReviewed && keyword.suggestedAction === '广泛探索').length
  const pendingNegativePhrase = keywords.filter((keyword) => !keyword.semanticReviewed && keyword.suggestedAction === '否定词组').length

  function download(group: RecommendationGroup, rows: KeywordRecord[]) {
    const headers = ['关键词', '相关性', '置信度', '风险', '理由', '竞品覆盖', '月搜索量']
    const values = rows.map((item) => [item.keyword, item.relevanceScore, item.confidence, item.risk, item.suggestionReason, `${item.competitorCoverage}/${item.competitorTotal}`, item.monthlySearchVolume ?? ''])
    const csv = [headers, ...values].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    link.download = `${product.name}-${group.title}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return <div className="ad-recommendation-page">
    <header className="ad-recommendation-head">
      <div><span className="panel-kicker">Advertising playbook / 双重审核</span><h1>广告建议</h1><p>内置规则先筛选，MiMo 再结合标题、五点和词根做语义复核。这里仅展示可导出的最终动作草稿。</p></div>
      <div className="ad-recommendation-actions"><button className="button button-primary compact-button" type="button" disabled={semanticReviewing || pending === 0} title="一次处理全部尚未完成 MiMo 二审的关键词；服务端按 40 条一批并发调用，不重复审核已完成结果" onClick={() => void onSemanticReview()}><RefreshCw size={15} />{semanticReviewing ? '增量审核中…' : pending ? '增量审核' : '已全部审核'}</button><div className="ad-review-status"><span className={pending ? 'status-dot status-dot-pending' : 'status-dot status-dot-live'} /><strong>已审核 {reviewed.toLocaleString('en-US')} / {total.toLocaleString('en-US')}</strong><span>{pending ? `待 MiMo 二审 ${pending.toLocaleString('en-US')} 条` : '双重审核完成，已形成建议'}</span></div></div>
    </header>
    {pending > 0 && <div className="ad-pending-banner"><Eye size={17} /><span>当前还有 <strong>{pending.toLocaleString('en-US')}</strong> 条只有内置规则预审，暂不进入四类导出清单。规则预审已标出 <strong>{pendingBroad.toLocaleString('en-US')}</strong> 条广泛候选、<strong>{pendingNegativePhrase.toLocaleString('en-US')}</strong> 条否定词组候选；返回工作台点击“MiMo 全量审核”后刷新本页。</span></div>}
    <div className="ad-recommendation-grid">
      {groups.map((group) => {
        const rows = keywords.filter((item) => item.suggestedAction === group.key && item.semanticReviewed).sort((left, right) => (right.monthlySearchVolume ?? -1) - (left.monthlySearchVolume ?? -1))
        const Icon = group.icon
        return <section className={`ad-recommendation-card ad-tone-${group.tone}`} key={group.key}>
          <div className="ad-card-head"><div className="ad-card-title"><span className="ad-card-icon"><Icon size={17} /></span><div><span className="panel-kicker">{group.eyebrow}</span><h2>{group.title}</h2></div></div><button className="icon-button small" type="button" title={`下载${group.title}建议`} aria-label={`下载${group.title}建议`} onClick={() => download(group, rows)}><Download size={15} /></button></div>
          <p className="ad-card-description">{group.description}</p>
          <div className="ad-card-meta"><strong>{rows.length.toLocaleString('en-US')}</strong><span>条建议词</span><button className="text-button" type="button" onClick={() => download(group, rows)}><FileDown size={13} />下载 CSV</button></div>
          <div className="ad-suggestion-list">{rows.length ? rows.map((item) => <button className="ad-suggestion-row" type="button" key={item.id} onClick={() => onSelectKeyword(item)}><span className="ad-suggestion-main"><strong>{item.keyword}</strong><small>{item.suggestionReason.replace(/^MiMo 语义审核：/, '')}</small></span><span className="ad-suggestion-metric"><b>{item.relevanceScore}</b><small>相关性</small></span><ConfidencePill value={item.confidence} /></button>) : <div className="ad-empty"><CheckCircle2 size={17} /><span>{pending > 0 ? '完成 MiMo 二审后，符合条件的建议会显示在这里。' : '本次双重审核没有通过该动作的安全门槛，当前无可导出建议词。'}</span></div>}</div>
        </section>
      })}
    </div>
    <div className="ad-footer-note"><Megaphone size={15} /><span>下载内容是广告工作流草稿，不会自动连接或修改 Amazon。否定词组必须结合受影响关键词人工确认后再使用。</span></div>
  </div>
}
