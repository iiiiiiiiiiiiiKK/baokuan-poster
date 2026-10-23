import { useRef } from 'react'
import type { Align, Content, Deco, Doc, FontKey, IconName, ShapeName, DividerName, CornerName, TextStyle } from '../model/types'
import {
  CORNER_OPTIONS,
  DIVIDER_OPTIONS,
  FONT_OPTIONS,
  ICON_OPTIONS,
  SHAPE_OPTIONS,
} from '../model/presets'
import { getTemplate } from '../render/templates'
import { charCount } from '../render/text'
import { Chips, ColorField, Field, Section, Segmented } from './components'

export interface EditorActions {
  setContent: (patch: Partial<Content>, label?: string, key?: string) => void
  setStyle: (patch: Partial<TextStyle>, label: string, key?: string) => void
  setDeco: (patch: Partial<Deco>, label: string, key?: string) => void
  setDocField: (patch: Partial<Doc>, label: string) => void
}

/* ---------------- 文字 ---------------- */

export function ContentSection({
  doc,
  actions,
  compact,
}: {
  doc: Doc
  actions: EditorActions
  compact?: boolean
}) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const wrapSelection = (
    ref: React.RefObject<HTMLTextAreaElement | null>,
    field: 'title' | 'body',
    mark: '**' | '==' | '__',
  ) => {
    const el = ref.current
    const value = doc.content[field]
    if (!el) return
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const selected = value.slice(start, end) || '重点'
    const next = `${value.slice(0, start)}${mark}${selected}${mark}${value.slice(end)}`
    actions.setContent({ [field]: next }, '标记强调', `mark-${field}`)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + mark.length, start + mark.length + selected.length)
    })
  }

  const tpl = getTemplate(doc.templateId)
  const titleCount = charCount(doc.content.title)
  const bodyCount = charCount(doc.content.body)

  return (
    <Section title="文字内容" hint="支持 **强调**、==标记==、__下划线__">
      <Field label="标题" value={`${titleCount} 字${titleCount > 30 ? ' · 偏长' : ''}`}>
        <textarea
          ref={titleRef}
          className="textarea"
          value={doc.content.title}
          rows={compact ? 2 : 3}
          onChange={(e) => actions.setContent({ title: e.target.value }, '编辑标题', 'title')}
          placeholder="一句话，就是你最想说的那句"
          data-testid="title-input"
        />
        <div className="row" style={{ marginTop: 6 }}>
          <button className="btn sm" onClick={() => wrapSelection(titleRef, 'title', '**')} title="加粗强调">
            <b>B</b> 强调
          </button>
          <button className="btn sm" onClick={() => wrapSelection(titleRef, 'title', '==')}>
            标记笔
          </button>
          <button className="btn sm" onClick={() => wrapSelection(titleRef, 'title', '__')}>
            <u>U</u> 下划线
          </button>
          <span className="mini-label grow" style={{ textAlign: 'right' }}>
        建议 ≤ {tpl.bodyHint > 150 ? 24 : 20} 字
          </span>
        </div>
      </Field>

      <Field
        label="正文"
        value={`${bodyCount} 字 / 舒适区 ${tpl.bodyHint} 字`}
      >
        <textarea
          ref={bodyRef}
          className={`textarea ${compact ? '' : 'tall'}`}
          value={doc.content.body}
          rows={compact ? 4 : 6}
          onChange={(e) => actions.setContent({ body: e.target.value }, '编辑正文', 'body')}
          placeholder="展开一两句解释；用 | 分隔可以得到要点列表（部分模板支持）"
          data-testid="body-input"
        />
        <div className="row wrap" style={{ marginTop: 6 }}>
          <button className="btn sm" onClick={() => wrapSelection(bodyRef, 'body', '**')}>
            <b>B</b> 强调
          </button>
          <button className="btn sm" onClick={() => wrapSelection(bodyRef, 'body', '==')}>
            标记笔
          </button>
          <button className="btn sm" onClick={() => wrapSelection(bodyRef, 'body', '__')}>
            <u>U</u> 下划线
          </button>
          <button
            className="btn sm"
            onClick={() => actions.setContent({ body: doc.content.body.replace(/\n/g, '') }, '清理换行')}
            title="把正文中的软换行合并为连续段落"
          >
            合并换行
          </button>
        </div>
        {bodyCount > tpl.bodyHint * 1.35 && (
          <div className="warning body" style={{ marginTop: 8, position: 'static' }}>
            <span>
              正文约 {bodyCount} 字，已超出该模板的舒适区（{tpl.bodyHint} 字）。建议精简，或切换到「复古报纸风 / 代码截图风」等容纳更多文字的模板。
            </span>
          </div>
        )}
      </Field>

      <div className="row">
        <div className="grow">
          <Field label="署名">
            <input
              className="input"
              value={doc.content.signature}
              onChange={(e) => actions.setContent({ signature: e.target.value }, '编辑署名', 'signature')}
              placeholder="文 / 你的名字"
              data-testid="signature-input"
            />
          </Field>
        </div>
      </div>
      <Field label="辅助文字（页脚 / 顶部标签）">
        <div className="row" style={{ alignItems: 'stretch' }}>
          <input
            className="input sm"
            style={{ flex: '0 0 46%' }}
            value={doc.content.eyebrow}
            onChange={(e) => actions.setContent({ eyebrow: e.target.value }, '编辑辅助文字', 'eyebrow')}
            placeholder="顶部标签"
          />
          <input
            className="input grow"
            value={doc.content.footer}
            onChange={(e) => actions.setContent({ footer: e.target.value }, '编辑辅助文字', 'footer')}
            placeholder="页脚 / 数据行（用 | 分隔）"
          />
        </div>
      </Field>
    </Section>
  )
}

