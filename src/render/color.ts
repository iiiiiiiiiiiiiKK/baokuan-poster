/** 颜色与几何工具：hex ↔ rgba、mix、lighten/darken、渐变工具 */

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function hexToRgba(hex: string, alpha = 1): string {
  const h = normalizeHex(hex)
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
}

export function normalizeHex(input: string): string {
  let h = (input || '').trim()
  if (!h.startsWith('#')) h = `#${h}`
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return '#000000'
  return h.toLowerCase()
}

export function withAlpha(hex: string, alpha: number) {
  return hexToRgba(hex, alpha)
}

export function mix(a: string, b: string, t: number): string {
  const x = normalizeHex(a)
  const y = normalizeHex(b)
  const ar = parseInt(x.slice(1, 3), 16)
  const ag = parseInt(x.slice(3, 5), 16)
  const ab = parseInt(x.slice(5, 7), 16)
  const br = parseInt(y.slice(1, 3), 16)
  const bg = parseInt(y.slice(3, 5), 16)
  const bb = parseInt(y.slice(5, 7), 16)
  const k = clamp(t, 0, 1)
  const to = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${to(ar + (br - ar) * k)}${to(ag + (bg - ag) * k)}${to(ab + (bb - ab) * k)}`
}

export function luminance(hex: string): number {
  const h = normalizeHex(hex)
  const r = parseInt(h.slice(1, 3), 16) / 255
  const g = parseInt(h.slice(3, 5), 16) / 255
  const b = parseInt(h.slice(5, 7), 16) / 255
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function readableInk(bg: string): '#111111' | '#ffffff' {
  return luminance(bg) > 0.45 ? '#111111' : '#ffffff'
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rr)
    return
  }
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

/** 以固定种子生成伪随机数，保证预览与导出的纸纹 / 颗粒完全一致 */
export function seededRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
