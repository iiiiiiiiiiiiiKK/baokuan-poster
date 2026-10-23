/**
 * 文案助手：本地规则引擎（无需 API Key）+ 可选接入 OpenAI 兼容接口。
 * 无 Key 时依然提供：标题改写建议、字数统计、按模板推荐、要点拆分。
 */
import { useMemo, useState } from 'react'
import type { Content, Doc } from '../model/types'
import { TEMPLATES, getTemplate } from '../render/templates'
import { charCount, stripMarkup } from '../render/text'
import { Modal } from './components'

interface Suggestion {
  label: string
  title: string
  body: string
  note: string
}

function localSuggestions(doc: Doc): Suggestion[] {
  const t = stripMarkup(doc.content.title).trim()
  const b = stripMarkup(doc.content.body).trim()
  const clauses = b
    .split(/[。！？!?\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const out: Suggestion[] = []

  if (t) {
    const short = t.length > 18 ? `${t.slice(0, 17)}…` : t
    out.push({
      label: '更短更有力',
      title: short,
      body: b,
      note: `原标题 ${charCount(t)} 字 → ${charCount(short)} 字，信息流里更容易读完`,
    })
    out.push({
      label: '加冲突感',
      title: t.includes('不是') ? t : `不是${t.replace(/[。.!！]$/, '')}，而是选择`,
      body: b,
      note: '用「不是 A，而是 B」结构制造对比，主旨不变',
    })
    out.push({
      label: '加量化钩子',
      title: /[\d一二三四五六七八九十]/.test(t) ? t : `${t}（90% 的人做反了）`,
      body: b,
      note: '加入量化对比提升点击意愿；若与事实不符请手动改写',
    })
  }
  if (clauses.length > 1) {
    out.push({
      label: '拆成两个短段',
      title: t || clauses[0],
      body: clauses.slice(0, 2).join('\n'),
      note: '把长句拆成两段，竖图阅读时节奏更清楚',
    })
  }
  return out.slice(0, 4)
}

const SYSTEM_PROMPT = `你是中文社交媒体文案编辑。请保持原意不变，只做表达优化：
1) 标题不超过 20 个汉字，有观点、有冲突感，不使用夸张虚假承诺；
2) 正文不超过 120 字，保留全部关键信息；
3) 只输出 JSON：{"title": "...", "body": "..."}，不要任何解释。`

export function CopyDialog({
  doc,
  onClose,
  onApply,
  onToast,
}: {
  doc: Doc
  onClose: () => void
  onApply: (patch: Partial<Content>) => void
  onToast: (text: string, kind?: 'ok' | 'err' | 'info') => void
}) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('baokuan:apiKey') ?? '')
  const [baseUrl, setBaseUrl] = useState(
    () => localStorage.getItem('baokuan:baseUrl') ?? 'https://api.openai.com/v1',
  )
  const [model, setModel] = useState(() => localStorage.getItem('baokuan:model') ?? 'gpt-4o-mini')
  const [busy, setBusy] = useState(false)
  const [aiResult, setAiResult] = useState<{ title: string; body: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)

  const tpl = getTemplate(doc.templateId)
  const suggestions = useMemo(() => localSuggestions(doc), [doc])
  const titleLen = charCount(doc.content.title)
  const bodyLen = charCount(doc.content.body)
  const fitTemplates = useMemo(
    () => TEMPLATES.filter((t) => t.bodyHint >= bodyLen * 0.8 && t.id !== tpl.id).slice(0, 3),
    [bodyLen, tpl.id],
  )

  const callAi = async () => {
    if (!apiKey.trim()) {
      onToast('未填写 API Key，本地建议仍可正常使用', 'err')
      setShowConfig(true)
      return
    }
    setBusy(true)
    setErr(null)
    try {
      localStorage.setItem('baokuan:apiKey', apiKey)
      localStorage.setItem('baokuan:baseUrl', baseUrl)
      localStorage.setItem('baokuan:model', model)
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `标题：${doc.content.title}\n正文：${doc.content.body}\n模板：${tpl.name}（建议正文 ${tpl.bodyHint} 字以内）`,
            },
          ],
        }),
      })
      if (!res.ok) throw new Error(`接口返回 ${res.status}，请检查 Key / 模型名 / 代理地址`)
      const data = await res.json()
      const text: string = data?.choices?.[0]?.message?.content ?? ''
      const match = /\{[\s\S]*\}/.exec(text)
      if (!match) throw new Error('模型未返回预期 JSON')
      const parsed = JSON.parse(match[0]) as { title?: string; body?: string }
      setAiResult({
        title: String(parsed.title ?? doc.content.title),
        body: String(parsed.body ?? doc.content.body),
      })
      onToast('AI 优化完成，可对比后应用', 'ok')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI 调用失败'
      setErr(msg)
      onToast(`AI 调用失败：${msg}（本地功能不受影响）`, 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="文案助手"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            关闭
          </button>
          <button className="btn" onClick={() => setShowConfig((v) => !v)}>
            {showConfig ? '收起 AI 设置' : 'AI 设置（可选）'}
          </button>
          <button className="btn primary" disabled={busy} onClick={callAi}>
            {busy ? '请求中…' : 'AI 优化文案'}
          </button>
        </>
      }
    >
      <div className="row wrap" style={{ gap: 16, marginBottom: 12 }}>
        <span className="mini-label">
          标题 <b style={{ color: 'var(--text)' }}>{titleLen}</b> 字
        </span>
        <span className="mini-label">
          正文 <b style={{ color: 'var(--text)' }}>{bodyLen}</b> 字 · 当前模板舒适区 {tpl.bodyHint}{' '}
          字
        </span>
        <span className="mini-label">模板：{tpl.name}</span>
      </div>

      {bodyLen > tpl.bodyHint * 1.35 && (
        <div className="warning body" style={{ position: 'static', marginBottom: 12 }}>
          <span>
            正文偏长。可切换：
            {fitTemplates.length ? fitTemplates.map((t) => t.name).join(' / ') : '建议精简文字'}
          </span>
        </div>
      )}

      <div className="section-title" style={{ marginBottom: 8 }}>
        本地建议（无需 API Key）
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {suggestions.map((s, i) => (
          <div
            key={i}
            style={{
              border: '1px solid var(--line)',
              borderRadius: 9,
              padding: 10,
              background: 'var(--bg-panel-2)',
            }}
          >
            <div className="row" style={{ marginBottom: 6 }}>
              <span
                className="badge"
                style={{
                  background: 'var(--accent-soft)',
                  borderColor: 'transparent',
                  color: '#ffb27a',
                }}
              >
                {s.label}
              </span>
              <span className="grow" />
              <button className="btn sm" onClick={() => onApply({ title: s.title, body: s.body })}>
                应用到画布
              </button>
            </div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
            <div className="mini-label" style={{ lineHeight: 1.6 }}>
              {s.body.slice(0, 120)}
              {s.body.length > 120 ? '…' : ''}
            </div>
            <div className="mini-label" style={{ marginTop: 6, color: 'var(--text-faint)' }}>
              {s.note}
            </div>
          </div>
        ))}
        {suggestions.length === 0 && <div className="mini-label">先输入标题，再来看建议。</div>}
      </div>

      {aiResult && (
        <>
          <div className="hr" />
          <div className="section-title" style={{ marginBottom: 8 }}>
            AI 优化结果
          </div>
          <div
            style={{
              border: '1px solid rgba(46,204,113,0.4)',
              borderRadius: 9,
              padding: 10,
              background: 'rgba(46,204,113,0.06)',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{aiResult.title}</div>
            <div className="mini-label" style={{ lineHeight: 1.6 }}>
              {aiResult.body}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => onApply(aiResult)}>
                采用 AI 文案
              </button>
              <button className="btn sm ghost" onClick={() => setAiResult(null)}>
                丢弃
              </button>
            </div>
          </div>
        </>
      )}

      {showConfig && (
        <>
          <div className="hr" />
          <div className="section-title" style={{ marginBottom: 8 }}>
            AI 设置（可选 · 仅本地保存）
          </div>
          <div className="field">
            <div className="field-label">
              <span>API Key</span>
            </div>
            <input
              className="input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
            />
          </div>
          <div className="row">
            <div className="grow">
              <div className="field">
                <div className="field-label">
                  <span>Base URL（OpenAI 兼容）</span>
                </div>
                <input
                  className="input"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="grow">
              <div className="field">
                <div className="field-label">
                  <span>模型</span>
                </div>
                <input className="input" value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="mini-label" style={{ lineHeight: 1.7 }}>
            Key 仅存于浏览器 localStorage，请求直接从浏览器发往你填写的地址。不填写时，以上本地建议、排版与导出功能完全可用。
          </div>
        </>
      )}
      {err && (
        <div className="warning" style={{ position: 'static', marginTop: 10 }}>
          <span>{err}</span>
        </div>
      )}
    </Modal>
  )
}
