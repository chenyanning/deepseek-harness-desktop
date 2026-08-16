/**
 * DeepSeek Harness desktop shell.
 *
 * Boots the bundled DSH web backend (a self-contained `@deepseek-ai/dsh`
 * production install) on a free loopback port, waits for its readiness line,
 * then opens a native window pointed at that URL. No browser is involved.
 *
 * The backend reuses the user's existing `~/.dsh` home (credentials, settings,
 * sessions, profiles, skills), so the desktop app picks up exactly where the
 * browser GUI left off.
 */

const { app, BrowserWindow, dialog, Menu, shell } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

let backendProcess = null
let backendUrl = null
let mainWindow = null

// ── single instance ─────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  app.whenReady().then(onReady)
}

// ── backend lifecycle ───────────────────────────────────────────────────────

/** Absolute directory of the bundled DSH backend (dev vs packaged layouts). */
function backendDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, 'backend')
}

/** The compiled dsh CLI entry inside the backend bundle. */
function dshBin() {
  // node_modules lives under vendor/ so electron-builder's extraResources copy
  // (which excludes a root-level `node_modules`) keeps the whole tree intact.
  return path.join(backendDir(), 'vendor', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

/**
 * Launch the DSH web backend with an OS-assigned free port and resolve once
 * its readiness line (`dsh web: http://127.0.0.1:<port>`) appears on stdout.
 */
function startBackend() {
  return new Promise((resolve, reject) => {
    const bin = dshBin()
    const dir = backendDir()
    if (!fs.existsSync(bin)) {
      reject(new Error(`DSH backend not found at:\n${bin}`))
      return
    }

    // Electron's binary doubles as a Node runtime for child processes.
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }

    // `--expose-internals` is required by the harness's HMR loader (it gates
    // the live profile-patch watcher), and must precede the script path.
    const child = spawn(process.execPath, ['--expose-internals', bin, '--profile', 'web', '--port', '0'], {
      cwd: dir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    backendProcess = child

    let stderrBuf = ''
    let settled = false

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error(`DeepSeek Harness backend timed out while starting.\n\n${stderrBuf}`))
      }
    }, 30000)

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      process.stdout.write(`[dsh] ${text}`)
      const m = text.match(/dsh web:\s+(http:\/\/\S+)/)
      if (m && !backendUrl) {
        backendUrl = m[1]
        settled = true
        clearTimeout(timeout)
        console.log('[deepseek-harness] backend ready:', backendUrl)
        resolve(backendUrl)
      }
    })
    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString()
      process.stderr.write(chunk)
    })
    child.on('error', (err) => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        reject(err)
      }
    })
    child.on('exit', (code, signal) => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        reject(new Error(`DeepSeek Harness backend exited before it was ready (${code ?? signal}).\n\n${stderrBuf}`))
      }
    })
  })
}

/** Terminate the backend cleanly (SIGTERM → the harness's bounded shutdown). */
function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    try { backendProcess.kill('SIGTERM') } catch { /* already gone */ }
  }
  backendProcess = null
  backendUrl = null
}

// ── window ──────────────────────────────────────────────────────────────────

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'DeepSeek Harness',
    backgroundColor: '#0b0f17',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  mainWindow.loadURL(url)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Same-origin popups stay in-app; anything external opens in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (backendUrl && target.startsWith(backendUrl)) return { action: 'allow' }
    void shell.openExternal(target)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

async function ensureBackendAndWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    return
  }
  try {
    const url = backendUrl || await startBackend()
    if (process.argv.includes('--smoke')) {
      console.log('[deepseek-harness] smoke: backend ready at', url)
      stopBackend()
      setTimeout(() => app.exit(0), 200)
      return
    }
    createWindow(url)
  } catch (err) {
    dialog.showErrorBox(
      'DeepSeek Harness failed to start',
      err && err.message ? err.message : String(err),
    )
    app.quit()
  }
}

// ── menu (keeps Cmd+C/V/X/A and standard window controls working) ───────────

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── app lifecycle ───────────────────────────────────────────────────────────

function onReady() {
  buildMenu()
  void ensureBackendAndWindow()
}

app.on('activate', () => {
  void ensureBackendAndWindow()
})

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopBackend()
})
