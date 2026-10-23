/**
 * 中文优先的文字度量 / 断行 / 富文本引擎。
 *
 * 设计要点：
 * 1. 断行以「字素簇」为最小单位（Intl.Segmenter 可用时），emoji、组合符不会被拆开。
 * 2. 中文逐字可断，英文按单词断行，空格优先断点。
 * 3. 简易避头尾（禁则）：行首不出现 `，。、）】…`，行尾不出现 `（【《`。
 * 4. 字间距（letterSpacing）在 Canvas 中手动实现，保证预览与导出完全一致。
 */
import type { FontKey } from '../model/types'

export const FONT_STACKS: Record<FontKey, string> = {
  sans: '"Inter", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Source Han Sans SC", system-ui, sans-serif',
  serif: '"Playfair Display", "SimSun", "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif',
  kai: '"KaiTi", "STKaiti", "Kaiti SC", "Songti SC", "SimSun", serif',
  mono: '"JetBrains Mono", "Cascadia Mono", "Consolas", "Microsoft YaHei", monospace',
  display: '"Inter", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif',
}

export function fontString(size: number, weight: number, family: string, italic = false) {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`
}

export function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  weight: number,
  fontKey: FontKey,
) {
  ctx.font = fontString(size, weight, FONT_STACKS[fontKey])
}

const widthCache = new Map<string, number>()

function cacheKey(ctx: CanvasRenderingContext2D, text: string) {
  return `${ctx.font}|${ctx.letterSpacing ?? '0'}|${text}`
}

/** 单段文本宽度（含字间距），带缓存 */
export function measure(ctx: CanvasRenderingContext2D, text: string, letterSpacing = 0): number {
  if (!text) return 0
  const key = cacheKey(ctx, text) + `|ls${letterSpacing}`
  const hit = widthCache.get(key)
  if (hit !== undefined) return hit
  let w = 0
  if (letterSpacing === 0 && typeof ctx.letterSpacing === 'string') {
    ctx.letterSpacing = '0px'
    w = ctx.measureText(text).width
  } else {
    w = ctx.measureText(text).width
  }
  const graphemes = splitGraphemes(text).length
  const total = w + Math.max(0, graphemes - 1) * letterSpacing
  widthCache.set(key, total)
  if (widthCache.size > 6000) widthCache.clear()
  return total
}

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new (Intl as unknown as { Segmenter: new (l?: string, o?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter(
        'zh',
        { granularity: 'grapheme' },
      )
    : null

export function splitGraphemes(text: string): string[] {
  if (!text) return []
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment)
  return Array.from(text)
}

const CJK = /[\u2E80-\u9FFF\u3000-\u303F\uF900-\uFAFF\uFF00-\uFFEF\u3040-\u30FF\uAC00-\uD7AF]/
const LATIN_WORD = /[A-Za-z0-9@#$%&'’\u00C0-\u024F]/
const NO_LINE_START = '，。、；：！？）〕〉》」』】”’·…‥ー々〆,.;:?!)]}%‰℃°'
const NO_LINE_END = '（〔〈《「『【“‘([{'

/**
 * 把文本切成「不可再分的断行单元」：
 * - 中文字 / 全角标点：单字
 * - 英文单词、数字、URL：《完整保留》
 * - 连续空格：一个单元
 */
export function tokenize(text: string): string[] {
  const grams = splitGraphemes(text)
  const out: string[] = []
  let word = ''
  const flush = () => {
    if (word) {
      out.push(word)
      word = ''
    }
  }
  for (const g of grams) {
    if (g === '\n') {
      flush()
      out.push('\n')
      continue
    }
    if (g === ' ' || g === '\u00A0' || g === '\t') {
      flush()
      if (out.length && /^[ \u00A0\t]+$/.test(out[out.length - 1])) out[out.length - 1] += g
      else out.push(g)
      continue
    }
    if (CJK.test(g) || /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(g)) {
      flush()
      out.push(g)
      continue
    }
    if (LATIN_WORD.test(g) || /[\u0300-\u036F\u200D\uFE0F]/u.test(g)) {
      word += g
      continue
    }
    flush()
    // 标点：与前一个单元合并，避免孤立的 “.” 或 “%”
    if (out.length && /[A-Za-z0-9]\s*$/.test(out[out.length - 1])) out[out.length - 1] += g
    else out.push(g)
  }
  flush()
  return out
}

export interface RichRun {
  text: string
  bold: boolean
  underline: boolean
  mark: boolean
  accent: boolean
}

/** 解析 **强调** / ==标记== / __下划线__，可嵌套 */
export function parseRich(input: string, baseBold = false): RichRun[] {
  const runs: RichRun[] = []
  const state = { bold: baseBold, underline: false, mark: false, accent: false }
  let buf = ''

  const push = () => {
    if (!buf) return
    runs.push({ text: buf, ...state })
    buf = ''
  }

  let i = 0
  while (i < input.length) {
    const rest = input.slice(i)
    if (rest.startsWith('**')) {
      push()
      state.bold = !state.bold
      state.accent = state.bold
      i += 2
      continue
    }
    if (rest.startsWith('==')) {
      push()
      state.mark = !state.mark
      i += 2
      continue
    }
    if (rest.startsWith('__')) {
      push()
      state.underline = !state.underline
      i += 2
      continue
    }
    buf += input[i]
    i += 1
  }
  push()
  return runs.length ? runs : [{ text: '', ...state }]
}

export interface LineRun {
  run: RichRun
  text: string
  width: number
}

export interface TextLine {
  runs: LineRun[]
  width: number
  text: string
  /** 该行是否由显式换行结束 */
  hardBreak: boolean
}

export interface WrapOptions {
  letterSpacing?: number
  /** 允许行首超出一两个标点（避头尾 overhang） */
  allowOverhang?: boolean
}

/**
 * 富文本断行。返回每一行的 run 片段，宽度精确到像素（与绘制一致）。
 */
export function wrapRuns(
  ctx: CanvasRenderingContext2D,
  runs: RichRun[],
  maxWidth: number,
  opts: WrapOptions = {},
): TextLine[] {
  const spacing = opts.letterSpacing ?? 0
  const allowOverhang = opts.allowOverhang ?? true
  const tokens: { text: string; run: RichRun; width: number }[] = []

  for (const run of runs) {
    if (!run.text) continue
    for (const t of tokenize(run.text)) {
      const w = measure(ctx, t, spacing)
      // 超长英文单词 / URL 无法在单词内断行时，按字素簇强制拆分，绝不溢出画布
      if (w > maxWidth && maxWidth > 0) {
        const chars = splitGraphemes(t)
        let chunk = ''
        let chunkW = 0
        for (const ch of chars) {
          const cw = measure(ctx, ch, spacing)
          if (chunk && chunkW + cw > maxWidth) {
            tokens.push({ text: chunk, run, width: chunkW })
            chunk = ch
            chunkW = cw
          } else {
            chunk += ch
            chunkW += cw
          }
        }
        if (chunk) tokens.push({ text: chunk, run, width: chunkW })
        continue
      }
      tokens.push({ text: t, run, width: w })
    }
  }

  const lines: TextLine[] = []
  let current: { text: string; run: RichRun; width: number }[] = []
  let currentWidth = 0

  const flushLine = (hard: boolean) => {
    const lineRuns: LineRun[] = []
    for (const t of current) {
      const last = lineRuns[lineRuns.length - 1]
      if (last && last.run === t.run) {
        last.text += t.text
        last.width += t.width
      } else {
        lineRuns.push({ run: t.run, text: t.text, width: t.width })
      }
    }
    const text = lineRuns.map((r) => r.text).join('')
    lines.push({ runs: lineRuns, width: currentWidth, text, hardBreak: hard })
    current = []
    currentWidth = 0
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.text === '\n') {
      flushLine(true)
      continue
    }
    const isSpace = /^[ \u00A0\t]+$/.test(token.text)
    const wouldOverflow = currentWidth + token.width > maxWidth + 0.01

    if (wouldOverflow && current.length > 0) {
      const firstChar = token.text[0] ?? ''
      const overflowingPunct = NO_LINE_START.includes(firstChar)
      const lastToken = current[current.length - 1]
      const lastChar = lastToken.text[lastToken.text.length - 1] ?? ''
      if (allowOverhang && overflowingPunct && currentWidth + token.width < maxWidth * 1.14) {
        // 标点不允许出现在行首：允许悬挂一到两个字符
        current.push(token)
        currentWidth += token.width
        flushLine(false)
        continue
      }
      if (NO_LINE_END.includes(lastChar) && current.length > 1) {
        // 开引号 / 开括号不允许留在行尾
        const moved = current.pop()!
        currentWidth -= moved.width
        flushLine(false)
        current.push(moved)
        currentWidth = moved.width
        if (isSpace) continue
        continue
      }
      flushLine(false)
      if (isSpace) continue
    }
    if (isSpace && current.length === 0) continue
    current.push(token)
    currentWidth += token.width
  }
  if (current.length > 0 || lines.length === 0) flushLine(false)
  return lines
}

/** 纯文本断行（内部用富文本实现，便于统一规则） */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  opts: WrapOptions = {},
): string[] {
  return wrapRuns(ctx, parseRich(text), maxWidth, opts).map((l) => l.text)
}

export interface DrawLineOptions {
  letterSpacing?: number
  color: string
  accentColor?: string
  markColor?: string
  underlineColor?: string
  align?: 'left' | 'center' | 'right'
  /** 行首 x；align 非 left 时作为对齐基准 */
  x: number
  /** 基线 y */
  y: number
  size: number
  weight: number
  fontKey: FontKey
  markAlpha?: number
  /** 标记笔的下沿偏移，用于贴合不同字号 */
  markPad?: number
}

/**
 * 绘制一行富文本（含强调色、下划线、标记笔）。
 * letterSpacing 通过逐字素绘制实现，保证与 measure() 结果一致。
 */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  line: TextLine,
  o: DrawLineOptions,
) {
  const spacing = o.letterSpacing ?? 0
  let x = o.x
  if (o.align === 'center') x = o.x - line.width / 2
  else if (o.align === 'right') x = o.x - line.width

  for (const part of line.runs) {
    setFont(ctx, o.size, part.run.bold ? Math.min(900, o.weight + 300) : o.weight, o.fontKey)
    const color = part.run.accent ? o.accentColor ?? o.color : o.color

    if (part.run.mark && part.text.trim()) {
      const h = o.size * (o.markPad ?? 0.62)
      ctx.save()
      ctx.fillStyle = o.markColor ?? 'rgba(255,214,0,0.55)'
      ctx.globalAlpha = o.markAlpha ?? 0.75
      ctx.fillRect(x - o.size * 0.04, o.y - h * 0.72, part.width + o.size * 0.08, h * 1.15)
      ctx.restore()
    }

    ctx.fillStyle = color
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    if (spacing === 0) {
      ctx.fillText(part.text, x, o.y)
    } else {
      let cx = x
      for (const g of splitGraphemes(part.text)) {
        ctx.fillText(g, cx, o.y)
        cx += measure(ctx, g) + spacing
      }
    }

    if (part.run.underline) {
      ctx.save()
      ctx.strokeStyle = part.run.accent ? o.accentColor ?? o.color : o.underlineColor ?? color
      ctx.lineWidth = Math.max(1, o.size * 0.055)
      ctx.beginPath()
      ctx.moveTo(x, o.y + o.size * 0.16)
      ctx.lineTo(x + part.width, o.y + o.size * 0.16)
      ctx.stroke()
      ctx.restore()
    }
    x += part.width
  }
}

/** 估算单行所需高度（用于布局） */
export function lineHeightOf(size: number, multiple: number) {
  return Math.round(size * multiple)
}

/** 二分查找可以让 text 在 maxWidth 内不超过 rows 行的最大字号 */
export function fitSize(
  measure: (size: number) => { rows: number; width: number },
  min: number,
  max: number,
  maxRows: number,
): number {
  if (max <= min) return min
  let lo = min
  let hi = max
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    const r = measure(mid)
    if (r.rows <= maxRows) lo = mid
    else hi = mid
  }
  return Math.floor(lo * 10) / 10
}

/** 计数：按字素簇统计字符数，用于「字数提示」 */
export function charCount(text: string) {
  return splitGraphemes(text.replace(/\n/g, '')).length
}

export function stripMarkup(text: string) {
  return text.replace(/\*\*|==|__/g, '')
}
