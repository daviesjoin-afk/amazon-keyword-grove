import { Bot, CheckCircle2, Eye, EyeOff, KeyRound, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AIConfig, AIConfigPayload } from '../types'

const openRouterPreset = { provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'minimax/minimax-m3:free' }
const mimoPreset = { provider: 'mimo', baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5' }
const openRouterFreeModels = [
  { value: 'minimax/minimax-m3:free', label: 'MiniMax M3（免费）' },
  { value: 'minimax/minimax-m2.7:free', label: 'MiniMax M2.7（免费）' },
]
const emptyAI: AIConfig = { ...openRouterPreset, enabled: false, timeoutSeconds: 60, apiKeySet: false, apiKeyHint: '' }

export function AISettingsPage() {
  const [ai, setAI] = useState<AIConfig>(emptyAI)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    api.getAIConfig().then((config) => { if (active) setAI(config) }).catch(() => { if (active) setMessage('AI 配置读取失败，请检查本地 API。') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function save() {
    if (!ai.baseUrl.trim() || !ai.model.trim()) { setMessage('请填写接口地址和模型名称。'); return }
    setSaving(true)
    setMessage('')
    try {
      const payload: AIConfigPayload = { provider: ai.provider, baseUrl: ai.baseUrl.trim(), model: ai.model.trim(), apiKey: apiKey.trim() || undefined, enabled: ai.enabled, timeoutSeconds: ai.timeoutSeconds }
      const saved = await api.saveAIConfig(payload)
      setAI(saved)
      setApiKey('')
      setMessage('AI 接口配置已保存到本机。完整 API Key 不会回显。')
    } catch (error) {
      setMessage(error instanceof Error ? `保存失败：${error.message}` : 'AI 配置保存失败。')
    } finally {
      setSaving(false)
    }
  }

  function selectProvider(provider: string) {
    const preset = provider === 'openrouter' ? openRouterPreset : provider === 'mimo' ? mimoPreset : null
    setAI((current) => preset ? { ...current, ...preset } : { ...current, provider })
  }

  return <div className="product-settings-page ai-workspace-page">
    <header className="settings-page-head"><div><span className="panel-kicker">Workspace intelligence / 全局能力</span><h1>AI 语义设置</h1><p>这是整个工作台共用的模型接口。所有产品可复用同一配置，但每次语义分析仍按产品隔离。</p></div><span className="settings-safety"><ShieldCheck size={16} />工作台全局配置</span></header>
    <section className="settings-card ai-settings-card">
      <div className="settings-card-head"><div className="settings-card-icon ai-icon"><Bot size={20} /></div><div><h2>AI 语义模型接口</h2><p>默认预设为 OpenRouter 的 MiniMax M3 免费模型；用于语义分类增强，不会自动执行广告或否定操作。</p></div><label className="settings-switch"><input type="checkbox" checked={ai.enabled} onChange={(event) => setAI((current) => ({ ...current, enabled: event.target.checked }))} /><span />启用配置</label></div>
      {loading ? <div className="settings-loading">正在读取本地配置…</div> : <div className="ai-form-grid">
        <label className="settings-field"><span>接口类型</span><select value={ai.provider} onChange={(event) => selectProvider(event.target.value)}><option value="openrouter">OpenRouter（MiniMax 免费模型）</option><option value="mimo">小米 MiMo</option><option value="openai_compatible">OpenAI 兼容接口</option><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="custom">自定义</option></select></label>
        <label className="settings-field"><span>模型预设</span><select aria-label="模型预设" value={openRouterFreeModels.some((item) => item.value === ai.model) ? ai.model : 'custom'} onChange={(event) => { if (event.target.value !== 'custom') setAI((current) => ({ ...current, model: event.target.value })) }}><option value={openRouterFreeModels[0].value}>{openRouterFreeModels[0].label}</option><option value={openRouterFreeModels[1].value}>{openRouterFreeModels[1].label}</option><option value="custom">自定义输入</option></select></label>
        <label className="settings-field full-settings-field"><span>模型标识 <em>*</em></span><input value={ai.model} onChange={(event) => setAI((current) => ({ ...current, model: event.target.value }))} placeholder="例如 minimax/minimax-m3:free" /><small>可直接修改或粘贴任意 OpenRouter 模型标识。</small></label>
        <label className="settings-field full-settings-field"><span>API Base URL <em>*</em></span><input value={ai.baseUrl} onChange={(event) => setAI((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://openrouter.ai/api/v1" /></label>
        <label className="settings-field full-settings-field"><span>API Key {ai.apiKeySet && <i>当前已设置 {ai.apiKeyHint}</i>}</span><div className="secret-input"><KeyRound size={16} /><input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={ai.apiKeySet ? '留空则保留当前 Key' : '输入 API Key'} autoComplete="new-password" /><button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><small>页面不会读取或回显已保存的完整 Key。</small></label>
        <label className="settings-field"><span>请求超时（秒）</span><input type="number" min="5" max="300" value={ai.timeoutSeconds} onChange={(event) => setAI((current) => ({ ...current, timeoutSeconds: Number(event.target.value) || 60 }))} /></label>
      </div>}
      <div className="ai-boundary-note"><ShieldCheck size={16} /><div><strong>当前阶段只保存配置</strong><span>后续接入语义分析时，会先提供测试连接、调用范围和费用提示，不会静默调用模型。</span></div></div>
      <div className="settings-card-footer"><span className={message.includes('失败') ? 'settings-message is-error' : 'settings-message'}>{message && <CheckCircle2 size={15} />}{message}</span><button className="button button-primary" type="button" onClick={save} disabled={saving || loading}><Save size={16} />{saving ? '正在保存…' : '保存 AI 配置'}</button></div>
    </section>
  </div>
}
