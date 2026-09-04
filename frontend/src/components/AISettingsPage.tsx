import { Bot, CheckCircle2, Eye, EyeOff, KeyRound, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AIConfig, AIConfigPayload } from '../types'
import { useI18n } from '../i18n'

const mimoPreset = { provider: 'mimo', baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5' }
const emptyAI: AIConfig = { ...mimoPreset, enabled: false, timeoutSeconds: 60, apiKeySet: false, apiKeyHint: '' }

export function AISettingsPage() {
  const { text } = useI18n()
  const [ai, setAI] = useState<AIConfig>(emptyAI)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    api.getAIConfig().then((config) => { if (active) setAI(config) }).catch(() => { if (active) setMessage(text('AI 配置读取失败，请检查本地 API。', 'Failed to load AI configuration. Please check the local API.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // Configuration loading should not repeat when only the display language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    if (!ai.baseUrl.trim() || !ai.model.trim()) { setMessage(text('请填写接口地址和模型名称。', 'Please provide the API base URL and model name.')); return }
    setSaving(true)
    setMessage('')
    try {
      const payload: AIConfigPayload = { provider: ai.provider, baseUrl: ai.baseUrl.trim(), model: ai.model.trim(), apiKey: apiKey.trim() || undefined, enabled: ai.enabled, timeoutSeconds: ai.timeoutSeconds }
      const saved = await api.saveAIConfig(payload)
      setAI(saved)
      setApiKey('')
      setMessage(text('AI 接口配置已保存到本机。完整 API Key 不会回显。', 'AI configuration saved locally. The full API key will never be echoed back.'))
    } catch (error) {
      setMessage(error instanceof Error ? text(`保存失败：${error.message}`, `Save failed: ${error.message}`) : text('AI 配置保存失败。', 'Failed to save AI configuration.'))
    } finally {
      setSaving(false)
    }
  }

  function selectProvider(provider: string) {
    setAI((current) => provider === 'mimo' ? { ...current, ...mimoPreset } : { ...current, provider })
  }

  return <div className="product-settings-page ai-workspace-page">
    <header className="settings-page-head"><div><span className="panel-kicker">{text('Workspace intelligence / 全局能力', 'Workspace intelligence / Global capability')}</span><h1>{text('AI 语义设置', 'AI Semantic Settings')}</h1><p>{text('这是整个工作台共用的模型接口。所有产品可复用同一配置，但每次语义分析仍按产品隔离。', 'This model connection is shared across the workspace. Products reuse the same configuration while semantic analysis remains isolated per product.')}</p></div><span className="settings-safety"><ShieldCheck size={16} />{text('工作台全局配置', 'Workspace-wide configuration')}</span></header>
    <section className="settings-card ai-settings-card">
      <div className="settings-card-head"><div className="settings-card-icon ai-icon"><Bot size={20} /></div><div><h2>{text('AI 语义模型接口', 'AI semantic model endpoint')}</h2><p>{text('配置工作台使用的语义模型接口，用于分类增强，不会自动执行广告或否定操作。', 'Configure the semantic model endpoint used by the workspace. It augments classification and never auto-executes ads or negatives.')}</p></div><label className="settings-switch"><input type="checkbox" checked={ai.enabled} onChange={(event) => setAI((current) => ({ ...current, enabled: event.target.checked }))} /><span />{text('启用配置', 'Enable')}</label></div>
      {loading ? <div className="settings-loading">{text('正在读取本地配置…', 'Loading local configuration…')}</div> : <div className="ai-form-grid">
        <label className="settings-field"><span>{text('接口类型', 'Provider')}</span><select value={ai.provider} onChange={(event) => selectProvider(event.target.value)}><option value="mimo">{text('默认语义接口', 'Default semantic endpoint')}</option><option value="openai_compatible">OpenAI Compatible</option><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="custom">{text('自定义', 'Custom')}</option></select></label>
        <label className="settings-field"><span>{text('模型名称', 'Model name')} <em>*</em></span><input value={ai.model} onChange={(event) => setAI((current) => ({ ...current, model: event.target.value }))} placeholder="e.g. provider/model-v2" /></label>
        <label className="settings-field full-settings-field"><span>API Base URL <em>*</em></span><input value={ai.baseUrl} onChange={(event) => setAI((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://api.example.com/v1" /></label>
        <label className="settings-field full-settings-field"><span>API Key {ai.apiKeySet && <i>{text(`当前已设置 ${ai.apiKeyHint}`, `Currently set ${ai.apiKeyHint}`)}</i>}</span><div className="secret-input"><KeyRound size={16} /><input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={ai.apiKeySet ? text('留空则保留当前 Key', 'Leave blank to keep the current key') : text('输入 API Key', 'Enter API key')} autoComplete="new-password" /><button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? text('隐藏 API Key', 'Hide API key') : text('显示 API Key', 'Show API key')}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><small>{text('页面不会读取或回显已保存的完整 Key。', 'The UI never reads or echoes the full stored key.')}</small></label>
        <label className="settings-field"><span>{text('请求超时（秒）', 'Request timeout (seconds)')}</span><input type="number" min="5" max="300" value={ai.timeoutSeconds} onChange={(event) => setAI((current) => ({ ...current, timeoutSeconds: Number(event.target.value) || 60 }))} /></label>
      </div>}
      <div className="ai-boundary-note"><ShieldCheck size={16} /><div><strong>{text('本地保存与显式调用', 'Local storage and explicit calls')}</strong><span>{text('模型调用只在用户主动执行语义审核时发生；API Key 保存在本地，广告动作始终需要人工审批。', 'Model calls occur only when the user explicitly runs semantic review. The API key stays local and advertising actions always require human approval.')}</span></div></div>
      <div className="settings-card-footer"><span className={/(失败|failed)/i.test(message) ? 'settings-message is-error' : 'settings-message'}>{message && <CheckCircle2 size={15} />}{message}</span><button className="button button-primary" type="button" onClick={save} disabled={saving || loading}><Save size={16} />{saving ? text('正在保存…', 'Saving…') : text('保存 AI 配置', 'Save AI configuration')}</button></div>
    </section>
  </div>
}
