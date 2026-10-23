/** 模板共用工具：尺寸换算、配色派生、配图处理、标题/正文自适应。 */
import type { Doc, RenderCtx } from '../model/types'
import { mix, normalizeHex } from './color'
import { flow, type FlowResult, type FlowOptions } from './layout'
import { resolveFont, resolveLineHeight, resolveSpacing } from './overrides'
import { drawImageIn } from './assets'
import { charCount, lineHeightOf, parseRich, setFont, wrapRuns, type TextLine } from './text'

export function scaleOf(W: number, H: number) {
  return Math.min(W, H) / 1080
}

export function padOf(W: number, H: number, ratio = 0.072) {
  return Math.min(W, H) * ratio
}

export interface Palette {
  bg: string
  ink: string
  soft: string
  accent: string
  /** 与底色对比更低的辅助色 */
  faint: string
  card: string
  line: string
}

export function paletteOf(doc: Doc): Palette {
  const s = doc.style
  const bg = normalizeHex(s.bg)
  const ink = normalizeHex(s.ink)
  const accent = normalizeHex(s.accent)
  const soft = normalizeHex(s.inkSoft || mix(ink, bg, 0.45))
  return {
    bg,
    ink,
    soft,
    accent,
    faint: mix(ink, bg, 0.62),
    card: mix(bg, ink, 0.07),
    line: mix(ink, bg, 0.74),
  }
}

export interface TitleOpts {
  width: number
  maxLines: number
  lineHeight?: number
  letterSpacing?: number
  weight?: number
  /** 相对模板默认字号的倍数 */
  sizeFactor?: number
  /** 最小可缩到默认字号的几成 */
  minFactor?: number
  align?: 'left' | 'center' | 'right'
  /** 标题块允许占用的最大高度（保证正文有位置） */
  maxHeight?: number
}

export function titleFlow(r: RenderCtx, o: TitleOpts): FlowResult {
  const { ctx, doc } = r
  const s = scaleOf(r.W, r.H)
  const base = doc.style.titleSize * s * doc.scale * (o.sizeFactor ?? 1)
  const weight = o.weight ?? doc.style.titleWeight
  const res = flow(ctx, {
    text: doc.content.title,
    fontKey: resolveFont(doc.style.fontTitle),
    weight,
    maxWidth: o.width,
    lineHeightMultiple: resolveLineHeight(o.lineHeight ?? doc.style.lineHeight, doc.style.lineHeight),
    letterSpacing: resolveSpacing((o.letterSpacing ?? doc.style.letterSpacing) * s),
    minSize: Math.max(16 * s, base * (o.minFactor ?? 0.44)),
    maxSize: base,
    maxLines: o.maxLines,
    maxHeight: o.maxHeight,
    autoFit: doc.autoFit,
  })
  if (doc.autoFit && res.size < base - 0.5) flagTitleShrunk(r)
  return res
}

export interface BodyOpts {
  width: number
  maxHeight?: number
  maxLines?: number
  sizeFactor?: number
  lineHeight?: number
  weight?: number
  letterSpacing?: number
  floor?: number
}

export function bodyFlow(r: RenderCtx, o: BodyOpts): FlowResult {
  const { ctx, doc } = r
  const s = scaleOf(r.W, r.H)
  const size = doc.style.bodySize * s * doc.scale * (o.sizeFactor ?? 1)
  return flow(ctx, {
    text: doc.content.body,
    fontKey: resolveFont(doc.style.fontBody),
    weight: o.weight ?? doc.style.bodyWeight,
    maxWidth: o.width,
    lineHeightMultiple: resolveLineHeight(o.lineHeight ?? Math.max(1.55, doc.style.lineHeight), doc.style.lineHeight),
    letterSpacing: resolveSpacing((o.letterSpacing ?? doc.style.letterSpacing) * s),
    minSize: Math.max(12 * s, size * (o.floor ?? 0.7)),
    maxSize: size,
    maxHeight: o.maxHeight,
    maxLines: o.maxLines,
    autoFit: doc.autoFit,
  })
}

