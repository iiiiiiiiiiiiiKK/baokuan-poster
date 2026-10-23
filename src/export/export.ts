/**
 * 导出：单一 Canvas 渲染源 —— 预览画布与导出画布走同一 template.render，
 * 区别仅在 pixelRatio，因此「所见即所得」。
 */
import type { Doc } from '../model/types'
import { getCachedImage, renderDoc } from '../render'

export type ExportQuality = 'standard' | 'hd' | 'ultra'

export const QUALITY_OPTIONS: { key: ExportQuality; label: string; ratio: number; hint: string }[] = [
  { key: 'standard', label: '标准清晰度', ratio: 1, hint: '与画布 1:1 像素，体积小' },
  { key: 'hd', label: '高清 2x', ratio: 2, hint: '适合手机端发布' },
  { key: 'ultra', label: '超清 3x', ratio: 3, hint: '适合印刷 / 大屏' },
]

export interface ExportResult {
  blob: Blob
  url: string
  filename: string
  width: number
  height: number
  bytes: number
}

export function filenameFor(doc: Doc, quality: ExportQuality): string {
  const stamp = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}`
  const raw = (doc.content.title || 'baokuan')
    .replace(/\*\*|==|__/g, '')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .slice(0, 24)
  return `baokuan-${doc.templateId}-${raw || 'poster'}-${date}-${quality}.png`
}

/** 等待字体就绪，避免导出到 fallback 字体 */
export async function waitForFonts(doc: Doc): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const weights = [400, 500, 600, 700, 800, 900]
  const families = ['Inter', 'JetBrains Mono', 'Playfair Display']
  const jobs: Promise<unknown>[] = []
  for (const f of families) {
    for (const w of weights) {
      try {
        jobs.push(document.fonts.load(`${w} 32px "${f}"`))
      } catch {
        /* 字体不存在时忽略，渲染会退回系统字体 */
      }
    }
  }
  jobs.push(document.fonts.ready)
  await Promise.all(jobs)
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  void doc
}

export async function ensureImages(doc: Doc): Promise<void> {
  if (!doc.image) return
  if (getCachedImage(doc.image.src)) return
  await new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('配图加载失败，无法导出'))
    img.src = doc.image!.src
  })
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('导出失败：浏览器未能生成图片'))
      }, type)
      return
    }
    try {
      const data = canvas.toDataURL(type)
      const bin = atob(data.split(',')[1])
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      resolve(new Blob([arr], { type }))
    } catch (e) {
      reject(e as Error)
    }
  })
}

export interface ExportOptions {
  quality: ExportQuality
  /** 最长边上限，避免 3x 时超出浏览器 canvas 尺寸限制 */
  maxEdge?: number
}

export async function exportPng(doc: Doc, opts: ExportOptions): Promise<ExportResult> {
  await waitForFonts(doc)
  await ensureImages(doc)
  const ratioBase = QUALITY_OPTIONS.find((q) => q.key === opts.quality)?.ratio ?? 1
  const maxEdge = opts.maxEdge ?? 8192
  const longEdge = Math.max(doc.width, doc.height)
  let ratio = ratioBase
  if (longEdge * ratio > maxEdge) ratio = Math.max(1, maxEdge / longEdge)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(doc.width * ratio)
  canvas.height = Math.round(doc.height * ratio)
  renderDoc(canvas, doc, { pixelRatio: ratio })
  const blob = await canvasToBlob(canvas)
  const url = URL.createObjectURL(blob)
  return {
    blob,
    url,
    filename: filenameFor(doc, opts.quality),
    width: canvas.width,
    height: canvas.height,
    bytes: blob.size,
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 8000)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
