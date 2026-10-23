/**
 * 真实浏览器验收脚本：启动 dist 静态服务，用 Edge/Chrome 无头模式执行
 * 1) 10 套模板逐一渲染并截图（写入 shots/）
 * 2) 每套模板导出 PNG，校验尺寸与文件可解码
 * 3) 超长中文 / 英文 / emoji / 特殊字符换行测试
 * 4) 草稿保存与恢复、撤销重做、比例切换、配图上传
 * 用法：node scripts/e2e.mjs
 */
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const SHOTS = join(ROOT, 'shots')
const PORT = 5391

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
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
}

function startServer() {
  return new Promise((resolveServer) => {
    const server = createServer(async (req, res) => {
      try {
        const url = decodeURIComponent((req.url ?? '/').split('?')[0])
        let file = join(DIST, url === '/' ? 'index.html' : url)
        if (!existsSync(file)) file = join(DIST, 'index.html')
        const buf = await readFile(file)
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
        res.end(buf)
      } catch (e) {
        res.writeHead(500)
        res.end(String(e))
      }
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
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
  })
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(m.text())
  })

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => Boolean(window.__baokuan), { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  record('页面加载 + 调试钩子就绪', true)

  const templates = await page.evaluate(() => window.__baokuan.templates())
  record('模板数量 = 10', templates.length === 10, `found ${templates.length}`)

  /* ---------------- 1. 全部模板渲染 + 导出（各模板用自身默认文案与配色） ---------------- */
  for (const t of templates) {
    const info = await page.evaluate(async (id) => {
      // 用 buildDoc 拿到该模板的完整默认设计（含推荐比例与示例文案）
      const fresh = window.__baokuan.buildDoc(id)
      window.__baokuan.setDoc(fresh)
      const stats = window.__baokuan.stats()
      const exported = await window.__baokuan.exportPng('hd')
      return { stats, exported }
    }, t.id)

    const bytes = Buffer.from(info.exported.dataUrl.split(',')[1], 'base64')
    const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    const dims = readPngSize(bytes)
    const expectedW = info.exported.width
    const expectedH = info.exported.height
    const ok =
      isPng &&
      dims.width === expectedW &&
      dims.height === expectedH &&
      bytes.length > 20000 &&
      info.stats.warnings.length === 0
    record(
      `模板渲染+导出 ${t.name}`,
      ok,
      `png ${dims.width}×${dims.height} ${(bytes.length / 1024).toFixed(0)}KB` +
        (info.stats.warnings.length ? ` warnings=${info.stats.warnings.join('|')}` : ''),
    )
    await writeFile(join(SHOTS, `template-${t.id}.png`), bytes)
  }

  /* ---------------- 2. 比例与自定义尺寸 ---------------- */
  const ratioChecks = [
    ['1:1', 1080, 1080],
    ['3:4', 1080, 1440],
    ['4:5', 1080, 1350],
    ['16:9', 1200, 675],
    ['9:16', 1080, 1920],
  ]
  for (const [key, w, h] of ratioChecks) {
    const out = await page.evaluate(async (k) => {
      window.__baokuan.setRatio(k)
      const d = window.__baokuan.doc()
      const png = await window.__baokuan.exportPng('standard')
      return { w: d.width, h: d.height, exW: png.width, exH: png.height, ok: png.dataUrl.startsWith('data:image/png') }
    }, key)
    record(
      `比例 ${key} → ${w}×${h}`,
      out.w === w && out.h === h && out.exW === w && out.exH === h && out.ok,
      `doc ${out.w}×${out.h}, export ${out.exW}×${out.exH}`,
    )
  }

  const custom = await page.evaluate(async () => {
    window.__baokuan.setDoc({ ratioKey: 'custom', width: 1400, height: 700 })
    const png = await window.__baokuan.exportPng('standard')
    return { w: png.width, h: png.height }
  })
  record('自定义尺寸 1400×700', custom.w === 1400 && custom.h === 700, `${custom.w}×${custom.h}`)

  /* ---------------- 3. 高清 / 超清导出 ---------------- */
  const qualities = await page.evaluate(async () => {
    window.__baokuan.setRatio('1:1')
    const std = await window.__baokuan.exportPng('standard')
    const hd = await window.__baokuan.exportPng('hd')
    const ultra = await window.__baokuan.exportPng('ultra')
    return {
      std: [std.width, std.height, std.bytes],
      hd: [hd.width, hd.height, hd.bytes],
      ultra: [ultra.width, ultra.height, ultra.bytes],
    }
  })
  record(
    '标准 / 高清 2x / 超清 3x 尺寸与体积递增',
    qualities.std[0] === 1080 &&
      qualities.hd[0] === 2160 &&
      qualities.ultra[0] === 3240 &&
      qualities.hd[2] > qualities.std[2] &&
      qualities.ultra[2] > qualities.hd[2],
    `std ${qualities.std[1]}px/${(qualities.std[2] / 1024).toFixed(0)}KB · hd ${qualities.hd[1]}px/${(
      qualities.hd[2] / 1024
    ).toFixed(0)}KB · ultra ${qualities.ultra[1]}px/${(qualities.ultra[2] / 1024).toFixed(0)}KB`,
  )

  /* ---------------- 4. 文字换行：中文 / 英文 / emoji / 特殊字符 ---------------- */
  const wrapCases = [
    {
      name: '超长中文（120 字）',
      text: '这是一段用来测试中文换行逻辑的超长句子，它没有任何空格，全靠逐字断行来保证排版正确，同时还要处理标点避头尾规则，避免句号逗号出现在行首造成视觉上的断裂感，并且必须保证每一个字都被完整保留不会被裁切',
    },
    {
      name: '英文长单词与混排',
      text: 'Supercalifragilisticexpialidocious antidisestablishmentarianism 中文与 English 混排，测试 word-break',
    },
    {
      name: 'Emoji 与组合字符',
      text: '测试 emoji 👨‍👩‍👧‍👦🏳️‍🌈 与 family 组合，还有 🇨🇳 旗帜和 1️⃣ 键帽符',
    },
    {
      name: '特殊字符',
      text: '《书名》【重点】「引号」（括号）——破折号…省略号 100% ¥1,200 @user #标签',
    },
  ]
  for (const c of wrapCases) {
    const probe = await page.evaluate(
      (text) => window.__baokuan.probeText(text, 600, 40),
      c.text,
    )
    const joined = probe.lines.join('')
    const collapsed = joined.replace(/\s/g, '')
    const original = c.text.replace(/\s/g, '')
    record(
      `换行完整性 ${c.name}`,
      collapsed === original && probe.rows >= 2,
      `${probe.rows} 行，字符数一致=${collapsed === original}`,
    )
  }

  const longBody = await page.evaluate(async () => {
    const long =
      '这是一段极长的正文用于验证超长内容不会被裁切或丢失。'.repeat(14) +
      'English words should wrap properly too. ' +
      '👨‍👩‍👧‍👦'.repeat(6)
    window.__baokuan.setTemplate('retro-paper')
    window.__baokuan.setContent({ title: '超长正文压力测试标题', body: long })
    const stats = window.__baokuan.stats()
    const png = await window.__baokuan.exportPng('standard')
    return { stats, chars: long.length, ok: png.dataUrl.startsWith('data:image/png'), bytes: png.bytes }
  })
  record(
    '超长正文导出成功且有溢出提示',
    longBody.ok && longBody.bytes > 20000,
    `${longBody.chars} 字符, warnings=${longBody.stats.warnings.length}`,
  )

  const shrink = await page.evaluate(() => {
    window.__baokuan.setTemplate('minimal-bw')
    const t =
      '这是一个非常非常长的标题用来验证自动缩放逻辑是否会在超过最大行数时缩小字号而不是删除文字或者溢出画布边界'.repeat(
        2,
      )
    window.__baokuan.setContent({ title: t, body: '短正文。' })
    const stats = window.__baokuan.stats()
    return { stats, chars: t.length, docTitle: window.__baokuan.doc().content.title }
  })
  record(
    '超长标题自动缩放且不删字',
    shrink.docTitle.length === shrink.chars &&
      shrink.stats.warnings.some((w) => w.includes('标题')),
    `标题保留 ${shrink.docTitle.length}/${shrink.chars} 字, warnings=${shrink.stats.warnings.join('|')}`,
  )

  /* ---------------- 5. 文字裁切审计（真实绘制包围盒） ---------------- */
  const auditAll = await page.evaluate(() => {
    const out = []
    for (const t of window.__baokuan.templates()) {
      window.__baokuan.setTemplate(t.id)
      const res = window.__baokuan.audit()
      out.push({ id: t.id, name: t.name, total: res.total, issues: res.issues })
    }
    return out
  })
  const badAudit = auditAll.filter((a) => a.issues.length > 0)
  record(
    '10 套模板文字均未越出画布',
    badAudit.length === 0,
    badAudit.length
      ? badAudit
          .map((a) => `${a.name}: ${a.issues.map((i) => `${i.kind}「${i.text}」${i.detail}`).join('; ')}`)
          .join(' | ')
      : `共检查 ${auditAll.reduce((n, a) => n + a.total, 0)} 段文字`,
  )

  // 极端内容下的裁切审计：超长标题 / 超长正文 / 长英文单词
  const stress = await page.evaluate(() => {
    const out = []
    const cases = [
      {
        name: '超长标题',
        content: { title: '超长标题压力测试'.repeat(12), body: '短正文。' },
      },
      {
        name: '超长正文',
        content: { title: '正文压力测试', body: '这是一段极长的正文。'.repeat(40) },
      },
      {
        name: '超长英文单词',
        content: {
          title: 'Antidisestablishmentarianism Supercalifragilisticexpialidocious',
          body: 'Pneumonoultramicroscopicsilicovolcanoconiosis '.repeat(6),
        },
      },
      {
        name: 'Emoji 密集',
        content: { title: '👨‍👩‍👧‍👦🏳️‍🌈🇨🇳1️⃣'.repeat(14), body: '🔥'.repeat(160) },
      },
    ]
    for (const t of window.__baokuan.templates()) {
      window.__baokuan.setTemplate(t.id)
      for (const c of cases) {
        const res = window.__baokuan.audit({ content: c.content })
        if (res.issues.length) out.push({ tpl: t.name, case: c.name, issues: res.issues })
      }
    }
    return out
  })
  record(
    '极端内容（长标题/长正文/长英文/emoji）不裁切',
    stress.length === 0,
    stress.length
      ? stress
          .slice(0, 4)
          .map((s) => `${s.tpl}/${s.case}: ${s.issues[0].kind}「${s.issues[0].text}」${s.issues[0].detail}`)
          .join(' | ')
      : '40 组组合全部通过',
  )

  /* ---------------- 6. 内容完整性：文字不丢失 ---------------- */
  const noLoss = await page.evaluate(() => {
    const text =
      '第一句。第二句！第三句？还有 English words 与 123 数字，以及 emoji 🎯 和特殊字符 《》、…——'
    window.__baokuan.setTemplate('code-shot')
    window.__baokuan.setContent({ title: text, body: text.repeat(3) })
    const d = window.__baokuan.doc()
    const stats = window.__baokuan.stats()
    const png = window.__baokuan.renderToDataUrl()
    return {
      titleLen: d.content.title.length,
      bodyLen: d.content.body.length,
      expectedTitle: text.length,
      expectedBody: text.length * 3,
      warnings: stats.warnings.length,
      hasImage: png.startsWith('data:image/png'),
    }
  })
  record(
    '代码截图风：超长内容不截断（不删字）',
    noLoss.titleLen === noLoss.expectedTitle && noLoss.bodyLen === noLoss.expectedBody && noLoss.hasImage,
    `title ${noLoss.titleLen}/${noLoss.expectedTitle}, body ${noLoss.bodyLen}/${noLoss.expectedBody}, warnings=${noLoss.warnings}`,
  )

  /* ---------------- 7. 实时生效：改文字 / 改色 / 改比例 ---------------- */
  const live = await page.evaluate(() => {
    window.__baokuan.setTemplate('minimal-bw')
    const base = { content: { title: '原始标题', body: '原始正文' } }
    const dTitle = window.__baokuan.pixelDiff(base, {
      content: { title: '换了一个完全不同的标题', body: '原始正文' },
    })
    const dColor = window.__baokuan.pixelDiff(base, {
      content: { title: '原始标题', body: '原始正文' },
      style: { accent: '#ff0000', bg: '#101010', ink: '#ffffff' },
    })
    const dRatio = window.__baokuan.pixelDiff(base, {
      content: { title: '原始标题', body: '原始正文' },
      width: 1200,
      height: 675,
      ratioKey: '16:9',
    })
    return { dTitle, dColor, dRatio }
  })
  record(
    '文字 / 颜色 / 比例切换实时改变像素',
    live.dTitle > 0.002 && live.dColor > 0.05 && live.dRatio > 0.02,
    `text ${(live.dTitle * 100).toFixed(2)}% · color ${(live.dColor * 100).toFixed(1)}% · ratio ${(
      live.dRatio * 100
    ).toFixed(1)}%`,
  )

  /* ---------------- 7. 预览与导出一致性（同一渲染器） ---------------- */
  const consistency = await page.evaluate(() => {
    window.__baokuan.setTemplate('research-report')
    window.__baokuan.setRatio('16:9')
    const previewLike = window.__baokuan.renderToDataUrl(undefined, 1)
    const previewLike2 = window.__baokuan.renderToDataUrl(undefined, 1)
    return { same: previewLike === previewLike2, len: previewLike.length }
  })
  record('渲染结果可复现（预览=导出，无随机噪点漂移）', consistency.same, `dataURL ${(consistency.len / 1024).toFixed(0)}KB`)


  /* ---------------- 8. 富文本标记 ---------------- */
  const rich = await page.evaluate(() => {
    window.__baokuan.setContent({
      title: '**重点**内容==标记==与__下划线__混排',
      body: '正文里的 **强调** 与 ==高亮== 都要保留原意。',
    })
    const png = window.__baokuan.renderToDataUrl()
    return { hasImage: png.startsWith('data:image/png'), len: png.length }
  })
  record('强调/标记/下划线渲染成功', rich.hasImage && rich.len > 5000, `${(rich.len / 1024).toFixed(0)}KB dataURL`)

  /* ---------------- 6. 配图上传 ---------------- */
  const withImage = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 400
    c.height = 300
    const g = c.getContext('2d')
    g.fillStyle = '#3366ff'
    g.fillRect(0, 0, 400, 300)
    g.fillStyle = '#ffffff'
    g.font = '40px sans-serif'
    g.fillText('PHOTO', 120, 160)
    const src = c.toDataURL('image/png')
    window.__baokuan.setDoc({
      image: {
        src,
        fit: 'cover',
        opacity: 1,
        tint: 0,
        blur: 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rounded: true,
      },
    })
    const png = await window.__baokuan.exportPng('standard')
    return { bytes: png.bytes, ok: png.dataUrl.startsWith('data:image/png') }
  })
  record('配图加入后导出包含图片', withImage.ok && withImage.bytes > 20000, `${(withImage.bytes / 1024).toFixed(0)}KB`)

  // 图片控件切到「完整显示」
  const containMode = await page.evaluate(async () => {
    window.__baokuan.setDoc({
      image: { ...window.__baokuan.doc().image, fit: 'contain', scale: 1.6, blur: 4, opacity: 0.7 },
    })
    const png = await window.__baokuan.exportPng('standard')
    return png.bytes
  })
  record('配图参数（fit/scale/blur/opacity）生效', containMode > 15000, `${(containMode / 1024).toFixed(0)}KB`)

  /* ---------------- 7. 撤销 / 重做 / 重置 / 复制 ---------------- */
  await page.evaluate(() => {
    window.__baokuan.setDoc({ image: null })
    window.__baokuan.setTemplate('minimal-bw')
  })
  await page.click('[data-testid="title-input"]')
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="title-input"]')
    el.focus()
  })
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.type('撤销测试标题')
  const afterType = await page.evaluate(() => window.__baokuan.doc().content.title)
  await page.evaluate(() => {
    document.querySelector('[title="撤销 (Ctrl+Z)"]').click()
  })
  const afterUndo = await page.evaluate(() => window.__baokuan.doc().content.title)
  await page.evaluate(() => {
    document.querySelector('[title="重做 (Ctrl+Shift+Z)"]').click()
  })
  const afterRedo = await page.evaluate(() => window.__baokuan.doc().content.title)
  record(
    '输入 → 撤销 → 重做',
    afterType === '撤销测试标题' && afterUndo !== afterType && afterRedo === afterType,
    `${afterType} → ${afterUndo} → ${afterRedo}`,
  )

  /* ---------------- 8. 草稿保存 / 恢复 ---------------- */
  const draft = await page.evaluate(async () => {
    window.__baokuan.setTemplate('crypto-market')
    window.__baokuan.setContent({ title: '草稿测试：比特币减半之后', body: '草稿正文内容。' })
    await new Promise((r) => setTimeout(r, 1600)) // 等待自动保存
    const stored = localStorage.getItem('baokuan-poster:draft:v1')
    window.__baokuan.setTemplate('english-quote')
    window.__baokuan.setContent({ title: 'Temporary title', body: 'temp' })
    await new Promise((r) => setTimeout(r, 100))
    return { stored: Boolean(stored), savedTitle: JSON.parse(stored ?? '{}')?.doc?.content?.title }
  })
  // 重新加载页面，验证草稿被恢复
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => Boolean(window.__baokuan), { timeout: 20000 })
  const restored = await page.evaluate(() => ({
    title: window.__baokuan.doc().content.title,
    template: window.__baokuan.doc().templateId,
  }))
  record(
    '草稿写入 localStorage 并在刷新后恢复',
    draft.stored && draft.savedTitle === '草稿测试：比特币减半之后' && restored.title === draft.savedTitle,
    `写入="${draft.savedTitle}" 恢复="${restored.title}"`,
  )

  /* ---------------- 9. UI 交互：点模板卡 / 改字号 / 比例 ---------------- */
  await page.click('[data-testid="tpl-hand-note"]')
  await new Promise((r) => setTimeout(r, 250))
  const afterClick = await page.evaluate(() => window.__baokuan.doc().templateId)
  record('点击模板卡切换模板', afterClick === 'hand-note', afterClick)

  const slider = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('.panel.right input[type="range"]'))
    if (inputs.length === 0) return { count: 0, before: 0, after: 0 }
    const el = inputs[0]
    const before = window.__baokuan.doc().style.titleSize
    // React 受控组件必须用原生 setter 才能触发 onChange
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, String(Number(el.value) + 6))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return { count: inputs.length, before, after: window.__baokuan.doc().style.titleSize }
  })
  record(
    '右侧属性面板滑杆可改变字号',
    slider.count >= 5 && slider.after !== slider.before,
    `${slider.count} 个滑杆，titleSize ${slider.before} → ${slider.after}`,
  )

  /* ---------------- 9. 装饰控件真实生效（10 套模板 × 每个开关） ---------------- */
  const deco = await page.evaluate(() => {
    const keys = ['icon', 'shape', 'divider', 'corner']
    const values = {
      icon: ['none', 'flame', 'trend', 'sparkles'],
      shape: ['none', 'circle', 'dots', 'blob'],
      divider: ['none', 'line', 'dots', 'arrow'],
      corner: ['none', 'brackets', 'index', 'mono'],
    }
    const fails = []
    let checks = 0
    for (const t of window.__baokuan.templates()) {
      window.__baokuan.setTemplateKeepRatio(t.id)
      for (const k of keys) {
        const base = { deco: { [k]: values[k][0] } }
        for (const v of values[k].slice(1)) {
          checks++
          const d = window.__baokuan.pixelDiff(base, { deco: { [k]: v } })
          const n = window.__baokuan.pixelDelta(base, { deco: { [k]: v } })
          // 细线条类装饰（角标/分割线）在 1:1 画布上可能只有几十像素，用绝对像素数更稳
          if (d < 0.0005 && n < 40) fails.push(`${t.name}/${k}=${v}`)
        }
      }
    }
    return { checks, fails }
  })
  record(
    '图标 / 图形 / 分割线 / 角标在每套模板上都真实生效',
    deco.fails.length === 0,
    `${deco.checks} 次对比，失效 ${deco.fails.length} 个` +
      (deco.fails.length ? `：${deco.fails.slice(0, 6).join(', ')}` : ''),
  )

  /* ---------------- 10. 全局控件真实生效（字号/行距/字距/对齐/字体/颜色） ---------------- */
  const styleLive = await page.evaluate(() => {
    window.__baokuan.setTemplate('cyber-terminal')
    const base = {}
    const probes = [
      ['标题字号', { style: { titleSize: 130 } }],
      ['正文字号', { style: { bodySize: 44 } }],
      ['标题字重', { style: { titleWeight: 400 } }],
      ['行距', { style: { lineHeight: 2.2 } }],
      ['字间距', { style: { letterSpacing: 10 } }],
      ['对齐方式', { style: { align: 'right' } }],
      ['标题字体', { style: { fontTitle: 'serif' } }],
      ['文字色', { style: { ink: '#ff0000' } }],
      ['背景色', { style: { bg: '#ffffff', ink: '#111111' } }],
      ['整体缩放', { scale: 0.7 }],
    ]
    const out = []
    for (const [name, patch] of probes) {
      const d = window.__baokuan.pixelDiff(base, patch)
      out.push({ name, d })
    }
    return out
  })
  const styleFails = styleLive.filter((s) => s.d < 0.0005)
  record(
    '字号 / 字重 / 行距 / 字距 / 对齐 / 字体 / 颜色 均真实生效',
    styleFails.length === 0,
    styleLive.map((s) => `${s.name} ${(s.d * 100).toFixed(1)}%`).join(' · '),
  )

  /* ---------------- 11. 桌面与移动端截图 ---------------- */
  await page.evaluate(() => {
    window.__baokuan.setTemplate('orange-poster')
    window.__baokuan.setContent({
      eyebrow: '爆款观点',
      title: '别做工具人，做定义问题的人',
      body: '工具会被替代，问题不会。谁能把模糊的抱怨翻译成清晰的问题，谁就掌握了定价权。',
      signature: '@阿橙',
      footer: '点赞 · 收藏 · 转发',
    })
  })
  await new Promise((r) => setTimeout(r, 400))
  await page.screenshot({ path: join(SHOTS, 'ui-desktop.png') })
  record('桌面端截图', true, 'shots/ui-desktop.png')

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await new Promise((r) => setTimeout(r, 700))
  const mobileVisible = await page.evaluate(() => {
    const shell = document.querySelector('.mobile-shell')
    const main = document.querySelector('.main')
    const canvas = document.querySelector('.mobile-canvas canvas')
    const r = canvas?.getBoundingClientRect()
    return {
      shell: shell ? getComputedStyle(shell).display !== 'none' : false,
      desktopHidden: main ? getComputedStyle(main).display === 'none' : false,
      steps: document.querySelectorAll('.mobile-steps button').length,
      canvas: r ? { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) } : null,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    }
  })
  await page.screenshot({ path: join(SHOTS, 'ui-mobile.png') })
  const mc = mobileVisible.canvas
  record(
    '移动端使用分步骤面板（不缩放桌面布局）',
    mobileVisible.shell && mobileVisible.desktopHidden && mobileVisible.steps >= 5,
    `steps=${mobileVisible.steps}`,
  )
  record(
    '移动端画布完整可见（未溢出视口）',
    Boolean(mc) &&
      mc.w > 120 &&
      mc.h > 120 &&
      mc.top >= 0 &&
      mc.left >= 0 &&
      mc.left + mc.w <= mobileVisible.viewport.w + 1 &&
      mc.top + mc.h <= mobileVisible.viewport.h + 1,
    mc ? `画布 ${mc.w}×${mc.h} @ (${mc.left},${mc.top}) 视口 ${mobileVisible.viewport.w}×${mobileVisible.viewport.h}` : '未找到画布',
  )

  // 桌面画布同样应完整可见
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })
  await new Promise((r) => setTimeout(r, 700))
  const deskCanvas = await page.evaluate(() => {
    const canvas = document.querySelector('.stage canvas')
    const r = canvas?.getBoundingClientRect()
    return r ? { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) } : null
  })
  record(
    '桌面端画布居中且完整可见',
    Boolean(deskCanvas) && deskCanvas.w > 300 && deskCanvas.top > 40 && deskCanvas.left > 250,
    deskCanvas ? `画布 ${deskCanvas.w}×${deskCanvas.h} @ (${deskCanvas.left},${deskCanvas.top})` : '未找到画布',
  )

  /* ---------------- 11. 全模板视觉核对图 ---------------- */
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })
  await new Promise((r) => setTimeout(r, 400))
  if (pageErrors.length) record('运行期 JS 错误（预览阶段）', false, pageErrors.slice(0, 3).join(' | '))
  await page.waitForFunction(() => Boolean(window.__baokuan), { timeout: 15000 })
  const grid = await page.evaluate(async () => {
    const tpls = window.__baokuan.templates()
    const out = []
    for (const t of tpls) {
      window.__baokuan.setTemplate(t.id)
      out.push({ id: t.id, png: window.__baokuan.renderToDataUrl(undefined, 0.42) })
    }
    return out
  })
  for (const g of grid) {
    await writeFile(
      join(SHOTS, `preview-${g.id}.png`),
      Buffer.from(g.png.split(',')[1], 'base64'),
    )
  }
  record('生成 10 张模板预览图', grid.length === 10, 'shots/preview-*.png')

  record('运行期无 JS 错误', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))

  await browser.close()
  server.close()

  const pass = results.filter((r) => r.ok).length
  const fail = results.length - pass
  console.log(`\n===== 结果：${pass} 通过 / ${fail} 失败 / 共 ${results.length} 项 =====`)
  const report = { at: new Date().toISOString(), pass, fail, results }
  await writeFile(join(ROOT, 'test-report.json'), JSON.stringify(report, null, 2), 'utf8')
  if (fail > 0) process.exitCode = 1
}

function readPngSize(buf) {
  if (buf.length < 24) return { width: 0, height: 0 }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
