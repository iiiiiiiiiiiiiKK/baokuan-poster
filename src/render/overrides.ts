/**
 * 用户样式覆盖层。
 *
 * 模板本身带有设计化的排版参数（赛博终端必须等宽、报纸必须衬线）。
 * 为了让右侧「字号 / 行距 / 字间距 / 字体 / 对齐」在每一套模板上都真实生效，
 * 这里把「用户值相对模板默认值的增量」算出来，绘制与测量时统一叠加：
 * - 行距：按倍数缩放
 * - 字间距：按增量平移（未乘 scale，使用时乘当前 scale）
 * - 字体：把模板的标题/正文字体映射到用户选择的字体
 */
import type { Doc, FontKey, TemplateDef } from '../model/types'
import { getTemplate } from './templates'

export interface StyleOverrides {
  scale: number
  lineHeightFactor: number
  /** 用户字间距增量（未乘 scale） */
  spacingDelta: number
  /** 用户实际字间距（已乘 scale），用于识别「调用方已包含用户值」 */
  userSpacingScaled: number
  fontTitleBase: FontKey
  fontBodyBase: FontKey
  fontTitleOverride: FontKey | null
  fontBodyOverride: FontKey | null
  alignOverride: 'left' | 'center' | 'right' | null
}

let current: StyleOverrides = {
  scale: 1,
  lineHeightFactor: 1,
  spacingDelta: 0,
  userSpacingScaled: 0,
  fontTitleBase: 'sans',
  fontBodyBase: 'sans',
  fontTitleOverride: null,
  fontBodyOverride: null,
  alignOverride: null,
}

export function beginStyleOverrides(doc: Doc, scale: number, template?: TemplateDef) {
  const tpl = template ?? getTemplate(doc.templateId)
  const base = tpl.style
  current = {
    scale,
    lineHeightFactor: base.lineHeight > 0 ? doc.style.lineHeight / base.lineHeight : 1,
    spacingDelta: doc.style.letterSpacing - base.letterSpacing,
    userSpacingScaled: doc.style.letterSpacing * scale,
    fontTitleBase: base.fontTitle,
    fontBodyBase: base.fontBody,
    fontTitleOverride: doc.style.fontTitle !== base.fontTitle ? doc.style.fontTitle : null,
    fontBodyOverride: doc.style.fontBody !== base.fontBody ? doc.style.fontBody : null,
    alignOverride: doc.style.align !== base.align ? doc.style.align : null,
  }
  return current
}

export function overrides(): StyleOverrides {
  return current
}

export function endStyleOverrides() {
  current = {
    scale: 1,
    lineHeightFactor: 1,
    spacingDelta: 0,
    userSpacingScaled: 0,
    fontTitleBase: 'sans',
    fontBodyBase: 'sans',
    fontTitleOverride: null,
    fontBodyOverride: null,
    alignOverride: null,
  }
}

/** 行距倍数：若调用方传的就是用户值则保持不变，否则叠加用户倍数 */
export function resolveLineHeight(templateMultiple: number, userLineHeight: number) {
  if (Math.abs(templateMultiple - userLineHeight) < 1e-6) return templateMultiple
  return templateMultiple * current.lineHeightFactor
}

/** 字间距：若调用方已把用户值乘好 scale 传入，就不再重复叠加 */
export function resolveSpacing(passed: number) {
  const delta = current.spacingDelta * current.scale
  if (Math.abs(delta) < 0.01) return passed
  if (Math.abs(passed - current.userSpacingScaled) < 0.01) return passed
  return passed + delta
}

/** 字体：模板的标题/正文字体 → 用户选择的字体 */
export function resolveFont(key: FontKey): FontKey {
  if (current.fontTitleOverride && key === current.fontTitleBase) return current.fontTitleOverride
  if (current.fontBodyOverride && key === current.fontBodyBase) return current.fontBodyOverride
  return key
}

/** 对齐：用户改过对齐方式时才覆盖 */
export function resolveAlign(fallback: 'left' | 'center' | 'right'): 'left' | 'center' | 'right' {
  return current.alignOverride ?? fallback
}
