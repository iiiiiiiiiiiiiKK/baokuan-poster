/**
 * 调试 / 自动化钩子：把编辑器能力挂到 window.__baokuan，供 e2e 与验收脚本使用。
 * 仅在浏览器环境生效，不影响正常交互。
 */
import type { Content, Doc, RatioKey } from '../model/types'
import { applyTemplateDesign, defaultDoc, sizeForRatio } from '../model/presets'
import { TEMPLATES, getTemplate } from '../render/templates'
import { renderDoc } from '../render'
import { exportPng } from '../export/export'
import { charCount, parseRich, wrapRuns } from '../render/text'
import { auditIssues, auditOverlaps, auditStart, auditStop, type AuditIssue } from '../render/audit'

export interface DebugApi {
  version: string
  templates: () => { id: string; name: string; bestRatio: string }[]
  doc: () => Doc
  setDoc: (patch: Partial<Doc>) => void
  setTemplate: (id: string) => void
  setTemplateKeepRatio: (id: string) => void
  setContent: (patch: Partial<Content>) => void
  setRatio: (key: RatioKey) => void
  buildDoc: (id: string, patch?: Partial<Doc>) => Doc
  renderToDataUrl: (patch?: Partial<Doc>, ratio?: number) => string
  exportPng: (quality?: 'standard' | 'hd' | 'ultra') => Promise<{
    dataUrl: string
    width: number
    height: number
    bytes: number
    filename: string
  }>
  probeText: (text: string, width: number, size?: number) => { lines: string[]; rows: number }
  audit: (patch?: Partial<Doc>) => { total: number; issues: AuditIssue[] }
  auditRects: (patch?: Partial<Doc>) => { kind: string; text: string; x: number; y: number; w: number; h: number }[]
  /** 渲染两份 doc 并返回像素差异比例（0~1），用于验证「改了什么就变了什么」 */
  pixelDiff: (a: Partial<Doc>, b: Partial<Doc>, ratio?: number) => number
  /** 渲染两份 doc 并返回差异像素个数（细线条类装饰判断用） */
  pixelDelta: (a: Partial<Doc>, b: Partial<Doc>, ratio?: number) => number
  stats: (patch?: Partial<Doc>) => {
    templateId: string
    width: number
    height: number
    titleChars: number
    bodyChars: number
    warnings: string[]
  }
}

export function mergeDoc(base: Doc, patch?: Partial<Doc>): Doc {
  return {
    ...base,
    ...(patch ?? {}),
    content: { ...base.content, ...(patch?.content ?? {}) },
    style: { ...base.style, ...(patch?.style ?? {}) },
    deco: { ...base.deco, ...(patch?.deco ?? {}) },
  }
}

