/**
 * 排版布局引擎：标题自动缩放、正文自动适配、安全区计算。
 * 所有模板共用这一层，确保「智能排版」规则一致。
 */
import type { LayoutWarning, TextStyle, TemplateDef } from '../model/types'
import { lineHeightOf, parseRich, setFont, wrapRuns, type TextLine } from './text'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface FlowResult {
  lines: TextLine[]
  size: number
  lineHeight: number
  height: number
  overflow: boolean
  baselines: number[]
}

export interface FlowOptions {
  text: string
  fontKey: TextStyle['fontTitle']
  weight: number
  maxWidth: number
  lineHeightMultiple: number
  letterSpacing: number
  minSize: number
  maxSize: number
  maxLines?: number
  /** 若给定，同时约束总高度 */
  maxHeight?: number
  /** 是否允许自动缩小 */
  autoFit?: boolean
  baseBold?: boolean
}

export function flow(ctx: CanvasRenderingContext2D, o: FlowOptions): FlowResult {
  const runs = parseRich(o.text, o.baseBold ?? false)
  const autoFit = o.autoFit ?? true
  const minSize = o.minSize
  const maxSize = Math.max(minSize, o.maxSize)

  const evaluate = (size: number): FlowResult => {
    setFont(ctx, size, o.weight, o.fontKey)
    const lines = wrapRuns(ctx, runs, o.maxWidth, { letterSpacing: o.letterSpacing })
    const lineHeight = lineHeightOf(size, o.lineHeightMultiple)
    const height = lines.length * lineHeight
    const baselines: number[] = []
    for (let i = 0; i < lines.length; i++) baselines.push(size * 0.86 + i * lineHeight)
    const overflowY = o.maxHeight != null && height > o.maxHeight + 1
    return {
      lines,
      size,
      lineHeight,
      height,
      overflow: (o.maxLines != null && lines.length > o.maxLines) || overflowY,
      baselines,
    }
  }

  let result = evaluate(maxSize)
  if (!result.overflow || !autoFit) return result

  // 二分查找满足约束的最大字号。
  // 若给了 maxHeight（正文必须落在版心内），允许比 minSize 更小，保证文字不溢出画布。
  const hardMin = o.maxHeight != null ? Math.max(7, minSize * 0.4) : minSize
  let lo = hardMin
  let hi = maxSize
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    const r = evaluate(mid)
    if (r.overflow) hi = mid
    else lo = mid
  }
  result = evaluate(Math.floor(lo * 10) / 10)
  // 极端情况下仍溢出（理论上不会）：退到 hardMin，保留全部文字并由此前的 warnings 提示
  if (result.overflow) result = evaluate(hardMin)
  return result
}

export function safeArea(W: number, H: number, pad = 0.068): Box {
  const p = Math.min(W, H) * pad
  return { x: p, y: p, w: W - p * 2, h: H - p * 2 }
}

export function pushWarning(warnings: LayoutWarning[], w: LayoutWarning) {
  if (!warnings.some((x) => x.text === w.text)) warnings.push(w)
}

export interface LayoutReport {
  titleLines: number
  bodyLines: number
  bodyChars: number
  titleShrunk: boolean
}

export function reportOverflow(tpl: TemplateDef, warnings: LayoutWarning[], report: LayoutReport) {
  if (report.titleShrunk) {
    pushWarning(warnings, {
      kind: 'title',
      text: '标题偏长，已自动缩小字号以保持版式完整。',
    })
  }
  if (report.bodyChars > tpl.bodyHint * 1.35) {
    pushWarning(warnings, {
      kind: 'body',
      text: `正文约 ${report.bodyChars} 字，超过「${tpl.name}」的舒适区（${tpl.bodyHint} 字）。可切换到留白更多的模板。`,
    })
  }
}
