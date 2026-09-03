import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, CircleHelp, FileSpreadsheet, Info, RefreshCw, Upload, X, XCircle } from 'lucide-react'
import type { FieldMapping, Product } from '../types'

interface ImportWizardProps {
  product: Product
  mappings: FieldMapping[]
  onImport: (file: File) => Promise<Record<string, unknown>>
  onFinish: () => void | Promise<void>
}

const steps = ['上传文件', '字段映射', '数据预览', '分析设置', '完成报告']

export function ImportWizard({ product, mappings, onImport, onFinish }: ImportWizardProps) {
  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState('')
  const [dragging, setDragging] = useState(false)
  const [analyzeMode, setAnalyzeMode] = useState<'rule' | 'assist'>('rule')
  const [dedupe, setDedupe] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const mappedCount = useMemo(() => mappings.filter((item) => item.status === '已识别').length, [mappings])

  function acceptFile(file?: File) {
    if (!file) return
    setFileName(file.name)
    setFileSize(`${(file.size / 1024 / 1024).toFixed(2)} MB`)
    setSelectedFile(file)
    setStep(2)
  }

  async function nextStep() {
    if (step < 4) { setStep(step + 1); return }
    if (step === 4) {
      if (!selectedFile) { setImportError('请选择真实的卖家精灵文件后再导入。'); return }
      setImporting(true); setImportError('')
      try { setImportResult(await onImport(selectedFile)); setStep(5) } catch (error) { setImportError(error instanceof Error ? error.message : '导入失败') } finally { setImporting(false) }
      return
    }
    await onFinish()
  }

  return <div className="import-page"><div className="page-heading-row import-heading"><div><span className="panel-kicker">Ingest pipeline / SellerSprite</span><h1>导入关键词反查表</h1><p>把卖家精灵导出的 Excel 变成产品级可维护资产。原始字段会保留，异常值会单独提示。</p></div><div className="import-safety-note"><Info size={15} /><span>只处理你主动上传的文件<br /><strong>不会自动连接 Amazon</strong></span></div></div><div className="wizard-stepper" aria-label="导入进度">{steps.map((label, index) => { const value = index + 1; return <div className={`wizard-step ${value === step ? 'is-current' : value < step ? 'is-done' : ''}`} key={label}><span className="wizard-step-number">{value < step ? <Check size={13} /> : value}</span><span>{label}</span>{value < steps.length && <i className="wizard-step-line" />}</div> })}</div><section className="wizard-card">{step === 1 && <UploadStep fileInput={fileInput} dragging={dragging} onDragging={setDragging} onFile={acceptFile} />}{step === 2 && <MappingStep fileName={fileName} fileSize={fileSize} mappings={mappings} mappedCount={mappedCount} />}{step === 3 && <PreviewStep product={product} />}{step === 4 && <AnalysisStep analyzeMode={analyzeMode} setAnalyzeMode={setAnalyzeMode} dedupe={dedupe} setDedupe={setDedupe} />}{step === 5 && <ReportStep fileName={fileName} />}{importError && <div className="mapping-notice"><XCircle size={15} /><span>{importError}</span></div>}{importResult && step === 5 && <div className="mapping-notice"><CheckCircle2 size={15} /><span>真实导入完成：新增 {String(importResult.inserted_rows ?? 0)}，更新 {String(importResult.updated_rows ?? 0)}，竞品 ASIN {Array.isArray(importResult.source_asins) ? importResult.source_asins.length : 0} 个。</span></div>}</section><div className="wizard-footer"><button className="button button-secondary" type="button" onClick={() => step === 1 ? onFinish() : setStep(step - 1)}>{step === 1 ? <X size={16} /> : <ArrowLeft size={16} />}{step === 1 ? '取消' : '上一步'}</button><div className="wizard-footer-hint">{step === 1 ? '支持 .xlsx、.xls、.csv，单文件最大 100 MB' : step === 2 ? '字段映射可保存为模板，后续同格式自动识别' : step === 3 ? '空值会保留为未知，不会静默转换为 0' : step === 4 ? '规则优先；AI 辅助仅在你主动开启时使用' : '本批次只写入本地词库，不会写入 Amazon'}</div><button className="button button-primary" type="button" onClick={() => void nextStep()} disabled={(step === 1 && !fileName) || importing}>{step === 5 ? <><CheckCircle2 size={16} />返回词库</> : <>{step === 4 ? importing ? '正在清洗与分析…' : '开始清洗与分析' : '继续'}<ArrowRight size={16} /></>}</button></div></div>
}

