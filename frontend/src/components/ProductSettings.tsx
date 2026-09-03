import { CheckCircle2, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Product, ProductCopyPayload } from '../types'

interface ProductSettingsProps {
  product: Product
  onSaveProduct: (payload: ProductCopyPayload) => Promise<void>
}

export function ProductSettings({ product, onSaveProduct }: ProductSettingsProps) {
  const [name, setName] = useState(product.name)
  const [title, setTitle] = useState(product.title)
  const [bullets, setBullets] = useState(() => Array.from({ length: 5 }, (_, index) => product.bullets[index] || ''))
  const [coreTerms, setCoreTerms] = useState(product.coreTerms.join(', '))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setName(product.name)
    setTitle(product.title)
    setBullets(Array.from({ length: 5 }, (_, index) => product.bullets[index] || ''))
    setCoreTerms(product.coreTerms.join(', '))
  }, [product])

  function updateBullet(index: number, value: string) {
    setBullets((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))
  }

  async function save() {
    if (!name.trim()) { setMessage('请先填写自定义名字。'); return }
    if (!title.trim()) { setMessage('请先填写产品标题。'); return }
    setSaving(true)
    setMessage('')
    try {
      const normalizedCoreTerms = coreTerms.split(/[,，\n]/).map((term) => term.trim().toLowerCase()).filter(Boolean)
      await onSaveProduct({ name: name.trim(), title: title.trim(), bullets: bullets.map((item) => item.trim()).filter(Boolean), coreTerms: normalizedCoreTerms })
      setMessage('自定义名字、标题、五点与核心词根已保存。')
    } catch {
      setMessage('保存失败，请检查本地 API。')
    } finally {
      setSaving(false)
    }
  }

  return <div className="product-settings-page">
    <header className="settings-page-head"><div><span className="panel-kicker">Product semantics / 产品语料</span><h1>产品资料</h1><p>维护当前产品的自定义名字、标题和五点。标题与五点会作为相关性判断的语义基线。</p></div><span className="settings-safety"><ShieldCheck size={16} />当前产品专属</span></header>
    <section className="settings-card copy-settings-card">
      <div className="settings-card-head"><div className="settings-card-icon"><Sparkles size={19} /></div><div><h2>自定义名字、标题与五点</h2><p>填写你自己的产品资料，不要粘贴竞品 Listing 文案。</p></div></div>
      <label className="settings-field display-name-field"><span>自定义名字 <em>*</em></span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="例如：26英寸黄杨木花环-US" /><small>{name.length} / 80</small><p>同步显示在左侧卡片、页面标题和产品中心，不参与关键词语义评分。</p></label>
      <label className="settings-field"><span>产品标题 <em>*</em></span><textarea value={title} onChange={(event) => setTitle(event.target.value)} rows={3} placeholder="输入完整英文标题" /><small>{title.length} 个字符</small></label>
      <label className="settings-field"><span>核心词根</span><input value={coreTerms} onChange={(event) => setCoreTerms(event.target.value)} placeholder="例如：boxwood wreath, front door wreath" /><small>系统会按长词组优先归类；用英文逗号、中文逗号或换行分隔。留空时，新产品将根据标题自动生成。</small></label>
      <div className="bullet-editor">{bullets.map((bullet, index) => <label className="settings-field bullet-field" key={index}><span><b>{index + 1}</b> 五点描述 {index + 1}</span><textarea value={bullet} onChange={(event) => updateBullet(index, event.target.value)} rows={3} placeholder={`输入第 ${index + 1} 条产品卖点`} /><small>{bullet.length} 个字符</small></label>)}</div>
      <div className="settings-card-footer"><span className={message.includes('失败') || message.includes('请先') ? 'settings-message is-error' : 'settings-message'}>{message && <CheckCircle2 size={15} />}{message}</span><button className="button button-primary" type="button" onClick={save} disabled={saving}><Save size={16} />{saving ? '正在保存…' : '保存产品资料'}</button></div>
    </section>
  </div>
}
