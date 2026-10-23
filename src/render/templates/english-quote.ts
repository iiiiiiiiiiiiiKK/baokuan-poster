/**
 * 模板 10 · 极简英文金句风
 * 版式逻辑：居中衬线大字 + 巨大装饰引号 + 等宽小字说明 + 超大留白 + 上下细线，
 * 强依赖英文排版的字号/行距关系（不居中正文时改为左对齐「作者引语」式）。
 */
import type { RenderCtx } from '../../model/types'
import { hexToRgba, mix } from '../color'
import { drawDivider, grain } from '../assets'
import { bodyFlow, padOf, paletteOf, scaleOf, titleFlow } from '../common'
import { paintLines, paintMeta } from '../paint'
import { setFont } from '../text'

export function renderEnglishQuote(r: RenderCtx) {
  const { ctx, W, H, doc } = r
  const p = paletteOf(doc)
  const s = scaleOf(W, H)
  const pad = padOf(W, H, 0.1)
  const inner = W - pad * 2

  if (!doc.transparent) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, mix(p.bg, '#ffffff', 0.06))
    g.addColorStop(1, mix(p.bg, '#000000', 0.06))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  // 外框细线
  ctx.strokeStyle = hexToRgba(p.ink, 0.14)
  ctx.lineWidth = Math.max(1, 1.2 * s)
  ctx.strokeRect(pad * 0.42, pad * 0.42, W - pad * 0.84, H - pad * 0.84)

  // 巨大引号
  ctx.save()
  setFont(ctx, Math.min(W, H) * 0.42, 700, 'serif')
  ctx.fillStyle = hexToRgba(p.accent, 0.16)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('“', pad * 0.28, pad * 0.4 + Math.min(W, H) * 0.34)
  ctx.restore()

  // 顶部 eyebrow
  paintMeta(ctx, (doc.content.eyebrow || 'A NOTE TO MYSELF').toUpperCase(), {
    x: pad,
    y: pad * 1.15,
    width: inner,
    align: doc.style.align === 'center' ? 'center' : 'left',
    size: 16 * s,
    weight: 600,
    color: p.soft,
    letterSpacing: 5 * s,
    ellipsis: true,
  })
  drawDivider(ctx, 'line', pad, pad * 1.42, inner, hexToRgba(p.ink, 0.18), Math.max(1, 1 * s))

  // 主文案：居中衬线大字（限制最大高度，超长时自动缩小而不是溢出画布）
  const title = titleFlow(r, {
    width: inner,
    maxLines: 5,
    lineHeight: 1.34,
    sizeFactor: 1.28,
    minFactor: 0.4,
    letterSpacing: 0,
    align: 'center',
    maxHeight: H * 0.52,
  })
  const blockH = title.height
  const titleTop = Math.max(pad * 2.2, H / 2 - blockH / 2 - (doc.content.body ? H * 0.07 : 0))
  paintLines(ctx, title.lines, {
    x: pad,
    y: titleTop + title.size * 0.86,
    width: inner,
    align: 'center',
    size: title.size,
    weight: doc.style.titleWeight,
    fontKey: 'serif',
    ink: p.ink,
    accent: p.accent,
    markColor: hexToRgba(p.accent, 0.22),
    letterSpacing: 0,
    lineHeight: title.lineHeight,
  })

  // 短横线分隔
  const ruleY = Math.min(titleTop + title.height + 30 * s, H - pad * 2.1)
  ctx.fillStyle = p.accent
  ctx.fillRect(W / 2 - 26 * s, ruleY, 52 * s, Math.max(2, 2.6 * s))

  // 副文案：小号衬线，居中
  if (doc.content.body) {
    const bodyTop = ruleY + 44 * s
    const body = bodyFlow(r, {
      width: inner * 0.72,
      maxHeight: Math.max(24 * s, H - pad * 1.9 - bodyTop),
      sizeFactor: 0.96,
      lineHeight: 1.9,
      letterSpacing: 0.4,
    })
    paintLines(ctx, body.lines, {
      x: pad + inner * 0.14,
      y: bodyTop + body.size * 0.86,
      width: inner * 0.72,
      align: 'center',
      size: body.size,
      weight: doc.style.bodyWeight,
      fontKey: 'serif',
      ink: p.soft,
      accent: p.accent,
      markColor: hexToRgba(p.accent, 0.2),
      letterSpacing: 0.4 * s,
      lineHeight: body.lineHeight,
    })
  }

  // 底部署名
  drawDivider(ctx, 'line', pad, H - pad * 1.3, inner, hexToRgba(p.ink, 0.18), Math.max(1, 1 * s))
  paintMeta(ctx, (doc.content.signature || '— ANONYMOUS, 2026').toUpperCase(), {
    x: pad,
    y: H - pad * 1.05,
    width: inner,
    align: 'center',
    size: 15.5 * s,
    weight: 600,
    color: p.ink,
    letterSpacing: 3.4 * s,
    ellipsis: true,
  })
  if (doc.content.footer) {
    paintMeta(ctx, doc.content.footer.toUpperCase(), {
      x: pad,
      y: H - pad * 0.82,
      width: inner,
      align: 'center',
      size: 13 * s,
      weight: 500,
      color: p.faint,
      letterSpacing: 2.6 * s,
      ellipsis: true,
    })
  }
  if (!doc.transparent) grain(ctx, W, H, 0.08, true)
}
