import type { KeywordRecord } from './types'

type Coverage = Pick<KeywordRecord, 'competitorCoverage' | 'competitorTotal'>

/** SellerSprite relevance is the share of competitor ASINs containing a term. */
export function relevanceRatio(keyword: Coverage): string {
  return keyword.competitorTotal > 0 ? `${keyword.competitorCoverage}/${keyword.competitorTotal}` : '—'
}

export function relevancePercent(keyword: Coverage): number | null {
  return keyword.competitorTotal > 0 ? Math.round(keyword.competitorCoverage / keyword.competitorTotal * 100) : null
}
