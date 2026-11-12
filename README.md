<div align="center">

# ✦ Flins

**A premium, fully-offline journal & notes space with a personal AI librarian.**

*Преміальний офлайн-щоденник і нотатник із персональним ШІ-бібліотекарем. Ваші думки — тільки на вашому залізі.*

[![Release](https://github.com/dreamyrt/flins/actions/workflows/release.yml/badge.svg)](https://github.com/dreamyrt/flins/releases)

Tauri 2 · Rust · React · BlockNote · SQLite — native desktop app for **macOS** and **Windows**

</div>

---

## Why Flins

Most journaling apps quietly send your most personal text to someone else's cloud. Flins is the opposite:

- 📓 **Paper soul, digital body** — a cozy journal aesthetic: real sheets, washi tape, handwritten headers, five synthesized acoustic sounds (kalimba, harp, typewriter, zen bell, celesta) built with the Web Audio API
- 🔒 **Local-first, always** — everything lives in a plain SQLite file in your own AppData; optional *Physical Vault* mirrors every entry as human-readable `.md` with YAML frontmatter into a folder you choose
- 🧠 **Bring-your-own AI** — connects to *your* local model through [LM Studio](https://lmstudio.ai) or [Ollama](https://ollama.com) (OpenAI-compatible API), with one-click server discovery. Not a single word leaves your machine unless you deliberately point it at a LAN/WAN server — the UI badges the network type honestly
- 🕯️ **Five intelligent touches, one librarian** — a literary *Quill* for free-form rewriting, quick ✦ re-edit of selected text, quiet margin advice, a daily reflection prompt, and *Chronicle* summaries (weekly/monthly), all running fully offline
- 🌗 Cozy (light) & Pastel Night (dark) themes, full **Ukrainian / English** localization, system-tray-grade polish

## Download

Grab the latest build from [**Releases**](https://github.com/dreamyrt/flins/releases):

| Platform | File | Note |
|---|---|---|
| 🪟 Windows 10/11 (x64) | `Flins_..._x64-setup.exe` | auto-updates included |
| 🍎 macOS (Apple Silicon) | `Flins_..._aarch64.dmg` | unsigned (hobby project) — if Gatekeeper says "damaged", run once after install: `xattr -dr com.apple.quarantine /Applications/Flins.app` |

> ⚠️ Pre-1.0 beta. Your data format is versioned and migrations are tested, but keep the JSON backup handy while we're in beta.

## Privacy & security

- The app makes **no** telemetry or analytics requests, ever
- The one outbound call is the optional update check to GitHub Releases (once/day, pure version handshake — disable it in *Settings → Updates*)
- AI requests go only to the URL **you** configure (default: your own PC)
- Journal DB is file-permission-protected (`0600`); for full protection of the Markdown vault, use disk encryption (FileVault / BitLocker)
- Found a vulnerability? Open a private security advisory on this repo — please don't file it as a public issue

## Development

Requires [Node.js 22+](https://nodejs.org), [pnpm](https://pnpm.io), [Rust stable](https://rustup.rs) and a Tauri 2 [prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```sh
pnpm install
pnpm tauri dev      # hot-reload desktop app
pnpm tauri build    # production bundle (needs TAURI_SIGNING_* for updater artifacts)
pnpm lint && pnpm build && cargo test --manifest-path src-tauri/Cargo.toml
```

Release flow: `pnpm sync-version X.Y.Z` → commit → `git tag vX.Y.Z` → push → GitHub Actions builds, signs and opens a draft release → publish.

## Tech

React 18 · TypeScript · Vite · Tailwind (custom cozy/night palettes) · BlockNote (TipTap) · Tauri 2 · Rust (rusqlite bundled, rfd, minisign updates) · Web Audio synthesis.

---

Crafted with far too much care for a free hobby app — ✦ **dreamyr**, 2026.
