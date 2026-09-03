// @vitest-environment jsdom

import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '../api/client'
import type { AIConfig } from '../types'
import { AISettingsPage } from './AISettingsPage'

const savedConfig: AIConfig = {
  provider: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'minimax/minimax-m3:free',
  enabled: true,
  timeoutSeconds: 60,
  apiKeySet: true,
  apiKeyHint: '••••1234',
  updatedAt: '2026-09-03T08:00:00Z',
}

let container: HTMLDivElement
let root: Root

async function renderPage(config: AIConfig = savedConfig) {
  vi.spyOn(api, 'getAIConfig').mockResolvedValue(config)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  await act(async () => {
    root.render(<AISettingsPage />)
    await Promise.resolve()
    await Promise.resolve()
  })
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function click(element: Element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  })
})

afterEach(() => {
  if (root) {
    act(() => root.unmount())
  }
  container?.remove()
  vi.restoreAllMocks()
})

describe('AISettingsPage safety contracts', () => {
  it('shows only the masked key hint and keeps the secret input empty', async () => {
    await renderPage()

    const keyInput = container.querySelector('input[autocomplete="new-password"]') as HTMLInputElement
    const revealButton = container.querySelector('button[aria-label="显示 API Key"]') as HTMLButtonElement

    expect(keyInput).toBeTruthy()
    expect(keyInput.value).toBe('')
    expect(keyInput.type).toBe('password')
    expect(container.textContent).toContain('当前已设置 ••••1234')
    expect(container.textContent).not.toContain('local-test-key-1234')

    act(() => click(revealButton))
    expect(keyInput.type).toBe('text')
    expect(keyInput.value).toBe('')
  })

  it('preserves the stored key when the API Key field is left blank', async () => {
    const saveSpy = vi.spyOn(api, 'saveAIConfig').mockResolvedValue(savedConfig)
    await renderPage()

    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('保存 AI 配置'))
    expect(saveButton).toBeTruthy()

    await act(async () => {
      click(saveButton!)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(saveSpy).toHaveBeenCalledWith({
      provider: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'minimax/minimax-m3:free',
      apiKey: undefined,
      enabled: true,
      timeoutSeconds: 60,
    })
    expect(container.textContent).toContain('完整 API Key 不会回显')
  })

  it('submits a newly entered key once and clears the plaintext field after save', async () => {
    const saveSpy = vi.spyOn(api, 'saveAIConfig').mockResolvedValue({ ...savedConfig, apiKeyHint: '••••ABCD' })
    await renderPage({ ...savedConfig, apiKeySet: false, apiKeyHint: '' })

    const keyInput = container.querySelector('input[autocomplete="new-password"]') as HTMLInputElement
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('保存 AI 配置'))

    act(() => setInputValue(keyInput, 'local-secret-ABCD'))
    expect(keyInput.value).toBe('local-secret-ABCD')

    await act(async () => {
      click(saveButton!)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'local-secret-ABCD' }))
    expect(keyInput.value).toBe('')
    expect(container.textContent).toContain('当前已设置 ••••ABCD')
    expect(container.textContent).not.toContain('local-secret-ABCD')
  })

  it('blocks save when required endpoint configuration is blank', async () => {
    const saveSpy = vi.spyOn(api, 'saveAIConfig').mockResolvedValue(savedConfig)
    await renderPage()

    const baseUrlInput = container.querySelector('input[placeholder="https://openrouter.ai/api/v1"]') as HTMLInputElement
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('保存 AI 配置'))

    act(() => setInputValue(baseUrlInput, '   '))
    await act(async () => {
      click(saveButton!)
      await Promise.resolve()
    })

    expect(saveSpy).not.toHaveBeenCalled()
    expect(container.textContent).toContain('请填写接口地址和模型名称。')
  })
})
