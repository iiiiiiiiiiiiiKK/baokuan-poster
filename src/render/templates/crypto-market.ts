/**
 * 模板 07 · 加密市场评论风
 * 版式逻辑：深色底 + 滚动行情条（ticker）+ 右上角 K 线缩略图 + 大号价格/涨跌标签 + 引用式正文 + 风险提示。
 */
import type { RenderCtx } from '../../model/types'
import { hexToRgba, mix, seededRandom } from '../color'
import { drawDivider, grain, roundRect, vGradient } from '../assets'
import { bodyFlow, flagBodyLong, padOf, paletteOf, scaleOf, titleFlow } from '../common'
import { paintLines, paintMeta } from '../paint'
import { setFont } from '../text'

export function renderCryptoMarket(r: RenderCtx) {
  const { ctx, W, H, doc } = r
  const p = paletteOf(doc)
  const s = scaleOf(W, H)
  const pad = padOf(W, H, 0.062)
  const inner = W - pad * 2

  if (!doc.transparent) {
    vGradient(ctx, W, H, [
      [0, mix(p.bg, '#ffffff', 0.03)],
      [0.5, p.bg],
      [1, mix(p.bg, '#000000', 0.35)],
    ])
  }

  // 装饰：右上光晕 + 网格
  const glowG = ctx.createRadialGradient(W * 0.86, H * 0.14, 0, W * 0.86, H * 0.14, W * 0.6)
  glowG.addColorStop(0, hexToRgba(p.accent, 0.2))
  glowG.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glowG
  ctx.fillRect(0, 0, W, H)

  // ---- 行情条 ----
  const tickH = 46 * s
  ctx.fillStyle = hexToRgba(p.accent, 0.14)
  ctx.fillRect(0, 0, W, tickH)
  ctx.fillStyle = p.accent
  ctx.fillRect(0, tickH - Math.max(1, 2 * s), W, Math.max(1, 2 * s))
  const ticker = 'BTC 68,420 ▲2.4%   ·   ETH 3,540 ▲1.1%   ·   SOL 168.2 ▼0.6%   ·   TOTAL 2.41T ▲1.8%   ·   FNG 74 贪婪'
  paintMeta(ctx, ticker, {
    x: 0,
    y: tickH / 2 + 6 * s,
    width: W - pad * 0.8,
    align: 'right',
    size: 15 * s,
    weight: 700,
    fontKey: 'mono',
    color: hexToRgba(p.accent, 0.95),
    letterSpacing: 0.6 * s,
    ellipsis: true,
  })

  let y = tickH + pad * 1.15

  // ---- 币种标签 ----
  ctx.save()
  setFont(ctx, 22 * s, 800, doc.style.fontTitle)
  const pair = (doc.content.eyebrow || 'BTC / USDT').toUpperCase()
  const pw = ctx.measureText(pair).width
  ctx.fillStyle = hexToRgba(p.accent, 0.16)
  roundRect(ctx, pad, y - 26 * s, pw + 28 * s, 40 * s, 8 * s)
  ctx.fill()
  ctx.fillStyle = p.accent
  ctx.textBaseline = 'middle'
  ctx.fillText(pair, pad + 14 * s, y - 5 * s)
  ctx.restore()

  // 涨跌药丸
  const up = !/▼|跌|亏|空/i.test(doc.content.title)
  paintMeta(ctx, up ? '▲ LONG 看多' : '▼ SHORT 看空', {
    x: pad,
    y: y - 5 * s,
    width: pw + 28 * s + 130 * s,
    size: 15 * s,
    weight: 800,
    fontKey: 'mono',
    color: up ? '#0ecb81' : '#f6465d',
    letterSpacing: 0.8 * s,
  })
  paintMeta(ctx, '24H  ·  高杠杆警示', {
    x: pad,
    y: y - 5 * s,
    width: inner,
    align: 'right',
    size: 14 * s,
    weight: 600,
    fontKey: 'mono',
    color: hexToRgba(p.ink, 0.5),
  })
  y += 34 * s

  // ---- 价格大字 ----
  const priceMain = /(?:[¥$€]?\s?[\d,]+(?:\.\d+)?)/.exec(doc.content.signature || '')?.[0] || '68,420'
  ctx.save()
  setFont(ctx, 74 * s, 800, doc.style.fontTitle)
  const priceSize = Math.min(74 * s, (inner * 0.62 * 74 * s) / ctx.measureText(priceMain).width)
  setFont(ctx, priceSize, 800, doc.style.fontTitle)
  ctx.fillStyle = p.ink
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(priceMain, pad, y + priceSize * 0.78)
  const priceW = ctx.measureText(priceMain).width
  ctx.restore()
  paintMeta(ctx, up ? '+2.41%' : '-2.41%', {
    x: pad + priceW + 18 * s,
    y: y + priceSize * 0.62,
    width: inner - priceW,
    size: 26 * s,
    weight: 800,
    fontKey: 'mono',
    color: up ? '#0ecb81' : '#f6465d',
  })
  y += priceSize + 18 * s

  // ---- 迷你 K 线 ----
  const chartH = Math.min(H * 0.16, 150 * s)
  const chartW = inner
  const rnd = seededRandom(4242)
  const candles = Math.max(18, Math.floor(chartW / (16 * s)))
  const cw = chartW / candles
  let price = 0.5
  const series: number[] = []
  for (let i = 0; i < candles; i++) {
    price += (rnd() - 0.45) * 0.16
    price = Math.min(0.95, Math.max(0.08, price))
    series.push(price)
  }
  const chartY = y
  series.forEach((v, i) => {
    const bh = v * chartH
    const cx = pad + i * cw
    const openV = series[i - 1] ?? v
    const gain = v >= openV
    ctx.fillStyle = gain ? hexToRgba('#0ecb81', 0.85) : hexToRgba('#f6465d', 0.8)
    const wick = 1.5 * s
    const bodyW = Math.max(2, cw * 0.56)
    ctx.fillRect(cx + cw / 2 - bodyW / 2, chartY + chartH - bh, bodyW, bh * 0.75)
    ctx.fillRect(cx + cw / 2 - wick / 2, chartY + chartH - bh * 1.28, wick, bh * 0.3)
  })
  // 均线
  ctx.save()
  ctx.strokeStyle = hexToRgba(p.accent, 0.9)
  ctx.lineWidth = Math.max(1.4, 2 * s)
  ctx.beginPath()
  series.forEach((v, i) => {
    const px = pad + i * cw + cw / 2
    const py = chartY + chartH - v * chartH * 0.86 - chartH * 0.08
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.stroke()
  ctx.restore()
  drawDivider(ctx, 'dashed', pad, chartY + chartH, chartW, hexToRgba(p.ink, 0.16), Math.max(1, 1 * s))
  y += chartH + 34 * s

  // ---- 标题 ----
  const title = titleFlow(r, { width: inner, maxLines: 4, lineHeight: 1.2, sizeFactor: 1.32, minFactor: 0.42, letterSpacing: -0.8 })
  paintLines(ctx, title.lines, {
    x: pad,
    y: y + title.size * 0.86,
    width: inner,
    align: doc.style.align,
    size: title.size,
    weight: doc.style.titleWeight,
    fontKey: doc.style.fontTitle,
    ink: p.ink,
    accent: p.accent,
    markColor: hexToRgba(p.accent, 0.3),
    letterSpacing: -0.8 * s,
    lineHeight: title.lineHeight,
  })
  y += title.height + 26 * s

  // ---- 正文（左竖线引用）----
  const footTop = H - pad * 1.1
  const bodyAvailable = footTop - 50 * s - y
  const body = bodyFlow(r, { width: inner - 26 * s, maxHeight: bodyAvailable, sizeFactor: 0.96, lineHeight: 1.76 })
  if (doc.content.body) {
    ctx.fillStyle = hexToRgba(p.accent, 0.8)
    ctx.fillRect(pad, y - 4 * s, Math.max(2, 3 * s), Math.min(body.height + 6 * s, bodyAvailable))
    paintLines(ctx, body.lines, {
      x: pad + 24 * s,
      y: y + body.size * 0.86,
      width: inner - 26 * s,
      align: 'left',
      size: body.size,
      weight: doc.style.bodyWeight,
      fontKey: doc.style.fontBody,
      ink: p.soft,
      accent: p.accent,
      markColor: hexToRgba(p.accent, 0.28),
      letterSpacing: doc.style.letterSpacing * s,
      lineHeight: body.lineHeight,
    })
  }
  flagBodyLong(r, 130, '加密市场评论风')

  // ---- 底部：作者 + 风险提示 ----
  drawDivider(ctx, 'line', pad, footTop - 18 * s, inner, hexToRgba(p.ink, 0.16), Math.max(1, 1 * s))
  paintMeta(ctx, doc.content.signature || '@crypto_notes · 独立研究员', {
    x: pad,
    y: footTop + 12 * s,
    width: inner,
    size: 17 * s,
    weight: 700,
    color: p.ink,
    letterSpacing: 0.4 * s,
    ellipsis: true,
  })
  paintMeta(ctx, doc.content.footer || '以上内容不构成投资建议 · DYOR', {
    x: pad,
    y: footTop + 12 * s,
    width: inner,
    align: 'right',
    size: 14 * s,
    weight: 500,
    color: hexToRgba(p.ink, 0.45),
    letterSpacing: 0.4 * s,
    ellipsis: true,
  })
  if (!doc.transparent) grain(ctx, W, H, 0.14, true)
}