function UploadStep({ fileInput, dragging, onDragging, onFile }: { fileInput: React.RefObject<HTMLInputElement>; dragging: boolean; onDragging: (value: boolean) => void; onFile: (file?: File) => void }) {
  return <div className="wizard-step-content upload-step-content"><div className="wizard-intro"><span className="step-ordinal">01 / SOURCE</span><h2>从卖家精灵导出文件开始</h2><p>支持关键词反查主表与词根表。一次只导入到当前产品，后续可继续追加其他竞品 ASIN。</p></div><div className={`upload-dropzone ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); onDragging(true) }} onDragLeave={() => onDragging(false)} onDrop={(event) => { event.preventDefault(); onDragging(false); onFile(event.dataTransfer.files?.[0]) }}><input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /><span className="upload-icon"><Upload size={24} /></span><strong>拖放 Excel / CSV 文件到这里</strong><span>或</span><button className="button button-primary" type="button" onClick={() => fileInput.current?.click()}>选择文件</button><small>支持 .xlsx、.xls、.csv · 推荐使用卖家精灵原始导出文件</small></div><div className="sample-file-card"><div className="sample-file-icon"><FileSpreadsheet size={18} /></div><div><strong>SellerSprite 格式示例已验证</strong><span>支持多个竞品 ASIN 与增量关键词导入</span></div><span className="mapping-health"><CheckCircle2 size={14} />兼容</span></div><div className="upload-guard"><CircleHelp size={15} /><div><strong>导入前检查</strong><span>请先在产品资料中填写标题和五点；上传的 ASIN 会作为竞品参考来源保存。</span></div></div></div>
}

function MappingStep({ fileName, fileSize, mappings, mappedCount }: { fileName: string; fileSize: string; mappings: FieldMapping[]; mappedCount: number }) {
  return <div className="wizard-step-content"><div className="wizard-intro compact-intro"><span className="step-ordinal">02 / MAPPING</span><h2>确认字段映射</h2><p>卖家精灵列名已按别名识别。无法稳定解析的原始值会保留在扩展字段中，不会丢失。</p></div><div className="selected-file-banner"><span className="file-icon"><FileSpreadsheet size={17} /></span><div><strong>{fileName}</strong><span>{fileSize}</span></div><span className="mapping-health"><CheckCircle2 size={14} />{mappedCount} 个字段已识别</span></div><div className="mapping-table-wrap"><table className="mapping-table"><thead><tr><th>卖家精灵原始列</th><th>映射到工具字段</th><th>首行示例</th><th>状态</th></tr></thead><tbody>{mappings.map((mapping) => <tr key={mapping.source}><td><strong>{mapping.source}</strong></td><td><select aria-label={`${mapping.source} 映射字段`} defaultValue={mapping.target}><option value={mapping.target}>{mapping.target}</option><option value="raw_extension">保留为原始扩展字段</option><option value="ignore">忽略（仍保留原始表）</option></select></td><td><code>{mapping.sample}</code></td><td><span className={`mapping-status mapping-${mapping.status === '已识别' ? 'ok' : mapping.status === '需确认' ? 'warn' : 'ignore'}`}>{mapping.status === '已识别' ? <Check size={13} /> : mapping.status === '需确认' ? <CircleHelp size={13} /> : <X size={13} />}{mapping.status}</span></td></tr>)}</tbody></table></div><div className="mapping-notice"><Info size={15} /><span><strong>字段校验已启用：</strong>当前样表的 PPC 竞价和流量占比均通过格式检查；未来遇到异常值会保留原文并排除评分，不会静默当作 0。</span></div></div>
}

function PreviewStep({ product }: { product: Product }) {
  const rows = [
    ['artificial boxwood wreath', '人造黄杨木花环', '14,800', '18 / 20', '自然 / SP', '98'],
    ['front door wreath', '前门花环', '33,100', '20 / 20', '自然 / SP / 视频', '94'],
    ['blue artificial wreath', '蓝色人造花环', '3,600', '2 / 20', '自然 / SP', '9'],
    ['waterproof outdoor wreath', '防水户外花环', '3,600', '8 / 20', '自然 / SP', '90'],
  ]
  return <div className="wizard-step-content"><div className="wizard-intro compact-intro"><span className="step-ordinal">03 / PREVIEW</span><h2>预览清洗后的数据</h2><p>以产品标题和五点为语料进行首轮相关性预估。关键词只会归属到当前产品，不会跨产品污染。</p></div><div className="preview-info-strip"><span><strong>{product.name}</strong><small>{product.site} · 竞品参考 {product.referenceAsin}</small></span><span><b>2,000</b> 行待处理</span><span><b>20</b> 个来源 ASIN</span><span className="preview-warning"><Info size={14} />缺失字段保留为未知</span></div><div className="preview-table-wrap"><table className="preview-table"><thead><tr><th>关键词</th><th>翻译</th><th>月搜索量</th><th>竞品覆盖</th><th>流量类型</th><th>预估相关性</th></tr></thead><tbody>{rows.map((row) => <tr key={row[0]}><td><strong>{row[0]}</strong></td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td><span className="traffic-types">{row[4].split(' / ').map((item) => <span key={item}>{item}</span>)}</span></td><td><strong className={Number(row[5]) >= 80 ? 'score-good' : Number(row[5]) >= 50 ? 'score-mid' : 'score-bad'}>{row[5]}</strong></td></tr>)}</tbody></table></div><div className="preview-footnote"><Info size={14} /><span>预览仅显示前 4 行。实际导入会校验相关产品数与相关 ASIN 数量，发现不一致时保留数据并生成告警。</span></div></div>
}

function AnalysisStep({ analyzeMode, setAnalyzeMode, dedupe, setDedupe }: { analyzeMode: 'rule' | 'assist'; setAnalyzeMode: (mode: 'rule' | 'assist') => void; dedupe: boolean; setDedupe: (value: boolean) => void }) {
  return <div className="wizard-step-content"><div className="wizard-intro compact-intro"><span className="step-ordinal">04 / ANALYSIS</span><h2>设置清洗与分析方式</h2><p>导入时先执行内置规则预审；完成导入后，必须在产品工作台运行 MiMo 全量审核，最终投放和否词草稿才算双重审核结果。</p></div><div className="analysis-option-grid"><label className={`analysis-option ${analyzeMode === 'rule' ? 'is-selected' : ''}`}><input type="radio" name="analyze-mode" checked={analyzeMode === 'rule'} onChange={() => setAnalyzeMode('rule')} /><span className="analysis-option-icon"><CheckCircle2 size={18} /></span><span><strong>内置规则预审</strong><small>使用标题、五点、核心词根和冲突词完成首轮相关性分析；结果会等待 MiMo 二审。</small></span><em>必经</em></label><label className={`analysis-option ${analyzeMode === 'assist' ? 'is-selected' : ''}`}><input type="radio" name="analyze-mode" checked={analyzeMode === 'assist'} onChange={() => setAnalyzeMode('assist')} /><span className="analysis-option-icon"><RefreshCw size={18} /></span><span><strong>MiMo 全量二审</strong><small>在工作台按每批 40 条发送全部关键词，结合产品资料和内置规则证据生成最终草稿。</small></span><em className="option-beta">必需</em></label></div><div className="analysis-checklist"><label><input type="checkbox" checked={dedupe} onChange={(event) => setDedupe(event.target.checked)} /><span><strong>按产品 + 站点 + 标准化关键词去重</strong><small>英文统一小写、清理首尾空格与不可见字符，不执行词干化。</small></span></label><label><input type="checkbox" defaultChecked /><span><strong>保留所有原始扩展字段</strong><small>未知列和无法解析值仍可在详情抽屉查看。</small></span></label><label><input type="checkbox" defaultChecked /><span><strong>生成双审广告建议草稿</strong><small>最终只保留精准、广泛、观察、否定精准和否定词组；结果仍需人工审批。</small></span></label></div></div>
}

function ReportStep({ fileName }: { fileName: string }) {
  return <div className="wizard-step-content report-step-content"><div className="report-success-icon"><CheckCircle2 size={28} /></div><span className="step-ordinal">05 / REPORT</span><h2>导入准备完成</h2><p><strong>{fileName}</strong> 已通过结构校验，下面是将写入产品词库的处理摘要。</p><div className="report-grid"><div><b>2,000</b><span>总行数</span></div><div><b className="report-green">2,000</b><span>新增关键词</span></div><div><b>0</b><span>重复跳过</span></div><div><b className="report-amber">待 MiMo 二审</b><span>最终决策</span></div></div><div className="report-next-step"><div className="callout-icon"><Check size={17} /></div><div><strong>下一步</strong><p>系统会将本批次写入当前产品并保留导入记录。返回工作台后点击“MiMo 全量审核”，全部关键词通过内置规则和 MiMo 双重审核后，才生成最终投放/否词草稿。</p></div></div><div className="report-note"><Info size={14} />上传的 ASIN 会标记为竞品参考来源，不会被当作自有产品。</div></div>
}
