// @vitest-environment jsdom

import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '../types'
import { Sidebar } from './Sidebar'

const products: Product[] = [
  {
    id: 'product-1', name: 'Boxwood wreath', referenceAsin: '竞品集合', site: 'US', language: 'en_US', category: 'Artificial Wreaths', status: '在售',
    title: 'Artificial Boxwood Wreath', bullets: [], coreTerms: ['boxwood wreath'], keywordTotal: 2000, strongCount: 40, mediumCount: 300, weakCount: 1660,
    sourceCount: 20, lastImportedAt: '2026-09-04', importHealth: 100, roots: ['boxwood wreath'],
  },
  {
    id: 'product-2', name: 'Battery terminal kit', referenceAsin: '尚未导入', site: 'US', language: 'en_US', category: 'Terminals & Ends', status: '准备中',
    title: 'Battery Terminal Kit', bullets: [], coreTerms: ['battery terminal'], keywordTotal: 0, strongCount: 0, mediumCount: 0, weakCount: 0,
    sourceCount: 0, lastImportedAt: '尚未导入', importHealth: 0, roots: ['battery terminal'],
  },
  {
    id: 'product-3', name: 'Garden trellis clips', referenceAsin: '竞品集合', site: 'US', language: 'en_US', category: 'Garden Supplies', status: '在售',
    title: 'Garden Trellis Clips', bullets: [], coreTerms: ['garden trellis'], keywordTotal: 125, strongCount: 12, mediumCount: 40, weakCount: 73,
    sourceCount: 8, lastImportedAt: '2026-09-03', importHealth: 100, roots: ['garden trellis'],
  },
  {
    id: 'product-4', name: 'Holiday ribbon set', referenceAsin: '竞品集合', site: 'US', language: 'en_US', category: 'Seasonal Décor', status: '在售',
    title: 'Holiday Ribbon Set', bullets: [], coreTerms: ['holiday ribbon'], keywordTotal: 88, strongCount: 10, mediumCount: 20, weakCount: 58,
    sourceCount: 6, lastImportedAt: '2026-09-02', importHealth: 100, roots: ['holiday ribbon'],
  },
]

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

async function renderSidebar(selectedProductId: string | null, onSelectProduct = vi.fn()) {
  await act(async () => {
    root.render(<Sidebar view="workbench" products={products} selectedProductId={selectedProductId} onSelectProduct={onSelectProduct} onNavigate={vi.fn()} />)
    await Promise.resolve()
  })
  return onSelectProduct
}

describe('Sidebar product switcher', () => {
  it('shows three product cards and marks only the selected product as current', async () => {
    await renderSidebar('product-2')

    const cards = Array.from(container.querySelectorAll<HTMLButtonElement>('.sidebar-product-card'))
    expect(cards).toHaveLength(3)
    for (const name of ['Boxwood wreath', 'Battery terminal kit', 'Garden trellis clips']) {
      expect(cards.some((card) => card.textContent?.includes(name))).toBe(true)
    }
    expect(container.querySelectorAll('.sidebar-product-card.is-current')).toHaveLength(1)
    expect(container.querySelector('.sidebar-product-card.is-current')?.textContent).toContain('Battery terminal kit')
    expect(container.querySelector('[aria-pressed="true"]')?.textContent).toContain('Battery terminal kit')
  })

  it('switches the active product when a card is clicked', async () => {
    const onSelectProduct = await renderSidebar('product-1')
    const target = Array.from(container.querySelectorAll<HTMLButtonElement>('.sidebar-product-card')).find((card) => card.textContent?.includes('Garden trellis clips'))

    await act(async () => {
      target?.click()
      await Promise.resolve()
    })

    expect(onSelectProduct).toHaveBeenCalledWith(products[2])
  })

  it('keeps a selected product visible when it is outside the first three products', async () => {
    await renderSidebar('product-4')

    const cards = Array.from(container.querySelectorAll<HTMLButtonElement>('.sidebar-product-card'))
    expect(cards).toHaveLength(3)
    expect(container.querySelector('.sidebar-product-card.is-current')?.textContent).toContain('Holiday ribbon set')
    expect(container.textContent).not.toContain('Garden trellis clips')
  })
})
