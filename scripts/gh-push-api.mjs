/**
 * 用 GitHub Contents API 提交文件（当 git push 因网络不可用时作为兜底）。
 * 用法：node scripts/gh-push-api.mjs <token> <owner/repo> <branch> <path...>
 */

import { readFile } from 'node:fs/promises'
import { request } from 'node:https'
import { join, resolve } from 'node:path'

const [, , TOKEN, REPO, BRANCH = 'main', ...PATHS] = process.argv
if (!TOKEN || !REPO || PATHS.length === 0) {
  console.error('用法：node scripts/gh-push-api.mjs <token> <owner/repo> <branch> <path...>')
  process.exit(1)
}

const ROOT = resolve(import.meta.dirname, '..')

function api(method, path, body) {
  return new Promise((res, rej) => {
    const payload = body ? JSON.stringify(body) : null
    const req = request(
      {
        hostname: 'api.github.com',
        path,
        method,
        rejectUnauthorized: false,
        headers: {
          'User-Agent': 'baokuan-poster-push',
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (r) => {
        let d = ''
        r.on('data', (c) => (d += c))
        r.on('end', () => {
          if (r.statusCode >= 200 && r.statusCode < 300) res(d ? JSON.parse(d) : {})
          else rej(new Error(`${method} ${path} → ${r.statusCode} ${d.slice(0, 300)}`))
        })
      },
    )
    req.on('error', rej)
    if (payload) req.write(payload)
    req.end()
  })
}

const [owner, name] = REPO.split('/')
let failed = 0

for (const rel of PATHS) {
  const abs = join(ROOT, rel)
  const content = await readFile(abs)
  const b64 = content.toString('base64')
  const apiPath = `/repos/${owner}/${name}/contents/${rel}`

  // 取当前 sha（存在则更新，不存在则新建）
  let sha = null
  try {
    const cur = await api('GET', `${apiPath}?ref=${BRANCH}`)
    sha = cur.sha
  } catch {
    sha = null
  }

  try {
    const out = await api('PUT', apiPath, {
      message: `更新 ${rel}`,
      content: b64,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    })
    console.log(`OK   ${rel}  → ${out.commit.sha.slice(0, 7)}`)
  } catch (e) {
    failed++
    console.error(`FAIL ${rel}  ${e.message}`)
  }
}

if (failed > 0) process.exitCode = 1
