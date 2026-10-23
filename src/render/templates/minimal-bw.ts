/**
 * 模板 01 · 极简黑白观点卡
 * 版式逻辑：顶部细线栅格 + 超大序号 + 标题锁上半区（左下大留白）+ 正文底部对齐 + 等宽角标。
 */
import type { RenderCtx } from '../../model/types'
import { mix } from '../color'
import { drawDivider, drawIcon, grain, noiseTile } from '../assets'
import { bodyFlow, flagBodyLong, drawUserImage, padOf, paletteOf, scaleOf, titleFlow } from '../common'
import { paintLines, paintMeta } from '../paint'

export function renderMinimalBW(r: RenderCtx) {
  const { ctx, W, H, doc } = r
  const p = paletteOf(doc)
  const s = scaleOf(W, H)
  const pad = padOf(W, H, 0.078)
  const inner = W - pad * 2

  if (!doc.transparent) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, W, H)
  }
  if (doc.image) {
    drawUserImage(r, 'faint', { tint: p.bg, tintAlpha: 0.55 })
  }
  if (!doc.transparent) grain(ctx, W, H, 0.16, true)

  const top = pad * 0.9

  // 顶部标识行
  ctx.fillStyle = p.accent
  ctx.fillRect(pad, top + 6 * s, 10 * s, 10 * s)
  paintMeta(ctx, doc.content.eyebrow || '观点 / VIEWPOINT', {
    x: pad + 24 * s,
    y: top + 16 * s,
    width: inner - 24 * s,
    size: 18 * s,
    weight: 700,
    color: p.ink,
    letterSpacing: 3.2 * s,
    ellipsis: true,
  })
  if (doc.deco.icon !== 'none') {
    drawIcon(ctx, doc.deco.icon, W - pad - 26 * s, top - 10 * s, 26 * s, p.ink, 2)
  }
  drawDivider(ctx, 'line', pad, top + 50 * s, inner, p.line, Math.max(1, 1.5 * s))

  // 标题（限制最大高度，保证正文与页脚始终有自己的位置）
  const titleTop = top + 108 * s
  const footerBase = H - pad * 1.05
  const titleMaxH = Math.max(60 * s, footerBase - 56 * s - 44 * s - titleTop - 150 * s)
  const title = titleFlow(r, {
    width: inner,
    maxLines: 5,
    lineHeight: 1.14,
    sizeFactor: 1.55,
    minFactor: 0.4,
    letterSpacing: -1,
    maxHeight: titleMaxH,
  })
  paintLines(ctx, title.lines, {
    x: pad,
    y: titleTop + title.size * 0.86,
    width: inner,
    align: doc.style.align,
    size: title.size,
    weight: doc.style.titleWeight,
    fontKey: doc.style.fontTitle,
    ink: p.ink,
    accent: p.accent,
    markColor: mix(p.accent, '#ffffff', 0.45),
    letterSpacing: -1 * s,
    lineHeight: title.lineHeight,
  })

  // 强调短线（放在标题最后一行基线下方，避免压字）
  const titleBottomY =
    titleTop +
    title.size * 0.86 +
    Math.max(0, title.lines.length - 1) * title.lineHeight +
    title.size * 0.2
  const ruleY = titleBottomY + 26 * s
  ctx.fillStyle = p.ink
  ctx.fillRect(pad, ruleY, Math.min(inner, 72 * s), Math.max(3, 4 * s))

  // 正文（底对齐，留出底部信息区）
  const bodyBottom = footerBase - 56 * s
  const bodyTopLimit = ruleY + 44 * s
  const body = bodyFlow(r, {
    width: inner * 0.9,
    maxHeight: Math.max(28 * s, bodyBottom - bodyTopLimit),
    sizeFactor: 1.0,
    lineHeight: 1.85,
  })
  if (doc.content.body) {
    const bodyTop = Math.max(bodyTopLimit, bodyBottom - body.height)
    paintLines(ctx, body.lines, {
      x: pad,
      y: bodyTop + body.size * 0.84,
      width: inner * 0.9,
      align: doc.style.align,
      size: body.size,
      weight: doc.style.bodyWeight,
      fontKey: doc.style.fontBody,
      ink: p.soft,
      accent: p.accent,
      markColor: mix(p.accent, '#ffffff', 0.4),
      letterSpacing: doc.style.letterSpacing * s,
      lineHeight: body.lineHeight,
    })
  }
  flagBodyLong(r, 96, '极简黑白观点卡')

  // 底部信息区
  drawDivider(ctx, 'line', pad, footerBase - 34 * s, inner, p.line, Math.max(1, 1.2 * s))
  paintMeta(ctx, doc.content.signature, {
    x: pad,
    y: footerBase,
    width: inner * 0.62,
    size: 19 * s,
    weight: 600,
    color: p.ink,
    letterSpacing: 1.4 * s,
    ellipsis: true,
  })
  paintMeta(ctx, doc.content.footer, {
    x: pad,
    y: footerBase,
    width: inner,
    align: 'right',
    size: 17 * s,
    weight: 500,
    color: p.faint,
    letterSpacing: 2 * s,
    ellipsis: true,
  })

  // 极简噪点块（右上角装饰，来自 deco.shape）
  if (doc.deco.shape !== 'none') {
    const tile = noiseTile(5, 120, 2.4, true)
    const pat = ctx.createPattern(tile, 'repeat')
    if (pat) {
      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.fillStyle = pat
      ctx.fillRect(W - pad - 120 * s, H - pad - 200 * s, 120 * s, 150 * s)
      ctx.restore()
    }
  }
}
