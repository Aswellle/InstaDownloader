#!/usr/bin/env node
/**
 * 准备随应用分发的内置 Python 运行时。
 *
 * 普通用户不应为了使用一个桌面下载工具而先安装 Python 开发环境。
 * 本脚本把 python-build-standalone 的 install_only_stripped 独立运行时
 * 下载、校验、裁剪后放置到 python-runtime/<flavor>/，electron-builder
 * 的 afterPack 钩子（scripts/electron-after-pack.cjs）再按目标平台架构
 * 复制进安装包 resources/python/。
 *
 * 网络考量：默认优先走 npmmirror 镜像，失败回退 GitHub Releases；
 * 可用 PB_RUNTIME_URLS 覆盖（逗号分隔，每项是包含 SHA256SUMS 与压缩包
 * 的目录 URL）。设 INSTADOWN_NO_BUNDLED_PYTHON=1 可完全跳过（打包将
 * 回退到系统 Python，不作为发行途径）。
 *
 * 使用：
 *   node scripts/prepare-python-runtime.mjs          # 当前主机（darwin 下载 arm64+x64 两种）
 *   node scripts/prepare-python-runtime.mjs --force  # 忽略缓存重新下载
 *
 * 版本钉在本文件与 src/main/services/python-runtime.ts 的
 * BUNDLED_PY_VERSION / BUNDLED_PY_TAG 两处，tests/unit/python-runtime.test.ts
 * 会校验两处一致。
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'

export const PY_VERSION = '3.12.15'
export const PY_TAG = '20261021'

const FILE = `cpython-${PY_VERSION}+${PY_TAG}-{triple}-install_only_stripped.tar.gz`

/** 主机平台/架构 → 上游 triple。 */
const TRIPLES = {
  'win32-x64': 'x86_64-pc-windows-msvc',
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu'
}

const SOURCES = (process.env.PB_RUNTIME_URLS || '')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean)

if (SOURCES.length === 0) {
  SOURCES.push(
    'https://registry.npmmirror.com/-/binary/python-build-standalone',
    'https://github.com/astral-sh/python-build-standalone/releases/download'
  )
}

/** 裁剪：解析 worker 用不到、却占体积的部分。条目不存在时静默跳过。 */
function prune(root) {
  const majorminor = PY_VERSION.slice(0, PY_VERSION.lastIndexOf('.'))
  const libDir =
    process.platform === 'win32' ? join(root, 'Lib') : join(root, 'lib', `python${majorminor}`)

  if (existsSync(libDir)) {
    for (const name of ['test', 'idlelib', 'lib2to3', 'tkinter', 'turtledemo', 'ensurepip', 'site-packages', '__phello__']) {
      rmSync(join(libDir, name), { recursive: true, force: true })
    }
    if (process.platform !== 'win32') {
      for (const name of readdirSync(libDir)) {
        if (name.startsWith('config-')) rmSync(join(libDir, name), { recursive: true, force: true })
      }
    }
  }

  if (process.platform === 'win32') {
    // libs/ 是给第三方扩展编译用的导入库；*.pdb 是调试符号
    for (const name of ['libs', 'Scripts', 'Tools', 'include']) {
      rmSync(join(root, name), { recursive: true, force: true })
    }
    rmPdb(root)
  } else {
    for (const rel of ['include', 'share/man', 'share/doc', 'lib/pkgconfig']) {
      rmSync(join(root, ...rel.split('/')), { recursive: true, force: true })
    }
    const bin = join(root, 'bin')
    if (existsSync(bin)) {
      for (const name of readdirSync(bin)) {
        if (/^(idle|pydoc|2to3)/.test(name) || name.endsWith('-config')) rmSync(join(bin, name), { force: true })
      }
    }
    const lib = join(root, 'lib')
    if (existsSync(lib)) {
      for (const name of readdirSync(lib)) {
        if (name.endsWith('.a')) rmSync(join(lib, name), { force: true })
      }
    }
  }
}

function rmPdb(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) rmPdb(p)
    else if (name.endsWith('.pdb')) rmSync(p, { force: true })
  }
}

function dirSize(dir) {
  let total = 0
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      const st = statSync(p)
      if (st.isDirectory()) walk(p)
      else total += st.size
    }
  }
  walk(dir)
  return total
}

async function fetchBuffer(url, { binary = false } = {}) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(600_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return binary ? buf : buf.toString('utf8')
}

