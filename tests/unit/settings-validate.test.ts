import { describe, expect, it } from 'vitest'
import { sanitizeSettingsPatch } from '../../src/main/services/settings-validate'

describe('sanitizeSettingsPatch', () => {
  it('合法 patch 完整保留', () => {
    const patch = {
      downloadDir: 'D:\Pictures\InstaVault',
      concurrency: 4,
      autoClipboard: true,
      warnAccountUse: false,
      autoCacheImages: true,
      theme: 'dark'
    }
    expect(sanitizeSettingsPatch(patch)).toEqual(patch)
  })

  it('非对象与空对象归一为空', () => {
    expect(sanitizeSettingsPatch(null)).toEqual({})
    expect(sanitizeSettingsPatch('x')).toEqual({})
    expect(sanitizeSettingsPatch({})).toEqual({})
  })

  it('丢弃非白名单键', () => {
    expect(sanitizeSettingsPatch({ evil: true, autoClipboard: false })).toEqual({ autoClipboard: false })
  })

  it.each([
    ['concurrency 越界', { concurrency: 99 }],
    ['concurrency 非整数', { concurrency: 2.5 }],
    ['theme 非法值', { theme: 123 }],
    ['downloadDir 空串', { downloadDir: '' }],
    ['downloadDir 超长', { downloadDir: 'D:' + String.fromCharCode(92) + 'a'.repeat(600) }],
    ['布尔字段为字符串', { autoClipboard: 'true' }]
  ])('丢弃：%s', (_name, patch) => {
    expect(sanitizeSettingsPatch(patch)).toEqual({})
  })
})
