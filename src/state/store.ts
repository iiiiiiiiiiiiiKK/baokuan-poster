import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Content, Deco, Doc, ImageLayer, RatioKey, TextStyle } from '../model/types'
import { applyTemplateDesign, defaultDoc, getRatio, sizeForRatio } from '../model/presets'
import { getTemplate } from '../render/templates'

export interface HistoryEntry {
  doc: Doc
  label: string
  key?: string
  at: number
}

export interface State {
  doc: Doc
  past: HistoryEntry[]
  future: HistoryEntry[]
  dirty: boolean
  savedAt: number | null
}

type Action =
  | { type: 'set-doc'; doc: Doc; label: string; key?: string }
  | { type: 'patch-content'; patch: Partial<Content>; label?: string; key?: string }
  | { type: 'patch-style'; patch: Partial<TextStyle>; label: string; key?: string }
  | { type: 'patch-deco'; patch: Partial<Deco>; label: string; key?: string }
  | { type: 'set-image'; image: ImageLayer | null; label: string }
  | { type: 'patch-image'; patch: Partial<ImageLayer>; label: string; key?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'mark-saved'; at: number }
  | { type: 'reset' }
  | { type: 'load'; doc: Doc }

const COALESCE_MS = 800
const MAX_HISTORY = 80

function pushPast(state: State, label: string, key?: string): HistoryEntry[] {
  const last = state.past[state.past.length - 1]
  const now = Date.now()
  // 同一控件连续拖动/输入：合并为一条历史
  if (key && last && last.key === key && now - last.at < COALESCE_MS) {
    return [...state.past.slice(0, -1), { doc: state.doc, label, key, at: now }]
  }
  const next = [...state.past, { doc: state.doc, label, key, at: now }]
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set-doc':
      return {
        ...state,
        doc: action.doc,
        past: pushPast(state, action.label, action.key),
        future: [],
        dirty: true,
      }
    case 'patch-content':
      return {
        ...state,
        doc: { ...state.doc, content: { ...state.doc.content, ...action.patch } },
        past: pushPast(state, action.label ?? '编辑文字', action.key),
        future: [],
        dirty: true,
      }
    case 'patch-style':
      return {
        ...state,
        doc: { ...state.doc, style: { ...state.doc.style, ...action.patch } },
        past: pushPast(state, action.label, action.key),
        future: [],
        dirty: true,
      }
    case 'patch-deco':
      return {
        ...state,
        doc: { ...state.doc, deco: { ...state.doc.deco, ...action.patch } },
        past: pushPast(state, action.label, action.key),
        future: [],
        dirty: true,
      }
    case 'set-image':
      return {
        ...state,
        doc: { ...state.doc, image: action.image },
        past: pushPast(state, action.label),
        future: [],
        dirty: true,
      }
    case 'patch-image':
      if (!state.doc.image) return state
      return {
        ...state,
        doc: { ...state.doc, image: { ...state.doc.image, ...action.patch } },
        past: pushPast(state, action.label, action.key),
        future: [],
        dirty: true,
      }
    case 'undo': {
      const prev = state.past[state.past.length - 1]
      if (!prev) return state
      return {
        ...state,
        doc: prev.doc,
        past: state.past.slice(0, -1),
        future: [{ doc: state.doc, label: prev.label, at: Date.now() }, ...state.future].slice(0, MAX_HISTORY),
        dirty: true,
      }
    }
    case 'redo': {
      const next = state.future[0]
      if (!next) return state
      return {
        ...state,
        doc: next.doc,
        past: [...state.past, { doc: state.doc, label: next.label, at: Date.now() }],
        future: state.future.slice(1),
        dirty: true,
      }
    }
    case 'mark-saved':
      return { ...state, dirty: false, savedAt: action.at }
    case 'reset':
      return {
        ...state,
        doc: defaultDoc(state.doc.templateId),
        past: pushPast(state, '重置模板'),
        future: [],
        dirty: true,
      }
    case 'load':
      return { ...state, doc: action.doc, past: [], future: [], dirty: false }
    default:
      return state
  }
}

const DRAFT_KEY = 'baokuan-poster:draft:v1'
const AUTOSAVE_MS = 1200

function loadDraft(): Doc | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { doc?: Doc }
    if (!parsed.doc || !parsed.doc.content || !parsed.doc.style) return null
    return parsed.doc
  } catch {
    return null
  }
}

export interface Store {
  state: State
  doc: Doc
  canUndo: boolean
  canRedo: boolean
  lastAction: string
  setDoc: (doc: Doc, label: string) => void
  setContent: (patch: Partial<Content>, label?: string, key?: string) => void
  setStyle: (patch: Partial<TextStyle>, label: string, key?: string) => void
  setDeco: (patch: Partial<Deco>, label: string, key?: string) => void
  setImage: (image: ImageLayer | null, label: string) => void
  patchImage: (patch: Partial<ImageLayer>, label: string, key?: string) => void
  selectTemplate: (id: string) => void
  resetTemplate: () => void
  undo: () => void
  redo: () => void
  setRatio: (key: RatioKey) => void
  setCustomSize: (w: number, h: number) => void
  saveDraft: () => void
  loadDraftNow: () => boolean
  duplicate: () => void
  hasDraft: boolean
  savedAt: number | null
  dirty: boolean
}