export function installDebug(
  setDoc: (patch: Partial<Doc>) => void,
  getDoc: () => Doc,
  selectTemplate?: (id: string) => void,
) {
  const api: DebugApi = {
    version: '1.0.0',
    templates: () => TEMPLATES.map((t) => ({ id: t.id, name: t.name, bestRatio: t.bestRatio })),
    doc: () => getDoc(),
    setDoc: (patch) => setDoc(patch),
    // 同步切换模板（含推荐比例），保证脚本「设置 → 立即对比」拿到同一份最新 doc
    setTemplate: (id) => {
      const tpl = getTemplate(id)
      const next = applyTemplateDesign(getDoc(), id, true)
      const size = sizeForRatio(tpl.bestRatio)
      setDoc({ ...next, ratioKey: tpl.bestRatio, width: size.width, height: size.height })
      void selectTemplate
    },
    // 只换模板设计（保留文字与比例），便于脚本稳定对比
    setTemplateKeepRatio: (id) => setDoc(applyTemplateDesign(getDoc(), id, true)),
    setContent: (patch) => setDoc({ content: { ...getDoc().content, ...patch } }),
    setRatio: (key) => setDoc({ ratioKey: key, ...sizeForRatio(key) }),
    buildDoc: (id, patch) => mergeDoc(defaultDoc(id), patch),
    renderToDataUrl: (patch, ratio = 1) => {
      const doc = mergeDoc(getDoc(), patch)
      const canvas = document.createElement('canvas')
      renderDoc(canvas, doc, { pixelRatio: ratio })
      return canvas.toDataURL('image/png')
    },
    exportPng: async (quality = 'hd') => {
      const res = await exportPng(getDoc(), { quality })
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('read fail'))
        reader.readAsDataURL(res.blob)
      })
      return {
        dataUrl,
        width: res.width,
        height: res.height,
        bytes: res.bytes,
        filename: res.filename,
      }
    },
    probeText: (text, width, size = 32) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      ctx.font = `800 ${size}px "Inter", "Microsoft YaHei", sans-serif`
      const lines = wrapRuns(ctx, parseRich(text), width, { letterSpacing: 0 })
      return { lines: lines.map((l) => l.text), rows: lines.length }
    },
    audit: (patch) => {
      const doc = mergeDoc(getDoc(), patch)
      const canvas = document.createElement('canvas')
      auditStart()
      renderDoc(canvas, doc, { pixelRatio: 1 })
      const rects = auditStop()
      return {
        total: rects.length,
        issues: [...auditIssues(doc.width, doc.height, rects), ...auditOverlaps(rects)],
      }
    },
    auditRects: (patch) => {
      const doc = mergeDoc(getDoc(), patch)
      const canvas = document.createElement('canvas')
      auditStart()
      renderDoc(canvas, doc, { pixelRatio: 1 })
      return auditStop()
    },
    pixelDiff: (a, b, ratio = 1) => {
      const base = getDoc()
      const render = (patch: Partial<Doc>) => {
        const doc = mergeDoc(base, patch)
        const c = document.createElement('canvas')
        c.width = Math.round(doc.width * ratio)
        c.height = Math.round(doc.height * ratio)
        renderDoc(c, doc, { pixelRatio: ratio })
        return c
      }
      const ca = render(a)
      const cb = render(b)
      // 全分辨率对比，避免装饰元素在缩放后被平均掉
      const ga = ca.getContext('2d')!.getImageData(0, 0, ca.width, ca.height).data
      const gb = cb.getContext('2d')!.getImageData(0, 0, cb.width, cb.height).data
      let diff = 0
      const total = ca.width * ca.height
      for (let i = 0; i < total; i++) {
        const p = i * 4
        if (
          Math.abs(ga[p] - gb[p]) > 6 ||
          Math.abs(ga[p + 1] - gb[p + 1]) > 6 ||
          Math.abs(ga[p + 2] - gb[p + 2]) > 6
        ) {
          diff++
        }
      }
      return diff / total
    },
    /** 改动影响到的像素个数（细线条类装饰用它判断是否真的画出来了） */
    pixelDelta: (a, b, ratio = 1) => {
      const base = getDoc()
      const render = (patch: Partial<Doc>) => {
        const doc = mergeDoc(base, patch)
        const c = document.createElement('canvas')
        c.width = Math.round(doc.width * ratio)
        c.height = Math.round(doc.height * ratio)
        renderDoc(c, doc, { pixelRatio: ratio })
        return c
      }
      const ca = render(a)
      const cb = render(b)
      const ga = ca.getContext('2d')!.getImageData(0, 0, ca.width, ca.height).data
      const gb = cb.getContext('2d')!.getImageData(0, 0, cb.width, cb.height).data
      let diff = 0
      for (let i = 0; i < ca.width * ca.height; i++) {
        const p = i * 4
        if (
          Math.abs(ga[p] - gb[p]) > 6 ||
          Math.abs(ga[p + 1] - gb[p + 1]) > 6 ||
          Math.abs(ga[p + 2] - gb[p + 2]) > 6
        ) {
          diff++
        }
      }
      return diff
    },
    stats: (patch) => {
      const doc = mergeDoc(getDoc(), patch)
      const canvas = document.createElement('canvas')
      const res = renderDoc(canvas, doc, { pixelRatio: 1 })
      return {
        templateId: doc.templateId,
        width: doc.width,
        height: doc.height,
        titleChars: charCount(doc.content.title),
        bodyChars: charCount(doc.content.body),
        warnings: res.warnings.map((w) => w.text),
      }
    },
  }
  ;(window as unknown as { __baokuan: DebugApi }).__baokuan = api
  return api
}
