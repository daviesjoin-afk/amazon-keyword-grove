import { ArrowUpRight, BarChart3, Check, ChevronRight, Hash, Search, ShieldAlert, Tag, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { KeywordRecord, Product } from '../types'
import { relevanceRatio } from '../keywordMetrics'

interface RootAnalysisProps {
  product: Product
  keywords: KeywordRecord[]
  onSelectKeyword: (keyword: KeywordRecord) => void
}

export function RootAnalysis({ product, keywords, onSelectKeyword }: RootAnalysisProps) {
  const [selectedRoot, setSelectedRoot] = useState(product.roots[0] || 'wreath')
  const [query, setQuery] = useState('')
  const availableRoots = useMemo(() => {
    const counts = new Map<string, number>()
    keywords.forEach((keyword) => counts.set(keyword.root, (counts.get(keyword.root) || 0) + 1))
    return [
      ...product.roots.filter((root) => counts.has(root)),
      ...[...counts.keys()].filter((root) => !product.roots.includes(root)).sort((left, right) => (counts.get(right) || 0) - (counts.get(left) || 0)),
    ]
  }, [keywords, product.roots])
  const activeRoot = availableRoots.includes(selectedRoot) ? selectedRoot : availableRoots[0] || selectedRoot
  const rootStats = useMemo(() => availableRoots.map((root) => {
    const items = keywords.filter((item) => item.root === root)
    const volume = items.reduce((sum, item) => sum + (item.monthlySearchVolume || 0), 0)
    const avgCoverage = items.length ? Math.round(items.reduce((sum, item) => sum + item.competitorCoverage, 0) / items.length) : 0
    const coverageTotal = items.length ? items[0].competitorTotal : 0
    return { root, count: items.length, volume, avgCoverage, coverageTotal }
  }), [keywords, availableRoots])
  const selectedKeywords = keywords
    .filter((item) => item.root === activeRoot && (!query || item.keyword.includes(query.toLowerCase())))
    .sort((left, right) => (right.monthlySearchVolume ?? -1) - (left.monthlySearchVolume ?? -1))
  const selectedStat = rootStats.find((item) => item.root === activeRoot) || rootStats[0]

  return <div className="root-analysis-layout"><section className="root-analysis-main"><div className="library-title-row"><div><span className="panel-kicker">Root intelligence / 当前产品</span><h1>词根分析</h1></div><span className="sample-label">按当前 {keywords.length} 条演示样本统计</span></div><div className="root-summary-grid"><div className="root-summary-card"><span><Hash size={15} />选中词根</span><strong>{selectedRoot}</strong><small>用于筛选长尾组合</small></div><div className="root-summary-card"><span><BarChart3 size={15} />相关长尾</span><strong>{selectedStat?.count || 0}</strong><small>在当前样本中出现</small></div><div className="root-summary-card"><span><TrendingUp size={15} />合计月搜</span><strong>{(selectedStat?.volume || 0).toLocaleString('en-US')}</strong><small>源表缺失值未计入</small></div><div className="root-summary-card"><span><Check size={15} />平均相关性</span><strong>{selectedStat?.avgCoverage || 0}/{selectedStat?.coverageTotal || '—'}</strong><small>竞品 ASIN 占比</small></div></div><div className="root-keyword-head"><div><span className="panel-kicker">Long-tail set</span><h2>“{selectedRoot}” 相关长尾词</h2></div><label className="search-field root-search"><Search size={15} /><span className="sr-only">筛选当前词根</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="在词根内搜索" /></label></div><div className="root-keyword-table"><div className="root-table-header"><span>关键词</span><span>相关性（竞品占比）</span><span>搜索量</span><span>建议动作</span></div>{selectedKeywords.length ? selectedKeywords.map((keyword) => <button className="root-keyword-row" key={keyword.id} type="button" onClick={() => onSelectKeyword(keyword)}><span><strong>{keyword.keyword}</strong><small>{keyword.translation}</small></span><span className="root-relevance-ratio">{relevanceRatio(keyword)}</span><span>{keyword.monthlySearchVolume === null ? '—' : keyword.monthlySearchVolume.toLocaleString('en-US')}</span><span className="root-action-text">{keyword.suggestedAction}<ChevronRight size={14} /></span></button>) : <div className="empty-state compact-empty"><Search size={20} /><p>当前词根下没有符合条件的长尾词。</p></div>}</div></section><aside className="root-catalog"><div className="root-catalog-head"><div><span className="panel-kicker">Grove index</span><h2>词根树</h2></div><button className="icon-button small" type="button" aria-label="词根设置" title="词根设置"><Tag size={15} /></button></div><div className="root-tree-visual"><div className="root-trunk" />{rootStats.map((item, index) => <button className={`catalog-root-node ${selectedRoot === item.root ? 'is-active' : ''}`} type="button" key={item.root} onClick={() => { setSelectedRoot(item.root); setQuery('') }}><span className="catalog-branch" style={{ top: `${32 + index * 59}px` }} /><span className="catalog-leaf" /><span className="catalog-root-copy"><strong>{item.root}</strong><small>{item.count} 条长尾 · 平均相关性 {item.avgCoverage}/{item.coverageTotal || '—'}</small></span><ArrowUpRight size={14} /></button>)}</div><div className="root-catalog-note"><ShieldAlert size={15} /><p>词根层只提供产品内的结构化视角。否定词组仍需查看受影响关键词后人工确认。</p></div></aside></div>
}
