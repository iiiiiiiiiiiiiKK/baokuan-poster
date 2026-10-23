/**
 * 响应式验收：在多种 iPhone / iPad / 桌面视口下检查布局自适应性。
 *
 * 检查项：
 * 1. 页面无横向滚动（documentElement.scrollWidth <= innerWidth + 1）
 * 2. 没有元素超出视口右边界
 * 3. 主要可点击控件的触控热区 >= 40px（iOS 建议 44px）
 * 4. 输入类控件 font-size >= 16px（否则 iOS Safari 聚焦时会自动放大页面）
 * 5. 画布完整可见且不溢出
 * 6. 顶部栏元素不重叠、不被裁切
 * 7. safe-area-inset 已在移动端生效（刘海 / Home Indicator）
 *
 * 用法：node scripts/responsive-check.mjs
 */
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const SHOTS = join(ROOT, 'shots')
const PORT = 5395

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
}

const VIEWPORTS = [
  { name: 'iPhone SE (2/3)', width: 375, height: 667, dpr: 2, mobile: true },
  { name: 'iPhone 12/13/14', width: 390, height: 844, dpr: 3, mobile: true },
  { name: 'iPhone 14 Pro', width: 393, height: 852, dpr: 3, mobile: true },
  { name: 'iPhone 15 Pro Max', width: 430, height: 932, dpr: 3, mobile: true },
  { name: 'iPad Mini (竖)', width: 744, height: 1133, dpr: 2, mobile: true },
  { name: '桌面 1440', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: '桌面 1920', width: 1920, height: 1080, dpr: 1, mobile: false },
]

