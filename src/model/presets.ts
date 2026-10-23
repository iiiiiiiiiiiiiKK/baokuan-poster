import type { Doc, RatioKey, RatioPreset, TextStyle } from './types'
import { TEMPLATES, getTemplate } from '../render/templates'

export const RATIOS: RatioPreset[] = [
  { key: '1:1', label: '1:1 方图', hint: '头像动态 / 社交卡片', width: 1080, height: 1080 },
  { key: '3:4', label: '3:4 竖图', hint: '手机信息流', width: 1080, height: 1440 },
  { key: '4:5', label: '4:5 竖图', hint: '小红书 / Instagram', width: 1080, height: 1350 },
  { key: '16:9', label: '16:9 横图', hint: 'X / 公众号头图', width: 1200, height: 675 },
  { key: '9:16', label: '9:16 长图', hint: '故事 / 短视频封面', width: 1080, height: 1920 },
  { key: 'custom', label: '自定义', hint: '自定宽高', width: 1080, height: 1080 },
]

export function getRatio(key: RatioKey): RatioPreset {
  return RATIOS.find((r) => r.key === key) ?? RATIOS[0]
}

export function sizeForRatio(key: RatioKey, baseLong = 1080): { width: number; height: number } {
  const preset = getRatio(key)
  if (key === '1:1') return { width: 1080, height: 1080 }
  if (key === '3:4') return { width: 1080, height: 1440 }
  if (key === '4:5') return { width: 1080, height: 1350 }
  if (key === '9:16') return { width: 1080, height: 1920 }
  if (key === '16:9') return { width: 1200, height: 675 }
  return { width: preset.width, height: preset.height }
  void baseLong
}

export const FONT_OPTIONS = [
  { key: 'sans' as const, label: '黑体 / Sans' },
  { key: 'serif' as const, label: '宋体 / Serif' },
  { key: 'kai' as const, label: '楷体 / Kai' },
  { key: 'mono' as const, label: '等宽 / Mono' },
  { key: 'display' as const, label: '标题 / Display' },
]

export const ICON_OPTIONS = [
  { key: 'none', label: '无' },
  { key: 'sparkles', label: '星芒' },
  { key: 'flame', label: '火苗' },
  { key: 'zap', label: '闪电' },
  { key: 'star', label: '星星' },
  { key: 'bookmark', label: '书签' },
  { key: 'code', label: '代码' },
  { key: 'quote', label: '引号' },
  { key: 'trend', label: '趋势' },
  { key: 'hash', label: '井号' },
  { key: 'layers', label: '图层' },
  { key: 'check', label: '对勾' },
] as const

export const SHAPE_OPTIONS = [
  { key: 'none', label: '无' },
  { key: 'circle', label: '圆形' },
  { key: 'blob', label: '色团' },
  { key: 'grid', label: '网格' },
  { key: 'dots', label: '点阵' },
  { key: 'arc', label: '弧线' },
  { key: 'triangle', label: '三角' },
  { key: 'bars', label: '柱状' },
] as const

export const DIVIDER_OPTIONS = [
  { key: 'none', label: '无' },
  { key: 'line', label: '细线' },
  { key: 'double', label: '双线' },
  { key: 'dashed', label: '虚线' },
  { key: 'dots', label: '点线' },
  { key: 'arrow', label: '箭头' },
] as const

export const CORNER_OPTIONS = [
  { key: 'none', label: '无' },
  { key: 'brackets', label: '四角括号' },
  { key: 'tag', label: '斜角标签' },
  { key: 'index', label: '大号编号' },
  { key: 'mono', label: '等宽坐标' },
] as const

export function defaultDoc(templateId = TEMPLATES[0].id): Doc {
  const tpl = getTemplate(templateId)
  const { width, height } = sizeForRatio(tpl.bestRatio)
  return {
    templateId: tpl.id,
    ratioKey: tpl.bestRatio,
    width,
    height,
    content: { ...tpl.sample },
    style: { ...tpl.style },
    deco: { ...tpl.deco },
    image: null,
    transparent: false,
    autoFit: true,
    scale: 1,
  }
}

/** 只应用模板的「设计」，保留用户输入的文字 */
export function applyTemplateDesign(doc: Doc, templateId: string, keepContent = true): Doc {
  const tpl = getTemplate(templateId)
  const next: Doc = {
    ...doc,
    templateId: tpl.id,
    content: keepContent ? doc.content : { ...tpl.sample },
    style: { ...tpl.style },
    deco: { ...tpl.deco },
  }
  return next
}

export function stylePreset(tpl: string): TextStyle {
  return { ...getTemplate(tpl).style }
}
