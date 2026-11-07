import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { zhCN } from '../../src/renderer/src/i18n/zh-CN'
import { en } from '../../src/renderer/src/i18n/en'

/**
 * i18n 键完整性：源码中 `t('…')` / `i18nT('…')` 引用的字面量键必须
 * 同时存在于 zh-CN 与 en 两份字典。缺键时界面显示键名本身，此前
 * 无任何报警。
 *
 * 静态扫描（与 selector-stability.test.ts 同模式）：不执行组件代码，
 * 只解析源文件文本；两份字典直接 import 后扁平化取键路径。
 */

const SRC_ROOT = join(__dirname, '../../src/renderer/src')
const EXT = /\.(tsx|ts)$/

function collectFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) out.push(...collectFiles(p))
    else if (EXT.test(name.name)) out.push(p)
  }
  return out
}

/** 字典对象 → 完整点路径集合（只取叶子） */
function flatten(obj: unknown, prefix = '', out = new Set<string>()): Set<string> {
  if (typeof obj !== 'object' || obj == null) return out
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v != null) flatten(v, path, out)
    else out.add(path)
  }
  return out
}

const zhKeys = flatten(zhCN)
const enKeys = flatten(en)

const sources = collectFiles(SRC_ROOT).filter((f) => !f.includes(`${join('i18n')}`))
const usedKeys = new Set<string>()
const KEY_RE = /(?:[^A-Za-z0-9_$.]|^)(?:t|i18nT)\('([A-Za-z0-9_.]+)'\)/g
for (const f of sources) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(KEY_RE)) usedKeys.add(m[1])
}

describe('i18n 键完整性（静态扫描）', () => {
  it('源码引用的每个键都存在于 zh-CN 字典', () => {
    const missing = [...usedKeys].filter((k) => !zhKeys.has(k)).sort()
    expect(missing).toEqual([])
  })

  it('源码引用的每个键都存在于 en 字典', () => {
    const missing = [...usedKeys].filter((k) => !enKeys.has(k)).sort()
    expect(missing).toEqual([])
  })

  it('扫描确实覆盖了源码（防扫描器失效的哨兵）', () => {
    // 这两个键必然被引用；若扫描逻辑坏掉（0 键）此处先失败
    expect(usedKeys.size).toBeGreaterThan(100)
    expect(usedKeys.has('topBar.parse')).toBe(true)
  })
})
