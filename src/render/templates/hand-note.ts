/**
 * 模板 08 · 手写批注风
 * 版式逻辑：横线笔记本纸 + 楷体正文 + 手绘荧光笔/下划线 + 便签贴纸 + 旋转印章 + 页边批注栏。
 * 正文按原文逐行绘制（不做三栏），强调词自动加手绘标记。
 */
import type { RenderCtx } from '../../model/types'
import { mix, seededRandom } from '../color'
import {
  drawDivider,
  drawSticker,
  grain,
  handUnderline,
  highlighter,
  roundRect,
} from '../assets'
import { bodyFlow, flagBodyLong, padOf, paletteOf, scaleOf, titleFlow } from '../common'
import { paintLines, paintMeta } from '../paint'
import { setFont } from '../text'

export function renderHandNote(r: RenderCtx) {
  const { ctx, W, H, doc } = r
  const p = paletteOf(doc)
  const s = scaleOf(W, H)
  const pad = padOf(W, H, 0.075)
  const inner = W - pad * 2

  const paperColor = doc.transparent ? 'rgba(0,0,0,0)' : p.bg
  if (!doc.transparent) {
    ctx.fillStyle = paperColor
    ctx.fillRect(0, 0, W, H)
    // 纸纹
    const rnd = seededRandom(31)
    ctx.save()
    ctx.globalAlpha = 0.16
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = rnd() > 0.5 ? '#000000' : '#ffffff'
      ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4)
    }
    ctx.restore()
  }

  // 横线纸纹理
  const ruleGap = 52 * s
  const ruleStart = pad * 0.5
  ctx.save()
  ctx.strokeStyle = mix(p.ink, p.bg, 0.86)
  ctx.lineWidth = Math.max(1, 1.2 * s)
  for (let y = ruleStart; y < H; y += ruleGap) {
    ctx.beginPath()
    ctx.moveTo(pad * 0.3, y)
    ctx.lineTo(W - pad * 0.3, y)
    ctx.stroke()
  }
  // 左侧红色竖线
  ctx.strokeStyle = mix('#e0554a', p.bg, 0.45)
  ctx.lineWidth = Math.max(1.2, 2 * s)
  ctx.beginPath()
  ctx.moveTo(pad * 0.95, 0)
  ctx.lineTo(pad * 0.95, H)
  ctx.stroke()
  ctx.restore()

  // 顶部日期 + 别针
  let y = pad * 1.35
  paintMeta(ctx, doc.content.eyebrow || '随手记 · 第 12 页', {
    x: pad * 1.3,
    y,
    width: inner,
    size: 17 * s,
    weight: 600,
    fontKey: 'kai',
    color: p.faint,
    letterSpacing: 1.6 * s,
    ellipsis: true,
  })
  paintMeta(ctx, doc.content.footer || '2026 / 10 / 23', {
    x: pad * 1.3,
    y,
    width: inner,
    align: 'right',
    size: 17 * s,
    weight: 600,
    fontKey: 'kai',
    color: p.faint,
    letterSpacing: 1 * s,
    ellipsis: true,
  })
  y += 40 * s

  // 标题（楷体 + 手绘下划线）
  const title = titleFlow(r, { width: inner * 0.88, maxLines: 3, lineHeight: 1.42, sizeFactor: 1.32, minFactor: 0.48, letterSpacing: 0.4 })
  const titleY = y + title.size * 0.86
  paintLines(ctx, title.lines, {
    x: pad * 1.3,
    y: titleY,
    width: inner * 0.88,
    align: 'left',
    size: title.size,
    weight: doc.style.titleWeight,
    fontKey: 'kai',
    ink: p.ink,
    accent: p.accent,
    markColor: mix('#ffe066', '#ffffff', 0.2),
    markAlpha: 0.85,
    letterSpacing: 0.4 * s,
    lineHeight: title.lineHeight,
  })
  // 标题最后一行的手绘下划线
  const lastLine = title.lines[title.lines.length - 1]
  handUnderline(
    ctx,
    pad * 1.3,
    titleY + (title.lines.length - 1) * title.lineHeight + title.size * 0.2,
    Math.min(lastLine?.width ?? inner * 0.5, inner),
    mix(p.accent, p.ink, 0.15),
    Math.max(2, 3.4 * s),
    17,
  )
  y = titleY + (title.lines.length - 1) * title.lineHeight + 46 * s

  // 正文（楷体，行距贴合横线）
  const bodyMax = H - pad * 1.5 - y
  const body = bodyFlow(r, {
    width: inner * 0.92,
    maxHeight: bodyMax,
    sizeFactor: 1.06,
    lineHeight: ruleGap / (doc.style.bodySize * s * doc.scale * 1.06) || 1.9,
    floor: 0.82,
  })
  const bodyLineH = Math.max(body.lineHeight, ruleGap)
  if (doc.content.body) {
    paintLines(ctx, body.lines, {
      x: pad * 1.3,
      y: y + body.size * 0.6,
      width: inner * 0.92,
      align: 'left',
      size: body.size,
      weight: doc.style.bodyWeight,
      fontKey: 'kai',
      ink: mix(p.ink, p.bg, 0.12),
      accent: p.accent,
      markColor: mix('#ffe066', '#ffffff', 0.15),
      markAlpha: 0.8,
      letterSpacing: 0.3 * s,
      lineHeight: bodyLineH,
    })
  }
  flagBodyLong(r, 120, '手写批注风')

  // 右侧边批注（竖排小手写字）
  const marginNote = doc.content.signature || '—— 记于深夜 / 想法还在长'
  ctx.save()
  ctx.translate(W - pad * 0.62, H * 0.58)
  ctx.rotate(Math.PI / 2)
  setFont(ctx, 16 * s, 500, 'kai')
  ctx.fillStyle = mix(p.accent, p.bg, 0.25)
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(marginNote.slice(0, 40), 0, 0)
  ctx.restore()

  // 便签贴纸
  const noteW = Math.min(inner * 0.46, 300 * s)
  const noteH = noteW * 0.62
  const nx = W - pad * 1.0 - noteW
  const ny = H - pad * 1.2 - noteH
  const hasImage = Boolean(doc.image)
  if (!hasImage) {
    ctx.save()
    ctx.translate(nx + noteW / 2, ny + noteH / 2)
    ctx.rotate((-4 * Math.PI) / 180)
    ctx.shadowColor = 'rgba(0,0,0,0.16)'
    ctx.shadowBlur = 18 * s
    ctx.shadowOffsetY = 6 * s
    ctx.fillStyle = mix('#ffe98a', p.bg, 0.12)
    ctx.fillRect(-noteW / 2, -noteH / 2, noteW, noteH)
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = mix(p.ink, p.bg, 0.2)
    ctx.font = `500 ${Math.round(17 * s)}px "KaiTi", "STKaiti", serif`
    ctx.textBaseline = 'top'
    const noteLines = ['重点不是写得多，', '而是敢不敢写。', '', '— 给自己']
    noteLines.forEach((t, i) => {
      ctx.fillText(t, -noteW / 2 + 20 * s, -noteH / 2 + 18 * s + i * 26 * s)
    })
    // 胶带
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillRect(-40 * s, -noteH / 2 - 12 * s, 80 * s, 24 * s)
    ctx.restore()
  } else {
    // 有配图时改为拍立得
    const px = W - pad - noteW * 0.92
    const py = H - pad - noteH * 1.1
    drawUserImageInline(r, px, py, noteW * 0.92, noteH * 0.86)
  }

  // 印章（仅当用户选择「斜角标签」角标时出现，其余角标由通用装饰层绘制）
  if (doc.deco.corner === 'tag') {
    ctx.save()
    ctx.translate(pad * 1.9, H - pad * 1.05)
    ctx.rotate((-8 * Math.PI) / 180)
    ctx.strokeStyle = mix('#d4463a', p.bg, 0.05)
    ctx.lineWidth = Math.max(2, 3.4 * s)
    roundRect(ctx, -62 * s, -22 * s, 124 * s, 44 * s, 8 * s)
    ctx.stroke()
    ctx.fillStyle = mix('#d4463a', p.bg, 0.05)
    ctx.font = `700 ${Math.round(19 * s)}px "KaiTi", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('已阅 ✓', 0, 2 * s)
    ctx.restore()
  }
  void drawDivider
  void drawSticker
  void grain
  void highlighter
  void p
}

/** 拍立得式小照片 */
function drawUserImageInline(r: RenderCtx, x: number, y: number, w: number, h: number) {
  const { ctx, image } = r
  if (!image) return
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate((5 * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.22)'
  ctx.shadowBlur = 20
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 44)
  ctx.shadowColor = 'transparent'
  ctx.beginPath()
  ctx.rect(-w / 2, -h / 2, w, h)
  ctx.clip()
  const iw = image.naturalWidth || image.width
  const ih = image.naturalHeight || image.height
  const ratio = Math.max(w / iw, h / ih)
  ctx.drawImage(image, -w / 2, -h / 2, iw * ratio, ih * ratio)
  ctx.restore()
}