export function flowWith(
  r: RenderCtx,
  o: Omit<FlowOptions, 'autoFit'> & { autoFit?: boolean },
): FlowResult {
  return flow(r.ctx, { ...o, autoFit: o.autoFit ?? r.doc.autoFit })
}

export function flagTitleShrunk(r: RenderCtx) {
  const text = '标题偏长，已自动缩小字号以保持版式完整。'
  if (!r.warnings.some((w) => w.text === text)) r.warnings.push({ kind: 'title', text })
}

export function flagBodyLong(r: RenderCtx, limit: number, tplName: string) {
  const chars = charCount(r.doc.content.body)
  if (chars > limit * 1.4) {
    const text = `正文约 ${chars} 字，已超过「${tplName}」的舒适区（约 ${limit} 字）。可切换留白更大的模板，或精简文字。`
    if (!r.warnings.some((w) => w.text === text)) r.warnings.push({ kind: 'body', text })
  }
}

export function flagImageMissing(r: RenderCtx, hint: string) {
  if (!r.doc.image) {
    if (!r.warnings.some((w) => w.text === hint)) r.warnings.push({ kind: 'image', text: hint })
  }
}

/** 用户上传的配图：多种版式 */
export type ImageMode = 'full' | 'faint' | 'banner' | 'circle' | 'polaroid' | 'panel'

export interface UserImageOpts {
  x?: number
  y?: number
  w?: number
  h?: number
  tint?: string
  tintAlpha?: number
  rounded?: number
  grayscale?: boolean
  rotate?: number
  border?: string
  baseOpacity?: number
}

