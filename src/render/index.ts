/** 统一的渲染入口：解析配图图片、清理状态、输出 warnings。 */
import type { Doc, LayoutWarning, RenderCtx, TemplateDef } from '../model/types'
import { mix } from './color'
import { drawCorner, drawDivider, drawIcon, drawShape } from './assets'
import { padOf, paletteOf, scaleOf } from './common'
import { beginStyleOverrides, endStyleOverrides } from './overrides'
import { getTemplate } from './templates'

export interface RenderOptions {
  /** 逻辑导出倍数：预览按 CSS 像素绘制，导出按 dpr 放大 */
  pixelRatio?: number
  /** 预览专用：告诉渲染器当前可视缩放（用于过滤亚像素误差），当前未使用 */
  preview?: boolean
}

export interface RenderResult {
  warnings: LayoutWarning[]
  canvas: HTMLCanvasElement
}

const imageCache = new Map<string, HTMLImageElement>()

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(src)
  if (hit && hit.complete && hit.naturalWidth > 0) return Promise.resolve(hit)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageCache.set(src, img)
      resolve(img)
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

export function getCachedImage(src: string): HTMLImageElement | null {
  const hit = imageCache.get(src)
  return hit && hit.complete && hit.naturalWidth > 0 ? hit : null
}

export function renderDoc(
  canvas: HTMLCanvasElement,
  doc: Doc,
  opts: RenderOptions = {},
): RenderResult {
  const ratio = opts.pixelRatio ?? 1
  const W = Math.round(doc.width * ratio)
  const H = Math.round(doc.height * ratio)
  if (canvas.width !== W) canvas.width = W
  if (canvas.height !== H) canvas.height = H
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return { warnings: [], canvas }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.save()
  ctx.scale(ratio, ratio)

  const template = getTemplate(doc.templateId)
  const warnings: LayoutWarning[] = []
  const image = doc.image ? getCachedImage(doc.image.src) : null
  if (doc.image && !image) {
    warnings.push({ kind: 'image', text: '配图尚未加载完成，导出前请稍候。' })
  }
  const r: RenderCtx = {
    ctx,
    W: doc.width,
    H: doc.height,
    doc,
    image,
    warnings,
  }
  beginStyleOverrides(doc, Math.min(doc.width, doc.height) / 1080, template)
  template.render(r)
  applyOverlayDeco(r, template)
  endStyleOverrides()
  ctx.restore()

  // 透明背景时清除残留（模板可能绘制了底色）
  return { warnings, canvas }
}
/**
 * 装饰层：背景图形 / 图标 / 分割线 / 角标。
 *
 * 模板内部会自行绘制底色与正文，因此装饰统一在模板绘制完成后叠加：
 * 图形使用低透明度与柔和的配色，作为版面点缀而不影响正文可读性。
 * 模板原生已绘制同一类装饰时不重复（见 TemplateDef.handles）。
 */
function applyOverlayDeco(r: RenderCtx, template: TemplateDef) {
  const { ctx, W, H, doc } = r
  const p = paletteOf(doc)
  const s = scaleOf(W, H)
  const pad = padOf(W, H, 0.072)
  const handles = template.handles ?? {}

  if (doc.deco.shape !== 'none') {
    ctx.save()
    ctx.globalAlpha = 0.28
    drawShape(
      ctx,
      doc.deco.shape,
      W * 0.82,
      H * 0.14,
      Math.min(W, H) * 0.36,
      mix(p.ink, p.accent, 0.55),
      doc.deco,
    )
    ctx.restore()
  }
  if (!handles.icon && doc.deco.icon !== 'none') {
    const iconSize = 56 * s
    drawIcon(ctx, doc.deco.icon, W - pad - iconSize, pad * 0.55, iconSize, p.accent, 2.2)
  }
  if (doc.deco.divider !== 'none') {
    drawDivider(ctx, doc.deco.divider, pad, H - pad * 0.42, W - pad * 2, p.line, Math.max(1, 1.6 * s))
  }
  if (!handles.corner && doc.deco.corner !== 'none') {
    drawCorner(ctx, doc.deco.corner, W, H, p.line, p.accent, '01')
  }
}

/** 用于测量与调试：返回画布尺寸 */
export function measureCanvas(canvas: HTMLCanvasElement) {
  return { w: canvas.width, h: canvas.height }
}
