/**
 * 模板 05 · 复古报纸风
 * 版式逻辑：报头（大刊名 + 日期栏 + 双线）+ 跨栏标题 + 多栏正文（首字下沉）+ 栏间竖线 + 页脚版次。
 */
import type { RenderCtx } from '../../model/types'
import { mix } from '../color'
import { drawDivider, grain, paperTexture, roundRect } from '../assets'
import { columnize, flagBodyLong, padOf, paletteOf, scaleOf, titleFlow } from '../common'
import { paintLines, paintMeta } from '../paint'
import { setFont } from '../text'

export function renderRetroPaper(r: RenderCtx) {
  const { ctx, W, H, doc } = r
  const p = paletteOf(doc)
  const s = scaleOf(W, H)
  const pad = padOf(W, H, 0.062)
  const inner = W - pad * 2

  if (!doc.transparent) paperTexture(ctx, W, H, p.bg, 1)
  else grain(ctx, W, H, 0.2, true)

  // 外框
  ctx.strokeStyle = mix(p.ink, p.bg, 0.35)
  ctx.lineWidth = Math.max(1, 2 * s)
  ctx.strokeRect(pad * 0.55, pad * 0.55, W - pad * 1.1, H - pad * 1.1)

  // 报头
  let y = pad * 1.55
  paintMeta(ctx, 'VOL.MMXXVI  ·  No.001  ·  观察家日报', {
    x: pad,
    y,
    width: inner,
    size: 15 * s,
    weight: 600,
    fontKey: 'serif',
    color: p.soft,
    letterSpacing: 2 * s,
    ellipsis: true,
  })
  paintMeta(ctx, doc.content.footer || '每日一期 · 售价 ¥0.00', {
    x: pad,
    y,
    width: inner,
    align: 'right',
    size: 15 * s,
    weight: 600,
    fontKey: 'serif',
    color: p.soft,
    letterSpacing: 1.4 * s,
    ellipsis: true,
  })
  y += 22 * s

  // 刊名
  const masthead = (doc.content.eyebrow || 'THE DAILY INSIGHT').toUpperCase()
  ctx.save()
  setFont(ctx, 46 * s, 900, 'serif')
  ctx.fillStyle = p.ink
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  const mw = ctx.measureText(masthead).width
  const mastSize = mw > inner ? (46 * s * inner) / mw : 46 * s
  setFont(ctx, mastSize, 900, 'serif')
  ctx.fillText(masthead, pad, y + mastSize)
  ctx.restore()
  y += mastSize + 18 * s

  drawDivider(ctx, 'double', pad, y, inner, p.ink, Math.max(1.4, 2.6 * s))
  y += 16 * s
  paintMeta(ctx, '头版 · 深度', {
    x: pad,
    y,
    width: inner * 0.5,
    size: 15 * s,
    weight: 700,
    fontKey: 'serif',
    color: p.accent,
    letterSpacing: 3 * s,
  })
  paintMeta(ctx, doc.content.signature || '本报记者 / 综合报道', {
    x: pad,
    y,
    width: inner,
    align: 'right',
    size: 15 * s,
    weight: 500,
    fontKey: 'serif',
    color: p.soft,
    letterSpacing: 1 * s,
    ellipsis: true,
  })
  drawDivider(ctx, 'line', pad, y + 12 * s, inner, mix(p.ink, p.bg, 0.6), Math.max(1, 1.2 * s))
  y += 40 * s

  // 跨栏标题（居中）
  const title = titleFlow(r, {
    width: inner * 0.94,
    maxLines: 3,
    lineHeight: 1.16,
    sizeFactor: 1.5,
    minFactor: 0.42,
    letterSpacing: 0,
  })
  paintLines(ctx, title.lines, {
    x: pad + inner * 0.03,
    y: y + title.size * 0.86,
    width: inner * 0.94,
    align: 'center',
    size: title.size,
    weight: 900,
    fontKey: 'serif',
    ink: p.ink,
    accent: p.accent,
    markColor: mix(p.accent, '#ffffff', 0.55),
    letterSpacing: 0,
    lineHeight: title.lineHeight,
  })
  y += title.height + 14 * s

  drawDivider(ctx, 'line', pad + inner * 0.22, y, inner * 0.56, mix(p.ink, p.bg, 0.7), Math.max(1, 1 * s))
  y += 34 * s

  // 多栏正文
  const cols = W > H * 1.15 ? 3 : 2
  const gap = 26 * s
  const footY = H - pad * 1.35
  const bodyMaxH = Math.max(80 * s, footY - y - 24 * s)
  const { cols: columns, size, lineHeight, colW } = columnize(r, cols, gap, inner, 1, bodyMaxH)

  let colX = pad
  columns.forEach((lines) => {
    paintLines(ctx, lines, {
      x: colX,
      y: y + size * 0.86,
      width: colW,
      align: 'left',
      size,
      weight: doc.style.bodyWeight,
      fontKey: 'serif',
      ink: p.soft,
      accent: p.accent,
      markColor: mix(p.accent, '#ffffff', 0.6),
      letterSpacing: 0,
      lineHeight,
    })
    if (colX + colW + gap / 2 < pad + inner) {
      ctx.strokeStyle = mix(p.ink, p.bg, 0.78)
      ctx.lineWidth = Math.max(1, 1 * s)
      ctx.beginPath()
      ctx.moveTo(colX + colW + gap / 2, y - 6 * s)
      ctx.lineTo(colX + colW + gap / 2, Math.min(footY - 10 * s, y + bodyMaxH))
      ctx.stroke()
    }
    colX += colW + gap
  })
  flagBodyLong(r, 260, '复古报纸风')

  // 首字下沉
  const first = doc.content.body.trim()[0]
  if (first && /[\u4e00-\u9fa5A-Za-z]/.test(first)) {
    ctx.save()
    ctx.fillStyle = doc.transparent ? 'rgba(255,255,255,0)' : p.bg
    ctx.fillRect(pad - 2, y - 6 * s, size * 2.1, size * lineHeight * 2)
    ctx.fillStyle = p.ink
    ctx.font = `900 ${size * 3.1}px "Songti SC", "SimSun", "Noto Serif SC", serif`
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.fillText(first, pad, y + size * 2.6)
    ctx.restore()
  }

  // 页脚
  drawDivider(ctx, 'double', pad, footY, inner, p.ink, Math.max(1, 2 * s))
  paintMeta(ctx, '广告位 · 承接品牌故事与深度访谈', {
    x: pad,
    y: footY + 22 * s,
    width: inner,
    size: 14 * s,
    weight: 500,
    fontKey: 'serif',
    color: p.faint,
    letterSpacing: 1.6 * s,
    ellipsis: true,
  })
  paintMeta(ctx, '— 第 01 版 —', {
    x: pad,
    y: footY + 22 * s,
    width: inner,
    align: 'right',
    size: 14 * s,
    weight: 700,
    fontKey: 'serif',
    color: p.soft,
    letterSpacing: 2 * s,
  })

  // 花边角
  if (doc.deco.shape !== 'none') {
    ctx.save()
    ctx.fillStyle = mix(p.ink, p.bg, 0.55)
    const bx = W - pad * 0.55 - 96 * s
    const by = pad * 0.55 + 10 * s
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        roundRect(ctx, bx + i * 14 * s, by + j * 5 * s, 10 * s, 2.4 * s, 1 * s)
        ctx.fill()
      }
    }
    ctx.restore()
  }
}
