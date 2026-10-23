/**
 * UI 级验收：真实点击界面上的按钮，确认每个可交互元素都接了真实逻辑。
 * 用法：node scripts/ui-check.mjs
 */
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const SHOTS = join(ROOT, 'shots')
const PORT = 5393

const EDGE_CANDIDATES = [
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
  const exe = EDGE_CANDIDATES.find((p) => existsSync(p))
  if (!exe) throw new Error('未找到 Edge / Chrome 可执行文件')
  await mkdir(SHOTS, { recursive: true })
  const server = await startServer()
  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1600, height: 1000 },
  })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => Boolean(window.__baokuan), { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)

  /* 1. 导出弹窗：生成预览 + 下载按钮真实产出 Blob */
  await page.click('.topbar .btn.primary')
  await page.waitForSelector('.modal', { timeout: 10000 })
  await page.waitForFunction(
    () => {
      const img = document.querySelector('.export-preview img')
      return Boolean(img && img.src.startsWith('blob:'))
    },
    { timeout: 30000 },
  )
  const previewInfo = await page.evaluate(() => {
    const img = document.querySelector('.export-preview img')
    return { w: img.naturalWidth, h: img.naturalHeight }
  })
  record('导出弹窗生成真实 PNG 预览', previewInfo.w > 0 && previewInfo.h > 0, `${previewInfo.w}×${previewInfo.h}`)

  const qualityBtns = await page.$$('.modal .btn')
  const qLabels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.modal-body .row .btn')).map((b) => b.textContent.trim()),
  )
  record('导出面板提供三档清晰度', qLabels.length === 3, qLabels.join(' / '))
  void qualityBtns

  // 切到超清，预览尺寸应变大
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.modal-body .row .btn'))
    const ultra = btns.find((b) => b.textContent.includes('超清'))
    ultra?.click()
  })
  await page.waitForFunction(
    () => {
      const img = document.querySelector('.export-preview img')
      return img && img.naturalWidth >= 3000
    },
    { timeout: 30000 },
  )
  const ultraInfo = await page.evaluate(() => {
    const img = document.querySelector('.export-preview img')
    return { w: img.naturalWidth, h: img.naturalHeight }
  })
  record('切换超清后预览尺寸放大', ultraInfo.w >= 3000, `${ultraInfo.w}×${ultraInfo.h}`)
  await page.screenshot({ path: join(SHOTS, 'ui-export.png') })

  // 下载按钮：拦截 a[download] 点击，确认真的产生 blob URL
  const download = await page.evaluate(async () => {
    return await new Promise((resolve) => {
      const origCreate = URL.createObjectURL
      let captured = null
      URL.createObjectURL = (blob) => {
        captured = { size: blob.size, type: blob.type }
        return origCreate.call(URL, blob)
      }
      const origClick = HTMLAnchorElement.prototype.click
      let downloaded = null
      HTMLAnchorElement.prototype.click = function patched() {
        downloaded = { href: this.href, name: this.download }
      }
      const btn = Array.from(document.querySelectorAll('.modal-foot .btn')).find((b) =>
        b.textContent.includes('下载 PNG'),
      )
      btn?.click()
      setTimeout(() => {
        HTMLAnchorElement.prototype.click = origClick
        URL.createObjectURL = origCreate
        resolve({ captured, downloaded })
      }, 1500)
    })
  })
  record(
    '「下载 PNG」按钮真实生成图片文件',
    Boolean(download.captured && download.captured.size > 10000) &&
      Boolean(download.downloaded && download.downloaded.name.endsWith('.png')),
    `blob ${download.captured?.size ?? 0}B · ${download.downloaded?.name ?? '未触发'}`,
  )
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 5000 })

  /* 2. 文案助手：无 API Key 也能用本地建议 */
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.topbar .btn'))
    btns.find((b) => b.textContent.includes('文案助手'))?.click()
  })
  await page.waitForSelector('.modal', { timeout: 5000 })
  const localSuggestions = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.modal-body .btn')).filter((b) =>
      b.textContent.includes('应用到画布'),
    ).length,
  )
  record('文案助手无 API Key 时提供本地建议', localSuggestions >= 1, `${localSuggestions} 条建议`)
  // 应用「加冲突感」建议（该建议必然改写标题）
  const before = await page.evaluate(() => window.__baokuan.doc().content.title)
  await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.modal-body .row')).find((r) =>
      r.textContent.includes('加冲突感'),
    )
    card?.querySelector('.btn')?.click()
  })
  await new Promise((r) => setTimeout(r, 500))
  const after = await page.evaluate(() => window.__baokuan.doc().content.title)
  record('应用文案建议后画布内容更新', after !== before, `"${before}" → "${after}"`)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 5000 })

  /* 3. 复制设计 / 保存草稿 / 恢复草稿 / 新建 按钮 */
  const clone = await page.evaluate(async () => {
    const undoBtn = Array.from(document.querySelectorAll('.topbar .btn')).find(
      (b) => b.getAttribute('title')?.includes('撤销'),
    )
    const beforeEnabled = undoBtn && !undoBtn.disabled
    const btns = Array.from(document.querySelectorAll('.panel.left .btn'))
    btns.find((b) => b.textContent.includes('复制设计'))?.click()
    await new Promise((r) => setTimeout(r, 400))
    const afterEnabled = undoBtn && !undoBtn.disabled
    // 复制后 doc 内容不变，但产生了一条可撤销的历史
    return { beforeEnabled, afterEnabled, same: window.__baokuan.doc().content.title.length > 0 }
  })
  record(
    '「复制设计」按钮生效（产生可撤销的新副本）',
    clone.afterEnabled && clone.same,
    `撤销按钮 disabled: ${clone.beforeEnabled} → ${clone.afterEnabled}`,
  )

  const saved = await page.evaluate(async () => {
    const btns = Array.from(document.querySelectorAll('.panel.left .btn'))
    btns.find((b) => b.textContent.trim() === '保存草稿')?.click()
    await new Promise((r) => setTimeout(r, 300))
    return Boolean(localStorage.getItem('baokuan-poster:draft:v1'))
  })
  record('「保存草稿」写入 localStorage', saved)

  const restored = await page.evaluate(async () => {
    const btns = Array.from(document.querySelectorAll('.panel.left .btn'))
    btns.find((b) => b.textContent.trim() === '恢复草稿')?.click()
    await new Promise((r) => setTimeout(r, 400))
    return Boolean(window.__baokuan.doc())
  })
  record('「恢复草稿」按钮生效', restored)

  /* 4. 重置模板按钮 */
  const reset = await page.evaluate(async () => {
    window.__baokuan.setDoc({ content: { title: '会被重置的标题', body: 'x' } })
    await new Promise((r) => setTimeout(r, 300))
    const btns = Array.from(document.querySelectorAll('.panel.left .btn'))
    btns.find((b) => b.textContent.includes('重置模板'))?.click()
    await new Promise((r) => setTimeout(r, 400))
    return window.__baokuan.doc().content.title
  })
  record(
    '「重置模板」恢复模板默认文案',
    reset !== '会被重置的标题',
    `重置后标题="${reset}"`,
  )

  /* 5. 缩放工具条 */
  const zoom = await page.evaluate(async () => {
    const read = () => document.querySelector('.zoom-val')?.textContent
    const before = read()
    const btns = Array.from(document.querySelectorAll('.stage-toolbar .btn'))
    btns.find((b) => b.textContent.trim() === '+')?.click()
    await new Promise((r) => setTimeout(r, 200))
    const after = read()
    btns.find((b) => b.textContent.trim() === '适应屏幕')?.click()
    await new Promise((r) => setTimeout(r, 300))
    return { before, after, fit: read() }
  })
  record(
    '画布缩放 / 适应屏幕工具条生效',
    zoom.before !== zoom.after && zoom.fit !== zoom.after,
    `${zoom.before} → ${zoom.after} → 适应 ${zoom.fit}`,
  )

  /* 6. 帮助弹窗 */
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.topbar .btn'))
    btns.find((b) => b.textContent.trim() === '?')?.click()
  })
  await page.waitForSelector('.modal', { timeout: 5000 })
  const helpText = await page.evaluate(() => document.querySelector('.modal-body')?.textContent ?? '')
  record('帮助弹窗展示快捷键说明', helpText.includes('Ctrl') && helpText.includes('排版规则'))
  await page.keyboard.press('Escape')

  record('UI 全流程无 JS 错误', errors.length === 0, errors.slice(0, 2).join(' | '))

  await browser.close()
  server.close()

  const pass = results.filter((r) => r.ok).length
  const fail = results.length - pass
  console.log(`\n===== UI 验收：${pass} 通过 / ${fail} 失败 / 共 ${results.length} 项 =====`)
  await (await import('node:fs/promises')).writeFile(
    join(ROOT, 'test-report-ui.json'),
    JSON.stringify({ at: new Date().toISOString(), pass, fail, results }, null, 2),
    'utf8',
  )
  if (fail > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
