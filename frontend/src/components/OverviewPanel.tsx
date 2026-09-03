import { ArrowUpRight, CheckCircle2, ChevronRight, CircleHelp, Database, FileCheck2, Hash, Layers3, Megaphone, ShieldAlert, Sparkles, Target, TrendingUp, UsersRound } from 'lucide-react'
import type { ImportBatch, KeywordRecord, Product } from '../types'
import { ActionPill, MatchPill } from './StatusPill'
import { relevanceRatio } from '../keywordMetrics'

interface OverviewPanelProps {
  product: Product
  keywords: KeywordRecord[]
  batches: ImportBatch[]
  onOpenKeywords: () => void
  onOpenImport: () => void
  onSelectKeyword: (keyword: KeywordRecord) => void
}

export function OverviewPanel({ product, keywords, batches, onOpenKeywords, onOpenImport, onSelectKeyword }: OverviewPanelProps) {
  const rootCounts = new Map<string, number>()
  keywords.forEach((keyword) => rootCounts.set(keyword.root, (rootCounts.get(keyword.root) || 0) + 1))
  const displayRoots = [
    ...product.roots.filter((root) => rootCounts.has(root)),
    ...[...rootCounts.keys()]
      .filter((root) => !product.roots.includes(root))
      .sort((left, right) => (rootCounts.get(right) || 0) - (rootCounts.get(left) || 0)),
  ].slice(0, 7)
  const actionCounts = [
    { label: '精准承接', value: '精准投放', count: keywords.filter((item) => item.suggestedAction === '精准投放').length, color: 'green' },
    { label: '广泛抓词根', value: '广泛探索', count: keywords.filter((item) => item.suggestedAction === '广泛探索').length, color: 'green-soft' },
    { label: '观察 / 暂不投放', value: '观察', count: keywords.filter((item) => item.suggestedAction === '观察').length, color: 'amber' },
    { label: '待人工复核', value: '人工复核', count: keywords.filter((item) => item.suggestedAction === '人工复核').length, color: 'navy' },
    { label: '否定草稿', value: '否定精准', count: keywords.filter((item) => item.suggestedAction === '否定精准' || item.suggestedAction === '否定词组').length, color: 'red' },
  ] as const
  const maxActionCount = Math.max(1, ...actionCounts.map((item) => item.count))
  const topKeywords = keywords.filter((item) => item.match === '强匹配').sort((left, right) => (right.monthlySearchVolume ?? -1) - (left.monthlySearchVolume ?? -1)).slice(0, 4)
  const broadRoots = [...new Set([...product.coreTerms, ...product.roots])]
    .map((root) => {
      const related = keywords.filter((keyword) => keyword.root === root && (keyword.match === '强匹配' || keyword.match === '中匹配') && keyword.risk !== '高')
      return { root, count: related.length, volume: related.reduce((sum, keyword) => sum + (keyword.monthlySearchVolume || 0), 0), score: related.reduce((sum, keyword) => sum + keyword.relevanceScore, 0) }
    })
    .filter((item) => item.count > 0)
    .sort((left, right) => {
      const leftPriority = product.coreTerms.indexOf(left.root)
      const rightPriority = product.coreTerms.indexOf(right.root)
      if (leftPriority !== -1 || rightPriority !== -1) return (leftPriority === -1 ? 99 : leftPriority) - (rightPriority === -1 ? 99 : rightPriority)
      return right.score - left.score
    })
    .slice(0, 10)

  return (
    <div className="overview-layout">
      <section className="overview-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" />竞品反查项目 / US</div>
          <h1>{product.name}</h1>
          <p>以 20 个竞品 ASIN 建立关键词基线，优先识别可承接的高意图词，再把探索流量与否定风险分开管理。</p>
          <div className="product-context-row">
            <span className="context-token"><span className="token-label">参考 ASIN</span><code>{product.referenceAsin}</code></span>
            <span className="context-token"><span className="token-label">站点</span>{product.site}</span>
            <span className="context-token"><span className="token-label">语料</span>{product.language}</span>
          </div>
          <div className="hero-actions">
            <button className="button button-primary" type="button" onClick={onOpenKeywords}><Target size={16} />进入关键词库<ArrowUpRight size={15} /></button>
            <button className="button button-secondary" type="button" onClick={onOpenImport}><Database size={16} />导入新批次</button>
          </div>
        </div>
        <div className="hero-grove" aria-label="关键词覆盖树示意图">
          <div className="grove-ring grove-ring-back" />
          <div className="grove-ring grove-ring-front" />
          <span className="grove-leaf leaf-a" /><span className="grove-leaf leaf-b" /><span className="grove-leaf leaf-c" />
          <div className="grove-core"><span>20</span><small>竞品 ASIN</small></div>
          <div className="grove-legend"><span><i className="legend-dot legend-green" />覆盖来源</span><span><i className="legend-dot legend-navy" />关键词资产</span></div>
        </div>
      </section>

      <section className="metric-strip" aria-label="词库关键指标">
        <MetricCard label="关键词总量" value={product.keywordTotal.toLocaleString('en-US')} note="去重后" icon={<Hash size={16} />} accent="green" />
        <MetricCard label="强匹配" value={product.strongCount.toLocaleString('en-US')} note={`${Math.round(product.strongCount / product.keywordTotal * 100)}% 的词库`} icon={<CheckCircle2 size={16} />} accent="green" />
        <MetricCard label="竞品覆盖" value={`${product.sourceCount} / 20`} note="本批次来源 ASIN" icon={<UsersRound size={16} />} accent="navy" />
        <MetricCard label="数据完整度" value={`${product.importHealth}%`} note="关键指标可用" icon={<FileCheck2 size={16} />} accent="amber" />
      </section>

      <div className="overview-grid">
        <section className="panel action-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">投放编排</span><h2>广告建议分布</h2></div>
            <button className="text-button" type="button" onClick={onOpenKeywords}>查看全部 <ChevronRight size={14} /></button>
          </div>
          <div className="action-bars">
            {actionCounts.map((item) => <div className="action-bar-row" key={item.value}>
              <div className="action-bar-meta"><span>{item.label}</span><strong>{item.count}</strong></div>
              <div className="action-bar-track"><span className={`action-bar-fill fill-${item.color}`} style={{ width: `${item.count ? Math.max(6, item.count / maxActionCount * 100) : 0}%` }} /></div>
            </div>)}
          </div>
          <div className="panel-footnote"><CircleHelp size={14} />建议只作为草稿，确认后再导出至广告工作流。此工具不会自动连接 Amazon。</div>
        </section>

        <section className="panel root-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">语义结构</span><h2>高频词根轨道</h2></div>
            <button className="icon-button small" type="button" aria-label="打开词根分析" onClick={onOpenKeywords}><ArrowUpRight size={15} /></button>
          </div>
          <div className="root-track-list">
            {displayRoots.map((root, index) => <div className="root-track-item" key={root}>
              <span className="root-node"><span>{String(index + 1).padStart(2, '0')}</span></span>
              <div className="root-track-label"><strong>{root}</strong><span>{(rootCounts.get(root) || 0).toLocaleString('en-US')} 条相关词</span></div>
              <span className="root-track-share">{Math.round((rootCounts.get(root) || 0) / Math.max(1, keywords.length) * 100)}%</span>
            </div>)}
          </div>
          <div className="root-panel-legend"><span><i className="branch-line" />以当前筛选范围统计</span><span><TrendingUp size={13} />按出现频次排序</span></div>
        </section>

        <section className="panel top-keyword-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">下一步优先级</span><h2>高意图关键词</h2></div>
            <span className="count-badge">{topKeywords.length} 条示例</span>
          </div>
          <div className="mini-keyword-list">
            {topKeywords.map((keyword) => <button className="mini-keyword-row" type="button" key={keyword.id} onClick={() => onSelectKeyword(keyword)}>
              <div><strong>{keyword.keyword}</strong><span>{keyword.relevanceReason}</span></div><div className="mini-keyword-score"><b>{relevanceRatio(keyword)}</b><small>相关性</small></div>
            </button>)}
          </div>
          <button className="panel-link-row" type="button" onClick={onOpenKeywords}>打开强匹配筛选 <ArrowUpRight size={14} /></button>
        </section>

        <section className="panel broad-root-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Broad control / 广泛控制</span><h2>广泛抓词根池</h2></div><span className="count-badge">{broadRoots.length} / 5–10 个</span></div>
          <p className="broad-root-intro"><Megaphone size={15} />投放仅保留精准和广泛：广泛只投产品级词根；属性长尾、季节词和低相关词保留在精准测试或观察，不直接放入广泛。</p>
          <div className="broad-root-list">{broadRoots.map((item) => <div className="broad-root-chip" key={item.root}><strong>{item.root}</strong><span>{item.count} 条强/中相关 · {item.volume.toLocaleString('en-US')} 月搜</span></div>)}</div>
          <div className="panel-footnote"><CircleHelp size={14} />建议至少保留 5 个、最多 10 个；不足 5 个时先补充产品资料中的核心词根，不用低相关词凑数。</div>
        </section>

        <section className="panel import-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">数据脉络</span><h2>最近导入</h2></div>
            <span className="sync-label"><span className="status-dot status-dot-live" />本地记录</span>
          </div>
          <div className="import-summary"><strong>{batches[0]?.fileName || '尚未导入文件'}</strong><span>{batches[0]?.createdAt || '上传文件后显示记录'}</span></div>
          <div className="import-result-grid"><span><b>+{batches[0]?.addedRows.toLocaleString('en-US') || '0'}</b>新增</span><span><b>{batches[0]?.updatedRows || 0}</b>更新</span><span><b>{batches[0]?.errorRows || 0}</b>错误</span></div>
          <div className="import-health"><span>字段识别完整度</span><strong>{product.importHealth}%</strong><div className="health-track"><span style={{ width: `${product.importHealth}%` }} /></div></div>
          <button className="panel-link-row" type="button" onClick={onOpenImport}>查看导入向导 <ArrowUpRight size={14} /></button>
        </section>
      </div>
    </div>
  )
}

function MetricCard({ label, value, note, icon, accent }: { label: string; value: string; note: string; icon: React.ReactNode; accent: 'green' | 'navy' | 'amber' }) {
  return <div className={`metric-card metric-${accent}`}><div className="metric-card-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></div>
}
