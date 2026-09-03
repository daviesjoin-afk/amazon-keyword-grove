// @vitest-environment jsdom

import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LanguageProvider, useI18n } from './i18n'

let container: HTMLDivElement
let root: Root

function Harness() {
  const { language, text, toggleLanguage } = useI18n()
  return <div><span data-testid="language">{language}</span><span data-testid="label">{text('中文界面', 'English interface')}</span><button type="button" onClick={toggleLanguage}>toggle</button></div>
}

function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<LanguageProvider><Harness /></LanguageProvider>))
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  })
  window.localStorage.clear()
  document.documentElement.lang = ''
})

afterEach(() => {
  if (root) act(() => root.unmount())
  container?.remove()
  window.localStorage.clear()
})

describe('LanguageProvider', () => {
  it('uses Chinese as the stable default and updates the document language', () => {
    mount()

    expect(container.querySelector('[data-testid="language"]')?.textContent).toBe('zh-CN')
    expect(container.querySelector('[data-testid="label"]')?.textContent).toBe('中文界面')
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('switches to English and persists the preference', () => {
    mount()
    const button = container.querySelector('button')!

    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(container.querySelector('[data-testid="language"]')?.textContent).toBe('en-US')
    expect(container.querySelector('[data-testid="label"]')?.textContent).toBe('English interface')
    expect(window.localStorage.getItem('keyword-grove:language')).toBe('en-US')
    expect(document.documentElement.lang).toBe('en-US')
  })

  it('restores a previously saved English preference', () => {
    window.localStorage.setItem('keyword-grove:language', 'en-US')
    mount()

    expect(container.querySelector('[data-testid="language"]')?.textContent).toBe('en-US')
    expect(container.querySelector('[data-testid="label"]')?.textContent).toBe('English interface')
  })
})
