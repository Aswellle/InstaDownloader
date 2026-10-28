/**
 * 简中字典（默认语言）。
 *
 * 结构约定：按组件/功能域分组的扁平两层对象，键名用英文语义命名。
 * 含插值的值用 {name} 占位（t() 负责替换）。
 */
export const zhCN = {
  // ── 通用 ──
  common: {
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    done: '完成',
    retry: '重试',
    loading: '加载中…',
    image: '图片',
    video: '视频',
    unknownAuthor: '未知作者',
    errorDetail: '{prefix}：{detail}'
  },

  // ── 顶栏 ──
  topBar: {
    history: '下载历史',
    library: '媒体库',
    settings: '设置',
    language: '切换语言',
    placeholder: '粘贴 Instagram 帖子 / Reels / 主页链接，或输入用户名…  (Ctrl+K)',
    paste: '粘贴',
    pasteTooltip: '读取剪贴板并解析',
    parse: '解析',
    login: '登录',
    loginTooltip: '登录 Instagram 账号（用于 Stories / 主页归档）',
    accountTooltip: '已登录 Instagram：@{name}（点击查看账号详情）',
    starTooltip: '在 GitHub 上 Star 这个项目 ⭐',
    star: 'Star',
    // 语言名以其自身文字显示，两本字典里的值保持一致
    languageZh: '简体中文',
    languageEn: 'English'
  },

  // ── 主页 / 空状态 ──
  home: {
    tagline: '本地优先的 Instagram 媒体归档',
    subtitle:
      '支持图片、Carousel 多图、Reels 视频与 Stories（需登录会话）。 全部解析在本地完成，不上传任何数据。',
    tryLabel: '试试：',
    exampleProfile: '@instagram 主页',
    examplePost: '示例帖子',
    steps: {
      paste: '粘贴链接',
      pasteDesc: '帖子 / Reels / 主页链接，或直接输入用户名',
      preview: '预览并选择',
      previewDesc: '点击卡片选择，Shift 连选，双击放大预览',
      batch: '批量下载',
      batchDesc: '最高质量原档保存，断点续传 · 自动归类',
      manage: '本地管理',
      manageDesc: '按 用户名 / 日期 / 类型 归档，可随时回访'
    },
    parsing: '正在解析…'
  },

  // ── 剪贴板检测 ──
  clipboard: {
    post: '检测到帖子链接',
    postDesc: '{kind} · {shortcode}',
    postAction: '立即解析',
    profile: '检测到主页链接',
    profileDesc: '@{username} 的主页媒体，可批量浏览与下载',
    profileAction: '打开主页',
    story: '检测到 Stories 链接',
    storyDesc: '@{username} 的限时动态（需要登录会话）',
    highlight: '检测到合集（Highlights）链接',
    highlightDesc: '精选合集暂不支持解析',
    bareName: '检测到 Instagram 用户名',
    generic: '检测到 Instagram 链接',
    dropDetected: '已检测到链接，正在解析…'
  },

  // ── 解析结果 ──
  parse: {
    failed: '解析失败',
    retry: '重试',
    login: '登录 Instagram',
    back: '返回',
    backTooltip: '返回主页（Esc 也可）',
    post: '帖子',
    stories: 'Stories',
    mediaCount: '{n} 个媒体',
    loadMore: '再加载 10 条',
    loadedCount: '已加载 {n} 条',
    loadedAll: '已加载全部 {n} 条',
    profileEmpty: '该主页没有可公开浏览的帖子',
    loadingMore: '正在加载…'
  },

  // ── 错误文案（worker/AppError code → 文案） ──
  error: {
    E_INVALID_URL: '链接无效：请输入 Instagram 帖子 / Reels / 主页链接或用户名',
    E_PARSE_FAILED: '解析失败：未找到可下载的媒体',
    E_IG_RATE_LIMIT: '请求过于频繁：Instagram 限流中，请稍后再试',
    E_IG_LOGIN_REQUIRED: '需要登录：请在设置中粘贴 Instagram 会话 Cookie（仅保存在本机）',
    E_IG_PRIVATE: '该账号为私密账号，无法获取',
    E_IG_NOT_FOUND: '未找到：帖子或用户不存在（也可能是私密内容）',
    E_WORKER_DOWN: '解析服务未就绪：正在重启，请稍后重试',
    E_NETWORK: '网络错误：请检查网络连接',
    E_DISK: '磁盘错误：无法写入目标目录',
    E_CANCELED: '已取消'
  },

  // ── 多选操作栏 ──
  selection: {
    selected: '已选',
    downloadSelected: '下载所选',
    selectAll: '全选',
    selectAllTitle: '全选 (Ctrl+A)',
    clear: '清除',
    clearTitle: '清除选择 (Esc)'
  },

  // ── 登录成功描述 ──
  login: {
    successDesc: '会话已加密保存在本机，Stories 与主页归档已可用',
    incomplete: '登录未完成，请重试',
    timeout: '登录超时或未完成安全验证，请重试'
  },

  // ── 图片 ──
  image: {
    expiredTooltip: '媒体链接已失效（Instagram CDN 链接会过期）'
  },

  // ── 网格卡片 / 查看器 ──
  grid: {
    copyLink: '复制链接',
    openInBrowser: '在浏览器打开',
    revealFile: '打开所在文件夹',
    noFilePath: '未找到文件路径',
    linkCopied: '链接已复制到剪贴板',
    copyFailed: '复制失败'
  },

  viewer: {
    prev: '上一张',
    next: '下一张',
    prevKey: '上一张 (←)',
    nextKey: '下一张 (→)',
    downloadThis: '下载此媒体',
    keysHint: '← → 翻页 · Enter 下载 · Esc 关闭',
    keysHintNoDownload: '← → 翻页 · Esc 关闭',
    videoBroken: '视频无法播放（链接可能已过期）',
    openOriginal: '在新窗口打开原链接'
  },

  // ── 任务栏 ──
  task: {
    title: '任务',
    idle: '空闲',
    activeCount: '{n} 个进行中',
    completed: '{n} 已完成',
    failed: '{n} 未成功',
    clearCompleted: '清除已完成',
    clearTitle: '清除所有已完成/失败/取消的任务',
    confirmClearTitle: '清除已完成的任务？',
    confirmClearBody:
      '将移除 {n} 条已完成/失败/取消的任务记录。此操作不可撤销；已下载到磁盘的文件不受影响。',
    status_WAITING: '等待中',
    status_DOWNLOADING: '下载中',
    status_PAUSED: '已暂停',
    status_SUCCESS: '完成',
    status_FAILED: '失败',
    status_CANCELED: '已取消',
    pause: '暂停',
    resume: '继续',
    cancel: '取消',
    remove: '移除记录',
    openFolder: '打开所在文件夹'
  },

  // ── 历史面板 ──
  history: {
    title: '下载历史',
    count: '{n} 条',
    clear: '清空',
    empty: '暂无下载记录',
    viewInApp: '在应用内查看',
    openExternal: '用系统默认程序打开',
    reveal: '在文件夹中显示',
    copyPath: '复制路径',
    pathCopied: '路径已复制',
    copyFailed: '复制失败',
    revealFailed: '无法打开文件夹',
    openFailed: '无法打开文件',
    fetchFailed: '获取历史记录失败',
    cleared: '历史记录已清空',
    clearFailed: '清空失败',
    confirmTitle: '清空下载历史？',
    confirmBody:
      '将删除全部 {n} 条历史记录。此操作不可撤销；已下载到磁盘的文件不会被删除。'
  },

  // ── 库面板（侧边） ──
  library: {
    title: '媒体库',
    fullscreenTitle: '切换到全屏媒体库（网格视图 + 更多筛选）',
    openItem: '打开',
    totalFiles: '共 {n} 个文件',
    imagesSuffix: '{n} 图片',
    videosSuffix: '{n} 视频',
    groupByAuthor: '按作者分组',
    showAll: '显示全部',
    searchPlaceholder: '搜索作者…',
    noMedia: '暂无媒体',
    noMediaHint: '下载的媒体会显示在这里',
    filesCount: '{n} 个文件',
    avgSize: '平均 {w}×{h}',
    loginWallRetry: '重试'
  },

  // ── 个人资料头部 ──
  profile: {
    privateAccount: '私密账号',
    posts: '帖子',
    followers: '粉丝',
    loadedSuffix: '（已加载 {n}）'
  },

  // ── 全屏媒体库 ──
  libFull: {
    back: '返回主页',
    collapse: '收起',
    title: '媒体库',
    refresh: '刷新',
    sortNewest: '最新优先',
    sortOldest: '最早优先',
    sortAuthor: '按作者',
    sortSize: '尺寸优先',
    sortTooltip: '切换排序方式',
    authorFilterTooltip: '按作者过滤',
    filters: '筛选',
    filtersTooltip: '作者与排序',
    clearSearch: '清除搜索',
    helpFilterSortLabel: '筛选 + 排序',
    filterAll: '全部',
    filterImage: '图片',
    filterVideo: '视频',
    allAuthors: '全部作者',
    empty: '媒体库为空，下载的媒体会出现在这里',
    noMatch: '没有匹配的内容',
    clearSelection: '取消全选',
    selectAll: '全选结果',
    downloadSelected: '下载所选 ({n})',
    help: '快捷键与操作说明',
    helpTitle: '操作说明',
    helpClick: '单击卡片',
    helpClickDesc: '打开应用内查看器（图片/视频都在应用内，不跳浏览器）',
    helpMulti: 'Ctrl/Shift + 单击',
    helpMultiDesc: '多选卡片（再点取消）；多选态下单击即切换选中',
    helpSelectAll: '底部「全选结果」',
    helpSelectAllDesc: '选中当前筛选出的全部内容，可一键批量下载',
    statsLine: '{total} 项 · 图片 {img} · 视频 {vid}',
    searchAll: '搜索作者 / shortcode / 文件名…',
    clearFilters: '清除过滤条件',
    selectedOf: '已选 {sel} / {total}',
    totalItems: '共 {n} 项',
    helpPrevNext: '查看器内上一张 / 下一张',
    helpEnter: '查看器内下载当前媒体',
    helpEsc: '逐级退出：帮助/下拉 → 清除多选 → 关闭查看器 → 收起全屏库',
    helpFilterSort: '类型（全部/图片/视频）、作者下拉、四种排序循环切换',
    helpArrows: '← → 方向键',
    loadFailed: '加载媒体库失败',
    escHint: 'Esc：选区 → 筛选 → 关闭'
  },

  // ── 设置面板 ──
  settings: {
    title: '设置',
    saved: '已保存',
    appearance: '外观',
    appearanceDesc: '界面主题，立即生效',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '跟随系统',
    languageAuto: '跟随系统',
    download: '下载',
    downloadDesc: '保存位置与并发',
    downloadDir: '下载目录',
    downloadDirHint: '文件按 用户名 / 日期 / 类型 自动归类',
    chooseDir: '选择新的下载目录',
    concurrency: '同时下载任务数',
    concurrencyHint: '并发越高越快，但更容易被 Instagram 限流；建议保持 3',
    concurrencyWarn: '{n} 并发可能触发 IG 限流',
    concurrencyOk: '{n} 个任务同时下载',
    change: '更改',
    openInFileManager: '在文件管理器中打开',
    anonymousFirstLong: '无登录优先（强烈建议保持开启）',
    anonymousFirstLongHint:
      '公开内容一律匿名获取，你的账号完全不进入请求路径，最大限度避免 IG 对自动化工具的风控与封号风险。关闭后公开请求也会携带会话（不推荐）。',
    warnAccountUseLong: '经由账号的操作前提醒',
    warnAccountUseLongHint:
      'Stories 等只能用账号完成的功能，执行前会明确提示「本操作将使用你的 IG 会话」，并提供取消入口。',
    autoCacheLong: '自动缓存浏览过的图片',
    autoCacheLongHint:
      '把头像与缩略图保存到本机；IG 的图片链接带签名几小时后就失效，缓存后图片永久可看。占用可在下方「存储与数据」清理。',
    accountDescLong: '用于主页归档与 Stories（需登录）',
    loggedInBadge: '已登录',
    loggedInAsShort: '已登录：@{name}',
    sessionEncryptedNote: '会话已加密保存在本机 · 点击顶栏头像查看详情',
    logoutShort: '退出',
    notLoggedInGuide:
      '点击下方按钮打开 Instagram 官方登录页，在其中登录你的账号即可。登录凭据直接提交给 Instagram，本应用不接触密码，仅加密保存会话 Cookie（绝不联网上传）。',
    waitingLogin: '等待登录…',
    statsLoading: '统计中…',
    behavior: '行为',
    behaviorDesc: '解析与剪贴板',
    autoClipboard: '剪贴板自动检测',
    autoClipboardHint: '窗口聚焦时检测剪贴板中的 IG 链接并提示',
    privacy: '隐私与账号安全',
    privacyDesc: '控制何时使用你的 IG 会话',
    anonymousFirstAlways: '内置策略，始终开启，不可关闭',
    warnAccountUse: '账号功能二次确认',
    account: 'Instagram 账号',
    login: '登录 Instagram',
    advanced: '高级',
    pasteCookie: '手动粘贴会话 Cookie',
    pasteCookieHint:
      '仅当无法打开登录窗口、或已有现成 Cookie 时使用。格式：sessionid=…（可包含多个 cookie，用 ; 分隔）',
    storage: '存储与数据',
    storageDesc: '本机占用与清理',
    imageCache: '图片缓存',
    filesCount: '{n} 个文件',
    cacheHint: '头像与缩略图缓存在本机，避免 Instagram 链接过期后图片无法显示。清空后再次浏览会重新缓存。',
    clearCache: '清空图片缓存',
    recordsCount: '{n} 条记录',
    historyHint: { pre: '清空的是历史列表，', bold: '已下载到磁盘的文件不会被删除', post: '。' },
    clearHistory: '清空下载历史',
    about: '关于',
    aboutDesc: '版本信息与开源仓库',
    repoLinkTitle: '在浏览器中打开开源仓库',
    starPromptPre: '如果这个项目帮你留住了想收藏的内容，欢迎到 GitHub 给一个',
    starPromptPost: '—— 这是对独立开发者最实在的鼓励，也能让更多人看到它。',
    confirmCacheTitle: '清空图片缓存？',
    confirmCacheBody:
      '将删除 {n} 个缓存文件（{size}）。此操作不可撤销；下次浏览时会重新缓存，缩略图首次显示会稍慢。',
    confirmCacheBodyGeneric: '将删除全部缓存文件。此操作不可撤销。',
    cacheCleared: '已清空图片缓存（{n} 个文件）',
    cacheClearedDesc: '下次浏览时会重新缓存，缩略图首次显示会稍慢',
    clearFailed: '清空失败',
    confirmHistoryTitle: '清空下载历史？',
    confirmHistoryBody:
      '将删除全部 {n} 条历史记录。此操作不可撤销；已下载到磁盘的文件不会被删除。',
    historyCleared: '已清空下载历史',
    historyClearedDesc: '已下载的文件不会被删除',
    confirmLogoutTitle: '退出 Instagram 登录？',
    confirmLogoutBody:
      '将清除本机保存的登录会话，主页归档与 Stories 将不可用，直到重新登录。',
    logoutLabel: '退出登录',
    loggedOut: '已退出登录并清除本地会话',
    logoutFailed: '退出失败',
    dirNotSet: '下载目录未设置',
    dirOpenFailed: '无法打开目录',
    cookieSavedNote: '会话已加密保存在本机',
    loginOk: '已登录 Instagram：@{name}',
    loginOkPlain: 'Instagram 登录成功',
    loginCancelled: '已取消登录',
    loginFailed: '未检测到登录状态，请重试',
    loginError: '登录失败'
  },

  // ── 账号面板 ──
  account: {
    title: 'Instagram 账号',
    unknownAccount: '未知账号',
    connected: '已连接 Instagram 账号',
    openProfile: '在浏览器中打开我的主页',
    profileShort: '主页',
    capabilities: '登录后可用的功能',
    capProfile: '主页帖子归档',
    capProfileHint: '批量浏览并下载某账号的主页媒体',
    capStories: 'Stories 查看',
    capStoriesHint: '读取当前有效的限时动态',
    capPrivate: '私密账号内容',
    capPrivateHint: '仅当你的账号已被对方接受关注时可用',
    policyTitle: '会话使用策略（账号安全）',
    policyNever: '默认绝不使用你的账号。',
    policyNeverBody:
      '公开内容（帖子 / Reels / 主页）一律匿名获取，你的会话不进入请求路径，IG 无法把这些请求与你的账号关联。',
    policyOnly: '仅当功能只能通过账号完成时（查看 Stories、私密账号内容）才会经由会话访问，且执行前会明确提醒。这是为保护你的账号设计的最小暴露原则。',
    policyRollback:
      '回退方式：如担心账号风险，可随时点「退出登录」清除本机会话；未登录状态下除 Stories / 私密内容外的全部功能仍然可用。',
    sessionStatus: '会话状态',
    statusPersisted: '已加密保存到本机',
    statusPartition: '浏览器分区已登录',
    sessionValid: '会话有效',
    sessionInvalid: '未检测到有效会话',
    statusEncryptedNote:
      '会话经系统密钥（safeStorage）加密后仅存于本机，不会上传到任何服务器。凭据始终直接提交给 Instagram，本应用不接触密码。',
    relogin: '重新登录',
    processing: '处理中…',
    logout: '退出登录',
    login: '登录 Instagram',
    notLoggedInTitle: '尚未登录 Instagram',
    notLoggedInHint:
      '登录后可归档任意账号的主页帖子、查看 Stories。点击下方按钮会打开 Instagram 官方登录页，在其中登录即可。',
    credentialsNote: '凭据直接提交给 Instagram，本应用不接触密码，仅加密保存会话 Cookie（绝不联网上传）。',
    waitingLogin: '等待登录…',
    loggedOut: '已退出登录并清除本地会话',
    logoutFailed: '退出失败',
  },

  // ── 账号风险确认 ──
  accountConfirm: {
    title: '此内容需要使用你的 Instagram 会话',
    body:
      'Stories / 精选合集只能经由登录账号查看（IG 官方机制）。本次访问会以你的账号身份进行，IG 可能将其识别为账号活动；如担心风险可选择取消，回退方式是清除会话（设置 → 账号）。',
    proceed: '继续访问'
  },

  // ── 下载提示 ──
  download: {
    queued: '已加入下载队列：{n} 项',
    queueFailed: '加入队列失败',
    workerDown: '解析服务异常，正在重启…',
    workerReviveBanner: '解析服务不可用，帖子/主页解析暂受影响；下载中的任务不受影响，可点击重试恢复',
    pythonMissingBanner:
      '未找到可用的 Python 运行环境，链接解析暂不可用（下载功能不受影响）。正常安装的发行版已内置 Python 运行时；若看到此提示，请参考 README「运行要求」重新安装，或安装 Python 3.11+ 后重试。',
    pythonVersionBanner:
      '检测到系统 Python 版本过低（需要 3.11+），链接解析暂不可用（下载功能不受影响）。请升级 Python 后点击重试；或重新安装带内置运行时的发行版。',
    pythonRetry: '重试检测',
    pythonReadyToast: '解析服务已恢复（Python {version}）',
  },

  // ── 拖拽 ──
  drag: {
    dropHere: '松开以上传链接'
  },

} as const

export type Dict = typeof zhCN

/** 扁平化的键路径联合类型（如 'topBar.parse' | 'settings.title' …） */
type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never

type Leaves<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : Join<K, Leaves<T[K]>>
    }[keyof T & string]

export type MessageKey = Leaves<Dict>
