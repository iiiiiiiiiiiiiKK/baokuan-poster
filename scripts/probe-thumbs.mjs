/**
 * 模板缩略图完整性检查：
 * 1. 缩略图画布的宽高比必须等于该模板推荐比例（不被压扁/拉伸）
 * 2. 缩略图必须完整落在卡片容器内（letterbox，无裁切）
 * 3. 缩略图不能溢出卡片
 * 用法：node scripts/probe-thumbs.mjs
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const PORT = 5396
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png' }
const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0])
  let file = join(DIST, url === '/' ? 'index.html' : url)
  if (!existsSync(file)) file = join(DIST, 'index.html')
  const buf = await readFile(file)
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
  res.end(buf)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
})

let bad = 0
for (const vp of [
  { name: 'desktop 1440', width: 1440, height: 900, mobile: false },
  { name: 'iPhone 14 Pro', width: 393, height: 852, mobile: true },
]) {
  const page = await browser.newPage()
  await page.setViewport({
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.mobile ? 3 : 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => Boolean(window.__baokuan))
  await new Promise((r) => setTimeout(r, 700))

  const rows = await page.evaluate(() => {
    const tpls = window.__baokuan.templates()
    const out = []
    for (const t of tpls) {
      // 只取当前可见的那张卡（桌面三栏 / 移动分步面板各一份）
      const cards = Array.from(document.querySelectorAll(`[data-testid="tpl-${t.id}"]`))
      const card = cards.find((c) => {
        const r = c.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      const wrap = card?.querySelector('.tpl-thumb-wrap')
      const cv = card?.querySelector('canvas.tpl-thumb')
      if (!card || !wrap || !cv) {
        out.push({ id: t.id, name: t.name, missing: true })
        continue
      }
      const wr = wrap.getBoundingClientRect()
      const cr = cv.getBoundingClientRect()
      const cardR = card.getBoundingClientRect()
      // 推荐比例
      const RATIO = { '1:1': 1, '3:4': 3 / 4, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 }
      const expect = RATIO[t.bestRatio] ?? 1
      out.push({
        id: t.id,
        name: t.name,
        best: t.bestRatio,
        canvas: [cv.width, cv.height],
        canvasRatio: +(cv.width / cv.height).toFixed(4),
        expectRatio: +expect.toFixed(4),
        ratioErr: +Math.abs(cv.width / cv.height - expect).toFixed(4),
        fitsWrap: cr.width <= wr.width + 1 && cr.height <= wr.height + 1,
        insideCard:
          cr.left >= cardR.left - 1 &&
          cr.right <= cardR.right + 1 &&
          cr.top >= cardR.top - 1 &&
          cr.bottom <= cardR.bottom + 1,
        rendered: [Math.round(cr.width), Math.round(cr.height)],
        wrap: [Math.round(wr.width), Math.round(wr.height)],
      })
    }
    return out
  })

  for (const r of rows) {
    if (r.missing) {
      console.log(`BAD ${vp.name} ${r.name} 缩略图缺失`)
      bad++
      continue
    }
    const ok = r.ratioErr < 0.02 && r.fitsWrap && r.insideCard
    if (!ok) bad++
    console.log(
      `${ok ? 'OK ' : 'BAD'} ${vp.name.padEnd(14)} ${r.name.padEnd(12)} ${r.best.padEnd(5)} ` +
        `画布 ${r.canvas[0]}×${r.canvas[1]} 比例 ${r.canvasRatio} (期望 ${r.expectRatio}) ` +
        `渲染 ${r.rendered[0]}×${r.rendered[1]} 容器内=${r.fitsWrap} 卡内=${r.insideCard}`,
    )
  }
  await page.close()
}

await browser.close()
server.close()
console.log(`\n问题 ${bad} 个`)
if (bad > 0) process.exitCode = 1
