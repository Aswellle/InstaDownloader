/**
 * English dictionary. Must stay structurally identical to zh-CN.ts —
 * t() walks both with the same key path, and a dev-time invariant check
 * (tests/unit/i18n.test.ts) fails if the trees drift apart.
 */
export const en = {
  common: {
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    done: 'Done',
    retry: 'Retry',
    loading: 'Loading…',
    image: 'Image',
    video: 'Video',
    unknownAuthor: 'Unknown author',
    errorDetail: '{prefix}: {detail}'
  },

  topBar: {
    history: 'Download history',
    library: 'Library',
    settings: 'Settings',
    language: 'Switch language',
    placeholder: 'Paste an Instagram post / Reels / profile link, or type a username…  (Ctrl+K)',
    paste: 'Paste',
    pasteTooltip: 'Read clipboard and parse',
    parse: 'Parse',
    login: 'Log in',
    loginTooltip: 'Log in to Instagram (for Stories / profile archives)',
    accountTooltip: 'Signed in as @{name} (click for account details)',
    starTooltip: 'Star this project on GitHub ⭐',
    star: 'Star',
    languageZh: '简体中文',
    languageEn: 'English'
  },

  home: {
    tagline: 'Local-first Instagram media archiver',
    subtitle:
      'Images, multi-image carousels, Reels and Stories (session required). Everything is parsed locally — nothing is uploaded.',
    tryLabel: 'Try:',
    exampleProfile: '@instagram profile',
    examplePost: 'Example post',
    steps: {
      paste: 'Paste a link',
      pasteDesc: 'Post / Reels / profile link, or type a username',
      preview: 'Preview & select',
      previewDesc: 'Click cards to select, Shift for ranges, double-click to zoom',
      batch: 'Batch download',
      batchDesc: 'Best-quality originals, resumable · auto-organized',
      manage: 'Manage locally',
      manageDesc: 'Organized by username / date / type, revisit anytime'
    },
    parsing: 'Parsing…'
  },

  clipboard: {
    post: 'Post link detected',
    postDesc: '{kind} · {shortcode}',
    postAction: 'Parse now',
    profile: 'Profile link detected',
    profileDesc: '@{username}’s profile media — browse and batch-download',
    profileAction: 'Open profile',
    story: 'Stories link detected',
    storyDesc: '@{username}’s story (session required)',
    highlight: 'Highlights link detected',
    highlightDesc: 'Highlight collections are not supported yet',
    bareName: 'Instagram username detected',
    generic: 'Instagram link detected',
    dropDetected: 'Link detected, parsing…'
  },

  parse: {
    failed: 'Parse failed',
    retry: 'Retry',
    login: 'Log in to Instagram',
    back: 'Back',
    backTooltip: 'Back to home (Esc also works)',
    post: 'Post',
    stories: 'Stories',
    mediaCount: '{n} items',
    loadMore: 'Load 10 more',
    loadedCount: '{n} loaded',
    loadedAll: 'All {n} loaded',
    profileEmpty: 'This profile has no public posts to browse',
    loadingMore: 'Loading…'
  },

  error: {
    E_INVALID_URL: 'Invalid link: enter an Instagram post / Reels / profile link or a username',
    E_PARSE_FAILED: 'Parse failed: no downloadable media found',
    E_IG_RATE_LIMIT: 'Too many requests: Instagram is rate-limiting, try again later',
    E_IG_LOGIN_REQUIRED: 'Login required: paste an Instagram session cookie in Settings (stored locally only)',
    E_IG_PRIVATE: 'This account is private and cannot be fetched',
    E_IG_NOT_FOUND: 'Not found: the post or user does not exist (or is private)',
    E_WORKER_DOWN: 'Parser not ready: restarting, please try again shortly',
    E_NETWORK: 'Network error: check your connection',
    E_DISK: 'Disk error: cannot write to the target directory',
    E_CANCELED: 'Canceled'
  },

  login: {
    successDesc: 'Session encrypted and stored locally — Stories and profile archives are now available',
    incomplete: 'Login not completed, please try again',
    timeout: 'Login timed out or security verification incomplete — please try again'
  },

  selection: {
    selected: 'Selected',
    downloadSelected: 'Download selected',
    selectAll: 'Select all',
    selectAllTitle: 'Select all (Ctrl+A)',
    clear: 'Clear',
    clearTitle: 'Clear selection (Esc)'
  },

  // ── Image ──
  image: {
    expiredTooltip: 'Media link has expired (Instagram CDN links expire)'
  },

  grid: {
    copyLink: 'Copy link',
    openInBrowser: 'Open in browser',
    revealFile: 'Show in folder',
    noFilePath: 'File path not found',
    linkCopied: 'Link copied to clipboard',
    copyFailed: 'Copy failed'
  },

  viewer: {
    prev: 'Previous',
    next: 'Next',
    prevKey: 'Previous (←)',
    nextKey: 'Next (→)',
    downloadThis: 'Download this media',
    keysHint: '← → navigate · Enter download · Esc close',
    keysHintNoDownload: '← → navigate · Esc close',
    videoBroken: 'Video cannot play (the link may have expired)',
    openOriginal: 'Open original link in a new window'
  },

  task: {
    title: 'Tasks',
    idle: 'Idle',
    activeCount: '{n} in progress',
    completed: '{n} completed',
    failed: '{n} failed',
    clearCompleted: 'Clear finished',
    clearTitle: 'Clear all finished/failed/canceled tasks',
    confirmClearTitle: 'Clear finished tasks?',
    confirmClearBody:
      'This removes {n} finished/failed/canceled task records. This cannot be undone; files already downloaded to disk are not affected.',
    status_WAITING: 'Waiting',
    status_DOWNLOADING: 'Downloading',
    status_PAUSED: 'Paused',
    status_SUCCESS: 'Done',
    status_FAILED: 'Failed',
    status_CANCELED: 'Canceled',
    pause: 'Pause',
    resume: 'Resume',
    cancel: 'Cancel',
    remove: 'Remove record',
    openFolder: 'Show in folder'
  },

  history: {
    title: 'Download history',
    count: '{n} items',
    clear: 'Clear',
    empty: 'No downloads yet',
    viewInApp: 'View in app',
    openExternal: 'Open with system default app',
    reveal: 'Show in folder',
    copyPath: 'Copy path',
    pathCopied: 'Path copied',
    copyFailed: 'Copy failed',
    revealFailed: 'Cannot open folder',
    openFailed: 'Cannot open file',
    fetchFailed: 'Failed to load history',
    cleared: 'History cleared',
    clearFailed: 'Clear failed',
    confirmTitle: 'Clear download history?',
    confirmBody:
      'This deletes all {n} history records. This cannot be undone; files already downloaded to disk are not deleted.'
  },

  library: {
    title: 'Library',
    fullscreenTitle: 'Switch to fullscreen library (grid view + more filters)',
    openItem: 'Open',
    totalFiles: '{n} files in total',
    imagesSuffix: '{n} images',
    videosSuffix: '{n} videos',
    groupByAuthor: 'Group by author',
    showAll: 'Show all',
    searchPlaceholder: 'Search authors…',
    noMedia: 'No media yet',
    noMediaHint: 'Downloaded media will appear here',
    filesCount: '{n} files',
    avgSize: 'avg {w}×{h}',
    loginWallRetry: 'Retry'
  },

  profile: {
    privateAccount: 'Private account',
    posts: 'Posts',
    followers: 'Followers',
    loadedSuffix: '({n} loaded)'
  },

  libFull: {
    back: 'Back home',
    collapse: 'Collapse',
    title: 'Library',
    refresh: 'Refresh',
    sortNewest: 'Newest first',
    sortOldest: 'Oldest first',
    sortAuthor: 'By author',
    sortSize: 'By size',
    sortTooltip: 'Change sort order',
    authorFilterTooltip: 'Filter by author',
    filters: 'Filters',
    filtersTooltip: 'Author & sort',
    clearSearch: 'Clear search',
    helpFilterSortLabel: 'Filter + sort',
    filterAll: 'All',
    filterImage: 'Images',
    filterVideo: 'Videos',
    allAuthors: 'All authors',
    empty: 'Library is empty — downloaded media will appear here',
    noMatch: 'No matching items',
    clearSelection: 'Deselect all',
    selectAll: 'Select all results',
    downloadSelected: 'Download selected ({n})',
    help: 'Shortcuts & actions',
    helpTitle: 'How to use',
    helpClick: 'Click a card',
    helpClickDesc: 'Open the in-app viewer (images and videos stay in the app)',
    helpMulti: 'Ctrl/Shift + click',
    helpMultiDesc: 'Multi-select cards (click again to deselect); while multi-selecting, a click toggles',
    helpSelectAll: '“Select all results” at the bottom',
    helpSelectAllDesc: 'Select everything matching the current filter, ready for batch download',
    statsLine: '{total} items · {img} images · {vid} videos',
    searchAll: 'Search author / shortcode / filename…',
    clearFilters: 'Clear filters',
    selectedOf: 'Selected {sel} / {total}',
    totalItems: '{n} items',
    helpPrevNext: 'Previous / next in the viewer',
    helpEnter: 'Download current media in the viewer',
    helpEsc: 'Exit step by step: help/dropdown → clear selection → close viewer → collapse library',
    helpFilterSort: 'Type (all/images/videos), author dropdown, four sort modes cycled',
    helpArrows: '← → arrow keys',
    loadFailed: 'Failed to load library',
    escHint: 'Esc: selection → filters → close'
  },

  settings: {
    title: 'Settings',
    saved: 'Saved',
    appearance: 'Appearance',
    appearanceDesc: 'UI theme, applies immediately',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    languageAuto: 'System',
    download: 'Download',
    downloadDesc: 'Save location & concurrency',
    downloadDir: 'Download directory',
    downloadDirHint: 'Files are organized by username / date / type',
    chooseDir: 'Choose a new download directory',
    concurrency: 'Simultaneous downloads',
    concurrencyHint: 'Higher concurrency is faster but more likely to trigger Instagram rate-limiting; 3 is recommended',
    concurrencyWarn: '{n} concurrent downloads may trigger IG rate-limiting',
    concurrencyOk: '{n} tasks downloading at once',
    change: 'Change',
    openInFileManager: 'Open in file manager',
    anonymousFirstLong: 'Anonymous-first (strongly recommended)',
    anonymousFirstLongHint:
      'Public content is always fetched anonymously — your account never enters the request path, minimizing IG risk-control exposure for automation tools. When disabled, public requests also carry your session (not recommended).',
    warnAccountUseLong: 'Warn before account-backed actions',
    warnAccountUseLongHint:
      'Features only possible with an account (e.g. Stories) explicitly state "this action uses your IG session" before running, with a cancel option.',
    autoCacheLong: 'Cache viewed images automatically',
    autoCacheLongHint:
      'Saves avatars and thumbnails locally; IG image links are signed and expire within hours, cached ones stay viewable forever. Usage can be cleaned up under "Storage & data" below.',
    accountDescLong: 'For profile archives and Stories (login required)',
    loggedInBadge: 'Logged in',
    loggedInAsShort: 'Logged in: @{name}',
    sessionEncryptedNote: 'Session encrypted and stored locally · click the top-bar avatar for details',
    logoutShort: 'Log out',
    notLoggedInGuide:
      'Click the button below to open Instagram\'s official login page and sign in there. Credentials go straight to Instagram — this app never touches your password and only stores the session cookie, encrypted (never uploaded).',
    waitingLogin: 'Waiting for login…',
    statsLoading: 'Counting…',
    behavior: 'Behavior',
    behaviorDesc: 'Parsing & clipboard',
    autoClipboard: 'Clipboard detection',
    autoClipboardHint: 'Detect IG links in the clipboard when the window is focused and prompt',
    privacy: 'Privacy & account safety',
    privacyDesc: 'Control when your IG session is used',
    anonymousFirstAlways: 'Built-in policy — always on, cannot be disabled',
    warnAccountUse: 'Confirm account-backed actions',
    account: 'Instagram account',
    login: 'Log in to Instagram',
    advanced: 'Advanced',
    pasteCookie: 'Paste session cookie manually',
    pasteCookieHint:
      'Only if the login window cannot open or you already have a cookie. Format: sessionid=… (multiple cookies separated by ;)',
    storage: 'Storage & data',
    storageDesc: 'Local usage & cleanup',
    imageCache: 'Image cache',
    filesCount: '{n} files',
    cacheHint:
      'Avatars and thumbnails are cached locally so images keep working after Instagram links expire. Clearing re-caches on next browse.',
    clearCache: 'Clear image cache',
    recordsCount: '{n} records',
    historyHint: { pre: 'Clearing removes the history list — ', bold: 'files already on disk are not deleted', post: '.' },
    clearHistory: 'Clear download history',
    about: 'About',
    aboutDesc: 'Version & open-source repo',
    repoLinkTitle: 'Open the repository in your browser',
    starPromptPre: 'If this project helped you keep the content you love, consider giving it a',
    starPromptPost: 'on GitHub — the most tangible encouragement for a solo developer, and it helps others find it.',
    confirmCacheTitle: 'Clear image cache?',
    confirmCacheBody:
      'This deletes {n} cached files ({size}). This cannot be undone; the cache rebuilds on next browse and thumbnails load slower the first time.',
    confirmCacheBodyGeneric: 'This deletes all cached files. This cannot be undone.',
    cacheCleared: 'Image cache cleared ({n} files)',
    cacheClearedDesc: 'The cache rebuilds on next browse; thumbnails load slower the first time',
    clearFailed: 'Clear failed',
    confirmHistoryTitle: 'Clear download history?',
    confirmHistoryBody:
      'This deletes all {n} history records. This cannot be undone; files already downloaded to disk are not deleted.',
    historyCleared: 'Download history cleared',
    historyClearedDesc: 'Downloaded files are not deleted',
    confirmLogoutTitle: 'Log out of Instagram?',
    confirmLogoutBody:
      'This clears the session stored on this machine. Profile archives and Stories will be unavailable until you log in again.',
    logoutLabel: 'Log out',
    loggedOut: 'Logged out; local session cleared',
    logoutFailed: 'Logout failed',
    dirNotSet: 'Download directory not set',
    dirOpenFailed: 'Cannot open directory',
    cookieSavedNote: 'Session encrypted and stored locally',
    loginOk: 'Logged in to Instagram: @{name}',
    loginOkPlain: 'Logged in to Instagram',
    loginCancelled: 'Login canceled',
    loginFailed: 'No login detected, please try again',
    loginError: 'Login failed'
  },

  account: {
    title: 'Instagram account',
    unknownAccount: 'unknown account',
    connected: 'Instagram account connected',
    openProfile: 'Open my profile in browser',
    profileShort: 'Profile',
    capabilities: 'What logging in unlocks',
    capProfile: 'Profile post archives',
    capProfileHint: 'Browse and batch-download a profile’s media',
    capStories: 'Stories viewing',
    capStoriesHint: 'Read currently active stories',
    capPrivate: 'Private account content',
    capPrivateHint: 'Only when your follow request has been accepted',
    policyTitle: 'Session policy (account safety)',
    policyNever: 'Your account is never used by default.',
    policyNeverBody:
      'Public content (posts / Reels / profiles) is always fetched anonymously — your session never enters the request path, so IG cannot associate these requests with your account.',
    policyOnly:
      'Only features that can only be done through an account (viewing Stories, private content) use the session, with an explicit warning beforehand. This is the minimal-exposure principle designed to protect your account.',
    policyRollback:
      'Rollback: if you are concerned about account risk, "Log out" clears the local session anytime; without login, everything except Stories / private content keeps working.',
    sessionStatus: 'Session status',
    statusPersisted: 'Encrypted & stored locally',
    statusPartition: 'Browser partition logged in',
    sessionValid: 'Session valid',
    sessionInvalid: 'No valid session detected',
    statusEncryptedNote:
      'The session is encrypted with the OS keychain (safeStorage) and stays on this machine — never uploaded to any server. Credentials always go straight to Instagram; this app never touches your password.',
    relogin: 'Log in again',
    processing: 'Working…',
    logout: 'Log out',
    login: 'Log in to Instagram',
    notLoggedInTitle: 'Not logged in to Instagram',
    notLoggedInHint:
      'Log in to archive any account’s profile posts and view Stories. The button below opens Instagram\'s official login page — sign in there.',
    credentialsNote:
      'Credentials go straight to Instagram — this app never touches your password and only stores the session cookie, encrypted (never uploaded).',
    waitingLogin: 'Waiting for login…',
    loggedOut: 'Logged out; local session cleared',
    logoutFailed: 'Logout failed',
  },

  accountConfirm: {
    title: 'This content requires your Instagram session',
    body:
      'Stories / Highlights can only be viewed through a logged-in account (an Instagram mechanism). This request runs under your account identity and IG may register it as account activity. If you are concerned, cancel — the rollback is clearing the session (Settings → Account).',
    proceed: 'Continue'
  },

  download: {
    queued: 'Added to download queue: {n} items',
    queueFailed: 'Failed to enqueue',
    workerDown: 'Parser error, restarting…',
    workerReviveBanner: 'Parser service unavailable — post/profile parsing is offline. Active downloads are unaffected; retry to bring it back',
    pythonMissingBanner:
      'No usable Python runtime found — link parsing is offline (downloads are unaffected). Official installers ship a bundled Python runtime; if you see this, reinstall per the README "Runtime requirements", or install Python 3.11+ and retry.',
    pythonVersionBanner:
      'System Python is too old (3.11+ required) — link parsing is offline (downloads are unaffected). Upgrade Python and retry, or reinstall a build with the bundled runtime.',
    pythonRetry: 'Retry',
    pythonReadyToast: 'Parser restored (Python {version})',
  },

  drag: {
    dropHere: 'Drop to parse the link'
  },

} as const

