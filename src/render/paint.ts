/** 文字块绘制：把 flow() / wrapRuns() 的结果画到画布上，处理对齐、字间距、强调色、标记笔。 */
import type { Align, FontKey, TextStyle } from '../model/types'
import { auditRecord } from './audit'
import { resolveAlign, resolveFont, resolveSpacing } from './overrides'
import { drawLine, measure, setFont, splitGraphemes, type TextLine } from './text'

export interface PaintOptions {
  x: number
  y: number
  width: number
  align?: Align
  size: number
  weight: number
  fontKey: FontKey
  ink: string
  accent: string
  markColor: string
  markAlpha?: number
  markPad?: number
  underlineColor?: string
  letterSpacing?: number
}

/** 单行 x 起点（center/right 时作为对齐基准）；用户改过对齐方式时以用户值为准 */
function lineX(o: PaintOptions): number {
  const align = resolveAlign(o.align ?? 'left')
  if (align === 'center') return o.x + o.width / 2
  if (align === 'right') return o.x + o.width
  return o.x
}

export function paintLines(
  ctx: CanvasRenderingContext2D,
  lines: TextLine[],
  o: PaintOptions & { lineHeight: number; limit?: number },
) {
  const count = o.limit != null ? Math.min(o.limit, lines.length) : lines.length
  for (let i = 0; i < count; i++) {
    const line = lines[i]
    const resolvedFont = resolveFont(o.fontKey)
    const resolvedLS = resolveSpacing(o.letterSpacing ?? 0)
    const resolvedAlign = resolveAlign(o.align ?? 'left')
    drawLine(ctx, line, {
      x: lineX(o),
      y: o.y + i * o.lineHeight,
      align: resolvedAlign,
      size: o.size,
      weight: o.weight,
      fontKey: resolvedFont,
      color: o.ink,
      accentColor: o.accent,
      markColor: o.markColor,
      markAlpha: o.markAlpha,
      markPad: o.markPad,
      underlineColor: o.underlineColor ?? o.ink,
      letterSpacing: resolvedLS,
    })
    const origin = lineX(o)
    auditRecord({
      kind: 'rich',
      text: line.text,
      x: resolvedAlign === 'center' ? origin - line.width / 2 : resolvedAlign === 'right' ? origin - line.width : origin,
      y: o.y + i * o.lineHeight,
      w: line.width,
      h: o.size,
    })
  }
}

/** 用统一样式画一行小字（eyebrow / footer / signature），返回实际宽度 */
export function paintMeta(
  ctx: CanvasRenderingContext2D,
  text: string,
  o: {
    x: number
    y: number
    width: number
    align?: Align
    size: number
    weight?: number
    fontKey?: FontKey
    color: string
    letterSpacing?: number
    /** 若设置，则超出时按字素簇截断并加省略号 */
    ellipsis?: boolean
  },
) {
  if (!text) return 0
  setFont(ctx, o.size, o.weight ?? 500, resolveFont(o.fontKey ?? 'sans'))
  const spacing = resolveSpacing(o.letterSpacing ?? 0)
  let out = text
  if (o.ellipsis && measure(ctx, out, spacing) > o.width) {
    const chars = splitGraphemes(text)
    while (chars.length && measure(ctx, `${chars.join('')}…`, spacing) > o.width) chars.pop()
    out = `${chars.join('')}…`
  }
  const w = measure(ctx, out, spacing)
  let x = o.x
  const align = resolveAlign(o.align ?? 'left')
  if (align === 'center') x = o.x + o.width / 2 - w / 2
  else if (align === 'right') x = o.x + o.width - w
  ctx.save()
  ctx.fillStyle = o.color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  if (!spacing) {
    ctx.fillText(out, x, o.y)
  } else {
    let cx = x
    for (const g of splitGraphemes(out)) {
      ctx.fillText(g, cx, o.y)
      cx += measure(ctx, g) + spacing
    }
  }
  ctx.restore()
  auditRecord({ kind: 'meta', text: out, x, y: o.y, w, h: o.size })
  return w
}

export function inkFor(style: TextStyle, fallback = '#111111') {
  return style.ink || fallback
}
