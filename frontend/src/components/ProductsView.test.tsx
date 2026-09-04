// @vitest-environment jsdom

import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '../types'
import { ProductsView } from './ProductsView'

const product: Product = {
  id: 'product-1',
  name: 'Boxwood wreath',
  referenceAsin: '竞品集合',
  site: 'US',
  language: 'en_US',
  category: 'Artificial Wreaths',
  status: '在售',
  title: 'Artificial Boxwood Wreath',
  bullets: [],
  coreTerms: ['boxwood wreath'],
  keywordTotal: 20,
  strongCount: 8,
  mediumCount: 6,
  weakCount: 6,
  sourceCount: 4,
  lastImportedAt: '2026-09-04',
  importHealth: 100,
  roots: ['boxwood wreath'],
}

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

async function renderProducts(onDelete = vi.fn().mockResolvedValue(undefined), onOpen = vi.fn()) {
  await act(async () => {
    root.render(<ProductsView products={[product]} selectedProductId={product.id} onOpen={onOpen} onDelete={onDelete} onImport={vi.fn()} onCreate={vi.fn()} />)
    await Promise.resolve()
  })
  return { onDelete, onOpen }
}

describe('ProductsView product actions', () => {
  it('visually marks the selected product and exposes a delete button', async () => {
    await renderProducts()

    expect(container.querySelector('.product-card.is-current')).toBeTruthy()
    expect(container.textContent).toContain('当前产品')
    expect(container.querySelector('button[aria-label="删除Boxwood wreath"]')).toBeTruthy()
  })

  it('routes delete clicks to the product callback without opening the card', async () => {
    const { onDelete, onOpen } = await renderProducts()
    const deleteButton = container.querySelector('button[aria-label="删除Boxwood wreath"]') as HTMLButtonElement

    await act(async () => {
      deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(onDelete).toHaveBeenCalledWith(product)
    expect(onOpen).not.toHaveBeenCalled()
  })
})
