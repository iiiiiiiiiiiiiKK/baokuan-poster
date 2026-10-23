/** 背景、纹理、图形、图标、分割线、角标等绘制原语。全部为纯 Canvas 2D，保证预览与导出一致。 */
import type { CornerName, Deco, DividerName, IconName, ShapeName } from '../model/types'
import { hexToRgba, mix, roundRect, seededRandom } from './color'

export { roundRect }

type Ctx = CanvasRenderingContext2D

/* ---------------- 纹理缓存 ---------------- */

const noiseCache = new Map<string, HTMLCanvasElement>()

/** 确定性颗粒纹理（同一 seed 每次渲染完全一致） */
export function noiseTile(seed = 7, size = 180, density = 0.5, dark = true): HTMLCanvasElement {
  const key = `${seed}|${size}|${density}|${dark}`
  const hit = noiseCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')!
  const rnd = seededRandom(seed)
  const count = Math.round(size * size * 0.11 * density)
  for (let i = 0; i < count; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const a = rnd() * 0.09
    g.fillStyle = dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`
    g.fillRect(x, y, 1, 1)
  }
  noiseCache.set(key, c)
  return c
}

export function grain(ctx: Ctx, W: number, H: number, alpha = 0.5, dark = true) {
  const tile = noiseTile(11, 180, 1, dark)
  const pattern = ctx.createPattern(tile, 'repeat')
  if (!pattern) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

/* ---------------- 底色 ---------------- */

export function vGradient(ctx: Ctx, W: number, H: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  for (const [p, c] of stops) g.addColorStop(p, c)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

export function vignette(ctx: Ctx, W: number, H: number, color = 'rgba(0,0,0,0.55)') {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.18, W / 2, H / 2, Math.max(W, H) * 0.78)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

export function paperTexture(ctx: Ctx, W: number, H: number, base: string, strength = 1) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, mix(base, '#ffffff', 0))
  g.addColorStop(0.5, mix(base, '#d8c9a8', 0.18 * strength))
  g.addColorStop(1, mix(base, '#c9b492', 0.12 * strength))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  grain(ctx, W, H, 0.55 * strength, true)
  const rnd = seededRandom(91)
  ctx.save()
  ctx.strokeStyle = 'rgba(90,70,40,0.05)'
  ctx.lineWidth = 1
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W
    const y = rnd() * H
    const len = 20 + rnd() * 90
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y + (rnd() - 0.5) * 8)
    ctx.stroke()
  }
  ctx.restore()
}

export function scanlines(ctx: Ctx, W: number, H: number, color = 'rgba(0,255,180,0.05)', gap = 6) {
  ctx.save()
  ctx.fillStyle = color
  for (let y = 0; y < H; y += gap) ctx.fillRect(0, y, W, 1)
  ctx.restore()
}

/* ---------------- 配图 ---------------- */

export interface ImageDrawOptions {
  fit?: 'cover' | 'contain'
  opacity?: number
  tint?: string
  tintAlpha?: number
  blur?: number
  scale?: number
  offsetX?: number
  offsetY?: number
  rounded?: number
  grayscale?: boolean
}

export function drawImageIn(
  ctx: Ctx,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  o: ImageDrawOptions = {},
) {
  const fit = o.fit ?? 'cover'
  const scale = o.scale ?? 1
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih || w <= 0 || h <= 0) return
  ctx.save()
  if (o.rounded) {
    roundRect(ctx, x, y, w, h, o.rounded)
    ctx.clip()
  } else {
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
  }
  ctx.globalAlpha = o.opacity ?? 1
  const filters: string[] = []
  if (o.blur) filters.push(`blur(${o.blur}px)`)
  if (o.grayscale) filters.push('grayscale(1)')
  if (filters.length) ctx.filter = filters.join(' ')
  const ratio = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)
  const dw = iw * ratio * scale
  const dh = ih * ratio * scale
  const dx = x + (w - dw) / 2 + (o.offsetX ?? 0)
  const dy = y + (h - dh) / 2 + (o.offsetY ?? 0)
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.filter = 'none'
  if (o.tint && o.tintAlpha) {
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = hexToRgba(o.tint, o.tintAlpha)
    ctx.fillRect(x, y, w, h)
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.restore()
}

/* ---------------- 装饰形状 ---------------- */

export function drawShape(
  ctx: Ctx,
  shape: ShapeName,
  x: number,
  y: number,
  size: number,
  color: string,
  deco?: Deco,
) {
  if (!shape || shape === 'none') return
  ctx.save()
  const r = seededRandom(23)
  switch (shape) {
    case 'circle': {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, size / 2, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'blob': {
      ctx.fillStyle = color
      ctx.beginPath()
      const pts = 14
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2
        const rad = size * 0.42 * (0.82 + r() * 0.36)
        const px = x + Math.cos(a) * rad
        const py = y + Math.sin(a) * rad * 0.92
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'grid': {
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(1, size * 0.006)
      const step = size / 12
      for (let i = 0; i <= 12; i++) {
        ctx.beginPath()
        ctx.moveTo(x - size / 2 + i * step, y - size / 2)
        ctx.lineTo(x - size / 2 + i * step, y + size / 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x - size / 2, y - size / 2 + i * step)
        ctx.lineTo(x + size / 2, y - size / 2 + i * step)
        ctx.stroke()
      }
      break
    }
    case 'dots': {
      ctx.fillStyle = color
      const step = size / 8
      for (let ix = 0; ix < 8; ix++) {
        for (let iy = 0; iy < 8; iy++) {
          ctx.beginPath()
          ctx.arc(
            x - size / 2 + ix * step + step / 2,
            y - size / 2 + iy * step + step / 2,
            step * 0.13,
            0,
            Math.PI * 2,
          )
          ctx.fill()
        }
      }
      break
    }
    case 'arc': {
      ctx.strokeStyle = color
      ctx.lineWidth = size * 0.045
      ctx.beginPath()
      ctx.arc(x, y, size * 0.46, Math.PI * 0.15, Math.PI * 1.1)
      ctx.stroke()
      break
    }
    case 'triangle': {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, y - size / 2)
      ctx.lineTo(x + size / 2, y + size / 2)
      ctx.lineTo(x - size / 2, y + size / 2)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'bars': {
      ctx.fillStyle = color
      const n = 5
      const bw = size / (n * 1.8)
      for (let i = 0; i < n; i++) {
        const bh = size * (0.22 + ((i * 37) % 70) / 100)
        ctx.fillRect(x - size / 2 + i * bw * 1.9, y + size / 2 - bh, bw, bh)
      }
      break
    }
  }
  ctx.restore()
  void deco
}

/* ---------------- 图标（矢量） ---------------- */

export function drawIcon(
  ctx: Ctx,
  name: IconName,
  x: number,
  y: number,
  size: number,
  color: string,
  lw = 2,
) {
  if (!name || name === 'none') return
  const s = size
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1, (s / 24) * lw)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const u = s / 24
  switch (name) {
    case 'sparkles': {
      ctx.beginPath()
      ctx.moveTo(12 * u, 3 * u)
      ctx.quadraticCurveTo(13 * u, 10 * u, 20 * u, 12 * u)
      ctx.quadraticCurveTo(13 * u, 14 * u, 12 * u, 21 * u)
      ctx.quadraticCurveTo(11 * u, 14 * u, 4 * u, 12 * u)
      ctx.quadraticCurveTo(11 * u, 10 * u, 12 * u, 3 * u)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.arc(19 * u, 5 * u, 1.6 * u, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'flame': {
      ctx.beginPath()
      ctx.moveTo(12 * u, 2.5 * u)
      ctx.bezierCurveTo(17 * u, 8 * u, 18.5 * u, 11 * u, 16.5 * u, 16 * u)
      ctx.bezierCurveTo(15.4 * u, 18.8 * u, 12.4 * u, 21.5 * u, 12 * u, 21.5 * u)
      ctx.bezierCurveTo(7 * u, 21.5 * u, 5 * u, 16.5 * u, 8 * u, 12.5 * u)
      ctx.bezierCurveTo(9 * u, 11 * u, 11.2 * u, 8.6 * u, 12 * u, 2.5 * u)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'zap': {
      ctx.beginPath()
      ctx.moveTo(13.5 * u, 2 * u)
      ctx.lineTo(4.5 * u, 13.5 * u)
      ctx.lineTo(11 * u, 13.5 * u)
      ctx.lineTo(10 * u, 22 * u)
      ctx.lineTo(19.5 * u, 10 * u)
      ctx.lineTo(13 * u, 10 * u)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'star': {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2
        const rad = i % 2 === 0 ? 10 * u : 4.4 * u
        const px = 12 * u + Math.cos(a) * rad
        const py = 12 * u + Math.sin(a) * rad
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'bookmark': {
      ctx.beginPath()
      ctx.moveTo(6 * u, 3 * u)
      ctx.lineTo(18 * u, 3 * u)
      ctx.lineTo(18 * u, 21 * u)
      ctx.lineTo(12 * u, 16 * u)
      ctx.lineTo(6 * u, 21 * u)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'code': {
      ctx.beginPath()
      ctx.moveTo(9 * u, 7 * u)
      ctx.lineTo(3 * u, 12 * u)
      ctx.lineTo(9 * u, 17 * u)
      ctx.moveTo(15 * u, 7 * u)
      ctx.lineTo(21 * u, 12 * u)
      ctx.lineTo(15 * u, 17 * u)
      ctx.stroke()
      break
    }
    case 'quote': {
      ctx.font = `bold ${18 * u}px Georgia, "Songti SC", serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('“', 7 * u, 10 * u)
      ctx.fillText('”', 17 * u, 16 * u)
      break
    }
    case 'trend': {
      ctx.beginPath()
      ctx.moveTo(3 * u, 17 * u)
      ctx.lineTo(9 * u, 10.5 * u)
      ctx.lineTo(13 * u, 14 * u)
      ctx.lineTo(21 * u, 5.5 * u)
      ctx.moveTo(16 * u, 5.5 * u)
      ctx.lineTo(21 * u, 5.5 * u)
      ctx.lineTo(21 * u, 10.5 * u)
      ctx.stroke()
      break
    }
    case 'hash': {
      ctx.beginPath()
      ctx.moveTo(9 * u, 3 * u)
      ctx.lineTo(7 * u, 21 * u)
      ctx.moveTo(17 * u, 3 * u)
      ctx.lineTo(15 * u, 21 * u)
      ctx.moveTo(4 * u, 9 * u)
      ctx.lineTo(20 * u, 9 * u)
      ctx.moveTo(3.5 * u, 15 * u)
      ctx.lineTo(19.5 * u, 15 * u)
      ctx.stroke()
      break
    }
    case 'layers': {
      ctx.beginPath()
      ctx.moveTo(12 * u, 3 * u)
      ctx.lineTo(21 * u, 8 * u)
      ctx.lineTo(12 * u, 13 * u)
      ctx.lineTo(3 * u, 8 * u)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(3 * u, 12.5 * u)
      ctx.lineTo(12 * u, 17.5 * u)
      ctx.lineTo(21 * u, 12.5 * u)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(3 * u, 17 * u)
      ctx.lineTo(12 * u, 22 * u)
      ctx.lineTo(21 * u, 17 * u)
      ctx.stroke()
      break
    }
    case 'check': {
      ctx.beginPath()
      ctx.moveTo(4 * u, 13 * u)
      ctx.lineTo(9.5 * u, 18.5 * u)
      ctx.lineTo(20 * u, 6 * u)
      ctx.stroke()
      break
    }
  }
  ctx.restore()
}

