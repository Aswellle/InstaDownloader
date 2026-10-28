<div align="center">

[简体中文](README.md) | [English](README_EN.md)

<img src="build/icon-256.png" width="120" alt="InstaDownloader logo" />

# InstaDownloader

**Archive Instagram media to your own disk — completely.**

[![Release](https://img.shields.io/badge/Release-v0.5.0-rose?logo=github)](../../releases)
[![Downloads](https://img.shields.io/github/downloads/Aswellle/InstaDown/total?label=Downloads&color=0d9488&logo=github)](../../releases)
[![Tests](https://img.shields.io/badge/Tests-130%20passing-16a34a?logo=vitest)](#development)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?logo=electron)](#download)
[![License](https://img.shields.io/badge/License-MIT-8b5cf6)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ff69b4)](#contributing)

*Paste a link → preview → batch download → archive forever. Everything stays local, no login required.*

[Download](#download) · [Features](#features) · [How It Works](#how-it-works) · [Contributing](#contributing)

</div>

---

> [!IMPORTANT]
> **Anonymous-first**: public content is always fetched anonymously — your Instagram account never enters any request path. Only content that IG requires an account to view (e.g. Stories) goes through a session, and you are warned explicitly before it does. See [FAIR_USE.md](FAIR_USE.md) for details.

## Why InstaDownloader

Instagram's CDN links expire within hours, and posts you saved disappear over time. Meanwhile, existing tools either demand your account cookie and carry it on every request (a serious risk-control exposure), or are just web-based resolvers (privacy concerns, no batch support).

InstaDownloader answers with three design commitments:

| Commitment | How |
|------|------|
| 🔒 **Account safety first** | Session usage is scoped per endpoint — public content **never** carries your cookie; account-backed features try anonymously first and only fall back on a login wall, with an explicit warning and a rollback path before every account-backed action |
| 📁 **Local-first** | Parsing, previewing, downloading, and managing all happen on your machine — nothing is uploaded; files are organized automatically under `username/date/type` |
| 🖼️ **A library you can trust** | Images are cached locally (they survive CDN expiry); the fullscreen library supports search by author/type/keyword plus batch downloads |

## Features

<div align="center">
  <img src="assets/screenshots/light-grid.jpg" width="820" alt="Parse result grid" />
  <p><sub>Paste a link and get a preview grid — media type badges, resolution and capture date at a glance</sub></p>
</div>

**Parsing & preview**
- Posts / carousels / Reels / Stories / full profiles, with direct username input
- Full carousel parsing (multi-layer fallback for old posts whose `contextJSON` is missing)
- Apple Photos-style multi-select grid: click to select, Shift to range-select, Ctrl to toggle, select all

**In-app loop** (no system browser)

<div align="center">
  <table>
    <tr>
      <td><img src="assets/screenshots/light-selection.jpg" alt="Multi-select batch download" /></td>
      <td><img src="assets/screenshots/light-viewer.jpg" alt="In-app viewer" /></td>
    </tr>
    <tr>
      <td align="center"><sub>Shift range-select + floating batch bar</sub></td>
      <td align="center"><sub>In-app viewer: paging / metadata / one-click download</sub></td>
    </tr>
  </table>
</div>

- Image/video viewer: arrow paging, `Enter` to download, keyboard hints on hover
- Download history opens files in-app (including video seeking), no external image viewer
- Profile archives load in controlled pages — "load 10 more" on demand

**Download engine**
- Concurrency 1–6, resumable downloads (Range + `.part`), automatic retry with backoff (1s/4s/16s)
- Pause/resume/cancel/retry, task persistence, automatic recovery after restart

**Media management**
- Fullscreen library: real thumbnail grid + author/type/keyword search + four sort modes + batch download
- Download history with thumbnails — recognize every item at a glance
- Avatars and thumbnails cached locally (custom `instadown-img://` protocol); expired links no longer mean placeholders

<div align="center">
  <table>
    <tr>
      <td><img src="assets/screenshots/light-library.jpg" alt="Fullscreen library (light)" /></td>
      <td><img src="assets/screenshots/dark-library.jpg" alt="Fullscreen library (dark)" /></td>
    </tr>
    <tr>
      <td align="center"><sub>Light theme</sub></td>
      <td align="center"><sub>Dark theme</sub></td>
    </tr>
  </table>
</div>

**Desktop experience**
- Simplified Chinese / English UI: one click on the globe icon at the top right; defaults to your system language
- Light / dark / follow-system themes (light by default), with the Windows title-bar buttons following along
- Smart clipboard detection: post links, profile links, and usernames each get their own prompt
- Every destructive action (clearing history/cache, logging out) requires confirmation

## Download

| Platform | How |
|------|----------|
| **Windows** | Grab `InstaDownloader-Setup-x.x.x.exe` (NSIS installer) from [Releases](../../releases) |
| **macOS / Linux** | Grab the `.dmg` / `.AppImage` from [Releases](../../releases), built automatically by CI |

### Runtime requirements (end users)

**No Python, no dev tools.** Release installers bundle a standalone Python
runtime (CPython 3.12, shipped with the app, never installed into your system) —
download, install, and it just works:

- OS: Windows 10+ (x64) / macOS 12+ (Apple Silicon or Intel) / mainstream
  Linux (x64)
- Disk: ~130–180 MB per install (runtime included), plus space for your media
  archive
- Network: Instagram public endpoints only; no third-party servers

If parsing reports Python unavailable (a banner explains what to do), the
installer was likely incomplete, or the bundled runtime is missing while your
system Python is older than 3.11 — re-download a full release; alternatively
install [Python 3.11+](https://www.python.org/downloads/) and hit Retry in the
app.

### Build requirements (developers)

Only needed when building from source:

- **Node ≥ 22** (CI uses Node 22)
- **Python ≥ 3.11** (the worker has zero pip dependencies; set `INSTADOWN_PYTHON`
  to pin an interpreter)
- Run `npm run prepare:python` before packaging a release (npmmirror mirror by
  default, GitHub Releases as fallback; `PB_RUNTIME_URLS` overrides mirrors;
  `INSTADOWN_NO_BUNDLED_PYTHON=1` skips it for local debugging only)

## Quick start

1. Open the app and **paste** an Instagram link (or type a username) — a prompt appears automatically when the clipboard holds a link
2. **Select** the media you want (Shift range-select is fastest)
3. Click **Download selected** (or `Ctrl+Enter`) — files are organized under `Pictures/InstaVault/{username}/{date}/`
4. Open **Library** from the top-left anytime to browse what you've archived — fullscreen grid view included

All of the above works without registration or login.

**Switch the UI language**: the globe icon at the top right of the main window → choose 简体中文 / English. It follows the system language by default; your choice is remembered, and you can pick “System” to go back to automatic. System notifications and native dialog text follow the UI language.

## How it works

```
┌─────────────────────────────────────────────┐
│  Renderer (React 19 + Zustand + Tailwind 4)  │
│         ↕ contextBridge (minimal IPC surface) │
│  Main (Electron 44)                          │
│   ├─ SQLite (node:sqlite, WAL)  tasks/media/history │
│   ├─ Download engine  resume · retry · concurrency limit │
│   └─ Image cache  instadown-img:// custom protocol │
│         ↕ JSON-RPC over stdio                 │
│  Python Worker (zero third-party deps)        │
│   └─ Public embed parsing · multi-layer fallback · session tiers │
└─────────────────────────────────────────────┘
```

- **Parsing path**: public embed metadata (provided by IG for embedding scenarios) → oEmbed → rendered page, with multi-layer fallback for reliability
- **Session tiers**: public paths never carry a cookie; endpoints like `media_info` go anonymously first and only retry with a session after an explicit login wall; Stories declare their session use up front
- **Privacy**: all parsing and downloading happen locally; the session cookie is encrypted with safeStorage and stays on your machine

## Development

```bash
npm install          # If the Electron binary is blocked: ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
npm run dev          # Dev mode (HMR)
npm test             # Vitest unit + integration tests (spawns a real Python worker)
npm run test:py      # Python worker tests (stdlib unittest only)
npm run typecheck    # TS type checking
npm run dist:dir     # Package (directory, for verification)
npm run dist         # Package release (win nsis / mac dmg / linux AppImage)
```

See [Build requirements (developers)](#build-requirements-developers) above.
When packaging with `npm run dist`, the afterPack hook copies the bundled
runtime from `python-runtime/` into the installer; a missing runtime fails the
build instead of producing an installer whose parser can't run.

Test coverage: queue state machine, resumable downloads, URL classification, carousel fallback, session tiering, selector stability — **130 cases** (83 Vitest + 47 unittest).

## Release process

```bash
# 1. Bump version in package.json and commit
# 2. Push a tag → GitHub Actions builds all three platforms and creates the Release
git tag v0.5.0
git push origin v0.5.0
```

Local verification: `npm run dist:dir` (directory) or `npm run dist` (installers).

## Instagram data acquisition

Only public web endpoints and public app headers (identical to a browser visit) are used — no auth bypass of any kind. When blocked without login (common on datacenter IPs), the app guides you clearly: you can complete Instagram's official login window inside the app (credentials go straight to Instagram; this app never touches your password), or paste the session cookie (`sessionid=…`) from your own logged-in browser — it is stored encrypted on your machine only.

**Account-safety design**: public content is always fetched anonymously (no session attached by default); only account-required features (Stories, private content) use a session, with an explicit warning beforehand — account exposure is minimized.

## Responsible use

> The full project boundary and compliance statement is in [FAIR_USE.md](FAIR_USE.md).

- Only archive content **you have access to**: your own account, public content, or content you're authorized to use
- **Do not** use it for bulk scraping, monitoring others, redistributing other people's content, or anything that violates privacy or copyright
- The built-in 1.5-second request throttle must not be removed or bypassed; high-frequency access triggers IG risk control (your account may be temporarily restricted) and contradicts the intent of this project
- Private accounts are always refused (built into the app, not optional)

## Disclaimer

1. This project is not affiliated with or endorsed by Instagram / Meta Platforms.
2. Instagram's Terms of Service prohibit unauthorized automated data collection. By using this tool you understand and accept all resulting risks and responsibilities, including but not limited to account restriction.
3. This software is provided "as is" (MIT license); the author is not liable for any consequences of its use or of IG platform policy changes.
4. If you represent Instagram / Meta and believe this repository is problematic, contact us via Issue — we respond within 24 hours.

## Contributing

Issues and PRs welcome! Constraints are in [FAIR_USE.md](FAIR_USE.md#给贡献者的约束):
no changes that add bulk scraping, throttle bypasses, or login-wall bypasses.

```bash
git clone https://github.com/Aswellle/InstaDown.git
cd InstaDown && npm install && npm run dev
```

Please make sure `npm test`, `npm run test:py`, and `npm run typecheck` pass before submitting.

If this project is useful to you, please give it a ⭐ Star — it's the most tangible encouragement for a solo developer, and it helps more people find it.

## License

[MIT](LICENSE)
