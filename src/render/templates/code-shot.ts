/**
 * 模板 09 · 代码截图风
 * 版式逻辑：IDE 窗口（行号沟槽 + 语法高亮）+ 文件树侧栏，标题与正文被「代码化」——
 * 每行正文前带行号，强调词按 token 上色，底部状态栏显示语言/编码。
 */
import type { RenderCtx } from '../../model/types'
import { hexToRgba, mix } from '../color'
import { drawDivider, grain, roundRect } from '../assets'
import { flagBodyLong, padOf, paletteOf, scaleOf, titleFlow } from '../common'
import { paintMeta } from '../paint'
import { drawLine, measure, setFont, type TextLine, wrapRuns, parseRich } from '../text'

export function renderCodeShot(r: RenderCtx) {
  const { ctx, W, H, doc } = r
  const p = paletteOf(doc)
  const s = scaleOf(W, H)
  const pad = padOf(W, H, 0.05)
  const narrow = W < H * 0.9

  const winX = pad * 0.75
  const winY = pad * 0.8
  const winW = W - winX * 2
  const winH = H - winY * 2

  if (!doc.transparent) {
    ctx.fillStyle = mix(p.bg, '#000000', 0.35)
    ctx.fillRect(0, 0, W, H)
  }

  // 窗口
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 40 * s
  ctx.shadowOffsetY = 16 * s
  ctx.fillStyle = p.bg
  roundRect(ctx, winX, winY, winW, winH, 16 * s)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = hexToRgba('#ffffff', 0.1)
  ctx.lineWidth = Math.max(1, 1.2 * s)
  roundRect(ctx, winX, winY, winW, winH, 16 * s)
  ctx.stroke()

  // 标题栏
  const barH = 48 * s
  ctx.save()
  roundRect(ctx, winX, winY, winW, winH, 16 * s)
  ctx.clip()
  ctx.fillStyle = hexToRgba('#ffffff', 0.055)
  ctx.fillRect(winX, winY, winW, barH)
  ctx.restore()
  ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(winX + 24 * s + i * 20 * s, winY + barH / 2, 5.5 * s, 0, Math.PI * 2)
    ctx.fill()
  })
  paintMeta(ctx, doc.content.eyebrow || 'poster.tsx — baokuan-poster', {
    x: winX + 92 * s,
    y: winY + barH / 2 + 5 * s,
    width: winW - 260 * s,
    size: 14.5 * s,
    weight: 500,
    fontKey: 'mono',
    color: hexToRgba(p.ink, 0.62),
    ellipsis: true,
  })
  paintMeta(ctx, doc.content.footer || 'TypeScript · UTF-8', {
    x: winX,
    y: winY + barH / 2 + 5 * s,
    width: winW - 22 * s,
    align: 'right',
    size: 13 * s,
    weight: 500,
    fontKey: 'mono',
    color: hexToRgba(p.ink, 0.38),
    ellipsis: true,
  })

  // 文件树侧栏（横图时显示）
  const gutterW = 78 * s
  const treeW = narrow ? 0 : Math.min(winW * 0.2, 220 * s)
  if (treeW) {
    ctx.fillStyle = hexToRgba('#ffffff', 0.03)
    ctx.fillRect(winX, winY + barH, treeW, winH - barH)
    ctx.strokeStyle = hexToRgba('#ffffff', 0.07)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(winX + treeW, winY + barH)
    ctx.lineTo(winX + treeW, winY + winH)
    ctx.stroke()
    const files = ['src/', '  templates/', '  render/', '  index.tsx', 'README.md', 'package.json']
    files.forEach((f, i) => {
      paintMeta(ctx, f, {
        x: winX + 18 * s,
        y: winY + barH + 34 * s + i * 27 * s,
        width: treeW - 28 * s,
        size: 13.5 * s,
        weight: 500,
        fontKey: 'mono',
        color: i === 1 ? p.accent : hexToRgba(p.ink, 0.45),
        ellipsis: true,
      })
    })
  }

  // 行号沟槽
  const gutterX = winX + treeW
  ctx.fillStyle = hexToRgba('#ffffff', 0.02)
  ctx.fillRect(gutterX, winY + barH, gutterW, winH - barH)
  ctx.strokeStyle = hexToRgba('#ffffff', 0.06)
  ctx.beginPath()
  ctx.moveTo(gutterX + gutterW, winY + barH)
  ctx.lineTo(gutterX + gutterW, winY + winH)
  ctx.stroke()

  const codeX = gutterX + gutterW + 26 * s
  const codeW = winX + winW - codeX - 26 * s
  let y = winY + barH + 42 * s

  // 标题：等宽、带注释语法
  const title = titleFlow(r, {
    width: codeW - 24 * s,
    maxLines: 4,
    lineHeight: 1.3,
    sizeFactor: 1.05,
    minFactor: 0.42,
    letterSpacing: 0,
  })
  const titleSize = Math.max(title.size, 16 * s)
  ctx.save()
  setFont(ctx, titleSize * 0.62, 600, 'mono')
  ctx.fillStyle = hexToRgba(p.accent, 0.65)
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('/**', codeX, y)
  ctx.restore()
  y += titleSize * 0.85

  paintLinesMono(ctx, title.lines, codeX + 16 * s, y, codeW - 16 * s, titleSize, doc.style.titleWeight, p.ink, p.accent, title.lineHeight)
  y += title.height + 12 * s
  ctx.save()
  setFont(ctx, titleSize * 0.62, 600, 'mono')
  ctx.fillStyle = hexToRgba(p.accent, 0.65)
  ctx.fillText(' */', codeX, y)
  ctx.restore()
  y += 26 * s

  // 正文：代码行（放不下时缩小字号，绝不截断用户文字）
  const baseBody = Math.max(13 * s, (doc.style.bodySize * s * doc.scale) / 1.05)
  const runs = parseRich(doc.content.body)
  const codeW2 = codeW - 30 * s
  const availH = winY + winH - 46 * s - y
  const lay = (size: number) => {
    setFont(ctx, size, doc.style.bodyWeight || 400, 'mono')
    const ls = wrapRuns(ctx, runs, codeW2, { letterSpacing: 0 })
    const lineH = size * 1.9
    return { lines: ls, lineH, fits: ls.length * lineH <= availH }
  }
  let layout = lay(baseBody)
  if (!layout.fits && doc.autoFit) {
    let lo = Math.max(7 * s, baseBody * 0.3)
    let hi = baseBody
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2
      if (lay(mid).fits) lo = mid
      else hi = mid
    }
    layout = lay(lo)
  }
  const bodySize = layout.lines.length ? (layout.lineH / 1.9) : baseBody
  const lineH = layout.lineH
  const lines = layout.lines
  const shown = lines

  // 当前行高亮
  ctx.fillStyle = hexToRgba('#ffffff', 0.035)
  ctx.fillRect(gutterX, y - bodySize * 0.9, winW - (gutterX - winX) - 8 * s, lineH)

  shown.forEach((line, i) => {
    paintMeta(ctx, String(i + 12).padStart(2, ' '), {
      x: gutterX,
      y: y + bodySize * 0.78 + i * lineH,
      width: gutterW - 14 * s,
      align: 'right',
      size: bodySize * 0.85,
      weight: 500,
      fontKey: 'mono',
      color: hexToRgba(p.ink, 0.3),
    })
    // 字符串/注释式着色：强调词用 accent，标记词用绿色
    drawLine(ctx, line, {
      x: codeX,
      y: y + bodySize * 0.78 + i * lineH,
      align: 'left',
      size: bodySize,
      weight: doc.style.bodyWeight || 400,
      fontKey: 'mono',
      color: hexToRgba(p.ink, 0.86),
      accentColor: p.accent,
      markColor: hexToRgba('#28c840', 0.18),
      letterSpacing: 0,
    })
  })

  void shown
  flagBodyLong(r, 260, '代码截图风')

  // 状态栏
  const stY = winY + winH - 22 * s
  ctx.save()
  ctx.fillStyle = hexToRgba(p.accent, 0.16)
  roundRect(ctx, winX, stY - 20 * s, winW, 26 * s, 0)
  ctx.clip()
  ctx.fillRect(winX, stY - 20 * s, winW, 26 * s)
  ctx.restore()
  paintMeta(ctx, `Ln ${Math.min(12 + shown.length, 999)}, Col 1`, {
    x: winX + 20 * s,
    y: stY - 2 * s,
    width: winW * 0.4,
    size: 12 * s,
    weight: 600,
    fontKey: 'mono',
    color: hexToRgba(p.accent, 0.95),
  })
  paintMeta(ctx, doc.content.signature || 'main ✓  ·  prettier  ·  UTF-8', {
    x: winX,
    y: stY - 2 * s,
    width: winW - 20 * s,
    align: 'right',
    size: 12 * s,
    weight: 600,
    fontKey: 'mono',
    color: hexToRgba(p.accent, 0.9),
    ellipsis: true,
  })

  if (!doc.transparent) grain(ctx, W, H, 0.1, true)
  void drawDivider
  void measure
}

function paintLinesMono(
  ctx: CanvasRenderingContext2D,
  lines: TextLine[],
  x: number,
  y: number,
  w: number,
  size: number,
  weight: number,
  ink: string,
  accent: string,
  lineHeight: number,
) {
  lines.forEach((line, i) => {
    // 简单 token 着色：数字、括号内容用 accent
    let cx = x
    for (const part of line.runs) {
      const text = part.text
      setFont(ctx, size, part.run.bold ? weight + 200 : weight, 'mono')
      const segs = text.split(/(\b\d+\.?\d*\b)/g).filter((t) => t.length > 0)
      for (const seg of segs) {
        ctx.fillStyle = /^\d/.test(seg) || part.run.accent ? accent : ink
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(seg, cx, y + i * lineHeight)
        cx += measure(ctx, seg)
      }
    }
    void w
  })
}
