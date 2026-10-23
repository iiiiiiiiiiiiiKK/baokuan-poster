import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/* ---------------- 作者链接（𝕏 / Twitter） ---------------- */

/**
 * 顶部的作者 X 链接。用数学粗体双线体字符 𝕏 呈现，
 * 新标签页打开并带 noopener。
 */
export function AuthorXLink({
  handle = 'oAdam',
  url = 'https://x.com/oAdam',
}: {
  handle?: string
  url?: string
}) {
  return (
    <a
      className="author-x"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`作者 @${handle} · ${url}`}
      aria-label={`作者 X 主页 @${handle}`}
    >
      <span className="x-glyph" aria-hidden="true">
        𝕏
      </span>
      <span className="x-handle">@{handle}</span>
    </a>
  )
}

/* ---------------- 基础控件 ---------------- */

export function Field({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-label">
        <span>{label}</span>
        {value != null && <span className="val">{value}</span>}
      </div>
      {children}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const [local, setLocal] = useState(value)
  const dragging = useRef(false)
  useEffect(() => {
    if (!dragging.current) setLocal(value)
  }, [value])
  return (
    <Field label={label} value={format ? format(local) : `${Math.round(local * 10) / 10}${unit}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        onPointerDown={() => {
          dragging.current = true
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        onBlur={() => {
          dragging.current = false
        }}
        onChange={(e) => {
          const v = Number(e.target.value)
          setLocal(v)
          onChange(v)
        }}
      />
    </Field>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={value === o.key ? 'active' : ''}
          onClick={() => onChange(o.key)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ColorField({
  label,
  value,
  onChange,
  presets = [],
}: {
  label: string
  value: string
  onChange: (v: string) => void
  presets?: string[]
}) {
  return (
    <div className="field">
      <div className="field-label">
        <span>{label}</span>
        <span className="val">{value.toUpperCase()}</span>
      </div>
      <div className="color-row">
        <label className="color-chip" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        </label>
        <input
          className="input sm"
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim()
            if (/^#?[0-9a-fA-F]{3,6}$/.test(v)) onChange(v.startsWith('#') ? v : `#${v}`)
          }}
          spellCheck={false}
        />
      </div>
      {presets.length > 0 && (
        <div className="swatches" style={{ marginTop: 6 }}>
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch ${c.toLowerCase() === value.toLowerCase() ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => onChange(c)}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="chip-row">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={`chip ${value === o.key ? 'active' : ''}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Section({
  title,
  hint,
  right,
  children,
}: {
  title: string
  hint?: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="panel-section">
      <div className="section-head">
        <div>
          <div className="section-title">{title}</div>
          {hint && <div className="section-hint" style={{ marginTop: 3 }}>{hint}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

/* ---------------- 提示 ---------------- */

export interface ToastItem {
  id: number
  text: string
  kind: 'ok' | 'err' | 'info'
}

export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((text: string, kind: ToastItem['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev.slice(-3), { id, text, kind }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, kind === 'err' ? 5200 : 2800)
  }, [])
  return { items, push }
}

export function Toasts({ items }: { items: ToastItem[] }) {
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind === 'ok' ? 'ok' : t.kind === 'err' ? 'err' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function Modal({
  title,
  children,
  footer,
  onClose,
  wide,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { width: 'min(920px, 100%)' } : undefined} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="btn ghost icon" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