async function downloadVerified(tag, filename) {
  const sumsPerSource = new Map()
  const errors = []
  for (const base of SOURCES) {
    const url = `${base}/${tag}/${filename}`
    try {
      if (!sumsPerSource.has(base)) {
        sumsPerSource.set(base, await fetchBuffer(`${base}/${tag}/SHA256SUMS`))
      }
      const line = sumsPerSource.get(base).split('\n').find((l) => l.trimEnd().endsWith(filename))
      if (!line) throw new Error('SHA256SUMS has no entry for ' + filename)
      const expected = line.trim().split(/\s+/)[0].toLowerCase()

      const buf = await fetchBuffer(url, { binary: true })
      const actual = createHash('sha256').update(buf).digest('hex')
      if (actual !== expected) throw new Error(`sha256 mismatch: expected ${expected}, got ${actual}`)
      return buf
    } catch (e) {
      errors.push(`${base}: ${e.message}`)
    }
  }
  throw new Error(
    `无法下载 ${filename}（所有源都失败）：\n  ${errors.join('\n  ')}\n` +
      '可设置 PB_RUNTIME_URLS=<目录URL> 指定镜像；或 INSTADOWN_NO_BUNDLED_PYTHON=1 跳过内置运行时。'
  )
}

/** 解压 install_only 压缩包（顶层为 python/ 目录），内容上移到 destDir。 */
function extractTarGz(buf, destDir) {
  const tmpTar = join(destDir, 'runtime.tar.gz')
  writeFileSync(tmpTar, buf)
  // cwd 切到目标目录用相对文件名：GNU tar 会把 "D:\..." 解析成 host:path
  // （"Cannot connect to D: resolve failed"），相对路径绕开这个坑
  const r = spawnSync('tar', ['-xzf', 'runtime.tar.gz'], { stdio: 'pipe', cwd: destDir })
  rmSync(tmpTar, { force: true })
  if (r.status !== 0) throw new Error(`tar extract failed: ${String(r.stderr || r.status)}`)
  const inner = join(destDir, 'python')
  if (!existsSync(inner)) throw new Error('unexpected archive layout: missing python/')
  for (const name of readdirSync(inner)) {
    const from = join(inner, name)
    const to = join(destDir, name)
    try {
      renameSync(from, to)
    } catch {
      cpSync(from, to, { recursive: true })
      rmSync(from, { recursive: true, force: true })
    }
  }
  rmSync(inner, { recursive: true, force: true })
}

async function prepare(flavor, force) {
  const root = resolve('python-runtime')
  const target = join(root, flavor)
  const marker = join(target, '.runtime-ok')
  if (!force && existsSync(marker)) {
    try {
      const m = JSON.parse(readFileSync(marker, 'utf8'))
      if (m.python === PY_VERSION && m.tag === PY_TAG) {
        console.log(`[python-runtime] ${flavor}: 已就绪（${m.python}, 缓存命中）`)
        return
      }
    } catch {
      /* 标记损坏则重新准备 */
    }
  }
  const triple = TRIPLES[flavor]
  if (!triple) throw new Error(`unknown flavor: ${flavor}`)
  const filename = FILE.replace('{triple}', triple)
  console.log(`[python-runtime] ${flavor}: 下载 ${filename} …`)
  const buf = await downloadVerified(PY_TAG, filename)
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  extractTarGz(buf, target)
  prune(target)
  writeFileSync(
    marker,
    JSON.stringify({ python: PY_VERSION, tag: PY_TAG, triple, flavor, createdAt: new Date().toISOString() }, null, 2)
  )
  console.log(`[python-runtime] ${flavor}: 就绪，${(dirSize(target) / 1048576).toFixed(1)} MB → ${target}`)
}

async function main() {
  const force = process.argv.includes('--force')
  let flavors
  const flavorArgIdx = process.argv.indexOf('--flavor')
  if (flavorArgIdx > 0) {
    flavors = [process.argv[flavorArgIdx + 1]]
  } else if (process.platform === 'darwin') {
    // macOS 的 dmg 同时构建 arm64 与 x64 两个安装包，两种运行时都要备好
    flavors = ['darwin-arm64', 'darwin-x64']
  } else {
    flavors = [`${process.platform}-${process.arch}`]
  }

  for (const f of flavors) {
    if (!TRIPLES[f]) {
      console.warn(`[python-runtime] 平台 ${f} 暂无内置运行时定义，跳过（运行时回退系统 Python）`)
      continue
    }
    await prepare(f, force)
  }
}

main().catch((e) => {
  console.error('[python-runtime] 失败:', e.message)
  process.exit(1)
})
