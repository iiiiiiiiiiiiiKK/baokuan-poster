import { useEffect, useRef } from 'react'
import type { Doc, LayoutWarning } from '../model/types'
import { renderDoc } from '../render'

/** 把 doc 渲染到 canvas；pixelRatio 决定清晰度，CSS 尺寸决定显示大小 */
export function drawToCanvas(canvas: HTMLCanvasElement, doc: Doc, pixelRatio: number): LayoutWarning[] {
  const res = renderDoc(canvas, doc, { pixelRatio })
  return res.warnings
}

export function CanvasStage({
  doc,
  zoom,
  onWarnings,
  onReady,
}: {
  doc: Doc
  zoom: number
  onWarnings?: (w: LayoutWarning[]) => void
  onReady?: (el: HTMLCanvasElement) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
    // 预览按屏幕分辨率渲染：显示宽度（zoom * doc.width）* dpr，但不低于 1x
    const displayW = doc.width * zoom
    const ratio = Math.min(2.5, Math.max(1, (displayW * dpr) / doc.width))
    const warnings = drawToCanvas(canvas, doc, ratio)
    canvas.style.width = `${displayW}px`
    canvas.style.height = `${doc.height * zoom}px`
    onWarnings?.(warnings)
  }, [doc, zoom, onWarnings])

  useEffect(() => {
    if (ref.current) onReady?.(ref.current)
  }, [onReady])

  return <canvas ref={ref} aria-label="配图预览" />
}

/**
 * 模板缩略图：用真实渲染器生成，保证缩略图与成品一致。
 * 画布保持模板自身的宽高比（不拉伸），由 CSS 容器 letterbox 居中显示。
 */
export function TemplateThumb({ doc, pixel = 320 }: { doc: Doc; pixel?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ratio = pixel / Math.max(doc.width, doc.height)
    drawToCanvas(canvas, doc, Math.max(0.2, ratio))
  }, [doc, pixel])
  return (
    <div className="tpl-thumb-wrap">
      <canvas ref={ref} className="tpl-thumb" />
    </div>
  )
}
