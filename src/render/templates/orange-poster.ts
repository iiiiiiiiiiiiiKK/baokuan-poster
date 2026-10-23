/**
 * 模板 02 · 橙色大字报
 * 版式逻辑：满版橙色块 + 字重极大的居中标题（可用「」括注）/ 斜切色块 / 底部黑色信息条。
 * 与「极简黑白」的区别：无细线栅格，靠色块与超大字号的视觉冲击。
 */
import type { RenderCtx } from '../../model/types'
import { mix } from '../color'
import { drawDivider, drawShape, drawSticker, grain, highlighter } from '../assets'
import { bodyFlow, drawUserImage, flagBodyLong, padOf, paletteOf, scaleOf, titleFlow } from '../common'
import { paintLines, paintMeta } from '../paint'
import { drawLine, setFont } from '../text'

export function renderOrangePoster(r: RenderCtx) {
  const { ctx, W, H, doc } = r
  const p = paletteOf(doc)
  const s = scaleOf(W, H)
  const pad = padOf(W, H, 0.068)
  const inner = W - pad * 2

  if (!doc.transparent) {
    // 橙色底 + 右上斜切亮块
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, W, H)
    ctx.save()
    ctx.globalAlpha = 0.5
    drawShape(ctx, 'blob', W * 0.92, H * 0.06, Math.min(W, H) * 0.9, mix(p.bg, '#ffffff', 0.28), doc.deco)
    ctx.restore()
  }
  if (doc.image) drawUserImage(r, 'faint', { tint: p.bg, tintAlpha: 0.72 })
  if (!doc.transparent) grain(ctx, W, H, 0.3, true)

  // 顶部徽标行
  const topY = pad * 0.95
  ctx.save()
  setFont(ctx, 19 * s, 800, doc.style.fontTitle)
  const badge = (doc.content.eyebrow || '爆款观点').toUpperCase()
  const bw = ctx.measureText(badge).width + 30 * s
  const bh = 40 * s
  ctx.fillStyle = p.ink
  ctx.beginPath()
  ctx.moveTo(pad, topY)
  ctx.lineTo(pad + bw, topY)
  ctx.lineTo(pad + bw - 10 * s, topY + bh)
  ctx.lineTo(pad, topY + bh)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = p.bg
  ctx.textBaseline = 'middle'
  ctx.fillText(badge, pad + 15 * s, topY + bh / 2 + 1 * s)
  ctx.restore()

  // 右侧编号
  paintMeta(ctx, 'NO.01', {
    x: pad,
    y: topY + bh * 0.72,
    width: inner,
    align: 'right',
    size: 18 * s,
    weight: 700,
    color: mix(p.ink, p.bg, 0.55),
    letterSpacing: 4 * s,
  })

  // 标题：超大、居中、紧凑行距（限制最大高度，确保正文块与底部信息条有位置）
  const titleTop = topY + 96 * s
  const footReserve = 58 * s
  const titleMaxH = Math.max(60 * s, H - pad * 1.5 - footReserve - titleTop - 84 * s)
  const title = titleFlow(r, {
    width: inner,
    maxLines: 5,
    lineHeight: 1.1,
    sizeFactor: 2.0,
    minFactor: 0.36,
    letterSpacing: -2,
    align: doc.style.align,
    maxHeight: titleMaxH,
  })
  paintLines(ctx, title.lines, {
    x: pad,
    y: titleTop + title.size * 0.86,
    width: inner,
    align: doc.style.align === 'left' ? 'left' : doc.style.align,
    size: title.size,
    weight: doc.style.titleWeight,
    fontKey: doc.style.fontTitle,
    ink: p.ink,
    accent: mix(p.accent, '#ffffff', 0.55),
    markColor: mix(p.ink, '#ffffff', 0.72),
    letterSpacing: -2 * s,
    lineHeight: title.lineHeight,
  })

  // 粗分割条（标题最后一行基线下方）
  const titleBottomY =
    titleTop + title.size * 0.86 + Math.max(0, title.lines.length - 1) * title.lineHeight + title.size * 0.18
  const barY = titleBottomY + 34 * s
  ctx.fillStyle = p.ink
  ctx.fillRect(pad, barY, inner, Math.max(3, 5 * s))

  // 正文：黑底白字块
  const bodyTop = barY + 34 * s
  const body = bodyFlow(r, {
    width: inner - 56 * s,
    maxHeight: H - pad * 1.5 - bodyTop,
    sizeFactor: 0.98,
    lineHeight: 1.7,
  })
  if (doc.content.body) {
    const boxH = Math.min(body.height + 56 * s, H - pad * 1.5 - bodyTop)
    ctx.fillStyle = mix(p.ink, p.bg, 0.06)
    ctx.fillRect(pad, bodyTop, inner, boxH)
    paintLines(ctx, body.lines, {
      x: pad + 28 * s,
      y: bodyTop + 28 * s + body.size * 0.86,
      width: inner - 56 * s,
      align: 'left',
      size: body.size,
      weight: doc.style.bodyWeight,
      fontKey: doc.style.fontBody,
      ink: p.bg,
      accent: mix(p.accent, '#ffffff', 0.5),
      markColor: mix(p.accent, '#ffffff', 0.2),
      letterSpacing: doc.style.letterSpacing * s,
      lineHeight: body.lineHeight,
    })
  }
  flagBodyLong(r, 84, '橙色大字报')

  // 底部信息条
  const footY = H - pad * 0.95
  drawDivider(ctx, 'line', pad, footY - 40 * s, inner, mix(p.ink, p.bg, 0.62), Math.max(1, 2 * s))
  paintMeta(ctx, doc.content.signature || '@你的名字', {
    x: pad,
    y: footY,
    width: inner * 0.55,
    size: 22 * s,
    weight: 800,
    color: p.ink,
    letterSpacing: 0.6 * s,
    ellipsis: true,
  })
  paintMeta(ctx, doc.content.footer || '点赞 · 收藏 · 转发', {
    x: pad,
    y: footY,
    width: inner,
    align: 'right',
    size: 17 * s,
    weight: 700,
    color: mix(p.ink, p.bg, 0.25),
    letterSpacing: 1.6 * s,
    ellipsis: true,
  })

  // 贴纸
  if (doc.deco.corner === 'tag') {
    drawSticker(ctx, 'HOT', W - pad * 1.2, topY + 130 * s, 9, {
      color: '#ffffff',
      bg: p.accent === p.bg ? '#e8442a' : p.accent,
      font: `800 ${Math.round(20 * s)}px "Inter", sans-serif`,
    })
  }
  void highlighter
  void drawLine
}
