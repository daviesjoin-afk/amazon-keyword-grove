import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleHelp, FileSpreadsheet, Info, RefreshCw, Upload, X, XCircle } from 'lucide-react'
import type { FieldMapping, Product } from '../types'
import { useI18n } from '../i18n'

interface ImportWizardProps {
  product: Product
  mappings: FieldMapping[]
  onImport: (file: File) => Promise<Record<string, unknown>>
  onFinish: () => void | Promise<void>
}

export function ImportWizard({ product, mappings, onImport, onFinish }: ImportWizardProps) {
  const { text } = useI18n()
  const steps = [
    text('上传文件', 'Upload'),
    text('字段映射', 'Field mapping'),
    text('数据预览', 'Preview'),
    text('分析设置', 'Analysis'),
    text('完成报告', 'Report'),
  ]
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
      if (!selectedFile) { setImportError(text('请选择真实的卖家精灵文件后再导入。', 'Choose a real SellerSprite export before importing.')); return }
      setImporting(true); setImportError('')
      try { setImportResult(await onImport(selectedFile)); setStep(5) } catch (error) { setImportError(error instanceof Error ? error.message : text('导入失败', 'Import failed')) } finally { setImporting(false) }
      return
    }
    await onFinish()
  }

  const footerHint = step === 1
    ? text('支持 .xlsx、.xls、.csv，单文件最大 100 MB', 'Supports .xlsx, .xls, and .csv up to 100 MB per file')
    : step === 2
      ? text('字段映射可保存为模板，后续同格式自动识别', 'Field mappings can be reused for the same export format')
      : step === 3
        ? text('空值会保留为未知，不会静默转换为 0', 'Missing values remain unknown and are never silently converted to zero')
        : step === 4
          ? text('规则优先；AI 辅助仅在你主动开启时使用', 'Rules run first; AI is used only when you explicitly request semantic review')
          : text('本批次只写入本地词库，不会写入 Amazon', 'This batch is written only to the local library, never to Amazon')

  return <div className="import-page"><div className="page-heading-row import-heading"><div><span className="panel-kicker">Ingest pipeline / SellerSprite</span><h1>{text('导入关键词反查表', 'Import reverse-ASIN keywords')}</h1><p>{text('把卖家精灵导出的 Excel 变成产品级可维护资产。原始字段会保留，异常值会单独提示。', 'Turn SellerSprite exports into maintainable product-level keyword assets. Raw fields are retained and anomalous values are surfaced explicitly.')}</p></div><div className="import-safety-note"><Info size={15} /><span>{text('只处理你主动上传的文件', 'Processes only files you upload')}<br /><strong>{text('不会自动连接 Amazon', 'Never auto-connects to Amazon')}</strong></span></div></div><div className="wizard-stepper" aria-label={text('导入进度', 'Import progress')}>{steps.map((label, index) => { const value = index + 1; return <div className={`wizard-step ${value === step ? 'is-current' : value < step ? 'is-done' : ''}`} key={label}><span className="wizard-step-number">{value < step ? <Check size={13} /> : value}</span><span>{label}</span>{value < steps.length && <i className="wizard-step-line" />}</div> })}</div><section className="wizard-card">{step === 1 && <UploadStep fileInput={fileInput} dragging={dragging} onDragging={setDragging} onFile={acceptFile} />}{step === 2 && <MappingStep fileName={fileName} fileSize={fileSize} mappings={mappings} mappedCount={mappedCount} />}{step === 3 && <PreviewStep product={product} />}{step === 4 && <AnalysisStep analyzeMode={analyzeMode} setAnalyzeMode={setAnalyzeMode} dedupe={dedupe} setDedupe={setDedupe} />}{step === 5 && <ReportStep fileName={fileName} />}{importError && <div className="mapping-notice"><XCircle size={15} /><span>{importError}</span></div>}{importResult && step === 5 && <div className="mapping-notice"><CheckCircle2 size={15} /><span>{text(`真实导入完成：新增 ${String(importResult.inserted_rows ?? 0)}，更新 ${String(importResult.updated_rows ?? 0)}，竞品 ASIN ${Array.isArray(importResult.source_asins) ? importResult.source_asins.length : 0} 个。`, `Import complete: ${String(importResult.inserted_rows ?? 0)} inserted, ${String(importResult.updated_rows ?? 0)} updated, ${Array.isArray(importResult.source_asins) ? importResult.source_asins.length : 0} competitor ASINs.`)}</span></div>}</section><div className="wizard-footer"><button className="button button-secondary" type="button" onClick={() => step === 1 ? onFinish() : setStep(step - 1)}>{step === 1 ? <X size={16} /> : <ArrowLeft size={16} />}{step === 1 ? text('取消', 'Cancel') : text('上一步', 'Back')}</button><div className="wizard-footer-hint">{footerHint}</div><button className="button button-primary" type="button" onClick={() => void nextStep()} disabled={(step === 1 && !fileName) || importing}>{step === 5 ? <><CheckCircle2 size={16} />{text('返回词库', 'Return to library')}</> : <>{step === 4 ? importing ? text('正在清洗与分析…', 'Cleaning and analyzing…') : text('开始清洗与分析', 'Clean and analyze') : text('继续', 'Continue')}<ArrowRight size={16} /></>}</button></div></div>
}