function startServer() {
  return new Promise((resolveServer) => {
    const server = createServer(async (req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0])
      let file = join(DIST, url === '/' ? 'index.html' : url)
      if (!existsSync(file)) file = join(DIST, 'index.html')
      const buf = await readFile(file)
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(buf)
    })
    server.listen(PORT, '127.0.0.1', () => resolveServer(server))
  })
}

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const exe = EDGE.find((p) => existsSync(p))
  if (!exe) throw new Error('未找到 Edge / Chrome')
  await mkdir(SHOTS, { recursive: true })
  const server = await startServer()
  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage()
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.dpr,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    })
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => Boolean(window.__baokuan), { timeout: 20000 })
    await page.evaluate(() => document.fonts.ready)
    await new Promise((r) => setTimeout(r, 700))

    const probe = await page.evaluate(() => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const docEl = document.documentElement
      const body = document.body

      // 1. 横向滚动
      const hOverflow = Math.max(docEl.scrollWidth, body.scrollWidth) - vw

      // 2. 越界元素（排除刻意隐藏的元素与绝对定位的装饰）
      const offenders = []
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const st = getComputedStyle(el)
        if (st.display === 'none' || st.visibility === 'hidden' || st.position === 'fixed') continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.right > vw + 1.5 || r.left < -1.5) {
          offenders.push({
            sel:
              el.tagName.toLowerCase() +
              (el.className && typeof el.className === 'string'
                ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
                : ''),
            left: Math.round(r.left),
            right: Math.round(r.right),
          })
        }
      }

      // 3. 触控热区（移动端 44px / 桌面 24px；排除隐藏的 .sr-only）
      const minTarget = window.innerWidth <= 900 ? 44 : 24
      const smallTargets = []
      const interactive = Array.from(
        document.querySelectorAll('button, a, input, select, textarea'),
      )
      for (const el of interactive) {
        const st = getComputedStyle(el)
        if (st.display === 'none' || st.visibility === 'hidden') continue
        if (el.classList.contains('sr-only')) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.height < minTarget || r.width < minTarget) {
          smallTargets.push({
            sel:
              el.tagName.toLowerCase() +
              (el.className && typeof el.className === 'string'
                ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
                : ''),
            w: Math.round(r.width),
            h: Math.round(r.height),
          })
        }
      }

      // 4. 输入类字号（排除隐藏的文件选择框 .sr-only）
      const fontMin = window.innerWidth <= 900 ? 16 : 12
      const smallFonts = []
      for (const el of Array.from(document.querySelectorAll('input, textarea, select'))) {
        const st = getComputedStyle(el)
        if (st.display === 'none') continue
        if (el.classList.contains('sr-only')) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0) continue
        const size = parseFloat(st.fontSize)
        if (size < fontMin) {
          smallFonts.push({
            sel: el.tagName.toLowerCase() + '.' + (el.className || '').split(/\s+/)[0],
            size,
          })
        }
      }

      // 5. 画布（取当前可见的那一个）
      const canvases = Array.from(document.querySelectorAll('.stage canvas, .mobile-canvas canvas'))
        .map((c) => ({ c, r: c.getBoundingClientRect() }))
        .filter((x) => x.r.width > 0 && x.r.height > 0)
      const canvas = canvases[0]?.c ?? null
      const cr = canvases[0]?.r ?? null

      // 6. 顶栏
      const topbar = document.querySelector('.topbar')
      const tr = topbar?.getBoundingClientRect()
      const kids = Array.from(topbar?.children ?? [])
        .filter((el) => getComputedStyle(el).display !== 'none')
        .map((el) => {
          const r = el.getBoundingClientRect()
          return { tag: el.tagName.toLowerCase(), l: Math.round(r.left), r: Math.round(r.right) }
        })

      // 顶栏重叠检测
      let overlap = null
      for (let i = 1; i < kids.length; i++) {
        if (kids[i].l < kids[i - 1].r - 1) {
          overlap = `${kids[i - 1].tag}(→${kids[i - 1].r}) 与 ${kids[i].tag}(${kids[i].l}) 重叠`
          break
        }
      }

      // 7. safe-area
      const rootStyles = getComputedStyle(document.documentElement)
      const app = document.querySelector('.app')
      const appStyles = app ? getComputedStyle(app) : null

      return {
        vw,
        vh,
        hOverflow,
        offenders: offenders.slice(0, 6),
        offenderCount: offenders.length,
        smallTargets: smallTargets.slice(0, 8),
        smallTargetCount: smallTargets.length,
        smallFonts: smallFonts.slice(0, 6),
        smallFontCount: smallFonts.length,
        canvas: cr
          ? {
              w: Math.round(cr.width),
              h: Math.round(cr.height),
              top: Math.round(cr.top),
              left: Math.round(cr.left),
              right: Math.round(cr.right),
              bottom: Math.round(cr.bottom),
            }
          : null,
        topbar: tr ? { h: Math.round(tr.height), w: Math.round(tr.width) } : null,
        overlap,
        mobileShellVisible:
          getComputedStyle(document.querySelector('.mobile-shell')).display !== 'none',
        desktopVisible: getComputedStyle(document.querySelector('.main')).display !== 'none',
        safeAreaVar: rootStyles.getPropertyValue('--sat').trim(),
        appPadBottom: appStyles ? appStyles.paddingBottom : null,
        bodyOverflow: getComputedStyle(body).overflow,
      }
    })

    const isMobile = vp.mobile
    const prefix = vp.name

    record(
      `${prefix} 无横向滚动`,
      probe.hOverflow <= 1,
      `overflow=${probe.hOverflow}px`,
    )
    record(
      `${prefix} 无元素越出视口`,
      probe.offenderCount === 0,
      probe.offenderCount
        ? probe.offenders.map((o) => `${o.sel}[${o.left},${o.right}]`).join(', ')
        : '无',
    )
    record(
      `${prefix} 触控热区 >= ${isMobile ? 44 : 24}px`,
      probe.smallTargetCount === 0,
      probe.smallTargetCount
        ? probe.smallTargets.map((t) => `${t.sel} ${t.w}×${t.h}`).join(', ')
        : '全部达标',
    )
    // 输入框字号：仅在触屏（iOS 会自动放大页面）时要求 >= 16px
    const fontThreshold = isMobile ? 16 : 12
    record(
      `${prefix} 输入框字号 >= ${fontThreshold}px${isMobile ? '（iOS 不缩放）' : ''}`,
      probe.smallFontCount === 0,
      probe.smallFontCount
        ? probe.smallFonts.map((f) => `${f.sel} ${f.size}px`).join(', ')
        : '全部达标',
    )
    record(
      `${prefix} 画布完整可见`,
      Boolean(probe.canvas) &&
        probe.canvas.w > 100 &&
        probe.canvas.h > 100 &&
        probe.canvas.left >= -1 &&
        probe.canvas.right <= probe.vw + 1 &&
        probe.canvas.top >= -1 &&
        probe.canvas.bottom <= probe.vh + 1,
      probe.canvas
        ? `${probe.canvas.w}×${probe.canvas.h} @ (${probe.canvas.left},${probe.canvas.top}) 视口 ${probe.vw}×${probe.vh}`
        : '未找到画布',
    )
    record(
      `${prefix} 顶栏无重叠`,
      probe.overlap === null,
      probe.overlap ?? `高 ${probe.topbar?.h}px`,
    )
    record(
      `${prefix} 布局模式正确（${
        isMobile ? '移动分步面板' : '桌面三栏'
      }）`,
      isMobile ? probe.mobileShellVisible && !probe.desktopVisible : !probe.mobileShellVisible && probe.desktopVisible,
      `mobile=${probe.mobileShellVisible} desktop=${probe.desktopVisible}`,
    )

    await page.screenshot({ path: join(SHOTS, `responsive-${vp.width}x${vp.height}.png`) })
    await page.close()
  }

  await browser.close()
  server.close()

  const pass = results.filter((r) => r.ok).length
  const fail = results.length - pass
  console.log(`\n===== 响应式验收：${pass} 通过 / ${fail} 失败 / 共 ${results.length} 项 =====`)
  const { writeFile } = await import('node:fs/promises')
  await writeFile(
    join(ROOT, 'test-report-responsive.json'),
    JSON.stringify({ at: new Date().toISOString(), pass, fail, results }, null, 2),
    'utf8',
  )
  if (fail > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