/* ---------------- 分割线 / 角标 ---------------- */

export function drawDivider(
  ctx: Ctx,
  kind: DividerName,
  x: number,
  y: number,
  w: number,
  color: string,
  weight = 2,
) {
  if (!kind || kind === 'none') return
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = weight
  switch (kind) {
    case 'line':
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + w, y)
      ctx.stroke()
      break
    case 'double':
      ctx.beginPath()
      ctx.moveTo(x, y - weight)
      ctx.lineTo(x + w, y - weight)
      ctx.moveTo(x, y + weight)
      ctx.lineTo(x + w, y + weight)
      ctx.stroke()
      break
    case 'dashed':
      ctx.setLineDash([weight * 4, weight * 3])
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + w, y)
      ctx.stroke()
      break
    case 'dots': {
      const n = Math.max(3, Math.round(w / (weight * 7)))
      for (let i = 0; i <= n; i++) {
        ctx.beginPath()
        ctx.arc(x + (w / n) * i, y, weight * 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'arrow':
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + w - weight * 6, y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + w - weight * 7, y - weight * 3)
      ctx.lineTo(x + w, y)
      ctx.lineTo(x + w - weight * 7, y + weight * 3)
      ctx.closePath()
      ctx.fill()
      break
  }
  ctx.restore()
}

