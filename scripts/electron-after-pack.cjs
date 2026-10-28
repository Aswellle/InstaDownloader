/**
 * electron-builder afterPack 钩子：把内置 Python 运行时复制进安装包。
 *
 * 打包机器上应先跑 scripts/prepare-python-runtime.mjs（release.yml 的
 * "Prepare bundled Python runtime" 步骤）；本钩子按目标平台/架构取
 * python-runtime/<flavor>/ 复制到 <app>/resources/python/。缺运行时
 * 时构建失败 —— 静默跳过会产出"用户机器上解析不可用"的发行包，比
 * 构建失败更难发现。
 *
 * 钩子跑在打包机器上：按 electron-builder 参数的平台/架构选 flavor，
 * 而不是打包机自己的平台（mac 上交叉打 win 包的场景）。
 */

const { existsSync, cpSync, readFileSync, rmSync } = require('node:fs')
const { join } = require('node:path')

/** 与 scripts/prepare-python-runtime.mjs 的 TRIPLES/flavor 命名一致 */
function flavorFor(platform, arch) {
  if (platform === 'win32' && arch === 'x64') return 'win32-x64'
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64'
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64'
  if (platform === 'linux' && arch === 'x64') return 'linux-x64'
  return null
}

/** 各平台解释器相对路径（与 src/main/services/python-runtime.ts 一致） */
function interpreterRelPath(platform) {
  if (platform === 'win32') return 'python.exe'
  if (platform === 'darwin' || platform === 'linux') return join('bin', 'python3')
  return null
}

/** electron-builder 的 arch 是数字枚举（Arch.x64=1 等），按平台映射成字符串 */
function archName(platform, arch) {
  if (typeof arch === 'string') return arch
  // app-builder-lib Arch: ia32=0, x64=1, armv7l=2, arm64=3, universal=4
  const table =
    platform === 'win32'
      ? { 0: 'ia32', 1: 'x64', 3: 'arm64' }
      : { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' }
  return table[arch] ?? String(arch)
}

module.exports = async function afterPack(context) {
  const { appOutDir, packager, electronPlatformName, arch } = context
  const archStr = archName(electronPlatformName, arch)
  const flavor = flavorFor(electronPlatformName, archStr === 'universal' ? 'x64' : archStr)
  if (!flavor) {
    throw new Error(
      `[after-pack] 平台 ${electronPlatformName}-${archStr} 暂不支持内置 Python 运行时；` +
        '如确需支持，请在 scripts/prepare-python-runtime.mjs 与本文件中补充 flavor 定义'
    )
  }

  // flavor 目录必须带 .runtime-ok 标记（prepare 脚本写入，含版本信息）
  const src = join(__dirname, '..', 'python-runtime', flavor)
  const markerPath = join(src, '.runtime-ok')
  if (!existsSync(markerPath)) {
    throw new Error(
      `[after-pack] 缺少内置 Python 运行时：${src} 不存在或未标记。\n` +
        '先运行 node scripts/prepare-python-runtime.mjs（CI 已内置该步骤；' +
        '本地可用 INSTADOWN_NO_BUNDLED_PYTHON=1 跳过，但发行包必须带运行时）。'
    )
  }

  const resourcesDir = packager.getResourcesDir(appOutDir)
  const dest = join(resourcesDir, 'python')
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
  // 标记文件只服务于构建期校验，不进安装包
  rmSync(join(dest, '.runtime-ok'), { force: true })

  const rel = interpreterRelPath(electronPlatformName)
  const exe = join(dest, rel)
  if (!existsSync(exe)) {
    throw new Error(`[after-pack] 复制后未找到解释器：${exe}`)
  }

  const marker = JSON.parse(readFileSync(markerPath, 'utf8'))
  console.log(
    `[after-pack] 内置 Python ${marker.python} (${flavor}) → resources/python，` +
      `${(cpSize(dest) / 1048576).toFixed(1)} MB`
  )
}

function cpSize(dir) {
  const { statSync, readdirSync } = require('node:fs')
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
