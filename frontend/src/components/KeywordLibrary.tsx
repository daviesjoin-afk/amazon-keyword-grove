import { useMemo, useState } from 'react'
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Filter,
  GripVertical,
  ListFilter,
  MoreHorizontal,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from 'lucide-react'
import type { ActionFilter, KeywordFilters, KeywordRecord, MatchStrength, Product } from '../types'
import { ActionPill, ApprovalPill, ConfidencePill, LockedMark, MatchPill, RiskPill } from './StatusPill'

interface KeywordLibraryProps {
  product: Product
  keywords: KeywordRecord[]
  onSelectKeyword: (keyword: KeywordRecord) => void
  onUpdateKeywords: (ids: string[], patch: Partial<KeywordRecord>) => void
  onExport: () => void
}

const pageSize = 8

export function KeywordLibrary({ product, keywords, onSelectKeyword, onUpdateKeywords, onExport }: KeywordLibraryProps) {
  const [filters, setFilters] = useState<KeywordFilters>({ query: '', match: '全部', action: 'all', category: '全部分类', root: '全部词根', approval: '全部' })
  const [sortBy, setSortBy] = useState<'relevanceScore' | 'monthlySearchVolume' | 'competitorCoverage'>('monthlySearchVolume')
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const categories = useMemo(() => ['全部分类', ...Array.from(new Set(keywords.map((item) => item.category)))], [keywords])
  const roots = useMemo(() => {
    const counts = new Map<string, number>()
    keywords.forEach((item) => counts.set(item.root, (counts.get(item.root) || 0) + 1))
    const primary = product.roots.filter((root) => counts.has(root))
    const discovered = [...counts.keys()]
      .filter((root) => !primary.includes(root))
      .sort((left, right) => (counts.get(right) || 0) - (counts.get(left) || 0))
    return ['全部词根', ...primary, ...discovered]
  }, [keywords, product.roots])
  const filteredKeywords = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    const actionMatch = (item: KeywordRecord) => {
      if (filters.action === 'all') return true
      if (filters.action === 'exact') return item.suggestedAction === '精准投放'
      if (filters.action === 'broad') return item.suggestedAction === '广泛探索'
      if (filters.action === 'negative_exact') return item.suggestedAction === '否定精准'
      if (filters.action === 'negative_phrase') return item.suggestedAction === '否定词组'
      return item.suggestedAction === '人工复核'
    }
    const result = keywords.filter((item) => {
      const matchesQuery = !query || [item.keyword, item.translation, item.root, item.category, item.suggestionReason, ...item.sourceAsins].some((field) => field.toLowerCase().includes(query))
      const matchesMatch = filters.match === '全部' || item.match === filters.match
      const matchesCategory = filters.category === '全部分类' || item.category === filters.category
      const matchesRoot = filters.root === '全部词根' || item.root === filters.root
      const matchesApproval = filters.approval === '全部' || item.approvalStatus === filters.approval
      return matchesQuery && matchesMatch && actionMatch(item) && matchesCategory && matchesRoot && matchesApproval
    })
    return result.sort((a, b) => {
      const av = (a[sortBy] ?? -1) as number
      const bv = (b[sortBy] ?? -1) as number
      return sortDesc ? bv - av : av - bv
    })
  }, [filters, keywords, sortBy, sortDesc])

  const totalPages = Math.max(1, Math.ceil(filteredKeywords.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const visibleKeywords = filteredKeywords.slice((safePage - 1) * pageSize, safePage * pageSize)
  const selectedVisible = visibleKeywords.length > 0 && visibleKeywords.every((item) => selected.includes(item.id))
  const selectedFiltered = filteredKeywords.length > 0 && filteredKeywords.every((item) => selected.includes(item.id))
  const hasFilters = Boolean(filters.query || filters.match !== '全部' || filters.action !== 'all' || filters.category !== '全部分类' || filters.root !== '全部词根' || filters.approval !== '全部')
  const groupedVisible = useMemo(() => {
    const groups = new Map<string, KeywordRecord[]>()
    visibleKeywords.forEach((item) => groups.set(item.root, [...(groups.get(item.root) || []), item]))
    return Array.from(groups.entries()).map(([root, items]) => ({ root, items }))
  }, [visibleKeywords])
  const groupedAll = useMemo(() => {
    const groups = new Map<string, KeywordRecord[]>()
    filteredKeywords.forEach((item) => groups.set(item.root, [...(groups.get(item.root) || []), item]))
    return groups
  }, [filteredKeywords])

  function patchFilter(patch: Partial<KeywordFilters>) {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
  }

  function toggleSelected(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function toggleAllVisible() {
    setSelected((current) => selectedVisible ? current.filter((id) => !visibleKeywords.some((item) => item.id === id)) : Array.from(new Set([...current, ...visibleKeywords.map((item) => item.id)])))
  }

  function toggleGroup(root: string) {
    const groupItems = groupedAll.get(root) || []
    const groupSelected = groupItems.length > 0 && groupItems.every((item) => selected.includes(item.id))
    setSelected((current) => groupSelected ? current.filter((id) => !groupItems.some((item) => item.id === id)) : Array.from(new Set([...current, ...groupItems.map((item) => item.id)])))
  }

  function toggleGroupExpanded(root: string) {
    setExpandedGroups((current) => ({ ...current, [root]: !(current[root] ?? true) }))
  }

  function toggleAllExpanded(expanded: boolean) {
    setExpandedGroups(Object.fromEntries(Array.from(groupedAll.keys()).map((root) => [root, expanded])))
  }

  function toggleAllFiltered() {
    setSelected((current) => selectedFiltered ? current.filter((id) => !filteredKeywords.some((item) => item.id === id)) : Array.from(new Set([...current, ...filteredKeywords.map((item) => item.id)])))
  }

  function applyBulkApproval(status: '已接受' | '已驳回') {
    if (!selected.length) return
    onUpdateKeywords(selected, { approvalStatus: status, isLocked: true })
    setSelected([])
  }

  return (
    <div className="library-layout">
      <FilterRail product={product} keywords={keywords} filters={filters} roots={roots} onFilter={patchFilter} />
      <section className="library-main" aria-labelledby="keyword-library-title">
        <div className="library-toolbar">
          <div className="library-title-row"><div><span className="panel-kicker">Keyword inventory / {product.site}</span><h1 id="keyword-library-title">关键词库</h1></div><span className="sample-label">当前加载 {keywords.length} / 总库 {product.keywordTotal.toLocaleString('en-US')}</span></div>
          <div className="segment-stat-row" aria-label="匹配强度统计"><SegmentStat label="全部" count={product.keywordTotal} active={filters.match === '全部'} onClick={() => patchFilter({ match: '全部' })} tone="all" /><SegmentStat label="强匹配" count={product.strongCount} active={filters.match === '强匹配'} onClick={() => patchFilter({ match: '强匹配' })} tone="strong" /><SegmentStat label="中匹配" count={product.mediumCount} active={filters.match === '中匹配'} onClick={() => patchFilter({ match: '中匹配' })} tone="medium" /><SegmentStat label="弱匹配" count={product.weakCount} active={filters.match === '弱匹配'} onClick={() => patchFilter({ match: '弱匹配' })} tone="weak" /><SegmentStat label="不相关" count={keywords.filter((item) => item.match === '不相关').length} active={filters.match === '不相关'} onClick={() => patchFilter({ match: '不相关' })} tone="irrelevant" /></div>
          <div className="keyword-search-row">
            <label className="search-field"><Search size={17} /><span className="sr-only">搜索关键词</span><input value={filters.query} onChange={(event) => patchFilter({ query: event.target.value })} placeholder="搜索关键词、中文翻译或词根" /></label>
            <button className={`filter-toggle ${showAdvanced ? 'is-active' : ''}`} type="button" onClick={() => setShowAdvanced((value) => !value)}><SlidersHorizontal size={15} />组合筛选{hasFilters && <span className="filter-count">{[filters.match !== '全部', filters.action !== 'all', filters.category !== '全部分类', filters.root !== '全部词根', filters.approval !== '全部'].filter(Boolean).length}</span>}</button>
            <button className="button button-secondary compact-button" type="button" onClick={onExport}><Download size={15} />导出</button>
            <button className="icon-button small" type="button" aria-label="列设置" title="列设置"><Columns3 size={16} /></button>
          </div>
          <div className="match-filter-row action-filter-row" aria-label="广告建议筛选"><span className="action-filter-label"><ListFilter size={13} />动作</span>{([['all', '全部动作'], ['exact', '精准'], ['broad', '广泛'], ['negative_exact', '否定精准'], ['negative_phrase', '否定词组'], ['review', '人工复核']] as const).map(([value, label]) => <button className={`filter-chip ${filters.action === value ? 'is-active' : ''}`} type="button" key={value} onClick={() => patchFilter({ action: value })}>{label}</button>)}</div>
          {showAdvanced && <div className="advanced-filter-panel">
            <div className="field-group"><label htmlFor="action-filter">建议动作</label><select id="action-filter" value={filters.action} onChange={(event) => patchFilter({ action: event.target.value as ActionFilter })}><option value="all">全部动作</option><option value="exact">精准投放</option><option value="broad">广泛探索</option><option value="negative_exact">否定精准</option><option value="negative_phrase">否定词组</option><option value="review">人工复核</option></select></div>
            <div className="field-group"><label htmlFor="category-filter">主分类</label><select id="category-filter" value={filters.category} onChange={(event) => patchFilter({ category: event.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field-group"><label htmlFor="root-filter">词根</label><select id="root-filter" value={filters.root} onChange={(event) => patchFilter({ root: event.target.value })}>{roots.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field-group"><label htmlFor="approval-filter">审批状态</label><select id="approval-filter" value={filters.approval} onChange={(event) => patchFilter({ approval: event.target.value as KeywordFilters['approval'] })}><option>全部</option><option>待审批</option><option>已接受</option><option>已修改</option><option>已驳回</option></select></div>
            {hasFilters && <button className="reset-filter" type="button" onClick={() => { setFilters({ query: '', match: '全部', action: 'all', category: '全部分类', root: '全部词根', approval: '全部' }); setPage(1) }}><RotateCcw size={14} />清除筛选</button>}
          </div>}
        </div>

        {selected.length > 0 && <div className="bulk-bar" role="region" aria-label="批量操作"><span><CheckSquare size={16} />已选 {selected.length} 条</span><button type="button" onClick={() => applyBulkApproval('已接受')}><Check size={14} />接受建议并锁定</button><button type="button" onClick={() => applyBulkApproval('已驳回')}><X size={14} />驳回</button><button className="bulk-clear" type="button" onClick={() => setSelected([])}>清除选择</button></div>}

          <div className="table-meta-row"><span>符合条件 <strong>{filteredKeywords.length}</strong> 条 · 已按词根分组</span><div className="table-quick-actions"><button type="button" onClick={() => toggleAllExpanded(true)}>全部展开</button><button type="button" onClick={() => toggleAllExpanded(false)}>全部收起</button><button type="button" className={selectedFiltered ? 'is-on' : ''} onClick={toggleAllFiltered}><CheckSquare size={12} />全选筛选</button><button type="button" onClick={() => setSelected([])} disabled={!selected.length}>清空选择</button></div><div className="table-sort"><label htmlFor="sort-select">排序</label><select id="sort-select" value={sortBy} onChange={(event) => { setSortBy(event.target.value as typeof sortBy); setPage(1) }}><option value="relevanceScore">相关性（语义评分）</option><option value="monthlySearchVolume">月搜索量</option><option value="competitorCoverage">相关性（竞品占比）</option></select><button type="button" className="sort-direction" aria-label={sortDesc ? '降序，点击切换升序' : '升序，点击切换降序'} onClick={() => setSortDesc((value) => !value)}>{sortDesc ? '↓' : '↑'}</button></div></div>

        {filteredKeywords.length === 0 ? <div className="empty-state"><Filter size={24} /><h2>没有匹配的关键词</h2><p>尝试放宽匹配强度、动作或词根筛选。</p><button className="button button-secondary" type="button" onClick={() => { setFilters({ query: '', match: '全部', action: 'all', category: '全部分类', root: '全部词根', approval: '全部' }); setPage(1) }}>清除筛选</button></div> : <>
          <div className="keyword-table-wrap">
            <table className="keyword-table">
              <thead><tr><th className="check-column"><input type="checkbox" aria-label="选择当前页全部关键词" checked={selectedVisible} onChange={toggleAllVisible} /></th><th>关键词 / 分组</th><th>匹配</th><th>搜索量 / ABA</th><th>相关性（竞品占比）</th><th>流量类型</th><th>建议动作</th><th>置信度</th><th>风险</th><th>审批</th><th className="actions-column"><span className="sr-only">操作</span></th></tr></thead>
              <tbody>{groupedVisible.flatMap(({ root, items }) => { const groupItems = groupedAll.get(root) || items; return [<GroupRow key={`group-${root}`} root={root} items={groupItems} expanded={expandedGroups[root] ?? true} selected={groupItems.length > 0 && groupItems.every((item) => selected.includes(item.id))} onToggleSelected={() => toggleGroup(root)} onToggleExpanded={() => toggleGroupExpanded(root)} />, ...((expandedGroups[root] ?? true) ? items.map((keyword) => <KeywordRow key={keyword.id} keyword={keyword} selected={selected.includes(keyword.id)} onToggle={() => toggleSelected(keyword.id)} onOpen={() => onSelectKeyword(keyword)} />) : [])] })}</tbody>
            </table>
          </div>
          <div className="mobile-keyword-list">{visibleKeywords.map((keyword) => <MobileKeywordCard key={keyword.id} keyword={keyword} selected={selected.includes(keyword.id)} onToggle={() => toggleSelected(keyword.id)} onOpen={() => onSelectKeyword(keyword)} />)}</div>
          <Pagination page={safePage} totalPages={totalPages} total={filteredKeywords.length} pageSize={pageSize} onPage={setPage} />
        </>}
      </section>
    </div>
  )
}

function SegmentStat({ label, count, active, onClick, tone }: { label: string; count: number; active: boolean; onClick: () => void; tone: 'all' | 'strong' | 'medium' | 'weak' | 'irrelevant' }) {
  return <button type="button" className={`segment-stat segment-${tone} ${active ? 'is-active' : ''}`} onClick={onClick} aria-pressed={active}><span className="segment-dot" /><span>{label}</span><strong>{count.toLocaleString('en-US')}</strong></button>
}

function GroupRow({ root, items, expanded, selected, onToggleSelected, onToggleExpanded }: { root: string; items: KeywordRecord[]; expanded: boolean; selected: boolean; onToggleSelected: () => void; onToggleExpanded: () => void }) {
  const totalSearch = items.reduce((sum, item) => sum + (item.monthlySearchVolume ?? 0), 0)
  const averageRelevance = items.length ? Math.round(items.reduce((sum, item) => sum + item.relevanceScore, 0) / items.length) : 0
  const coverage = items.length ? Math.max(...items.map((item) => item.competitorCoverage)) : 0
  const coverageTotal = items.length ? items[0].competitorTotal : 0
  return <tr className="keyword-group-row">
    <td className="check-column" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`选择 ${root} 分组`} checked={selected} onChange={onToggleSelected} /></td>
    <td className="group-name-cell"><button type="button" className="group-expand" onClick={onToggleExpanded} aria-expanded={expanded} aria-label={`${expanded ? '收起' : '展开'} ${root} 分组`}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button><GripVertical size={14} className="group-grip" aria-hidden="true" /><strong>{root}</strong><span className="group-count">{items.length}</span></td>
    <td><span className="group-summary-label">分组</span></td>
    <td className="metric-cell"><strong>{formatNumber(totalSearch)}</strong><span>组内月搜</span></td>
    <td><div className="coverage-cell"><strong>{coverage}<small>/{coverageTotal || '—'}</small></strong><span className="coverage-track"><i style={{ width: `${coverageTotal ? coverage / coverageTotal * 100 : 0}%` }} /></span></div></td>
    <td><span className="group-summary-label">{new Set(items.flatMap((item) => item.trafficTypes)).size} 类流量</span></td>
    <td><span className="group-summary-label">组级汇总</span></td>
    <td><ConfidencePill value={averageRelevance} /></td>
    <td colSpan={3}><button type="button" className="group-detail-button" onClick={onToggleExpanded}>{expanded ? '收起关键词' : '查看关键词'}</button></td>
  </tr>
}

function FilterRail({ product, keywords, filters, roots, onFilter }: { product: Product; keywords: KeywordRecord[]; filters: KeywordFilters; roots: string[]; onFilter: (patch: Partial<KeywordFilters>) => void }) {
  const categories = [
    { label: '全部关键词', value: '全部', count: product.keywordTotal },
    { label: '强匹配', value: '强匹配', count: product.strongCount },
    { label: '中匹配', value: '中匹配', count: product.mediumCount },
    { label: '弱匹配', value: '弱匹配', count: product.weakCount },
    { label: '不相关 / 冲突', value: '不相关', count: keywords.filter((item) => item.match === '不相关').length },
  ] as const
  const rootCounts = roots.slice(1).map((root) => ({ root, count: keywords.filter((item) => item.root === root).length }))
  return <aside className="filter-rail" aria-label="关键词分类与词根"><div className="rail-heading"><span className="panel-kicker">Grove index</span><h2>分类与词根</h2><button className="icon-button small" type="button" aria-label="更多筛选设置" title="更多筛选设置"><MoreHorizontal size={15} /></button></div><div className="rail-tree rail-category-tree"><div className="rail-tree-label"><span className="branch-mark" />匹配强度</div>{categories.map((item) => <button className={`rail-item ${filters.match === item.value || (item.value === '全部' && filters.match === '全部') ? 'is-active' : ''}`} type="button" key={item.value} onClick={() => onFilter({ match: item.value as KeywordFilters['match'] })}><span className="rail-item-name"><span className={`rail-dot rail-dot-${item.value === '强匹配' ? 'strong' : item.value === '中匹配' ? 'medium' : item.value === '弱匹配' ? 'weak' : item.value === '不相关' ? 'irrelevant' : 'all'}`} />{item.label}</span><span>{item.count.toLocaleString('en-US')}</span></button>)}</div><div className="rail-divider" /><div className="rail-tree rail-root-tree"><div className="rail-tree-label"><span className="branch-mark branch-mark-green" />高频词根</div>{rootCounts.map((item, index) => <button className={`root-rail-item ${filters.root === item.root ? 'is-active' : ''}`} type="button" key={item.root} onClick={() => onFilter({ root: item.root })}><span className="root-rail-branch" aria-hidden="true"><i /><b /></span><span className="root-rail-name"><strong>{item.root}</strong><small>{index < 2 ? '核心' : '属性'}</small></span><span className="root-rail-count">{item.count}</span></button>)}</div><div className="rail-tip"><Tag size={14} /><p>点击词根即可筛出对应长尾词。分类是产品级判断，不会跨产品自动复用。</p></div></aside>
}

function KeywordRow({ keyword, selected, onToggle, onOpen }: { keyword: KeywordRecord; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  return <tr className={selected ? 'is-selected' : ''} onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }} tabIndex={0} aria-label={`查看关键词 ${keyword.keyword}`}>
    <td className="check-column" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`选择 ${keyword.keyword}`} checked={selected} onChange={onToggle} /></td>
    <td className="keyword-cell"><strong>{keyword.keyword}</strong><span>{keyword.translation}</span><LockedMark locked={keyword.isLocked} /></td>
    <td><MatchPill value={keyword.match} /></td>
    <td className="metric-cell"><strong>{formatNumber(keyword.monthlySearchVolume)}</strong><span>ABA {formatNumber(keyword.abaRank)}</span></td>
    <td><div className="coverage-cell"><strong>{keyword.competitorCoverage}<small>/{keyword.competitorTotal}</small></strong><span className="coverage-track"><i style={{ width: `${keyword.competitorCoverage / keyword.competitorTotal * 100}%` }} /></span></div></td>
    <td><div className="traffic-types">{keyword.trafficTypes.slice(0, 3).map((type) => <span key={type}>{type}</span>)}{keyword.trafficTypes.length > 3 && <span>+{keyword.trafficTypes.length - 3}</span>}</div></td>
    <td className="action-cell"><ActionPill value={keyword.suggestedAction} /><span title={keyword.suggestionReason}>{keyword.suggestionReason}</span></td>
    <td><ConfidencePill value={keyword.confidence} /></td>
    <td><RiskPill value={keyword.risk} /></td>
    <td><ApprovalPill value={keyword.approvalStatus} /></td>
    <td className="actions-column"><button className="row-more" type="button" aria-label={`打开 ${keyword.keyword} 更多操作`} onClick={(event) => { event.stopPropagation(); onOpen() }}><MoreHorizontal size={16} /></button></td>
  </tr>
}

function MobileKeywordCard({ keyword, selected, onToggle, onOpen }: { keyword: KeywordRecord; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  return <article className={`mobile-keyword-card ${selected ? 'is-selected' : ''}`}><div className="mobile-card-top"><input type="checkbox" aria-label={`选择 ${keyword.keyword}`} checked={selected} onChange={onToggle} /><button type="button" className="mobile-keyword-open" onClick={onOpen}><strong>{keyword.keyword}</strong><span>{keyword.translation}</span></button><MatchPill value={keyword.match} compact /></div><div className="mobile-card-meta"><span><b>{formatNumber(keyword.monthlySearchVolume)}</b>月搜</span><span><b>{keyword.competitorCoverage}/{keyword.competitorTotal || '—'}</b>相关性</span><span><b>{keyword.confidence}%</b>置信</span><RiskPill value={keyword.risk} /></div><div className="mobile-card-action"><ActionPill value={keyword.suggestedAction} compact /><span>{keyword.suggestionReason}</span></div><button className="mobile-card-detail" type="button" onClick={onOpen}>查看详情<ChevronRight size={15} /></button></article>
}

function Pagination({ page, totalPages, total, pageSize: size, onPage }: { page: number; totalPages: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const start = total === 0 ? 0 : (page - 1) * size + 1
  const end = Math.min(page * size, total)
  const pages = Array.from(new Set([1, page - 1, page, page + 1, totalPages].filter((value) => value >= 1 && value <= totalPages)))
  return <div className="pagination"><span>显示 {start}–{end} / {total} 条</span><div className="page-controls"><button type="button" aria-label="上一页" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}><ChevronLeft size={16} /></button>{pages.map((value) => <button key={value} type="button" className={value === page ? 'is-active' : ''} aria-current={value === page ? 'page' : undefined} onClick={() => onPage(value)}>{value}</button>)}<button type="button" aria-label="下一页" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}><ChevronRight size={16} /></button></div></div>
}

function formatNumber(value: number | null) {
  return value === null ? '—' : value.toLocaleString('en-US')
}
