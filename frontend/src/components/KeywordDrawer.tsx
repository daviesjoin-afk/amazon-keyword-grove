import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowUpRight, Check, CheckCircle2, CircleHelp, Clock3, FileText, History, Info, LockKeyhole, Save, ShieldAlert, Sparkles, Target, X } from 'lucide-react'
import type { KeywordRecord, SuggestedAction } from '../types'
import { ActionPill, ApprovalPill, ConfidencePill, LockedMark, MatchPill, RiskPill } from './StatusPill'

interface KeywordDrawerProps {
  keyword: KeywordRecord
  onClose: () => void
  onSave: (patch: Partial<KeywordRecord>) => void
}

const actionOptions: SuggestedAction[] = ['精准投放', '广泛探索', '否定精准', '否定词组', '观察', '人工复核']

export function KeywordDrawer({ keyword, onClose, onSave }: KeywordDrawerProps) {
  const [action, setAction] = useState<SuggestedAction>(keyword.suggestedAction)
  const [approval, setApproval] = useState(keyword.approvalStatus)
  const [notes, setNotes] = useState(keyword.notes || '')

  useEffect(() => {
    setAction(keyword.suggestedAction)
    setApproval(keyword.approvalStatus)
    setNotes(keyword.notes || '')
  }, [keyword])

  const isNegativePhrase = action === '否定词组'
  const isNegativeExact = action === '否定精准'
  const isNegative = isNegativePhrase || isNegativeExact

  function save() {
    onSave({ suggestedAction: action, approvalStatus: approval, notes, isLocked: approval === '已接受' || approval === '已修改' })
  }

  return <div className="drawer-layer"><button className="drawer-scrim" type="button" aria-label="关闭关键词详情" onClick={onClose} /><aside className="keyword-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div className="drawer-header"><div><span className="panel-kicker">Keyword detail / {keyword.id}</span><h2 id="drawer-title">关键词详情</h2></div><button className="icon-button" type="button" aria-label="关闭详情" onClick={onClose}><X size={19} /></button></div><div className="drawer-scroll"><div className="drawer-keyword-head"><div><h1>{keyword.keyword}</h1><p>{keyword.translation}</p></div><MatchPill value={keyword.match} /></div><div className="drawer-context-tags"><span><span className="tag-key">词根</span>{keyword.root}</span><span><span className="tag-key">分类</span>{keyword.category}</span><span><span className="tag-key">意图</span>{keyword.intent}</span></div><section className="drawer-section recommendation-section"><div className="drawer-section-head"><div><span className="panel-kicker">Recommendation / 建议草稿</span><h3>广告动作</h3></div><ApprovalPill value={approval} /></div><div className="drawer-action-hero"><ActionPill value={action} /><ConfidencePill value={keyword.confidence} /></div><p className="drawer-reason"><Sparkles size={15} /><span>{keyword.suggestionReason}</span></p>{isNegativePhrase && <div className="negative-warning"><div className="negative-warning-head"><ShieldAlert size={17} /><strong>高风险：否定词组会拦截多个长尾词</strong><RiskPill value="高" /></div><p>词组 <code>{keyword.keyword}</code> 预计会影响 <strong>7</strong> 条已收录关键词，其中包含 2 条强匹配词。系统阻止直接批量确认，请逐条检查。</p><div className="impact-keywords"><span>可能受影响：</span><code>{keyword.keyword} for front door</code><code>large {keyword.keyword}</code><code>{keyword.keyword} indoor</code></div></div>}{isNegativeExact && <div className="negative-safe-note"><CheckCircle2 size={16} /><span>否定精准只排除完整搜索词，不会拦截相同词根的其它长尾组合。</span></div>}<label className="drawer-field-label" htmlFor="drawer-action">调整建议动作</label><select id="drawer-action" className="drawer-action-select" value={action} onChange={(event) => setAction(event.target.value as SuggestedAction)}>{actionOptions.map((option) => <option key={option}>{option}</option>)}</select><div className="drawer-approval-actions" role="group" aria-label="建议审批"><button className={approval === '已接受' ? 'is-selected' : ''} type="button" onClick={() => setApproval('已接受')}><Check size={14} />接受并锁定</button><button className={approval === '已修改' ? 'is-selected' : ''} type="button" onClick={() => setApproval('已修改')}><FileText size={14} />修改后锁定</button><button className={approval === '已驳回' ? 'is-selected is-danger' : ''} type="button" onClick={() => setApproval('已驳回')}><X size={14} />驳回建议</button></div></section><section className="drawer-section"><div className="drawer-section-head"><div><span className="panel-kicker">Evidence / 来源证据</span><h3>为什么这样判断</h3></div><CircleHelp size={16} /></div><div className="evidence-list"><EvidenceRow label="产品语料覆盖" value={keyword.relevanceReason} icon={<Target size={15} />} /><EvidenceRow label="搜索需求" value={`${formatNumber(keyword.monthlySearchVolume)} 月搜索量 · ABA ${formatNumber(keyword.abaRank)}`} icon={<ArrowUpRight size={15} />} /><EvidenceRow label="竞品覆盖" value={`${keyword.competitorCoverage} / ${keyword.competitorTotal} 个来源 ASIN`} icon={<History size={15} />} /><EvidenceRow label="流量类型" value={keyword.trafficTypes.join(' / ')} icon={<Sparkles size={15} />} /></div></section><section className="drawer-section"><div className="drawer-section-head"><div><span className="panel-kicker">Metrics / 卖家精灵原始指标</span><h3>数据快照</h3></div><Info size={16} /></div><div className="drawer-metric-grid"><Metric label="月搜索量" value={formatNumber(keyword.monthlySearchVolume)} /><Metric label="ABA 周排名" value={formatNumber(keyword.abaRank)} /><Metric label="标题密度" value={formatNumber(keyword.titleDensity)} /><Metric label="需供比" value={keyword.demandSupplyRatio === null ? '—' : keyword.demandSupplyRatio.toFixed(1)} /><Metric label="PPC 竞价" value={keyword.ppcBid === null ? '无法解析' : `$${keyword.ppcBid.toFixed(2)}`} /><Metric label="最新更新" value={keyword.lastUpdated} /></div><p className="drawer-data-note"><Info size={13} />缺失字段显示为「—」，不会按 0 参与建议分。</p></section><section className="drawer-section"><div className="drawer-section-head"><div><span className="panel-kicker">Sources / 来源关系</span><h3>竞品 ASIN</h3></div><span className="source-count">{keyword.sourceAsins.length} 个来源</span></div><div className="drawer-asins">{keyword.sourceAsins.map((asin) => <code key={asin}>{asin}</code>)}</div></section><section className="drawer-section"><div className="drawer-section-head"><div><span className="panel-kicker">Notes / 人工维护</span><h3>运营备注</h3></div><LockedMark locked={keyword.isLocked} /></div><label className="sr-only" htmlFor="keyword-notes">关键词运营备注</label><textarea id="keyword-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="记录投放分组、Listing 位置或复核原因" rows={3} /><div className="drawer-note-helper"><Clock3 size={13} />人工备注和锁定的动作会在再次导入时保留</div></section></div><div className="drawer-footer"><button className="button button-secondary" type="button" onClick={onClose}>取消</button><button className="button button-primary" type="button" onClick={save}><Save size={16} />保存判断</button></div></aside></div>
}

function EvidenceRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="evidence-row"><span className="evidence-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong></div><CheckCircle2 size={14} className="evidence-check" /></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="drawer-metric"><span>{label}</span><strong>{value}</strong></div>
}

function formatNumber(value: number | null) {
  return value === null ? '—' : value.toLocaleString('en-US')
}
