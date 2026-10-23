import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Content, Doc, LayoutWarning, TextStyle, Deco } from '../model/types'
import { applyTemplateDesign, defaultDoc, sizeForRatio } from '../model/presets'
import { getTemplate } from '../render/templates'
import { useEditorStore } from '../state/store'
import { CanvasStage } from './Stage'
import { TemplatePanel, RatioPanel, ImagePanel } from './LeftPanel'
import { ContentSection, DecoSection, StyleSection } from './RightPanel'
import { ExportDialog } from './ExportDialog'
import { Modal, Toasts, useToasts, AuthorXLink } from './components'
import { CopyDialog } from './CopyDialog'
import { loadImage } from '../render'
import { installDebug, mergeDoc } from './debug'

type MobileTab = 'template' | 'text' | 'style' | 'export'

export function App() {
  const store = useEditorStore()
  const { doc } = store
  const { items: toasts, push } = useToasts()
  const [zoom, setZoom] = useState(0.5)
  const [autoFitScreen, setAutoFitScreen] = useState(true)
  const [warnings, setWarnings] = useState<LayoutWarning[]>([])
  const [showExport, setShowExport] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showCopy, setShowCopy] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('template')
  const [mobileSheetOpen, setMobileSheetOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const mobileStageRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<Content>(doc.content)
  contentRef.current = doc.content
  // 调试钩子始终读到最新 doc（避免闭包过期）
  const docRef = useRef<Doc>(doc)
  docRef.current = doc

  /** 取当前可见画布容器的缩放比（桌面 / 移动端只有一个有尺寸） */
  const fitZoom = useCallback(() => {
    const candidates = [stageRef.current, mobileStageRef.current]
    const el = candidates.find((c) => c && c.clientWidth > 0)
    if (!el) return 0.5
    const padX = el.clientWidth < 600 ? 24 : 96
    const padY = el.clientHeight < 600 ? 40 : 96
    const w = Math.max(120, el.clientWidth - padX)
    const h = Math.max(120, el.clientHeight - padY)
    return Math.min(w / doc.width, h / doc.height, 1.6)
  }, [doc.width, doc.height])

  useEffect(() => {
    if (!autoFitScreen) return
    const apply = () => setZoom(fitZoom())
    apply()
    const ro = new ResizeObserver(apply)
    for (const el of [stageRef.current, mobileStageRef.current]) if (el) ro.observe(el)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [autoFitScreen, fitZoom])

  const actions = useMemo(
    () => ({
      setContent: (patch: Partial<Content>, label?: string, key?: string) =>
        store.setContent(patch, label, key),
      setStyle: (patch: Partial<TextStyle>, label: string, key?: string) =>
        store.setStyle(patch, label, key),
      setDeco: (patch: Partial<Deco>, label: string, key?: string) =>
        store.setDeco(patch, label, key),
      setDocField: (patch: Partial<Doc>, label: string) => store.setDoc({ ...doc, ...patch }, label),
    }),
    [store, doc],
  )

  /**
   * 缩略图使用当前文字 + 各模板设计。
   * 关键：按「模板自己的推荐比例」渲染（如 3:4 的模板就渲染成竖图），
   * 再由卡片容器 letterbox 居中显示，避免缩略图被压成 4:3 而看不出真实版式。
   */
  const makePreviewDoc = useCallback(
    (id: string): Doc => {
      const tpl = getTemplate(id)
      const base = applyTemplateDesign({ ...doc, content: contentRef.current }, id, true)
      const size = sizeForRatio(tpl.bestRatio)
      return {
        ...base,
        ratioKey: tpl.bestRatio,
        width: size.width,
        height: size.height,
        image: null,
      }
    },
    [doc],
  )

  const onPickImage = useCallback(
    (file: File) => {
      const reader = new FileReader()
      setLoading(true)
      reader.onload = async () => {
        const src = String(reader.result)
        try {
          await loadImage(src)
          store.setImage(
            {
              src,
              fit: 'cover',
              opacity: 1,
              tint: 0,
              blur: 0,
              offsetX: 0,
              offsetY: 0,
              scale: 1,
              rounded: true,
            },
            '上传配图',
          )
          push('配图已添加', 'ok')
        } catch {
          push('图片解码失败，请换一张试试', 'err')
        } finally {
          setLoading(false)
        }
      }
      reader.onerror = () => {
        setLoading(false)
        push('读取文件失败', 'err')
      }
      reader.readAsDataURL(file)
    },
    [push, store],
  )

  const onLoadDraft = useCallback(() => {
    const ok = store.loadDraftNow()
    push(ok ? '已恢复本地草稿' : '本机暂无草稿', ok ? 'ok' : 'err')
  }, [push, store])

  const copyPng = useCallback(async () => {
    try {
      const { exportPng } = await import('../export/export')
      const res = await exportPng(doc, { quality: 'standard' })
      const item = new ClipboardItem({ 'image/png': res.blob })
      await navigator.clipboard.write([item])
      URL.revokeObjectURL(res.url)
      push('已复制图片到剪贴板', 'ok')
    } catch {
      push('当前浏览器不支持复制图片，请使用导出下载', 'err')
    }
  }, [doc, push])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        store.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        store.saveDraft()
        push('草稿已保存到本机', 'ok')
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        store.duplicate()
        push('已复制当前设计', 'ok')
        return
      }
      if (typing) return
      if (e.key === '?') setShowHelp(true)
      if (e.key === '0' && mod) {
        e.preventDefault()
        setAutoFitScreen(true)
      }
      if (e.key === '+' || e.key === '=') {
        setAutoFitScreen(false)
        setZoom((z) => Math.min(2.4, z + 0.1))
      }
      if (e.key === '-') {
        setAutoFitScreen(false)
        setZoom((z) => Math.max(0.1, z - 0.1))
      }
      if (e.key.toLowerCase() === 'e' && !mod) setShowExport(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [push, store])

  const savedLabel = useMemo(() => {
    if (!store.dirty && store.savedAt) {
      const d = new Date(store.savedAt)
      return `草稿已保存 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return store.dirty ? '有未保存更改（自动保存中）' : '草稿已就绪'
  }, [store.dirty, store.savedAt])

  const tpl = getTemplate(doc.templateId)

  // 暴露自动化钩子（e2e / 验收脚本使用，不影响正常交互）。
  // 通过 ref 同步更新，保证「设置 → 立即读/导出」不会读到过期状态。
  useEffect(() => {
    installDebug(
      (patch) => {
        docRef.current = mergeDoc(docRef.current, patch)
        store.setDoc(docRef.current, '自动化设置')
      },
      () => docRef.current,
      (id) => store.selectTemplate(id),
    )
  }, [store])

  const draftRow = (
    <div className="panel-section">
      <div className="section-title" style={{ marginBottom: 8 }}>
        草稿
      </div>
      <div className="row">
        <button
          className="btn sm grow"
          onClick={() => {
            store.saveDraft()
            push('草稿已保存到本机', 'ok')
          }}
        >
          保存草稿
        </button>
        <button className="btn sm grow" onClick={onLoadDraft}>
          恢复草稿
        </button>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button
          className="btn sm grow"
          onClick={() => {
            store.duplicate()
            push('已复制当前设计', 'ok')
          }}
        >
          复制设计
        </button>
        <button
          className="btn sm grow"
          onClick={() => {
            store.setDoc(defaultDoc(), '新建默认设计')
            push('已新建默认设计', 'ok')
          }}
        >
          新建
        </button>
      </div>
      <div className="mini-label" style={{ marginTop: 8 }}>
        {savedLabel} · 仅存本机
      </div>
    </div>
  )

  const warningsView = (max: number) => (
    <div className="warnings">
      {warnings.slice(0, max).map((w, i) => (
        <div key={i} className={`warning ${w.kind === 'body' ? 'body' : ''}`}>
          <span>!</span>
          <span>{w.text}</span>
        </div>
      ))}
    </div>
  )

  const onImagePatch = (p: Record<string, number | string | boolean>) =>
    store.patchImage(p as never, '调整配图', JSON.stringify(Object.keys(p).sort()))

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">爆</span>
          <span>一句话变成爆款配图</span>
          <small className="desktop-only">Canvas 排版工作台</small>
        </div>
        <div className="spacer" />
        <AuthorXLink />
        <div className="row desktop-only" style={{ gap: 6 }}>
          <button
            className="btn ghost icon"
            disabled={!store.canUndo}
            onClick={store.undo}
            title="撤销 (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            className="btn ghost icon"
            disabled={!store.canRedo}
            onClick={store.redo}
            title="重做 (Ctrl+Shift+Z)"
          >
            ↷
          </button>
          <span className="mini-label" style={{ minWidth: 82, textAlign: 'center' }}>
            {store.lastAction}
          </span>
          <button
            className="btn"
            onClick={() => {
              store.saveDraft()
              push('草稿已保存到本机', 'ok')
            }}
          >
            保存草稿
          </button>
          <button className="btn" onClick={copyPng} title="复制为 PNG 图片到剪贴板">
            复制图片
          </button>
          <button className="btn" onClick={() => setShowCopy(true)}>
            文案助手
          </button>
          <button
            className="btn ghost icon"
            onClick={() => setShowHelp(true)}
            title="快捷键与说明"
          >
            ?
          </button>
        </div>
        <button className="btn primary" onClick={() => setShowExport(true)}>
          导出 PNG
        </button>
      </header>

      <div className="main">
        <div className="panel left">
          <TemplatePanel
            doc={doc}
            onSelect={(id) => {
              store.selectTemplate(id)
              push(`已切换到「${getTemplate(id).name}」`, 'ok')
            }}
            onReset={() => {
              store.resetTemplate()
              push('已重置为模板默认样式', 'ok')
            }}
            makePreviewDoc={makePreviewDoc}
          />
          <RatioPanel doc={doc} onRatio={store.setRatio} onCustom={store.setCustomSize} />
          <ImagePanel
            doc={doc}
            onFile={onPickImage}
            onRemove={() => {
              store.setImage(null, '移除配图')
              push('已移除配图', 'ok')
            }}
            onPatch={onImagePatch}
          />
          {draftRow}
        </div>

        <div className="stage" ref={stageRef}>
          <div className="stage-badge">
            <span className="badge">{tpl.name}</span>
            <span className="badge">
              {doc.width}×{doc.height}
            </span>
            {doc.transparent && <span className="badge">透明背景</span>}
          </div>
          {warnings.length > 0 && warningsView(3)}
          <div className="stage-inner">
            <CanvasStage doc={doc} zoom={zoom} onWarnings={setWarnings} />
          </div>
          <div className="stage-toolbar">
            <button
              className="btn ghost icon"
              onClick={() => {
                setAutoFitScreen(false)
                setZoom((z) => Math.max(0.1, z - 0.1))
              }}
              title="缩小 (-)"
            >
              −
            </button>
            <span className="zoom-val">{Math.round(zoom * 100)}%</span>
            <button
              className="btn ghost icon"
              onClick={() => {
                setAutoFitScreen(false)
                setZoom((z) => Math.min(2.4, z + 0.1))
              }}
              title="放大 (+)"
            >
              +
            </button>
            <button
              className={`btn ghost ${autoFitScreen ? 'on' : ''}`}
              onClick={() => setAutoFitScreen(true)}
              title="适应屏幕 (Ctrl+0)"
            >
              适应屏幕
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setAutoFitScreen(false)
                setZoom(1)
              }}
              title="1:1 实际像素"
            >
              100%
            </button>
          </div>
        </div>

        <div className="panel right">
          <ContentSection doc={doc} actions={actions} />
          <StyleSection doc={doc} actions={actions} />
          <DecoSection doc={doc} actions={actions} />
        </div>
      </div>

      <div className="mobile-shell">
        <div className="mobile-canvas" ref={mobileStageRef}>
          {warnings.length > 0 && warningsView(1)}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 8px 12px',
            }}
          >
            <CanvasStage doc={doc} zoom={zoom} onWarnings={setWarnings} />
          </div>
          {mobileSheetOpen && (
            <div className="mobile-sheet">
              <div className="mobile-banner">
                  {mobileTab === 'template' && '步骤 1 / 3 · 选择模板与比例'}
                {mobileTab === 'text' && '步骤 2 / 3 · 编辑文字'}
                {mobileTab === 'style' && '步骤 2 / 3 · 调整样式与装饰'}
                {mobileTab === 'export' && '步骤 3 / 3 · 导出与草稿'}
              </div>
              {mobileTab === 'template' && (
                <>
                  <TemplatePanel
                    doc={doc}
                    onSelect={(id) => store.selectTemplate(id)}
                    onReset={() => store.resetTemplate()}
                    makePreviewDoc={makePreviewDoc}
                  />
                  <RatioPanel doc={doc} onRatio={store.setRatio} onCustom={store.setCustomSize} />
                  <ImagePanel
                    doc={doc}
                    onFile={onPickImage}
                    onRemove={() => store.setImage(null, '移除配图')}
                    onPatch={onImagePatch}
                  />
                </>
              )}
              {mobileTab === 'text' && <ContentSection doc={doc} actions={actions} compact />}
              {mobileTab === 'style' && (
                <>
                  <StyleSection doc={doc} actions={actions} />
                  <DecoSection doc={doc} actions={actions} />
                </>
              )}
              {mobileTab === 'export' && (
                <div className="panel-section">
                  <div className="section-title" style={{ marginBottom: 10 }}>
                    导出与保存
                  </div>
                  <button
                    className="btn primary"
                    style={{ width: '100%', height: 40 }}
                    onClick={() => setShowExport(true)}
                  >
                    导出 PNG（标准 / 高清 / 超清）
                  </button>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button
                      className="btn grow"
                      onClick={() => {
                        store.saveDraft()
                        push('草稿已保存到本机', 'ok')
                      }}
                    >
                      保存草稿
                    </button>
                    <button className="btn grow" onClick={onLoadDraft}>
                      恢复草稿
                    </button>
                  </div>
                  <div className="mini-label" style={{ marginTop: 10, lineHeight: 1.7 }}>
                    {savedLabel}
                    <br />
                    手机端建议选择「高清 2x」，下载后在相册 / 文件中查看。
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mobile-steps">
          {(
            [
              ['template', '模板', '▦'],
              ['text', '文字', 'T'],
              ['style', '样式', '✦'],
              ['export', '导出', '↓'],
            ] as [MobileTab, string, string][]
          ).map(([k, label, icon]) => (
            <button
              key={k}
              className={mobileTab === k ? 'active' : ''}
              onClick={() => {
                setMobileTab(k)
                setMobileSheetOpen(true)
              }}
            >
              <span style={{ fontSize: 14 }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
          <button onClick={() => setMobileSheetOpen((v) => !v)}>
            <span style={{ fontSize: 14 }}>{mobileSheetOpen ? '▾' : '▴'}</span>
            <span>{mobileSheetOpen ? '收起' : '展开'}</span>
          </button>
        </div>
      </div>

      {showExport && (
        <ExportDialog doc={doc} onClose={() => setShowExport(false)} onToast={push} />
      )}
      {showCopy && (
        <CopyDialog
          doc={doc}
          onClose={() => setShowCopy(false)}
          onApply={(patch) => {
            store.setContent(patch, '应用文案建议')
            push('已把建议应用到画布（可撤销）', 'ok')
          }}
          onToast={push}
        />
      )}
      {showHelp && (
        <Modal
          title="使用说明与快捷键"
          onClose={() => setShowHelp(false)}
          footer={
            <button className="btn primary" onClick={() => setShowHelp(false)}>
              知道了
            </button>
          }
        >
          <div style={{ lineHeight: 1.9, fontSize: 12.5 }}>
            <b>排版标记</b>
            <div className="mini-label" style={{ marginBottom: 10 }}>
              在标题或正文里使用 <span className="kbd">**加粗**</span>、
              <span className="kbd">==标记笔==</span>、<span className="kbd">__下划线__</span>。
              标记只改变样式，不改变文字内容。
            </div>
            <b>快捷键</b>
            <div className="mini-label" style={{ marginBottom: 10 }}>
              <span className="kbd">Ctrl/⌘ + Z</span> 撤销 ·{' '}
              <span className="kbd">Ctrl/⌘ + Shift + Z</span> 重做 ·{' '}
              <span className="kbd">Ctrl/⌘ + S</span> 保存草稿 ·{' '}
              <span className="kbd">Ctrl/⌘ + D</span> 复制设计 ·{' '}
              <span className="kbd">Ctrl/⌘ + 0</span> 适应屏幕 ·{' '}
              <span className="kbd">+ / -</span> 缩放 · <span className="kbd">E</span> 导出
            </div>
            <b>排版规则</b>
            <div className="mini-label" style={{ marginBottom: 10, lineHeight: 1.9 }}>
              中文逐字断行、英文按单词断行、标点避头尾；emoji 与组合字符按字素簇处理，不会被拆开。
              标题超过模板允许行数时会自动缩小字号（绝不删字）。正文超过模板舒适区会提示，但文字全部保留。
              导出前会等待字体与配图加载完成，避免生成错版图片。
            </div>
            <b>数据</b>
            <div className="mini-label">
              草稿保存在浏览器 localStorage（仅本机），配图以 data URL 形式内嵌，不上传任何服务器。
            </div>
          </div>
        </Modal>
      )}

      {loading && (
        <div className="loading-veil">
          <div className="spinner" />
          <div>正在载入图片…</div>
        </div>
      )}

      <Toasts items={toasts} />
    </div>
  )
}

