import { useMemo, useRef, useState } from 'react'
import { TEMPLATES } from '../render/templates'
import type { Doc, RatioKey } from '../model/types'
import { RATIOS } from '../model/presets'
import { Section } from './components'
import { TemplateThumb } from './Stage'

export type TemplateWithDoc = (id: string) => Doc

export function TemplatePanel({
  doc,
  onSelect,
  onReset,
  makePreviewDoc,
}: {
  doc: Doc
  onSelect: (id: string) => void
  onReset: () => void
  makePreviewDoc: TemplateWithDoc
}) {
  const previews = useMemo(() => TEMPLATES.map((t) => makePreviewDoc(t.id)), [makePreviewDoc])

  return (
    <Section
      title="模板"
      hint={`${TEMPLATES.length} 套 · 各自独立的排版逻辑`}
      right={
        <button className="btn sm ghost" onClick={onReset} title="恢复该模板的示例文案与样式（可撤销）">
          重置模板
        </button>
      }
    >
      <div className="tpl-grid">
        {TEMPLATES.map((t, i) => (
          <button
            key={t.id}
            className={`tpl-card ${doc.templateId === t.id ? 'active' : ''}`}
            onClick={() => onSelect(t.id)}
            title={t.tagline}
            data-testid={`tpl-${t.id}`}
          >
            <TemplateThumb doc={previews[i]} />
            <div className="tpl-meta">
              <div className="tpl-name">{t.name}</div>
              <div className="tpl-tag">
                {t.tag} · 推荐 {t.bestRatio}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Section>
  )
}

export function RatioPanel({
  doc,
  onRatio,
  onCustom,
}: {
  doc: Doc
  onRatio: (k: RatioKey) => void
  onCustom: (w: number, h: number) => void
}) {
  const [w, setW] = useState(doc.width)
  const [h, setH] = useState(doc.height)

  return (
    <Section title="图片比例" hint="切换后画布与导出同步">
      <ChipsInline
        items={RATIOS.map((r) => ({ key: r.key, label: r.label, hint: r.hint }))}
        value={doc.ratioKey}
        onChange={(k) => onRatio(k as RatioKey)}
      />
      {doc.ratioKey === 'custom' && (
        <div className="row" style={{ marginTop: 10 }}>
          <input
            className="input sm grow"
            type="number"
            value={w}
            min={240}
            max={4096}
            onChange={(e) => setW(Number(e.target.value))}
            aria-label="宽度"
          />
          <span className="mini-label">×</span>
          <input
            className="input sm grow"
            type="number"
            value={h}
            min={240}
            max={4096}
            onChange={(e) => setH(Number(e.target.value))}
            aria-label="高度"
          />
          <button className="btn sm" onClick={() => onCustom(w, h)}>
            应用
          </button>
        </div>
      )}
      <div className="mini-label" style={{ marginTop: 8 }}>
        当前 {doc.width} × {doc.height} px
      </div>
    </Section>
  )
}

/** 带 hint 的胶囊按钮组 */
export function ChipsInline({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string; hint?: string }[]
  value: string
  onChange: (k: string) => void
}) {
  return (
    <div className="chip-row">
      {items.map((o) => (
        <button
          key={o.key}
          className={`chip ${value === o.key ? 'active' : ''}`}
          onClick={() => onChange(o.key)}
          title={o.hint}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ImagePanel({
  doc,
  onFile,
  onRemove,
  onPatch,
}: {
  doc: Doc
  onFile: (file: File) => void
  onRemove: () => void
  onPatch: (patch: Record<string, number | string | boolean>) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  return (
    <Section
      title="配图"
      hint="仅在本地处理，不上传服务器"
      right={
        doc.image ? (
          <button className="btn sm ghost" onClick={onRemove}>
            移除
          </button>
        ) : undefined
      }
    >
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          const f = e.dataTransfer.files?.[0]
          if (f && f.type.startsWith('image/')) onFile(f)
        }}
        style={{
          border: `1px dashed ${drag ? 'var(--accent)' : 'var(--line)'}`,
          borderRadius: 9,
          padding: '12px 10px',
          textAlign: 'center',
          background: drag ? 'var(--accent-soft)' : 'var(--bg-panel-2)',
        }}
      >
        {doc.image ? (
          <img
            src={doc.image.src}
            alt="已上传配图"
            style={{ maxWidth: '100%', maxHeight: 92, borderRadius: 6, display: 'block', margin: '0 auto 8px' }}
          />
        ) : (
          <div className="mini-label" style={{ marginBottom: 8, lineHeight: 1.6 }}>
            拖入图片，或点击选择
            <br />
            支持 PNG / JPG / WebP，建议 1080px 以上
          </div>
        )}
        <button className="btn sm" onClick={() => fileRef.current?.click()}>
          {doc.image ? '更换图片' : '上传本地图片'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          data-testid="image-input"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
      </div>

      {doc.image && (
        <div style={{ marginTop: 10 }}>
          <RangeRow
            label="透明度"
            value={doc.image.opacity}
            display={`${Math.round(doc.image.opacity * 100)}%`}
            min={0.05}
            max={1}
            step={0.01}
            onChange={(v) => onPatch({ opacity: v })}
          />
          <RangeRow
            label="缩放"
            value={doc.image.scale}
            display={`${doc.image.scale.toFixed(2)}×`}
            min={0.4}
            max={2.4}
            step={0.02}
            onChange={(v) => onPatch({ scale: v })}
          />
          <RangeRow
            label="模糊"
            value={doc.image.blur}
            display={`${Math.round(doc.image.blur)}px`}
            min={0}
            max={24}
            step={0.5}
            onChange={(v) => onPatch({ blur: v })}
          />
          <div className="row">
            <button
              className="btn sm grow"
              onClick={() => onPatch({ offsetX: 0, offsetY: 0, scale: 1 })}
            >
              居中还原
            </button>
            <button
              className="btn sm grow"
              onClick={() => onPatch({ fit: doc.image?.fit === 'cover' ? 'contain' : 'cover' })}
            >
              {doc.image?.fit === 'cover' ? '完整显示' : '填满裁切'}
            </button>
          </div>
        </div>
      )}
    </Section>
  )
}

export function RangeRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="field">
      <div className="field-label">
        <span>{label}</span>
        <span className="val">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}