export function drawCorner(
  ctx: Ctx,
  kind: CornerName,
  W: number,
  H: number,
  color: string,
  accent: string,
  index = '01',
) {
  if (!kind || kind === 'none') return
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  const m = Math.min(W, H) * 0.045
  const len = Math.min(W, H) * 0.06
  switch (kind) {
    case 'brackets':
      ctx.lineWidth = Math.max(2, W * 0.0035)
      for (const [px, py, sx, sy] of [
        [m, m, 1, 1],
        [W - m, m, -1, 1],
        [m, H - m, 1, -1],
        [W - m, H - m, -1, -1],
      ] as [number, number, number, number][]) {
        ctx.beginPath()
        ctx.moveTo(px + sx * len, py)
        ctx.lineTo(px, py)
        ctx.lineTo(px, py + sy * len)
        ctx.stroke()
      }
      break
    case 'tag': {
      const label = 'BETA'
      ctx.font = `700 ${Math.round(W * 0.017)}px "Inter", "Microsoft YaHei", sans-serif`
      const tw = ctx.measureText(label).width + W * 0.034
      const th = W * 0.042
      ctx.translate(W - m - th * 0.15, m + th * 0.75)
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = accent
      roundRect(ctx, -tw / 2, -th / 2, tw, th, th / 2)
      ctx.fill()
      ctx.fillStyle = '#111111'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, 0, 1)
      break
    }
    case 'index': {
      ctx.textAlign = 'right'
      ctx.textBaseline = 'alphabetic'
      ctx.font = `800 ${Math.round(Math.min(W, H) * 0.13)}px "Inter", sans-serif`
      // 大号序号角标：优先用重点色，保证在浅色底上也清晰可见
      ctx.globalAlpha = 0.22
      ctx.fillStyle = accent
      ctx.fillText(index, W - m * 0.8, H - m * 0.6)
      break
    }
    case 'mono': {
      ctx.font = `600 ${Math.round(W * 0.019)}px "JetBrains Mono", Consolas, monospace`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(`[ ${index} ]`, m, H - m * 0.9)
      break
    }
  }
  ctx.restore()
}

