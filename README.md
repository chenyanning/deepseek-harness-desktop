# DeepSeek Harness Desktop

A self-contained **macOS desktop app** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the full browser GUI wrapped in a native window. No browser required: double-click it and the whole harness (backend + web UI) starts and opens in a window.

> This is an independent community wrapper. It is **not** an official DeepSeek product. The bundled `@deepseek-ai/dsh` harness is DeepSeek's open-source (MIT) project, and the whale mark in the icon is reproduced from the harness's own MIT-licensed `favicon.svg`.

## Features

- **No browser** — an Electron window loads the exact same web GUI served by `dsh web`.
- **Self-contained** — bundles a production install of `@deepseek-ai/dsh` (backend + frontend dist + native modules).
- **Reuses `~/.dsh`** — your model, API key, sessions, skills, and settings carry over automatically.
- **Free port** — binds `127.0.0.1` on an OS-assigned port (no conflict with port 3080).
- **Image input** — paste or drop images into the chat; the bundled DeepSeek adapter is patched to send them as native vision input (`deepseek-v4-pro` image reasoning).
- **Clean lifecycle** — closing the window stops the backend; re-opening restarts it; `⌘Q` quits everything.

## How it works

`main.cjs` (the Electron main process) does three things:

1. Spawns the bundled backend as a Node child with `ELECTRON_RUN_AS_NODE=1 --expose-internals` on a free port.
2. Waits for the `dsh web: http://127.0.0.1:<port>` readiness line.
3. Opens a `BrowserWindow` at that URL.

## Prerequisites

- macOS (Apple Silicon, arm64)
- Node.js `^22.19.0 || >=24.0.0`
- npm

## Quick start (development)

```bash
npm install                               # electron + electron-builder
node node_modules/electron/install.js     # download the Electron binary (electron 43 has no postinstall)
npm run setup:backend                     # install @deepseek-ai/dsh into backend/vendor/node_modules
npm start                                 # launch the app in dev mode
```

## Build the .app / .zip / .dmg

```bash
npm run setup:backend
npm run dist                              # → release/
```

`electron-builder` downloads the Electron distribution on the first build. In China, point it at a mirror for much faster downloads:

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm run dist
```

## Project structure

```
main.cjs                     Electron main process (backend lifecycle + window)
package.json                 app metadata + electron-builder config
scripts/setup-backend.sh     builds the self-contained backend
scripts/render-icon.mjs      regenerates build/icon.png (needs sharp)
backend/package.json         declares the bundled @deepseek-ai/dsh dependency
backend/vendor/              generated backend install (gitignored)
build/                       app icon (icon.png / icon.svg)
```

## Icon

The icon is the DeepSeek whale mark on a blue tile. To regenerate it:

```bash
npm i -D sharp
npm run icon
```

## License

[MIT](./LICENSE) © 2026 chenyanning.

The DeepSeek name and whale logo are trademarks of DeepSeek; they are used here only to identify the wrapped open-source harness.
