/**
 * 模板 04 · 赛博终端风
 * 版式逻辑：终端窗口（标题栏 + 三色圆点）包裹内容，等宽字体、绿/青霓虹、扫描线、
 * 命令提示符 `>` 引导正文，右侧竖排英文坐标。
 */
import type { RenderCtx } from '../../model/types'
import { hexToRgba, mix } from '../color'
import {
  drawDivider,
  glowText,
  grain,
  roundRect,
  scanlines,
  vGradient,
} from '../assets'
import { bodyFlow, flagBodyLong, padOf, paletteOf, scaleOf, titleFlow } from '../common'
import { paintLines, paintMeta } from '../paint'
import { setFont, splitGraphemes, measure } from '../text'

export function renderCyberTerminal(r: RenderCtx) {
  const { ctx, W, H, doc } = r
  const p = paletteOf(doc)
  const s = scaleOf(W, H)
  const pad = padOf(W, H, 0.055)
  const inner = W - pad * 2

  if (!doc.transparent) {
    vGradient(ctx, W, H, [
      [0, mix(p.bg, '#000000', 0.25)],
      [0.55, p.bg],
      [1, mix(p.bg, p.accent, 0.12)],
    ])
  }
  // 网格背景
  ctx.save()
  ctx.strokeStyle = hexToRgba(p.accent, 0.1)
  ctx.lineWidth = Math.max(1, 1 * s)
  const step = 58 * s
  for (let x = 0; x < W; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y < H; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.restore()
  // 光晕
  const glow = ctx.createRadialGradient(W * 0.72, H * 0.16, 0, W * 0.72, H * 0.16, Math.max(W, H) * 0.7)
  glow.addColorStop(0, hexToRgba(p.accent, 0.22))
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // 终端窗口
  const winX = pad
  const winY = pad * 1.35
  const winW = inner
  const winH = H - winY - pad * 1.2
  ctx.save()
  ctx.shadowColor = hexToRgba(p.accent, 0.5)
  ctx.shadowBlur = 46 * s
  ctx.fillStyle = hexToRgba(mix(p.bg, '#000000', 0.35), 0.92)
  roundRect(ctx, winX, winY, winW, winH, 18 * s)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = hexToRgba(p.accent, 0.6)
  ctx.lineWidth = Math.max(1, 1.6 * s)
  roundRect(ctx, winX, winY, winW, winH, 18 * s)
  ctx.stroke()

  // 标题栏
  const barH = 54 * s
  ctx.fillStyle = hexToRgba(p.accent, 0.12)
  ctx.save()
  roundRect(ctx, winX, winY, winW, winH, 18 * s)
  ctx.clip()
  ctx.fillRect(winX, winY, winW, barH)
  ctx.restore()
  drawDivider(ctx, 'line', winX, winY + barH, winW, hexToRgba(p.accent, 0.45), Math.max(1, 1.2 * s))
  const dots = [p.accent, mix(p.accent, '#ffcc00', 0.6), '#ff5f57']
  dots.forEach((c, i) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(winX + 26 * s + i * 22 * s, winY + barH / 2, 6 * s, 0, Math.PI * 2)
    ctx.fill()
  })
  paintMeta(ctx, doc.content.eyebrow || '~/vibe/terminal — zsh', {
    x: winX + 104 * s,
    y: winY + barH / 2 + 6 * s,
    width: winW - 220 * s,
    size: 15.5 * s,
    weight: 600,
    fontKey: 'mono',
    color: hexToRgba(p.accent, 0.85),
    letterSpacing: 0.4 * s,
    ellipsis: true,
  })
  paintMeta(ctx, '80×24', {
    x: winX,
    y: winY + barH / 2 + 6 * s,
    width: winW - 24 * s,
    align: 'right',
    size: 14 * s,
    weight: 500,
    fontKey: 'mono',
    color: hexToRgba(p.accent, 0.55),
  })

  const cx = winX + 40 * s
  const cw = winW - 80 * s
  let y = winY + barH + 56 * s

  // 命令提示
  ctx.save()
  setFont(ctx, 20 * s, 700, 'mono')
  const prompt = '$ cat insight.md'
  glowText(ctx, prompt, cx, y, p.accent, hexToRgba(p.accent, 0.85), 18 * s)
  y += 40 * s
  ctx.restore()

  // 标题
  const title = titleFlow(r, { width: cw, maxLines: 4, lineHeight: 1.22, sizeFactor: 0.98, minFactor: 0.5, letterSpacing: 0 })
  const titleTop = y + title.size * 0.86
  const titleText = doc.content.title
  // 逐行发光标题
  ctx.save()
  for (let i = 0; i < title.lines.length; i++) {
    const line = title.lines[i]
    ctx.save()
    ctx.shadowColor = hexToRgba(p.ink, 0.75)
    ctx.shadowBlur = 22 * s
    paintLines(ctx, [line], {
      x: cx,
      y: titleTop + i * title.lineHeight,
      width: cw,
      align: doc.style.align,
      size: title.size,
      weight: doc.style.titleWeight,
      fontKey: doc.style.fontTitle,
      ink: p.ink,
      accent: p.accent,
      markColor: hexToRgba(p.accent, 0.35),
      letterSpacing: 0,
      lineHeight: title.lineHeight,
    })
    ctx.restore()
  }
  ctx.restore()
  y = titleTop + title.height + 10 * s
  void titleText

  // 分隔
  drawDivider(ctx, 'dashed', cx, y, cw, hexToRgba(p.accent, 0.55), Math.max(1, 1.4 * s))
  y += 34 * s

  // 正文：等宽 + 提示符
  const bodyMax = winY + winH - 96 * s - y
  const body = bodyFlow(r, { width: cw - 26 * s, maxHeight: bodyMax, sizeFactor: 0.92, lineHeight: 1.78, letterSpacing: 0 })
  if (doc.content.body) {
    setFont(ctx, body.size, 700, 'mono')
    ctx.fillStyle = hexToRgba(p.accent, 0.9)
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('>', cx, y + body.size * 0.86)
    paintLines(ctx, body.lines, {
      x: cx + 26 * s,
      y: y + body.size * 0.86,
      width: cw - 26 * s,
      align: 'left',
      size: body.size,
      weight: doc.style.bodyWeight,
      fontKey: 'mono',
      ink: p.soft,
      accent: p.accent,
      markColor: hexToRgba(p.accent, 0.32),
      letterSpacing: 0,
      lineHeight: body.lineHeight,
    })
  }
  flagBodyLong(r, 140, '赛博终端风')

  // 光标闪烁方框
  const lastY = y + (body.lines.length ? (body.lines.length - 1) * body.lineHeight : 0) + body.size * 0.86
  ctx.fillStyle = p.accent
  ctx.fillRect(cx + 26 * s, lastY + 4 * s, body.size * 0.55, body.size * 0.16)

  // 底部状态行
  const stY = winY + winH - 26 * s
  paintMeta(ctx, doc.content.signature || 'user@cyber', {
    x: cx,
    y: stY,
    width: cw * 0.5,
    size: 15 * s,
    weight: 600,
    fontKey: 'mono',
    color: hexToRgba(p.accent, 0.8),
    ellipsis: true,
  })
  paintMeta(ctx, doc.content.footer || '● connected · 12ms', {
    x: cx,
    y: stY,
    width: cw,
    align: 'right',
    size: 15 * s,
    weight: 600,
    fontKey: 'mono',
    color: hexToRgba(p.ink, 0.75),
    ellipsis: true,
  })

  if (!doc.transparent) {
    scanlines(ctx, W, H, hexToRgba('#000000', 0.16), 5)
    grain(ctx, W, H, 0.2, true)
  }

  // 右侧竖排坐标（仅当用户选择「等宽坐标」角标时出现，其余角标由通用装饰层绘制）
  if (doc.deco.corner === 'mono') {
    ctx.save()
    ctx.translate(W - pad * 0.55, H * 0.42)
    ctx.rotate(Math.PI / 2)
    setFont(ctx, 13 * s, 600, 'mono')
    ctx.fillStyle = hexToRgba(p.accent, 0.55)
    ctx.textBaseline = 'alphabetic'
    const label = `SYS.MSG // ${splitGraphemes(doc.content.footer || 'LIVE').slice(0, 12).join('')}`
    ctx.fillText(label, 0, 0)
    ctx.restore()
    void measure
  }
}