/* ---------------- 通用小部件 ---------------- */

export function drawChip(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  opts: {
    font: string
    color: string
    bg?: string
    border?: string
    padX?: number
    padY?: number
    radius?: number
  },
): number {
  ctx.save()
  ctx.font = opts.font
  const padX = opts.padX ?? 16
  const padY = opts.padY ?? 8
  const tw = ctx.measureText(text).width
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(opts.font)?.[1] ?? '16')
  const h = size * 1.35 + padY * 2
  const w = tw + padX * 2
  if (opts.bg) {
    ctx.fillStyle = opts.bg
    roundRect(ctx, x, y, w, h, opts.radius ?? h / 2)
    ctx.fill()
  }
  if (opts.border) {
    ctx.strokeStyle = opts.border
    ctx.lineWidth = Math.max(1, size * 0.075)
    roundRect(ctx, x, y, w, h, opts.radius ?? h / 2)
    ctx.stroke()
  }
  ctx.fillStyle = opts.color
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(text, x + padX, y + h / 2 + size * 0.02)
  ctx.restore()
  return w
}

export function drawSticker(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  angle: number,
  opts: { color: string; bg: string; font: string; padX?: number },
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((angle * Math.PI) / 180)
  ctx.font = opts.font
  const padX = opts.padX ?? 18
  const tw = ctx.measureText(text).width
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(opts.font)?.[1] ?? '18')
  const h = size * 2.1
  ctx.fillStyle = opts.bg
  roundRect(ctx, -tw / 2 - padX, -h / 2, tw + padX * 2, h, size * 0.2)
  ctx.fill()
  ctx.fillStyle = opts.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, size * 0.03)
  ctx.restore()
}

/** 高亮笔触（斜切矩形，模拟马克笔） */
export function highlighter(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha = 0.6,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y + h * 0.15)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w - w * 0.02, y + h)
  ctx.lineTo(x - w * 0.01, y + h * 0.92)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** 手绘风格下划线（二次曲线 + 轻微抖动） */
export function handUnderline(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  color: string,
  lw = 3,
  seed = 5,
) {
  const rnd = seededRandom(seed)
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y + rnd() * 4)
  ctx.bezierCurveTo(
    x + w * 0.3,
    y - 3 + rnd() * 6,
    x + w * 0.7,
    y + 3 + rnd() * 5,
    x + w,
    y - 2 + rnd() * 4,
  )
  ctx.stroke()
  ctx.restore()
}

export function glowText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  color: string,
  glow: string,
  blur: number,
) {
  ctx.save()
  ctx.shadowColor = glow
  ctx.shadowBlur = blur
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.shadowBlur = blur * 0.5
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function drawDecoShapes(ctx: Ctx, deco: Deco, W: number, H: number, color: string) {
  drawShape(ctx, deco.shape, W * 0.86, H * 0.16, Math.min(W, H) * 0.42, color, deco)
}
