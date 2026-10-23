/**
 * 模板 06 · 研究报告风
 * 版式逻辑：左侧深色侧栏（机构 / 报告编号 / 竖排期号）+ 右侧白底正文区，
 * 章节编号 + 摘要框 + 数据行（从署名/页脚的「|」解析），强调块引用。
 */
import type { RenderCtx } from '../../model/types'
import { mix } from '../color'
import { drawDivider, drawIcon, grain, roundRect } from '../assets'
import { bodyFlow, flagBodyLong, padOf, paletteOf, scaleOf, titleFlow } from '../common'
import { paintLines, paintMeta } from '../paint'
import { setFont } from '../text'

export function renderResearchReport(r: RenderCtx) {
  const { ctx, W, H, doc } = r
  const p = paletteOf(doc)
  const s = scaleOf(W, H)
  const narrow = W < H * 0.85
  const sideW = narrow ? W * 0.175 : W * 0.235
  const pad = padOf(W, H, 0.06)

  if (!doc.transparent) {
    ctx.fillStyle = mix('#ffffff', p.bg, 0.35)
    ctx.fillRect(0, 0, W, H)
  }

  // 左侧深色侧栏
  ctx.fillStyle = p.ink
  ctx.fillRect(0, 0, sideW, H)
  ctx.save()
  ctx.strokeStyle = mix(p.ink, p.accent, 0.5)
  ctx.lineWidth = 1
  for (let y = 0; y < H; y += 40 * s) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(sideW, y)
    ctx.stroke()
  }
  ctx.restore()

  // 侧栏内容（竖排文字）
  const sx = sideW / 2
  ctx.save()
  ctx.fillStyle = mix(p.accent, '#ffffff', 0.35)
  ctx.beginPath()
  ctx.arc(sx, pad * 1.9, 20 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  drawIcon(ctx, doc.deco.icon === 'none' ? 'trend' : doc.deco.icon, sx - 12 * s, pad * 1.9 - 12 * s, 24 * s, p.ink, 2.2)

  paintMeta(ctx, doc.content.eyebrow || 'RESEARCH INSIGHT', {
    x: 0,
    y: pad * 3.2,
    width: sideW,
    align: 'center',
    size: 12.5 * s,
    weight: 700,
    color: mix(p.accent, '#ffffff', 0.4),
    letterSpacing: 2.4 * s,
    ellipsis: true,
  })

  // 竖排期号
  const issue = (doc.content.footer || 'No.2026-Q4').split(/[|｜]/)[0].trim()
  ctx.save()
  ctx.translate(sideW * 0.34, H * 0.62)
  ctx.rotate(-Math.PI / 2)
  setFont(ctx, 30 * s, 800, doc.style.fontTitle)
  ctx.fillStyle = mix(p.ink, '#ffffff', 0.22)
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(issue.toUpperCase(), 0, 0)
  ctx.restore()

  paintMeta(ctx, doc.content.signature || '数据研究中心', {
    x: 0,
    y: H - pad * 1.2,
    width: sideW,
    align: 'center',
    size: 13 * s,
    weight: 600,
    color: mix(p.accent, '#ffffff', 0.5),
    letterSpacing: 1.2 * s,
    ellipsis: true,
  })

  // 右侧内容区
  const cx = sideW + pad
  const cw = W - cx - pad
  let y = pad * 1.25

  // 报告标签
  ctx.save()
  setFont(ctx, 14 * s, 700, doc.style.fontBody)
  const tagText = 'INSIGHT REPORT'
  const tw = ctx.measureText(tagText).width + 22 * s
  ctx.strokeStyle = p.accent
  ctx.lineWidth = Math.max(1, 1.6 * s)
  roundRect(ctx, cx, y - 20 * s, tw, 30 * s, 4 * s)
  ctx.stroke()
  ctx.fillStyle = p.accent
  ctx.textBaseline = 'middle'
  ctx.fillText(tagText, cx + 11 * s, y - 5 * s)
  ctx.restore()
  paintMeta(ctx, '仅供内部参考', {
    x: cx,
    y: y,
    width: cw,
    align: 'right',
    size: 13 * s,
    weight: 500,
    color: p.faint,
    letterSpacing: 1 * s,
  })
  y += 32 * s

  // 标题
  const title = titleFlow(r, { width: cw, maxLines: 4, lineHeight: 1.28, sizeFactor: 1.12, minFactor: 0.46, letterSpacing: -0.4 })
  paintLines(ctx, title.lines, {
    x: cx,
    y: y + title.size * 0.86,
    width: cw,
    align: 'left',
    size: title.size,
    weight: doc.style.titleWeight,
    fontKey: doc.style.fontTitle,
    ink: p.ink,
    accent: p.accent,
    markColor: mix(p.accent, '#ffffff', 0.6),
    letterSpacing: -0.4 * s,
    lineHeight: title.lineHeight,
  })
  y += title.height + 26 * s

  // 关键数据条
  const dataItems = (doc.content.footer || '样本量 1,024 | 增速 +38% | 置信度 95%')
    .split(/[|｜]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3)
  if (dataItems.length >= 2) {
    const gap = 14 * s
    const boxW = (cw - gap * (dataItems.length - 1)) / dataItems.length
    dataItems.forEach((item, i) => {
      const bx = cx + i * (boxW + gap)
      const parts = item.split(/\s+/)
      const big = parts[0] ?? item
      const rest = parts.slice(1).join(' ')
      ctx.fillStyle = mix(p.bg, p.ink, 0.04)
      roundRect(ctx, bx, y, boxW, 78 * s, 8 * s)
      ctx.fill()
      ctx.fillStyle = p.accent
      ctx.fillRect(bx, y, Math.max(2, 3 * s), 78 * s)
      paintMeta(ctx, big, {
        x: bx + 16 * s,
        y: y + 36 * s,
        width: boxW - 26 * s,
        size: 28 * s,
        weight: 800,
        color: p.ink,
        ellipsis: true,
      })
      paintMeta(ctx, rest, {
        x: bx + 16 * s,
        y: y + 62 * s,
        width: boxW - 26 * s,
        size: 13.5 * s,
        weight: 500,
        color: p.faint,
        letterSpacing: 0.4 * s,
        ellipsis: true,
      })
    })
    y += 78 * s + 26 * s
  }

  // 摘要
  drawDivider(ctx, 'line', cx, y, cw, mix(p.ink, p.bg, 0.82), Math.max(1, 1 * s))
  y += 18 * s
  paintMeta(ctx, '01  核心摘要 / SUMMARY', {
    x: cx,
    y: y + 14 * s,
    width: cw,
    size: 14.5 * s,
    weight: 800,
    color: p.ink,
    letterSpacing: 2 * s,
  })
  y += 30 * s

  const bodyMax = H - pad * 1.3 - y
  const body = bodyFlow(r, { width: cw, maxHeight: bodyMax, sizeFactor: 1.0, lineHeight: 1.78 })
  if (doc.content.body) {
    paintLines(ctx, body.lines, {
      x: cx,
      y: y + body.size * 0.86,
      width: cw,
      align: 'left',
      size: body.size,
      weight: doc.style.bodyWeight,
      fontKey: doc.style.fontBody,
      ink: p.soft,
      accent: p.accent,
      markColor: mix(p.accent, '#ffffff', 0.62),
      letterSpacing: doc.style.letterSpacing * s,
      lineHeight: body.lineHeight,
    })
  }
  flagBodyLong(r, 210, '研究报告风')

  // 页脚
  paintMeta(ctx, '© 2026 Research Lab  ·  本图仅用于设计示意', {
    x: cx,
    y: H - pad * 0.85,
    width: cw,
    size: 12.5 * s,
    weight: 500,
    color: p.faint,
    letterSpacing: 0.8 * s,
    ellipsis: true,
  })
  if (!doc.transparent) grain(ctx, W, H, 0.1, true)
}
