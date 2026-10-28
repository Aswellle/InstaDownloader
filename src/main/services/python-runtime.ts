import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PythonStatus } from '@shared/types'

/**
 * Python 解释器解析（docs/02 三进程架构的 worker 装配前置）。
 *
 * 解析优先级：
 *   1. INSTADOWN_PYTHON 环境变量（开发者显式钉住解释器）
 *   2. 内置运行时 —— 打包产物 resources/python/（electron-builder 的
 *      afterPack 钩子从 python-runtime/<flavor>/ 复制），开发态回退
 *      APP_ROOT/python-runtime/<flavor>/（scripts/prepare-python-runtime.mjs）
 *   3. 系统 python / python3 / py -3
 *
 * 内置运行时是普通用户开箱即用的一部分：安装包自带独立 CPython
 * （python-build-standalone 的 install_only_stripped 构建），不写入
 * 系统、不需要用户安装任何开发环境。
 *
 * 版本钉在这里与 scripts/prepare-python-runtime.mjs 两处，
 * tests/unit/python-runtime.test.ts 校验一致性。3.12 的安全维护
 * 到 2028-10，期限内无需被动升级。
 */

/** 内置运行时的 CPython 版本（与 scripts/prepare-python-runtime.mjs 同步） */
export const BUNDLED_PY_VERSION = '3.12.15'
/** python-build-standalone 的构建 tag（与脚本同步） */
export const BUNDLED_PY_TAG = '20261021'

/** worker 兼容的最低 Python 版本（worker/*.py 按此基线编写） */
export const MIN_PY = [3, 11]

/** 探测脚本：打印 major.minor 并按版本门槛退出（py2/旧版会非零退出） */
export const PYTHON_PROBE_CODE =
  'import sys; print("{}.{}".format(*sys.version_info)); sys.exit(0 if sys.version_info >= (3, 11) else 1)'

/** flavor → 解释器在运行时目录内的相对路径 */
export function interpreterRelPath(platform: NodeJS.Platform = process.platform): string | null {
  if (platform === 'win32') return 'python.exe'
  if (platform === 'darwin' || platform === 'linux') return join('bin', 'python3')
  return null
}

/** 主机平台/架构 → 运行时 flavor（与 prepare 脚本、上游 triple 一一对应） */
export function flavorFor(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string | null {
  if (platform === 'win32' && arch === 'x64') return 'win32-x64'
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64'
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64'
  if (platform === 'linux' && arch === 'x64') return 'linux-x64'
  return null
}

/** 内置运行时的候选解释器路径（打包 resources / 开发 python-runtime 两处）。 */
export function bundledCandidates(opts?: {
  resourcesPath?: string
  appRoot?: string
  platform?: NodeJS.Platform
  arch?: string
}): Array<{ exe: string; origin: 'packaged' | 'dev' }> {
  const platform = opts?.platform ?? process.platform
  const arch = opts?.arch ?? process.arch
  const rel = interpreterRelPath(platform)
  const flavor = flavorFor(platform, arch)
  if (!rel || !flavor) return []
  const out: Array<{ exe: string; origin: 'packaged' | 'dev' }> = []
  if (opts?.resourcesPath) out.push({ exe: join(opts.resourcesPath, 'python', rel), origin: 'packaged' })
  if (opts?.appRoot) out.push({ exe: join(opts.appRoot, 'python-runtime', flavor, rel), origin: 'dev' })
  return out
}

/** 内置运行时的启动参数：忽略用户环境变量与用户 site-packages。
 *  -E 隔离 PYTHONPATH/PYTHONHOME（用户环境里的路径不该污染内置 stdlib），
 *  -s 跳过用户 site-packages；不使用 -I/-P —— 那会去掉脚本目录的 sys.path
 *  前缀（-I 隐含 -P），而 worker 需要导入同目录模块。 */
export function argsForBundled(): string[] {
  return ['-E', '-s']
}

/** 解析探测结果（纯函数，供测试）。 */
export function parseProbeResult(code: number | null, stdout: string): { ok: boolean; version: string | null } {
  const m = stdout.trim().match(/^(\d+)\.(\d+)/m)
  const version = m ? `${m[1]}.${m[2]}` : null
  return { ok: code === 0 && !!version, version }
}

/** 运行一次解释器探测（不抛异常：失败以 ok:false 表达）。 */
export function probePython(
  cmd: string,
  args: string[],
  timeoutMs = 5000
): Promise<{ ok: boolean; version: string | null }> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(cmd, [...args, '-c', PYTHON_PROBE_CODE], { windowsHide: true })
    } catch {
      return resolve({ ok: false, version: null })
    }
    let out = ''
    let settled = false
    const done = (code: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(parseProbeResult(code, out))
    }
    const timer = setTimeout(() => {
      child.kill()
      done(null)
    }, timeoutMs)
    child.on('error', () => done(null))
    child.stdout?.on('data', (d: Buffer) => (out += d.toString()))
    child.on('close', (code) => done(code))
    // 子进程立刻退出时写入端可能 EPIPE：无监听的 error 会击穿主进程
    child.stdin?.on('error', () => {})
    child.stdin?.end('\n')
  })
}

export interface PythonCommand {
  cmd: string
  args: string[]
  source: 'bundled' | 'env' | 'system'
  version: string | null
}

/** 找一个可用的解释器；找不到抛 E_WORKER_DOWN（附原因，供 UI 指引）。 */
export async function findPython(opts?: {
  resourcesPath?: string
  appRoot?: string
}): Promise<PythonCommand> {
  // 1. 环境变量（探测失败不硬失败：钉住的路径可能只是暂时错了，
  //    继续走内置/系统候选更稳）
  const envPy = process.env.INSTADOWN_PYTHON
  if (envPy && existsSync(envPy)) {
    const r = await probePython(envPy, [])
    if (r.ok) return { cmd: envPy, args: [], source: 'env', version: r.version }
  }

  // 2. 内置运行时
  for (const c of bundledCandidates(opts)) {
    if (!existsSync(c.exe)) continue
    const r = await probePython(c.exe, argsForBundled())
    if (r.ok) return { cmd: c.exe, args: argsForBundled(), source: 'bundled', version: r.version }
  }

  // 3. 系统 Python
  const candidates: Array<[string, string[]]> = [
    ['python', []],
    ['python3', []],
    ['py', ['-3']]
  ]
  let sawOldVersion = false
  for (const [cmd, args] of candidates) {
    const r = await probePython(cmd, args)
    if (r.ok) return { cmd, args, source: 'system', version: r.version }
    if (r.version) sawOldVersion = true
  }

  throw Object.assign(
    new Error(
      sawOldVersion
        ? `python >= ${MIN_PY.join('.')} required (found older)`
        : 'python not found'
    ),
    { code: 'E_WORKER_DOWN' }
  )
}

/** 只探测不落定：给 UI 的运行环境状态（worker:python 通道）。 */
export async function inspectPython(opts?: {
  resourcesPath?: string
  appRoot?: string
}): Promise<PythonStatus> {
  try {
    const found = await findPython(opts)
    return {
      available: true,
      source: found.source,
      version: found.version,
      command: found.cmd,
      reason: null
    }
  } catch (e) {
    const msg = (e as Error).message ?? ''
    return {
      available: false,
      source: null,
      version: null,
      command: null,
      reason: msg.includes('required') ? 'version' : 'missing'
    }
  }
}