function UploadStep({ fileInput, dragging, onDragging, onFile }: { fileInput: React.RefObject<HTMLInputElement>; dragging: boolean; onDragging: (value: boolean) => void; onFile: (file?: File) => void }) {
  const { text } = useI18n()
  return <div className="wizard-step-content upload-step-content"><div className="wizard-intro"><span className="step-ordinal">01 / SOURCE</span><h2>{text('从卖家精灵导出文件开始', 'Start with a SellerSprite export')}</h2><p>{text('支持关键词反查主表与词根表。一次只导入到当前产品，后续可继续追加其他竞品 ASIN。', 'Supports reverse-ASIN keyword sheets and root sheets. Each import belongs to the current product, and more competitor ASINs can be added later.')}</p></div><div className={`upload-dropzone ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); onDragging(true) }} onDragLeave={() => onDragging(false)} onDrop={(event) => { event.preventDefault(); onDragging(false); onFile(event.dataTransfer.files?.[0]) }}><input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /><span className="upload-icon"><Upload size={24} /></span><strong>{text('拖放 Excel / CSV 文件到这里', 'Drop an Excel / CSV file here')}</strong><span>{text('或', 'or')}</span><button className="button button-primary" type="button" onClick={() => fileInput.current?.click()}>{text('选择文件', 'Choose file')}</button><small>{text('支持 .xlsx、.xls、.csv · 推荐使用卖家精灵原始导出文件', 'Supports .xlsx, .xls, .csv · original SellerSprite exports are recommended')}</small></div><div className="sample-file-card"><div className="sample-file-icon"><FileSpreadsheet size={18} /></div><div><strong>{text('SellerSprite 格式示例已验证', 'SellerSprite format validated')}</strong><span>{text('支持多个竞品 ASIN 与增量关键词导入', 'Supports multiple competitor ASINs and incremental imports')}</span></div><span className="mapping-health"><CheckCircle2 size={14} />{text('兼容', 'Compatible')}</span></div><div className="upload-guard"><CircleHelp size={15} /><div><strong>{text('导入前检查', 'Before importing')}</strong><span>{text('请先在产品资料中填写标题和五点；上传的 ASIN 会作为竞品参考来源保存。', 'Add product title and bullets first. Imported ASINs are stored as competitor evidence sources.')}</span></div></div></div>
}

function MappingStep({ fileName, fileSize, mappings, mappedCount }: { fileName: string; fileSize: string; mappings: FieldMapping[]; mappedCount: number }) {
  const { text } = useI18n()
  function statusLabel(status: string) {
    return status === '已识别' ? text('已识别', 'Recognized') : status === '需确认' ? text('需确认', 'Review') : status === '忽略' ? text('忽略', 'Ignored') : status
  }
  return <div className="wizard-step-content"><div className="wizard-intro compact-intro"><span className="step-ordinal">02 / MAPPING</span><h2>{text('确认字段映射', 'Confirm field mapping')}</h2><p>{text('卖家精灵列名已按别名识别。无法稳定解析的原始值会保留在扩展字段中，不会丢失。', 'SellerSprite headers are recognized by aliases. Raw values that cannot be parsed reliably are preserved in extension fields.')}</p></div><div className="selected-file-banner"><span className="file-icon"><FileSpreadsheet size={17} /></span><div><strong>{fileName}</strong><span>{fileSize}</span></div><span className="mapping-health"><CheckCircle2 size={14} />{text(`${mappedCount} 个字段已识别`, `${mappedCount} fields recognized`)}</span></div><div className="mapping-table-wrap"><table className="mapping-table"><thead><tr><th>{text('卖家精灵原始列', 'Source column')}</th><th>{text('映射到工具字段', 'Mapped field')}</th><th>{text('首行示例', 'Sample')}</th><th>{text('状态', 'Status')}</th></tr></thead><tbody>{mappings.map((mapping) => <tr key={mapping.source}><td><strong>{mapping.source}</strong></td><td><select aria-label={text(`${mapping.source} 映射字段`, `Map ${mapping.source}`)} defaultValue={mapping.target}><option value={mapping.target}>{mapping.target}</option><option value="raw_extension">{text('保留为原始扩展字段', 'Keep as raw extension field')}</option><option value="ignore">{text('忽略（仍保留原始表）', 'Ignore (raw source still retained)')}</option></select></td><td><code>{mapping.sample}</code></td><td><span className={`mapping-status mapping-${mapping.status === '已识别' ? 'ok' : mapping.status === '需确认' ? 'warn' : 'ignore'}`}>{mapping.status === '已识别' ? <Check size={13} /> : mapping.status === '需确认' ? <CircleHelp size={13} /> : <X size={13} />}{statusLabel(mapping.status)}</span></td></tr>)}</tbody></table></div><div className="mapping-notice"><Info size={15} /><span><strong>{text('字段校验已启用：', 'Field validation is enabled:')}</strong>{text('当前样表的 PPC 竞价和流量占比均通过格式检查；未来遇到异常值会保留原文并排除评分，不会静默当作 0。', 'PPC bid and traffic-share values are format-checked. Invalid future values retain the raw text and are excluded from scoring instead of silently becoming zero.')}</span></div></div>
}

function PreviewStep({ product }: { product: Product }) {
  const { text } = useI18n()
  const rows = [
    ['artificial boxwood wreath', '人造黄杨木花环', '14,800', '18 / 20', text('自然 / SP', 'Organic / SP'), '98'],
    ['front door wreath', '前门花环', '33,100', '20 / 20', text('自然 / SP / 视频', 'Organic / SP / Video'), '94'],
    ['blue artificial wreath', '蓝色人造花环', '3,600', '2 / 20', text('自然 / SP', 'Organic / SP'), '9'],
    ['waterproof outdoor wreath', '防水户外花环', '3,600', '8 / 20', text('自然 / SP', 'Organic / SP'), '90'],
  ]
  return <div className="wizard-step-content"><div className="wizard-intro compact-intro"><span className="step-ordinal">03 / PREVIEW</span><h2>{text('预览清洗后的数据', 'Preview normalized data')}</h2><p>{text('以产品标题和五点为语料进行首轮语义评分，同时用竞品 ASIN 占比展示相关性。关键词只会归属到当前产品，不会跨产品污染。', 'Product title and bullets provide semantic evidence while competitor-ASIN coverage expresses relevance. Keywords remain isolated to the current product.')}</p></div><div className="preview-info-strip"><span><strong>{product.name}</strong><small>{product.site} · {text('竞品参考', 'Competitor reference')} {product.referenceAsin}</small></span><span><b>2,000</b> {text('行待处理', 'rows pending')}</span><span><b>20</b> {text('个来源 ASIN', 'source ASINs')}</span><span className="preview-warning"><Info size={14} />{text('缺失字段保留为未知', 'Missing fields remain unknown')}</span></div><div className="preview-table-wrap"><table className="preview-table"><thead><tr><th>{text('关键词', 'Keyword')}</th><th>{text('翻译', 'Translation')}</th><th>{text('月搜索量', 'Monthly search volume')}</th><th>{text('相关性（竞品占比）', 'Relevance (competitor coverage)')}</th><th>{text('流量类型', 'Traffic type')}</th><th>{text('语义评分', 'Semantic score')}</th></tr></thead><tbody>{rows.map((row) => <tr key={row[0]}><td><strong>{row[0]}</strong></td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td><span className="traffic-types">{row[4].split(' / ').map((item) => <span key={item}>{item}</span>)}</span></td><td><strong className={Number(row[5]) >= 80 ? 'score-good' : Number(row[5]) >= 50 ? 'score-mid' : 'score-bad'}>{row[5]}</strong></td></tr>)}</tbody></table></div><div className="preview-footnote"><Info size={14} /><span>{text('预览仅显示前 4 行。相关性按当前竞品 ASIN 占比计算（例如 5/20）；语义评分仅作为双重审核证据。', 'Preview shows four rows only. Relevance is competitor-ASIN coverage (for example 5/20); the semantic score is supporting evidence for the two-stage review.')}</span></div></div>
}

function AnalysisStep({ analyzeMode, setAnalyzeMode, dedupe, setDedupe }: { analyzeMode: 'rule' | 'assist'; setAnalyzeMode: (mode: 'rule' | 'assist') => void; dedupe: boolean; setDedupe: (value: boolean) => void }) {
  const { text } = useI18n()
  return <div className="wizard-step-content"><div className="wizard-intro compact-intro"><span className="step-ordinal">04 / ANALYSIS</span><h2>{text('设置清洗与分析方式', 'Configure normalization and analysis')}</h2><p>{text('导入时先执行内置规则预审；完成导入后，必须在产品工作台运行 AI 全量审核，最终投放和否词草稿才算双重审核结果。', 'Imports run deterministic pre-review first. After import, run AI review from the workbench before treating targeting and negative-keyword drafts as two-stage reviewed results.')}</p></div><div className="analysis-option-grid"><label className={`analysis-option ${analyzeMode === 'rule' ? 'is-selected' : ''}`}><input type="radio" name="analyze-mode" checked={analyzeMode === 'rule'} onChange={() => setAnalyzeMode('rule')} /><span className="analysis-option-icon"><CheckCircle2 size={18} /></span><span><strong>{text('内置规则预审', 'Deterministic rule pre-review')}</strong><small>{text('使用标题、五点、核心词根和冲突词完成首轮相关性分析；结果会等待 AI 二审。', 'Uses title, bullets, core roots, and conflicts for first-pass relevance analysis; results then wait for AI review.')}</small></span><em>{text('必经', 'Required')}</em></label><label className={`analysis-option ${analyzeMode === 'assist' ? 'is-selected' : ''}`}><input type="radio" name="analyze-mode" checked={analyzeMode === 'assist'} onChange={() => setAnalyzeMode('assist')} /><span className="analysis-option-icon"><RefreshCw size={18} /></span><span><strong>{text('AI 全量二审', 'AI full semantic review')}</strong><small>{text('在工作台按有界批次发送全部关键词，结合产品资料和内置规则证据生成最终草稿。', 'Sends keywords in bounded batches from the workbench and combines product context with rule evidence for final drafts.')}</small></span><em className="option-beta">{text('必需', 'Required')}</em></label></div><div className="analysis-checklist"><label><input type="checkbox" checked={dedupe} onChange={(event) => setDedupe(event.target.checked)} /><span><strong>{text('按产品 + 站点 + 标准化关键词去重', 'Deduplicate by product + marketplace + normalized keyword')}</strong><small>{text('英文统一小写、清理首尾空格与不可见字符，不执行词干化。', 'English text is lowercased and whitespace/invisible characters are cleaned; stemming is not applied.')}</small></span></label><label><input type="checkbox" defaultChecked /><span><strong>{text('保留所有原始扩展字段', 'Retain all raw extension fields')}</strong><small>{text('未知列和无法解析值仍可在详情抽屉查看。', 'Unknown columns and unparsable values remain inspectable in keyword details.')}</small></span></label><label><input type="checkbox" defaultChecked /><span><strong>{text('生成双审广告建议草稿', 'Generate two-stage advertising drafts')}</strong><small>{text('最终只保留精准、广泛、观察、否定精准和否定词组；结果仍需人工审批。', 'Final actions are exact, broad, observe, negative exact, or negative phrase; every result still requires human approval.')}</small></span></label></div></div>
}

function ReportStep({ fileName }: { fileName: string }) {
  const { text } = useI18n()
  return <div className="wizard-step-content report-step-content"><div className="report-success-icon"><CheckCircle2 size={28} /></div><span className="step-ordinal">05 / REPORT</span><h2>{text('导入准备完成', 'Import preparation complete')}</h2><p>{text(`${fileName} 已通过结构校验，下面是将写入产品词库的处理摘要。`, `${fileName} passed structural validation. The summary below describes what will be written to the product library.`)}</p><div className="report-grid"><div><b>2,000</b><span>{text('总行数', 'Total rows')}</span></div><div><b className="report-green">2,000</b><span>{text('新增关键词', 'New keywords')}</span></div><div><b>0</b><span>{text('重复跳过', 'Duplicates skipped')}</span></div><div><b className="report-amber">{text('待 AI 二审', 'Awaiting AI review')}</b><span>{text('最终决策', 'Final decision')}</span></div></div><div className="report-next-step"><div className="callout-icon"><Check size={17} /></div><div><strong>{text('下一步', 'Next step')}</strong><p>{text('系统会将本批次写入当前产品并保留导入记录。返回工作台后点击“AI 全量审核”，全部关键词通过内置规则和 AI 双重审核后，才生成最终投放/否词草稿。', 'The batch is written to the current product with an import record. Back in the workbench, run AI review so all keywords receive both deterministic and semantic review before final targeting/negative drafts are used.')}</p></div></div><div className="report-note"><Info size={14} />{text('上传的 ASIN 会标记为竞品参考来源，不会被当作自有产品。', 'Imported ASINs are marked as competitor evidence sources, not owned products.')}</div></div>
}