export function drawUserImage(r: RenderCtx, mode: ImageMode, opts: UserImageOpts = {}) {
  const { ctx, W, H, image, doc } = r
  if (!image) return
  const im = doc.image
  const base = {
    opacity: (im?.opacity ?? 1) * (opts.baseOpacity ?? 1),
    tint: opts.tint,
    tintAlpha: opts.tintAlpha,
    blur: im?.blur ?? 0,
    offsetX: im?.offsetX ?? 0,
    offsetY: im?.offsetY ?? 0,
    scale: im?.scale ?? 1,
    fit: im?.fit ?? 'cover',
    grayscale: opts.grayscale,
  }

  if (mode === 'full' || mode === 'faint') {
    drawImageIn(ctx, image, 0, 0, W, H, {
      ...base,
      opacity: mode === 'faint' ? base.opacity * 0.34 : base.opacity,
      rounded: 0,
    })
    return
  }

  const x = opts.x ?? 0
  const y = opts.y ?? 0
  const w = opts.w ?? W
  const h = opts.h ?? H

  if (mode === 'circle') {
    const d = Math.min(w, h)
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + w / 2, y + h / 2, d / 2, 0, Math.PI * 2)
    ctx.clip()
    drawImageIn(ctx, image, x + (w - d) / 2, y + (h - d) / 2, d, d, { ...base, rounded: 0 })
    ctx.restore()
    if (opts.border) {
      ctx.save()
      ctx.strokeStyle = opts.border
      ctx.lineWidth = Math.max(2, d * 0.01)
      ctx.beginPath()
      ctx.arc(x + w / 2, y + h / 2, d / 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    return
  }

  if (mode === 'polaroid') {
    const rotate = opts.rotate ?? -4
    ctx.save()
    ctx.translate(x + w / 2, y + h / 2)
    ctx.rotate((rotate * Math.PI) / 180)
    const b = Math.max(6, w * 0.04)
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = Math.max(10, w * 0.05)
    ctx.shadowOffsetY = Math.max(4, w * 0.022)
    ctx.fillStyle = opts.border ?? '#ffffff'
    ctx.fillRect(-w / 2 - b, -h / 2 - b, w + b * 2, h + b * 2 + b * 1.8)
    ctx.shadowColor = 'transparent'
    drawImageIn(ctx, image, -w / 2, -h / 2, w, h, { ...base, rounded: 0 })
    ctx.restore()
    return
  }

  drawImageIn(ctx, image, x, y, w, h, { ...base, rounded: opts.rounded ?? 0 })
}

/** 渐变遮罩，保证配图上的文字可读 */
export function scrim(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  color: string,
  alphaFrom: number,
  alphaTo = alphaFrom,
  vertical = true,
) {
  const g = vertical ? ctx.createLinearGradient(0, 0, 0, H) : ctx.createLinearGradient(0, 0, W, 0)
  g.addColorStop(0, rgba(color, alphaFrom))
  g.addColorStop(1, rgba(color, alphaTo))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function rgba(hex: string, a: number) {
  const h = normalizeHex(hex)
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`
}

/** 「a | b | c」形式的 meta 行 */
export function metaRow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  o: {
    size: number
    weight: number
    fontKey: Doc['style']['fontBody']
    color: string
    sep?: string
    sepAlpha?: number
    align?: 'left' | 'right'
    rightX?: number
  },
): number {
  const parts = text.split(/\s*[|｜]\s*/).filter(Boolean)
  if (!parts.length) return 0
  const sep = o.sep ?? '  ·  '
  ctx.save()
  setFont(ctx, o.size, o.weight, o.fontKey)
  ctx.textBaseline = 'alphabetic'
  const widths = parts.map((p) => ctx.measureText(p).width)
  const sepW = ctx.measureText(sep).width
  const total = widths.reduce((a, b) => a + b, 0) + sepW * (parts.length - 1)
  let cx = o.align === 'right' ? (o.rightX ?? x) - total : x
  parts.forEach((p, i) => {
    if (i > 0) {
      ctx.fillStyle = o.color
      ctx.globalAlpha = o.sepAlpha ?? 0.45
      ctx.fillText(sep, cx, y)
      cx += sepW
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = o.color
    ctx.fillText(p, cx, y)
    cx += widths[i]
  })
  ctx.restore()
  return total
}

/**
 * 把正文按列切分（报纸 / 报告 / 代码）。
 * 若正文超出「列数 × 每列行数」的容量，自动缩小字号直至放下——
 * 绝不删字，也不让文字溢出画布。
 */
export function columnize(
  r: RenderCtx,
  columns: number,
  gap: number,
  width: number,
  sizeFactor = 1,
  maxHeight?: number,
) {
  const { ctx, doc } = r
  const s = scaleOf(r.W, r.H)
  const baseSize = doc.style.bodySize * s * doc.scale * sizeFactor
  const colW = (width - gap * (columns - 1)) / columns
  const runs = parseRich(doc.content.body)
  const spacing = doc.style.letterSpacing * s
  const multiple = Math.max(1.6, doc.style.lineHeight)

  const evaluate = (size: number) => {
    setFont(ctx, size, doc.style.bodyWeight, doc.style.fontBody)
    const lines = wrapRuns(ctx, runs, colW, { letterSpacing: spacing })
    const lineHeight = lineHeightOf(size, multiple)
    const rowsPerCol = maxHeight ? Math.max(1, Math.floor(maxHeight / lineHeight)) : Math.ceil(lines.length / columns)
    const capacity = rowsPerCol * columns
    return { lines, size, lineHeight, rowsPerCol, capacity, fits: lines.length <= capacity }
  }

  let best = evaluate(baseSize)
  if (!best.fits && doc.autoFit) {
    const hardMin = Math.max(6, baseSize * 0.32)
    let lo = hardMin
    let hi = baseSize
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (evaluate(mid).fits) lo = mid
      else hi = mid
    }
    best = evaluate(lo)
  }

  const cols: TextLine[][] = []
  for (let i = 0; i < best.lines.length; i += best.rowsPerCol) {
    cols.push(best.lines.slice(i, i + best.rowsPerCol))
  }
  return { cols, size: best.size, lineHeight: best.lineHeight, colW, rowsPerCol: best.rowsPerCol }
}

export { mix }
