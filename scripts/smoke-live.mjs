/**
 * 线上冒烟测试：在真实浏览器里打开已部署的站点，确认能加载、能渲染、能导出。
 * 用法：node scripts/smoke-live.mjs https://example.com/path/
 */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const URL = process.argv[2]
if (!URL) {
  console.error('用法：node scripts/smoke-live.mjs <url>')
  process.exit(1)
}

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))
if (!EDGE) throw new Error('未找到 Edge / Chrome')

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

await mkdir(join(ROOT, 'shots'), { recursive: true })
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--ignore-certificate-errors'],
  defaultViewport: { width: 1440, height: 900 },
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

const t0 = Date.now()
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 45000 })
const loadMs = Date.now() - t0
record('线上页面加载成功', true, `${loadMs}ms`)

await page.waitForFunction(() => Boolean(window.__baokuan), { timeout: 25000 })
record('调试钩子就绪（应用完成挂载）', true)

const tplCount = await page.evaluate(() => window.__baokuan.templates().length)
record('10 套模板就绪', tplCount === 10, `found ${tplCount}`)

// 真实导出一次
const exp = await page.evaluate(async () => {
  const res = await window.__baokuan.exportPng('hd')
  return { w: res.width, h: res.height, bytes: res.bytes }
})
record('线上执行导出成功', exp.w > 0 && exp.bytes > 10000, `${exp.w}×${exp.h} · ${Math.round(exp.bytes / 1024)}KB`)

// 作者链接
const author = await page.evaluate(() => {
  const a = document.querySelector('a.author-x')
  return a ? { href: a.getAttribute('href'), text: a.textContent.trim() } : null
})
record(
  '作者 X 链接存在且指向 oAdam',
  Boolean(author && author.href === 'https://x.com/oAdam'),
  author ? `${author.text} → ${author.href}` : '未找到',
)

await page.screenshot({ path: join(ROOT, 'shots', 'live-desktop.png') })
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await new Promise((r) => setTimeout(r, 800))
const mobile = await page.evaluate(() => ({
  shell: getComputedStyle(document.querySelector('.mobile-shell')).display !== 'none',
  desktop: getComputedStyle(document.querySelector('.main')).display !== 'none',
}))
record('移动端切换为分步面板', mobile.shell && !mobile.desktop, `mobile=${mobile.shell} desktop=${mobile.desktop}`)
await page.screenshot({ path: join(ROOT, 'shots', 'live-mobile.png') })

record('运行期无 JS 错误', errors.length === 0, errors.slice(0, 2).join(' | '))

await browser.close()
const pass = results.filter((r) => r.ok).length
const fail = results.length - pass
console.log(`\n===== 线上冒烟：${pass} 通过 / ${fail} 失败 / 共 ${results.length} 项 =====`)
await writeFile(
  join(ROOT, 'test-report-live.json'),
  JSON.stringify({ at: new Date().toISOString(), url: URL, pass, fail, results }, null, 2),
  'utf8',
)
if (fail > 0) process.exitCode = 1
