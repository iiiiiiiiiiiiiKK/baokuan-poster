/**
 * 导出弹窗预览图完整性检查：
 * 1. 预览 <img> 的渲染宽高比必须与原图一致（未被拉伸/裁切）
 * 2. 预览图必须完整落在容器内（无裁切）
 * 3. 容器不能出现横向滚动
 * 用法：node scripts/probe-export-preview.mjs
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const PORT = 5398
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

const RATIOS = ['1:1', '3:4', '9:16', '16:9']
const VPS = [
  { name: 'desktop 1440', width: 1440, height: 900, mobile: false },
  { name: 'iPhone 14 Pro', width: 393, height: 852, mobile: true },
]

for (const vp of VPS) {
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
  await new Promise((r) => setTimeout(r, 500))

  for (const ratio of RATIOS) {
    await page.evaluate((k) => window.__baokuan.setRatio(k), ratio)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.topbar .btn')).find(
        (b) => b.textContent.includes('导出 PNG'),
      )
      btn?.click()
    })
    await page.waitForSelector('.export-preview img', { timeout: 20000 })
    await page.waitForFunction(
      () => {
        const img = document.querySelector('.export-preview img')
        return img && img.complete && img.naturalWidth > 0
      },
      { timeout: 30000 },
    )
    await new Promise((r) => setTimeout(r, 250))

    const info = await page.evaluate(() => {
      const img = document.querySelector('.export-preview img')
      const box = document.querySelector('.export-preview')
      const modal = document.querySelector('.modal')
      const ir = img.getBoundingClientRect()
      const br = box.getBoundingClientRect()
      const mr = modal.getBoundingClientRect()
      const naturalRatio = img.naturalWidth / img.naturalHeight
      const renderRatio = ir.width / ir.height
      return {
        natural: [img.naturalWidth, img.naturalHeight],
        rendered: [Math.round(ir.width), Math.round(ir.height)],
        naturalRatio: +naturalRatio.toFixed(4),
        renderRatio: +renderRatio.toFixed(4),
        ratioErr: +Math.abs(naturalRatio - renderRatio).toFixed(4),
        fitsBox: ir.width <= br.width + 1 && ir.height <= br.height + 1,
        fitsModal: ir.top >= mr.top - 1 && ir.bottom <= mr.bottom + 1,
        boxScroll: box.scrollWidth - box.clientWidth,
        modalScrollX: modal.scrollWidth - modal.clientWidth,
        imgRight: Math.round(ir.right),
        viewportW: window.innerWidth,
      }
    })
    const ok = info.ratioErr < 0.01 && info.fitsBox && info.boxScroll <= 1 && info.modalScrollX <= 1
    console.log(
      `${ok ? 'OK ' : 'BAD'} ${vp.name.padEnd(14)} ${ratio.padEnd(5)} ` +
        `原图 ${info.natural[0]}×${info.natural[1]} → 渲染 ${info.rendered[0]}×${info.rendered[1]} ` +
        `比例误差 ${info.ratioErr} 容器内=${info.fitsBox} 弹窗内=${info.fitsModal} 横向滚动=${info.boxScroll}`,
    )
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 5000 })
  }
  await page.close()
}

await browser.close()
server.close()
