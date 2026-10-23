/**
 * 把 shots/ 里的大图压缩成 docs/assets 下适合放进 Git 仓库的 WebP。
 * 用法：node scripts/build-docs-images.mjs
 */
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readdir, mkdir, writeFile, stat } from 'node:fs/promises'
import { join, resolve, extname, basename } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SHOTS = join(ROOT, 'shots')
const OUT = join(ROOT, 'docs', 'assets')

const MAX_W = 1200
const QUALITY = 82

await mkdir(OUT, { recursive: true })

const files = (await readdir(SHOTS)).filter((f) => extname(f) === '.png')
let total = 0
for (const f of files) {
  const src = join(SHOTS, f)
  const img = await loadImage(await (await import('node:fs/promises')).readFile(src))
  const scale = Math.min(1, MAX_W / img.width)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const c = createCanvas(w, h)
  const g = c.getContext('2d')
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, 0, 0, w, h)
  const buf = await c.encode('webp', QUALITY)
  const name = basename(f, '.png') + '.webp'
  await writeFile(join(OUT, name), buf)
  const before = (await stat(src)).size
  total += buf.length
  console.log(
    `${f.padEnd(32)} ${img.width}x${img.height} → ${w}x${h}  ` +
      `${(before / 1024).toFixed(0)}KB → ${(buf.length / 1024).toFixed(0)}KB`,
  )
}
console.log(`\n共 ${files.length} 张，合计 ${(total / 1024 / 1024).toFixed(2)} MB`)
