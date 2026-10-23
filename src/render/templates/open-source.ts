/**
 * 模板 03 · 开源项目介绍卡
 * 版式逻辑：GitHub 风格的卡片 —— 标题行 + 徽章行 + 分隔线 + 两列特性列表（从正文的「|」自动派生）+ 底部 star 计数。
 */
import type { RenderCtx } from '../../model/types'
import { mix } from '../color'
import { drawDivider, drawIcon, grain, roundRect } from '../assets'
import { bodyFlow, flagBodyLong, padOf, paletteOf, scaleOf, titleFlow } from '../common'
import { paintLines, paintMeta } from '../paint'
import { setFont } from '../text'

const BADGES = ['MIT License', 'TypeScript', 'v1.0.0', 'Open Source']

export function renderOpenSource(r: RenderCtx) {
  const { ctx, W, H, doc } = r
  const p = paletteOf(doc)
  const s = scaleOf(W, H)
  const pad = padOf(W, H, 0.07)
  const inner = W - pad * 2

  if (!doc.transparent) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, W, H)
    // 顶部细网格
    ctx.save()
    ctx.strokeStyle = mix(p.bg, p.ink, 0.08)
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += 44 * s) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H * 0.32)
      ctx.stroke()
    }
    for (let y = 0; y < H * 0.32; y += 44 * s) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.restore()
  }
  if (!doc.transparent) grain(ctx, W, H, 0.12, true)

  // 卡片
  const cardX = pad
  const cardY = pad * 1.5
  const cardW = inner
  const cardH = H - cardY - pad * 1.35
  ctx.save()
  ctx.shadowColor = 'rgba(15,23,42,0.18)'
  ctx.shadowBlur = 40 * s
  ctx.shadowOffsetY = 12 * s
  ctx.fillStyle = p.card
  roundRect(ctx, cardX, cardY, cardW, cardH, 26 * s)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = p.line
  ctx.lineWidth = Math.max(1, 1.6 * s)
  roundRect(ctx, cardX, cardY, cardW, cardH, 26 * s)
  ctx.stroke()

  const cx = cardX + 52 * s
  const cw = cardW - 104 * s
  let y = cardY + 66 * s

  // 仓库头像 + owner/name
  const av = 54 * s
  ctx.fillStyle = p.accent
  roundRect(ctx, cx, y - av * 0.78, av, av, 14 * s)
  ctx.fill()
  drawIcon(ctx, doc.deco.icon === 'none' ? 'code' : doc.deco.icon, cx + av * 0.18, y - av * 0.6, av * 0.64, p.bg, 2)

  const repoName = doc.content.eyebrow || 'open-source / project'
  paintMeta(ctx, repoName, {
    x: cx + av + 22 * s,
    y: y - 12 * s,
    width: cw - av - 22 * s,
    size: 19 * s,
    weight: 600,
    color: p.soft,
    letterSpacing: 0.5 * s,
    ellipsis: true,
  })
  paintMeta(ctx, doc.content.signature || '★ 12,480   ·   Fork 1,204', {
    x: cx + av + 22 * s,
    y: y + 20 * s,
    width: cw - av - 22 * s,
    size: 17 * s,
    weight: 500,
    color: p.faint,
    letterSpacing: 0.4 * s,
    ellipsis: true,
  })

  y += 58 * s
  drawDivider(ctx, 'line', cx, y, cw, p.line, Math.max(1, 1.4 * s))
  y += 44 * s

  // 标题
  const title = titleFlow(r, { width: cw, maxLines: 3, lineHeight: 1.24, sizeFactor: 1.06, minFactor: 0.5, letterSpacing: -0.6 })
  paintLines(ctx, title.lines, {
    x: cx,
    y: y + title.size * 0.84,
    width: cw,
    align: 'left',
    size: title.size,
    weight: doc.style.titleWeight,
    fontKey: doc.style.fontTitle,
    ink: p.ink,
    accent: p.accent,
    markColor: mix(p.accent, '#ffffff', 0.55),
    letterSpacing: -0.6 * s,
    lineHeight: title.lineHeight,
  })
  y += title.height + 24 * s

  // 徽章行
  let bx = cx
  ctx.save()
  setFont(ctx, 15.5 * s, 700, doc.style.fontBody)
  for (const b of BADGES.slice(0, 4)) {
    const tw = ctx.measureText(b).width + 24 * s
    if (bx + tw > cx + cw) break
    const h = 32 * s
    ctx.fillStyle = mix(p.accent, p.bg, 0.86)
    roundRect(ctx, bx, y, tw, h, 6 * s)
    ctx.fill()
    ctx.strokeStyle = mix(p.accent, p.bg, 0.62)
    ctx.lineWidth = Math.max(1, 1.2 * s)
    roundRect(ctx, bx, y, tw, h, 6 * s)
    ctx.stroke()
    ctx.fillStyle = mix(p.accent, p.ink, 0.15)
    ctx.textBaseline = 'middle'
    ctx.fillText(b, bx + 12 * s, y + h / 2 + 1 * s)
    bx += tw + 10 * s
  }
  ctx.restore()
  y += 54 * s

  // 正文 / 特性列表
  const bodyTop = y + 26 * s
  const bodyMax = cardY + cardH - 96 * s - bodyTop
  const body = bodyFlow(r, { width: cw, maxHeight: bodyMax, sizeFactor: 1.0, lineHeight: 1.72 })
  const bullet = doc.content.body.includes('|')
  if (body.lines.length) {
    // 左侧竖线（引用块）
    ctx.fillStyle = p.accent
    ctx.fillRect(cx, bodyTop - 4 * s, Math.max(2, 3 * s), Math.min(body.height, bodyMax) + 4 * s)
    paintLines(ctx, body.lines, {
      x: cx + 24 * s,
      y: bodyTop + body.size * 0.86,
      width: cw - 24 * s,
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
  flagBodyLong(r, 150, '开源项目介绍卡')

  // 底部：命令行
  const cmdY = cardY + cardH - 44 * s
  ctx.fillStyle = mix(p.ink, p.bg, 0.94)
  roundRect(ctx, cx, cmdY - 26 * s, cw, 46 * s, 10 * s)
  ctx.fill()
  paintMeta(ctx, `$ ${doc.content.footer || 'npm i your-package'}`, {
    x: cx + 18 * s,
    y: cmdY + 4 * s,
    width: cw - 36 * s,
    size: 17 * s,
    weight: 600,
    fontKey: 'mono',
    color: p.soft,
    letterSpacing: 0.2 * s,
    ellipsis: true,
  })
  void bullet
}
