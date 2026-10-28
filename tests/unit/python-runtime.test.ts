import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  argsForBundled,
  BUNDLED_PY_TAG,
  BUNDLED_PY_VERSION,
  bundledCandidates,
  flavorFor,
  interpreterRelPath,
  parseProbeResult,
  PYTHON_PROBE_CODE,
  probePython
} from '../../src/main/services/python-runtime'

describe('bundled python runtime contract', () => {
  it('版本在 prepare 脚本与主进程解析器两处一致', () => {
    const script = readFileSync(
      join(__dirname, '../../scripts/prepare-python-runtime.mjs'),
      'utf8'
    )
    expect(script).toContain(`PY_VERSION = '${BUNDLED_PY_VERSION}'`)
    expect(script).toContain(`PY_TAG = '${BUNDLED_PY_TAG}'`)
  })

  it('版本是 3.12 稳定线（安全维护到 2028-10，长期可用）', () => {
    expect(BUNDLED_PY_VERSION.startsWith('3.12.')).toBe(true)
    expect(BUNDLED_PY_TAG).toMatch(/^\d{8}$/)
  })
})

describe('flavorFor / interpreterRelPath', () => {
  it('四个受支持的平台/架构映射到上游 triple 对应的 flavor', () => {
    expect(flavorFor('win32', 'x64')).toBe('win32-x64')
    expect(flavorFor('darwin', 'arm64')).toBe('darwin-arm64')
    expect(flavorFor('darwin', 'x64')).toBe('darwin-x64')
    expect(flavorFor('linux', 'x64')).toBe('linux-x64')
  })

  it('未支持平台返回 null（回退系统 Python）', () => {
    expect(flavorFor('linux', 'arm64')).toBeNull()
    expect(flavorFor('freebsd', 'x64')).toBeNull()
  })

  it('解释器相对路径按平台区分', () => {
    expect(interpreterRelPath('win32')).toBe('python.exe')
    expect(interpreterRelPath('darwin')).toBe(join('bin', 'python3'))
    expect(interpreterRelPath('linux')).toBe(join('bin', 'python3'))
    expect(interpreterRelPath('sunos')).toBeNull()
  })
})

describe('bundledCandidates', () => {
  it('打包态给 resources/python，开发态给 python-runtime/<flavor>', () => {
    const out = bundledCandidates({
      resourcesPath: 'R',
      appRoot: 'A',
      platform: 'win32',
      arch: 'x64'
    })
    expect(out).toEqual([
      { exe: join('R', 'python', 'python.exe'), origin: 'packaged' },
      { exe: join('A', 'python-runtime', 'win32-x64', 'python.exe'), origin: 'dev' }
    ])
  })

  it('缺任一根时只返回存在的候选', () => {
    expect(bundledCandidates({ appRoot: 'A', platform: 'win32', arch: 'x64' })).toHaveLength(1)
    expect(bundledCandidates({ platform: 'linux', arch: 'arm64' })).toHaveLength(0)
  })
})

describe('bundled interpreter launch args', () => {
  it('隔离用户环境但保留脚本目录导入路径', () => {
    const args = argsForBundled()
    // -E 忽略 PYTHONPATH/PYTHONHOME，-s 跳过用户 site-packages
    expect(args).toContain('-E')
    expect(args).toContain('-s')
    // 不能用 -I/-P：那会去掉脚本目录的 sys.path 前缀，worker 无法导入同目录模块
    expect(args).not.toContain('-I')
    expect(args).not.toContain('-P')
  })
})

describe('parseProbeResult', () => {
  it('解析 major.minor 并以退出码判定可用', () => {
    expect(parseProbeResult(0, '3.12.15\n')).toEqual({ ok: true, version: '3.12' })
    expect(parseProbeResult(1, '2.7.18\n')).toEqual({ ok: false, version: '2.7' })
    expect(parseProbeResult(0, '')).toEqual({ ok: false, version: null })
    expect(parseProbeResult(null, '3.12.15\n')).toEqual({ ok: false, version: '3.12' })
  })
})

describe('probePython', () => {
  it('探到本机 Python 并报出版本', async () => {
    const r = await probePython(process.env.INSTADOWN_PYTHON || 'python', [])
    expect(r.ok).toBe(true)
    expect(r.version).toMatch(/^\d+\.\d+$/)
  }, 15_000)

  it('不存在的命令安静失败', async () => {
    const r = await probePython('definitely-not-a-real-python-binary-xyz', [])
    expect(r.ok).toBe(false)
    expect(r.version).toBeNull()
  }, 15_000)

  it('探测脚本对旧版本返回非零（门槛逻辑）', () => {
    // 探测代码把版本门槛内嵌：直接断言代码文本含 3.11 门槛，避免
    // 在测试里真装一个旧解释器
    expect(PYTHON_PROBE_CODE).toContain('(3, 11)')
  })
})
