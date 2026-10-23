/**
 * 排版审计（Audit）：开启后记录每一次文字绘制的包围盒，
 * 用于自动化验证「文字没有被画布裁切」「文字未超出安全区」。
 * 默认关闭，零运行时开销。
 */
export interface AuditRect {
  kind: 'title' | 'body' | 'meta' | 'rich'
  text: string
  x: number
  y: number
  w: number
  h: number
}

interface AuditState {
  on: boolean
  rects: AuditRect[]
}

const state: AuditState = { on: false, rects: [] }

export function auditStart() {
  state.on = true
  state.rects = []
}

export function auditStop(): AuditRect[] {
  state.on = false
  return state.rects
}

export function auditActive() {
  return state.on
}

export function auditRecord(r: AuditRect) {
  if (!state.on) return
  if (!r.text || !r.text.trim()) return
  state.rects.push(r)
}

export interface AuditIssue {
  kind: string
  text: string
  detail: string
}

/** 检查所有文字包围盒是否落在画布内（允许 1px 抗锯齿误差） */
export function auditIssues(W: number, H: number, rects: AuditRect[]): AuditIssue[] {
  const issues: AuditIssue[] = []
  for (const r of rects) {
    const left = r.x
    const right = r.x + r.w
    const top = r.y - r.h * 0.92
    const bottom = r.y + r.h * 0.24
    if (left < -1 || right > W + 1 || top < -1 || bottom > H + 1) {
      issues.push({
        kind: r.kind,
        text: r.text.slice(0, 24),
        detail: `越界 x:[${left.toFixed(0)},${right.toFixed(0)}] y:[${top.toFixed(0)},${bottom.toFixed(0)}] 画布 ${W}×${H}`,
      })
    }
  }
  return issues
}

interface Box {
  l: number
  r: number
  t: number
  b: number
}

function boxOf(r: AuditRect): Box {
  return { l: r.x, r: r.x + r.w, t: r.y - r.h * 0.86, b: r.y + r.h * 0.24 }
}

function overlapArea(a: Box, b: Box) {
  const l = Math.max(a.l, b.l)
  const r = Math.min(a.r, b.r)
  const t = Math.max(a.t, b.t)
  const bo = Math.min(a.b, b.b)
  if (r <= l || bo <= t) return 0
  return (r - l) * (bo - t)
}

/**
 * 排版重叠检测：正文占位与页脚/署名等 meta 文字互相压字属于明显的视觉事故，
 * 这里用包围盒重叠面积占比来断言（忽略小于 55% 的轻微接触，避免误报）。
 */
export function auditOverlaps(rects: AuditRect[]): AuditIssue[] {
  const issues: AuditIssue[] = []
  const metas = rects.filter((r) => r.kind === 'meta')
  const blocks = rects.filter((r) => r.kind === 'rich')
  for (const b of blocks) {
    const bb = boxOf(b)
    const areaB = (bb.r - bb.l) * (bb.b - bb.t)
    if (areaB <= 0) continue
    for (const m of metas) {
      const mb = boxOf(m)
      const areaM = (mb.r - mb.l) * (mb.b - mb.t)
      if (areaM <= 0) continue
      const ov = overlapArea(bb, mb)
      const ratio = ov / Math.min(areaB, areaM)
      if (ratio > 0.55) {
        issues.push({
          kind: 'overlap',
          text: `${b.text.slice(0, 14)} × ${m.text.slice(0, 14)}`,
          detail: `重叠 ${(ratio * 100).toFixed(0)}%（正文压住页脚/署名）`,
        })
      }
    }
  }
  return issues
}

