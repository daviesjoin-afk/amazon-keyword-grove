import { AlertTriangle, Check, CircleDot, Eye, FileCheck2, LockKeyhole, Minus, ShieldAlert, Target, Waves } from 'lucide-react'
import type { ApprovalStatus, MatchStrength, SuggestedAction } from '../types'
import { useI18n } from '../i18n'

export function MatchPill({ value, compact = false }: { value: MatchStrength; compact?: boolean }) {
  const { text } = useI18n()
  const icon = value === '强匹配' ? <Check size={13} /> : value === '中匹配' ? <Waves size={13} /> : value === '弱匹配' ? <Eye size={13} /> : <Minus size={13} />
  const label = value === '强匹配' ? text('强匹配', 'Strong') : value === '中匹配' ? text('中匹配', 'Medium') : value === '弱匹配' ? text('弱匹配', 'Weak') : text('不相关', 'Irrelevant')
  return <span className={`match-pill match-${matchClass(value)}${compact ? ' is-compact' : ''}`}>{icon}{label}</span>
}

export function ActionPill({ value, compact = false }: { value: SuggestedAction; compact?: boolean }) {
  const { text } = useI18n()
  const isNegative = value === '否定精准' || value === '否定词组'
  const icon = value === '精准投放' ? <Target size={13} /> : isNegative ? <ShieldAlert size={13} /> : value === '人工复核' ? <AlertTriangle size={13} /> : value === '观察' ? <Eye size={13} /> : <Waves size={13} />
  const label = value === '精准投放'
    ? text('精准投放', 'Exact')
    : value === '广泛探索'
      ? text('广泛探索', 'Broad')
      : value === '否定精准'
        ? text('否定精准', 'Negative exact')
        : value === '否定词组'
          ? text('否定词组', 'Negative phrase')
          : value === '人工复核'
            ? text('人工复核', 'Manual review')
            : text('观察', 'Observe')
  return <span className={`action-pill action-${actionClass(value)}${compact ? ' is-compact' : ''}`}>{icon}{label}</span>
}

export function ConfidencePill({ value }: { value: number }) {
  return <span className={`confidence-pill ${value >= 80 ? 'confidence-high' : value >= 60 ? 'confidence-mid' : 'confidence-low'}`}><span className="confidence-meter"><span style={{ width: `${value}%` }} /></span>{value}%</span>
}

export function RiskPill({ value }: { value: '低' | '中' | '高' }) {
  const { text } = useI18n()
  const label = value === '低' ? text('低风险', 'Low risk') : value === '中' ? text('中风险', 'Medium risk') : text('高风险', 'High risk')
  return <span className={`risk-pill risk-${value === '低' ? 'low' : value === '中' ? 'mid' : 'high'}`}>{value === '高' ? <ShieldAlert size={12} /> : value === '中' ? <AlertTriangle size={12} /> : <Check size={12} />}{label}</span>
}

export function ApprovalPill({ value }: { value: ApprovalStatus }) {
  const { text } = useI18n()
  const icon = value === '已接受' ? <Check size={12} /> : value === '已修改' ? <FileCheck2 size={12} /> : value === '已驳回' ? <Minus size={12} /> : <CircleDot size={12} />
  const label = value === '已接受' ? text('已接受', 'Accepted') : value === '已修改' ? text('已修改', 'Modified') : value === '已驳回' ? text('已驳回', 'Rejected') : text('待审批', 'Pending')
  return <span className={`approval-pill approval-${value === '待审批' ? 'pending' : value === '已驳回' ? 'rejected' : 'approved'}`}>{icon}{label}</span>
}

export function LockedMark({ locked }: { locked?: boolean }) {
  const { text } = useI18n()
  if (!locked) return null
  return <span className="locked-mark" title={text('人工锁定，重新导入不会覆盖', 'Manually locked; re-imports will not overwrite it')}><LockKeyhole size={12} />{text('人工锁定', 'Manual lock')}</span>
}

function matchClass(value: MatchStrength) {
  return value === '强匹配' ? 'strong' : value === '中匹配' ? 'medium' : value === '弱匹配' ? 'weak' : 'irrelevant'
}

function actionClass(value: SuggestedAction) {
  if (value === '精准投放') return 'exact'
  if (value === '广泛探索') return 'broad'
  if (value === '否定精准') return 'negative-exact'
  if (value === '否定词组') return 'negative-phrase'
  if (value === '人工复核') return 'review'
  return 'observe'
}