/* ---------------- 样式 ---------------- */

const INK_PRESETS = ['#111111', '#ffffff', '#f5f2ea', '#0f172a', '#d4463a', '#2f6df6']
const BG_PRESETS = ['#ffffff', '#f7f6f3', '#efe6d2', '#0d1117', '#111827', '#ff6a1a', '#fdfaf0', '#eef2f9']

export function StyleSection({ doc, actions }: { doc: Doc; actions: EditorActions }) {
  const s = doc.style
  const titleSize = Math.round(s.titleSize * doc.scale)
  return (
    <>
      <Section title="字号与字重" hint="自动排版关闭后完全手动">
        <Field label="标题字号" value={`${titleSize} px`}>
          <input
            type="range"
            min={28}
            max={180}
            step={1}
            value={titleSize}
            onChange={(e) => {
              const v = Number(e.target.value)
              actions.setDocField({ scale: 1 }, '调整标题字号')
              actions.setStyle({ titleSize: v }, '调整标题字号', 'titleSize')
            }}
          />
        </Field>
        <Field label="正文字号" value={`${Math.round(s.bodySize)} px`}>
          <input
            type="range"
            min={12}
            max={64}
            step={1}
            value={s.bodySize}
            onChange={(e) => actions.setStyle({ bodySize: Number(e.target.value) }, '调整正文字号', 'bodySize')}
          />
        </Field>
        <Field label="标题字重" value={String(s.titleWeight)}>
          <div className="segmented">
            {[400, 500, 600, 700, 800, 900].map((w) => (
              <button
                key={w}
                className={s.titleWeight === w ? 'active' : ''}
                onClick={() => actions.setStyle({ titleWeight: w }, '调整标题字重')}
              >
                {w}
              </button>
            ))}
          </div>
        </Field>
        <Field label="正文字重" value={String(s.bodyWeight)}>
          <div className="segmented">
            {[300, 400, 500, 600, 700].map((w) => (
              <button
                key={w}
                className={s.bodyWeight === w ? 'active' : ''}
                onClick={() => actions.setStyle({ bodyWeight: w }, '调整正文字重')}
              >
                {w}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="行距 · 字距 · 对齐">
        <Field label="行距" value={s.lineHeight.toFixed(2)}>
          <input
            type="range"
            min={1}
            max={2.6}
            step={0.01}
            value={s.lineHeight}
            onChange={(e) => actions.setStyle({ lineHeight: Number(e.target.value) }, '调整行距', 'lineHeight')}
          />
        </Field>
        <Field label="字间距" value={`${s.letterSpacing.toFixed(1)} px`}>
          <input
            type="range"
            min={-4}
            max={16}
            step={0.2}
            value={s.letterSpacing}
            onChange={(e) => actions.setStyle({ letterSpacing: Number(e.target.value) }, '调整字间距', 'letterSpacing')}
          />
        </Field>
        <Field label="对齐方式">
          <Segmented<Align>
            options={[
              { key: 'left', label: '左对齐' },
              { key: 'center', label: '居中' },
              { key: 'right', label: '右对齐' },
            ]}
            value={s.align}
            onChange={(v) => actions.setStyle({ align: v }, '调整对齐方式')}
          />
        </Field>
        <div className="row">
          <div className="grow">
            <Field label="标题字体">
              <select
                className="select"
                value={s.fontTitle}
                onChange={(e) => actions.setStyle({ fontTitle: e.target.value as FontKey }, '切换标题字体')}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grow">
            <Field label="正文字体">
              <select
                className="select"
                value={s.fontBody}
                onChange={(e) => actions.setStyle({ fontBody: e.target.value as FontKey }, '切换正文字体')}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </Section>

      <Section title="颜色">
        <ColorField
          label="文字色"
          value={s.ink}
          onChange={(v) => actions.setStyle({ ink: v }, '修改文字色', 'ink')}
          presets={INK_PRESETS}
        />
        <ColorField
          label="次级文字色"
          value={s.inkSoft}
          onChange={(v) => actions.setStyle({ inkSoft: v }, '修改次级文字色', 'inkSoft')}
          presets={INK_PRESETS}
        />
        <ColorField
          label="重点色"
          value={s.accent}
          onChange={(v) => actions.setStyle({ accent: v }, '修改重点色', 'accent')}
          presets={['#ff6a1a', '#e8443a', '#39ff88', '#2f6df6', '#f5b93b', '#b08d57']}
        />
        <ColorField
          label="背景色"
          value={s.bg}
          onChange={(v) => actions.setStyle({ bg: v }, '修改背景色', 'bg')}
          presets={BG_PRESETS}
        />
      </Section>
    </>
  )
}

/* ---------------- 装饰 ---------------- */

export function DecoSection({ doc, actions }: { doc: Doc; actions: EditorActions }) {
  return (
    <>
      <Section title="图形与图标" hint="矢量绘制，导出无损">
        <Field label="小图标">
          <Chips<IconName>
            options={ICON_OPTIONS.map((o) => ({ key: o.key as IconName, label: o.label }))}
            value={doc.deco.icon}
            onChange={(v) => actions.setDeco({ icon: v }, '切换图标')}
          />
        </Field>
        <Field label="背景图形">
          <Chips<ShapeName>
            options={SHAPE_OPTIONS.map((o) => ({ key: o.key as ShapeName, label: o.label }))}
            value={doc.deco.shape}
            onChange={(v) => actions.setDeco({ shape: v }, '切换背景图形')}
          />
        </Field>
        <Field label="分割线">
          <Chips<DividerName>
            options={DIVIDER_OPTIONS.map((o) => ({ key: o.key as DividerName, label: o.label }))}
            value={doc.deco.divider}
            onChange={(v) => actions.setDeco({ divider: v }, '切换分割线')}
          />
        </Field>
        <Field label="角标">
          <Chips<CornerName>
            options={CORNER_OPTIONS.map((o) => ({ key: o.key as CornerName, label: o.label }))}
            value={doc.deco.corner}
            onChange={(v) => actions.setDeco({ corner: v }, '切换角标')}
          />
        </Field>
      </Section>

      <Section title="自动排版" hint="开启后标题过长会自动缩小，绝不删字">
        <div className="row" style={{ marginBottom: 10 }}>
          <button
            className={`btn grow ${doc.autoFit ? 'on' : ''}`}
            onClick={() => actions.setDocField({ autoFit: !doc.autoFit }, doc.autoFit ? '关闭自动排版' : '开启自动排版')}
          >
            {doc.autoFit ? '✓ 自动排版已开启' : '自动排版已关闭'}
          </button>
        </div>
        <Field label="整体缩放" value={`${Math.round(doc.scale * 100)}%`}>
          <input
            type="range"
            min={0.6}
            max={1.5}
            step={0.01}
            value={doc.scale}
            onChange={(e) => actions.setDocField({ scale: Number(e.target.value) }, '整体缩放')}
          />
        </Field>
        <div className="row">
          <button
            className={`btn grow ${doc.transparent ? 'on' : ''}`}
            onClick={() => actions.setDocField({ transparent: !doc.transparent }, '切换透明背景')}
          >
            {doc.transparent ? '透明背景：开' : '透明背景：关'}
          </button>
          <button className="btn grow" onClick={() => actions.setDocField({ scale: 1 }, '重置缩放')}>
            重置缩放
          </button>
        </div>
        <div className="mini-label" style={{ marginTop: 8, lineHeight: 1.6 }}>
          关闭自动排版后，标题会按固定字号绘制；若超出安全区，画布上方会提示。
        </div>
      </Section>
    </>
  )
}

export function RightPanel({
  doc,
  actions,
}: {
  doc: Doc
  actions: EditorActions
}) {
  return (
    <div className="panel right">
      <ContentSection doc={doc} actions={actions} />
      <StyleSection doc={doc} actions={actions} />
      <DecoSection doc={doc} actions={actions} />
    </div>
  )
}