function initState(): State {
  const draft = loadDraft()
  return { doc: draft ?? defaultDoc(), past: [], future: [], dirty: false, savedAt: null }
}

export function useEditorStore(): Store {
  const [state, dispatch] = useReducer(reducer, undefined, initState)
  const [hasDraft, setHasDraft] = useState(() => Boolean(loadDraft()))
  const saveTimer = useRef<number | null>(null)

  const persist = useCallback((doc: Doc) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ doc, savedAt: Date.now() }))
      setHasDraft(true)
      return true
    } catch {
      return false
    }
  }, [])

  const saveDraft = useCallback(() => {
    if (persist(state.doc)) dispatch({ type: 'mark-saved', at: Date.now() })
  }, [persist, state.doc])

  // 自动保存草稿（防抖）
  useEffect(() => {
    if (!state.dirty) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      if (persist(state.doc)) dispatch({ type: 'mark-saved', at: Date.now() })
    }, AUTOSAVE_MS)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [state.doc, state.dirty, persist])

  const setDoc = useCallback((doc: Doc, label: string) => dispatch({ type: 'set-doc', doc, label }), [])
  const setContent = useCallback(
    (patch: Partial<Content>, label?: string, key?: string) =>
      dispatch({ type: 'patch-content', patch, label, key }),
    [],
  )
  const setStyle = useCallback(
    (patch: Partial<TextStyle>, label: string, key?: string) =>
      dispatch({ type: 'patch-style', patch, label, key }),
    [],
  )
  const setDeco = useCallback(
    (patch: Partial<Deco>, label: string, key?: string) => dispatch({ type: 'patch-deco', patch, label, key }),
    [],
  )
  const setImage = useCallback(
    (image: ImageLayer | null, label: string) => dispatch({ type: 'set-image', image, label }),
    [],
  )
  const patchImage = useCallback(
    (patch: Partial<ImageLayer>, label: string, key?: string) =>
      dispatch({ type: 'patch-image', patch, label, key }),
    [],
  )

  const selectTemplate = useCallback(
    (id: string) => {
      const tpl = getTemplate(id)
      const next = applyTemplateDesign(state.doc, id, true)
      // 若当前比例与该模板不匹配，切换到推荐比例
      const shouldSwitchRatio = !isRatioCompatible(state.doc.ratioKey, tpl.bestRatio)
      if (shouldSwitchRatio) {
        const size = sizeForRatio(tpl.bestRatio)
        dispatch({
          type: 'set-doc',
          doc: { ...next, ratioKey: tpl.bestRatio, width: size.width, height: size.height },
          label: `切换模板：${tpl.name}`,
        })
      } else {
        dispatch({ type: 'set-doc', doc: next, label: `切换模板：${tpl.name}` })
      }
    },
    [state.doc],
  )

  const resetTemplate = useCallback(() => dispatch({ type: 'reset' }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  const setRatio = useCallback(
    (key: RatioKey) => {
      if (key === 'custom') {
        dispatch({
          type: 'set-doc',
          doc: { ...state.doc, ratioKey: 'custom' },
          label: '切换到自定义尺寸',
        })
        return
      }
      const size = sizeForRatio(key)
      dispatch({
        type: 'set-doc',
        doc: { ...state.doc, ratioKey: key, width: size.width, height: size.height },
        label: `切换比例：${getRatio(key).label}`,
      })
    },
    [state.doc],
  )

  const setCustomSize = useCallback(
    (w: number, h: number) => {
      const width = Math.max(240, Math.min(4096, Math.round(w)))
      const height = Math.max(240, Math.min(4096, Math.round(h)))
      dispatch({
        type: 'set-doc',
        doc: { ...state.doc, ratioKey: 'custom', width, height },
        label: '自定义尺寸',
        key: 'custom-size',
      } as Action)
    },
    [state.doc],
  )

  const loadDraftNow = useCallback(() => {
    const draft = loadDraft()
    if (!draft) return false
    dispatch({ type: 'load', doc: draft })
    return true
  }, [])

  const duplicate = useCallback(() => {
    dispatch({ type: 'set-doc', doc: { ...clone(state.doc) }, label: '复制当前设计' })
  }, [state.doc])

  const lastAction = useMemo(() => state.past[state.past.length - 1]?.label ?? '初始状态', [state.past])

  return {
    state,
    doc: state.doc,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    lastAction,
    setDoc,
    setContent,
    setStyle,
    setDeco,
    setImage,
    patchImage,
    selectTemplate,
    resetTemplate,
    undo,
    redo,
    setRatio,
    setCustomSize,
    saveDraft,
    loadDraftNow,
    duplicate,
    hasDraft,
    savedAt: state.savedAt,
    dirty: state.dirty,
  }
}

function isRatioCompatible(current: RatioKey, best: RatioKey) {
  if (current === 'custom') return true
  const a = getRatio(current)
  const b = getRatio(best)
  const ra = a.width / a.height
  const rb = b.width / b.height
  return Math.abs(ra - rb) < 0.06
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}
