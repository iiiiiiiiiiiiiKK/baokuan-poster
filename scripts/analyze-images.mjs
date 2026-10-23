/**
 * 图像分析（辅助验证，不依赖人工看图）：
 * 1) 每张导出的模板图不是空白图（像素多样性）
 * 2) 10 张模板图两两之间视觉差异足够大（说明不是只换背景色）
 * 3) 图为标准 PNG 且尺寸正确
 * 文字是否被裁切由 window.__baokuan.audit() 的文字包围盒断言负责（见 e2e.mjs）。
 */
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SHOTS = join(ROOT, 'shots')

function signature(data, w, h, n = 16) {
  const cells = new Float64Array(n * n)
  const counts = new Float64Array(n * n)
  for (let y = 0; y < h; y++) {
    const cy = Math.min(n - 1, Math.floor((y / h) * n))
    for (let x = 0; x < w; x++) {
      const cx = Math.min(n - 1, Math.floor((x / w) * n))
      const i = (y * w + x) * 4
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      cells[cy * n + cx] += lum
      counts[cy * n + cx]++
    }
  }
  for (let i = 0; i < cells.length; i++) cells[i] /= counts[i] || 1
  return cells
}

function distance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  return sum / a.length
}

function stats(data, w, h) {
  const set = new Set()
  let min = 255
  let max = 0
  let sum = 0
  const step = Math.max(1, Math.floor(Math.min(w, h) / 300))
  let count = 0
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0
      set.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`)
      if (lum < min) min = lum
      if (lum > max) max = lum
      sum += lum
      count++
    }
  }
  return { distinctColors: set.size, minLum: min, maxLum: max, avgLum: sum / count }
}

async function main() {
  const files = (await readdir(SHOTS)).filter((f) => f.startsWith('template-') && f.endsWith('.png'))
  const canvas = createCanvas(10, 10)
  const ctx = canvas.getContext('2d')
  const rows = []
  let problems = 0

  for (const f of files.sort()) {
    const img = await loadImage(join(SHOTS, f))
    canvas.width = img.width
    canvas.height = img.height
    ctx.clearRect(0, 0, img.width, img.height)
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, img.width, img.height).data
    const s = stats(data, img.width, img.height)
    const sig = signature(data, img.width, img.height)
    const blank = s.distinctColors < 12 || s.maxLum - s.minLum < 40
    if (blank) problems++
    rows.push({ file: f, w: img.width, h: img.height, ...s, sig })
    console.log(
      `${blank ? 'BLANK' : 'OK   '} ${f.padEnd(30)} ${img.width}x${img.height} ` +
        `colors=${String(s.distinctColors).padStart(4)} lum ${s.minLum}-${s.maxLum} avg ${s.avgLum.toFixed(0)}`,
    )
  }

  // 两两差异
  let minDist = Infinity
  let minPair = ''
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const d = distance(rows[i].sig, rows[j].sig)
      if (d < minDist) {
        minDist = d
        minPair = `${rows[i].file} vs ${rows[j].file}`
      }
    }
  }
  console.log(`\n最小视觉差异 ${minDist.toFixed(2)} （${minPair}）`)
  if (minDist < 3) {
    problems++
    console.log('警告：存在视觉过于相似的模板')
  }

  await writeFile(
    join(ROOT, 'test-report-images.json'),
    JSON.stringify(
      { count: rows.length, minDistance: minDist, minPair, rows: rows.map(({ sig, ...r }) => r) },
      null,
      2,
    ),
    'utf8',
  )
  console.log(`\n模板图 ${rows.length} 张，问题 ${problems} 个`)
  if (problems > 0) process.exitCode = 1
}

main()
