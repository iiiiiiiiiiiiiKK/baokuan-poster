/**
 * 文字覆盖度检查：确认导出图里真的画出了文字（而不是空白底色或纯色块）。
 *
 * 做法：
 * 1. 统计 4×4×4 量化色直方图，取出现最多的桶作为「背景色」；
 * 2. 统计与背景亮度差 > 42 的像素占比 = 前景占比（文字 + 图形）；
 * 3. 断言前景占比落在合理区间（> 0.4% 说明有内容，< 55% 说明不是整块死色）。
 *
 * 用法：node scripts/verify-text.mjs
 */
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SHOTS = join(ROOT, 'shots')

const files = [
  'template-minimal-bw.png',
  'template-orange-poster.png',
  'template-open-source.png',
  'template-cyber-terminal.png',
  'template-retro-paper.png',
  'template-research-report.png',
  'template-crypto-market.png',
  'template-hand-note.png',
  'template-code-shot.png',
  'template-english-quote.png',
]

function analyze(data, w, h) {
  const hist = new Uint32Array(64)
  const lum = new Float64Array(64)
  const count = new Float64Array(64)
  const total = w * h
  for (let i = 0; i < total; i++) {
    const p = i * 4
    const bucket = (data[p] >> 6) * 16 + (data[p + 1] >> 6) * 4 + (data[p + 2] >> 6)
    hist[bucket]++
    lum[bucket] += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    count[bucket]++
  }
  let bg = 0
  for (let i = 1; i < 64; i++) if (hist[i] > hist[bg]) bg = i
  const bgLum = lum[bg] / (count[bg] || 1)

  let fg = 0
  for (let i = 0; i < total; i++) {
    const p = i * 4
    const l = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    if (Math.abs(l - bgLum) > 42) fg++
  }
  return { bgLum, fgRatio: fg / total, bgShare: hist[bg] / total }
}

const rows = []
let problems = 0
for (const f of files) {
  const buf = await readFile(join(SHOTS, f))
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0)
  const data = g.getImageData(0, 0, img.width, img.height).data
  const a = analyze(data, img.width, img.height)
  // 有实质内容、且不是整张死色
  const ok = a.fgRatio > 0.004 && a.fgRatio < 0.55
  if (!ok) problems++
  rows.push({
    file: f,
    w: img.width,
    h: img.height,
    bgLum: +a.bgLum.toFixed(1),
    bgShare: +(a.bgShare * 100).toFixed(2),
    fgRatio: +(a.fgRatio * 100).toFixed(2),
    ok,
  })
  console.log(
    `${ok ? 'OK ' : 'BAD'} ${f.padEnd(30)} ${img.width}x${img.height} ` +
      `背景亮度 ${a.bgLum.toFixed(0).padStart(3)} (占 ${(a.bgShare * 100).toFixed(1)}%)  ` +
      `前景(文字+图形) ${(a.fgRatio * 100).toFixed(2)}%`,
  )
}

console.log(`\n共 ${rows.length} 张，问题 ${problems} 个`)
await writeFile(
  join(ROOT, 'test-report-text.json'),
  JSON.stringify({ count: rows.length, problems, rows }, null, 2),
  'utf8',
)
if (problems > 0) process.exitCode = 1
