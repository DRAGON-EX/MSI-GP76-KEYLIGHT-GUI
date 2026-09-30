// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 DRAGON-EX
const { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')

let backend = null
let window = null
const externalLinks = Object.freeze({
  github: 'https://github.com/DRAGON-EX',
  youtube: 'https://www.youtube.com/@FireDragonX3',
  mixcloud: 'https://www.mixcloud.com/DRAGON-X/',
  upstream: 'https://github.com/Askannz/msi-perkeyrgb',
})
ipcMain.on('gp76:close-app', event => {
  if (event.sender === window?.webContents) app.quit()
})
ipcMain.on('gp76:open-link', (event, link) => {
  if (event.sender === window?.webContents && Object.hasOwn(externalLinks, link)) shell.openExternal(externalLinks[link])
})
const integrationFile = () => path.join(app.getPath('userData'), 'integration.json')
const appImagePath = () => process.env.APPIMAGE && path.isAbsolute(process.env.APPIMAGE) ? process.env.APPIMAGE : null
const dataHome = () => path.isAbsolute(process.env.XDG_DATA_HOME || '') ? process.env.XDG_DATA_HOME : path.join(os.homedir(), '.local', 'share')

async function integrationChoice() {
  try {
    const data = JSON.parse(await fs.readFile(integrationFile(), 'utf8'))
    return data.choice === 'installed' || data.choice === 'skipped' ? data.choice : null
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return null
    throw error
  }
}

async function saveIntegrationChoice(choice) {
  await fs.mkdir(path.dirname(integrationFile()), { recursive: true })
  await fs.writeFile(integrationFile(), JSON.stringify({ choice }) + '\n', { mode: 0o600 })
}

function desktopQuoted(value) {
  if (/[\r\n]/.test(value)) throw new Error('Invalid AppImage path.')
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')}"`
}

async function installLauncher() {
  const executable = appImagePath()
  if (!executable) throw new Error('This option is available only in the AppImage.')
  const image = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 256, height: 256 })
  if (image.isEmpty()) throw new Error('The application icon could not be loaded.')
  const applications = path.join(dataHome(), 'applications')
  const icons = path.join(dataHome(), 'icons', 'hicolor', '256x256', 'apps')
  await fs.mkdir(applications, { recursive: true })
  await fs.mkdir(icons, { recursive: true })
  await fs.writeFile(path.join(icons, 'msi-gp76-keylight.png'), image.toPNG())
  const entry = `[Desktop Entry]\n# SPDX-License-Identifier: GPL-3.0-only\n# Copyright (C) 2026 DRAGON-EX\nType=Application\nName=MSI-GP76-KEYLIGHT\nComment=GP76 keyboard lighting editor\nExec=${desktopQuoted(executable)} --no-sandbox\nIcon=msi-gp76-keylight\nTerminal=false\nCategories=Utility;\nStartupWMClass=com.dragonex.msi-gp76-keylight\n`
  await fs.writeFile(path.join(applications, 'msi-gp76-keylight.desktop'), entry, { mode: 0o644 })
}

ipcMain.handle('gp76:integration-status', async event => {
  if (event.sender !== window?.webContents) throw new Error('Invalid window.')
  if (!appImagePath()) return { available: false, prompt: false }
  const choice = await integrationChoice()
  if (choice === 'installed') {
    await installLauncher()
    return { available: true, prompt: false, installed: true }
  }
  return { available: true, prompt: choice === null, installed: false }
})
ipcMain.handle('gp76:integration-choice', async (event, choice) => {
  if (event.sender !== window?.webContents) throw new Error('Invalid window.')
  if (choice !== 'installed' && choice !== 'skipped') throw new Error('Invalid choice.')
  if (choice === 'installed') await installLauncher()
  await saveIntegrationChoice(choice)
  return { installed: choice === 'installed' }
})
const startupArgs = process.argv.slice(1)
const suppressWarning = startupArgs.includes('--supress-warning') || startupArgs.includes('--suppress-warning') || startupArgs.some((arg, index) => arg === '--supress' && startupArgs[index + 1] === 'warning')

const hasInstanceLock = app.requestSingleInstanceLock()
if (!hasInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}

async function waitForBackend(url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${url}/api/state`)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('The local GP76 service could not be started.')
}

async function launch() {
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  const backendRoot = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked') : __dirname
  backend = spawn('python3', [path.join(backendRoot, 'server.py')], {
    cwd: backendRoot,
    env: {
      ...process.env,
      GP76_GUI_PORT: String(port),
      GP76_EXTENSION_DIR: path.join(backendRoot, 'vendor', 'GP76 Extension'),
      GP76_STAGE_EXTENSION: app.isPackaged ? '1' : '0',
      GP76_GUI_DATA_DIR: app.isPackaged ? app.getPath('userData') : path.join(__dirname, 'data'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  backend.stdout.on('data', chunk => process.stdout.write(chunk))
  backend.stderr.on('data', chunk => process.stderr.write(chunk))
  await waitForBackend(url)

  window = new BrowserWindow({
    title: 'MSI-GP76-KEYLIGHT',
    icon: path.join(__dirname, 'icon.png'),
    width: 1080,
    height: 570,
    minWidth: 960,
    minHeight: 530,
    backgroundColor: '#111216',
    show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: false, preload: path.join(__dirname, 'electron-preload.cjs') },
  })
  window.once('ready-to-show', () => window.show())
  window.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(url + '/')) event.preventDefault()
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  await window.loadURL(suppressWarning ? `${url}/?suppressWarning=1` : url)
}

if (hasInstanceLock) {
  app.whenReady().then(launch).catch(error => {
    dialog.showErrorBox('MSI-GP76-KEYLIGHT', error.message)
    app.quit()
  })
}
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  if (backend && !backend.killed) backend.kill('SIGTERM')
})
