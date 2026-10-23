import { useCallback, useEffect, useState } from 'react'
import type { Doc } from '../model/types'
import {
  QUALITY_OPTIONS,
  downloadBlob,
  exportPng,
  formatBytes,
  type ExportQuality,
  type ExportResult,
} from '../export/export'
import { Modal } from './components'

export function ExportDialog({
  doc,
  onClose,
  onToast,
}: {
  doc: Doc
  onClose: () => void
  onToast: (text: string, kind?: 'ok' | 'err' | 'info') => void
}) {
  const [quality, setQuality] = useState<ExportQuality>('hd')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (autoDownload: boolean) => {
      setBusy(true)
      setError(null)
      try {
        const res = await exportPng(doc, { quality })
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url)
          return res
        })
        if (autoDownload) {
          downloadBlob(res.blob, res.filename)
          onToast(`已导出 ${res.width}×${res.height} PNG`, 'ok')
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '导出失败'
        setError(msg)
        onToast(msg, 'err')
      } finally {
        setBusy(false)
      }
    },
    [doc, quality, onToast],
  )

  // 打开即生成一次预览；切换清晰度重新生成
  useEffect(() => {
    void run(false)
  }, [quality, run])

  return (
    <Modal
      title="导出图片"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            关闭
          </button>
          <button className="btn" disabled={busy || !result} onClick={() => run(true)}>
            重新生成并下载
          </button>
          <button
            className="btn primary"
            disabled={busy || !result}
            onClick={() => {
              if (result) {
                downloadBlob(result.blob, result.filename)
                onToast('已开始下载，手机端可在相册 / 下载中查看', 'ok')
              }
            }}
          >
            下载 PNG
          </button>
        </>
      }
    >
      <div className="row" style={{ marginBottom: 12, gap: 6 }}>
        {QUALITY_OPTIONS.map((o) => (
          <button
            key={o.key}
            className={`btn grow ${quality === o.key ? 'on' : ''}`}
            onClick={() => setQuality(o.key)}
            title={o.hint}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="export-preview">
        {busy && <div className="mini-label">正在渲染并等待字体与图片就绪…</div>}
        {!busy && result && <img src={result.url} alt="导出预览" className="export-preview-img" />}
        {!busy && !result && <div className="mini-label">尚未生成</div>}
      </div>

      {result && (
        <div className="row wrap" style={{ marginTop: 12, gap: 14 }}>
          <span className="mini-label">
            尺寸{' '}
            <b style={{ color: 'var(--text)' }}>
              {result.width} × {result.height}
            </b>{' '}
            px
          </span>
          <span className="mini-label">
            体积 <b style={{ color: 'var(--text)' }}>{formatBytes(result.bytes)}</b>
          </span>
          <span className="mini-label">格式 PNG · 含背景 / 图形 / 配图 / 全部文字</span>
        </div>
      )}

      {error && (
        <div className="warning" style={{ marginTop: 10, position: 'static' }}>
          <span>{error}</span>
        </div>
      )}

      <div className="hr" />
      <div className="mini-label" style={{ lineHeight: 1.8 }}>
        · 导出与预览使用同一个 Canvas 渲染器，只提升像素密度，因此不会出现「预览对、导出错」。
        <br />
        · 导出前会等待字体与配图加载完成；字体未就绪时不会生成错误图片。
        <br />
        · 手机端点击「下载 PNG」后，Safari 请在「文件」App 中查看，Chrome 会提示保存到相册。
      </div>
    </Modal>
  )
}
