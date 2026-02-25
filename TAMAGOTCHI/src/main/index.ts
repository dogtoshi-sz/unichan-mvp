import { homedir, userInfo } from 'node:os'
import { join } from 'node:path'
import { env, platform } from 'node:process'

// Redact username and home path from all stdout/stderr (universal log privacy)
function installStreamRedaction() {
  const home = homedir()
  const username = userInfo().username
  const redact = (chunk: string | Buffer): string | Buffer => {
    if (typeof chunk === 'string') {
      let s = chunk
      if (home && s.includes(home)) s = s.split(home).join('~')
      if (username && username !== 'USER' && s.includes(username)) s = s.split(username).join('USER')
      return s
    }
    try {
      let s = chunk.toString('utf8')
      if (home && s.includes(home)) s = s.split(home).join('~')
      if (username && username !== 'USER' && s.includes(username)) s = s.split(username).join('USER')
      return Buffer.from(s, 'utf8')
    } catch {
      return chunk
    }
  }
  const wrap = (stream: NodeJS.WriteStream) => {
    const orig = stream.write.bind(stream) as (chunk: unknown, ...args: unknown[]) => boolean
    stream.write = function (chunk: unknown, ...args: unknown[]) {
      return orig(redact(chunk as string | Buffer), ...args)
    }
  }
  wrap(process.stdout)
  wrap(process.stderr)
}
installStreamRedaction()

import { electronApp, optimizer } from '@electron-toolkit/utils'
import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'
import { initScreenCaptureForMain } from '@proj-airi/electron-screen-capture/main'
import { app, ipcMain } from 'electron'
import { noop } from 'es-toolkit'
import { createLoggLogger, injeca } from 'injeca'
import { isLinux } from 'std-env'

import icon from '../../resources/icon.png?asset'

import { openDebugger, setupDebugger } from './app/debugger'
import { emitAppBeforeQuit, emitAppReady, emitAppWindowAllClosed } from './libs/bootkit/lifecycle'
import { setElectronMainDirname } from './libs/electron/location'
import { setupServerChannelHandlers } from './services/airi/channel-server'
import { setupAutoUpdater } from './services/electron/auto-updater'
import { setupTray } from './tray'
import { setupAboutWindowReusable } from './windows/about'
import { setupBeatSync } from './windows/beat-sync'
import { setupCaptionWindowManager } from './windows/caption'
import { setupChatWindowReusableFunc } from './windows/chat'
import { setupDevtoolsWindow } from './windows/devtools'
import { setupMainWindow } from './windows/main'
import { setupNoticeWindowManager } from './windows/notice'
import { setupSettingsWindowReusableFunc } from './windows/settings'
import { setupWidgetsWindowManager } from './windows/widgets'

// TODO: once we refactored eventa to support window-namespaced contexts,
// we can remove the setMaxListeners call below since eventa will be able to dispatch and
// manage events within eventa's context system.
ipcMain.setMaxListeners(100)

setElectronMainDirname(__dirname)

// Use a dedicated writable userData path to avoid "Access is denied" / "Unable to create cache"
// on Windows when running from restricted folders (e.g. Downloads) or when AppData is locked.
const customUserData = join(homedir(), '.unichan', 'electron-tamagotchi')
app.setPath('userData', customUserData)

setGlobalFormat(Format.Pretty)
setGlobalLogLevel(LogLevel.Log)
setupDebugger()

// Clamp negative timeouts to 0 to avoid Node "TimeoutNegativeWarning" from deps (e.g. widgets, animations)
const origSetTimeout = global.setTimeout
const origSetInterval = global.setInterval
global.setTimeout = function (fn: TimerHandler, delay?: number, ...args: any[]): ReturnType<typeof setTimeout> {
  const d = typeof delay === 'number' && delay < 0 ? 0 : delay
  return origSetTimeout(fn, d, ...args) as ReturnType<typeof setTimeout>
}
global.setInterval = function (fn: TimerHandler, delay?: number, ...args: any[]): ReturnType<typeof setInterval> {
  const d = typeof delay === 'number' && delay < 0 ? 0 : delay
  return origSetInterval(fn, d, ...args) as ReturnType<typeof setInterval>
}

const log = useLogg('main').useGlobalConfig()

// Silence injeca lifecycle logs (BEFORE RUN provide / RUN provide) by using Warn level for the injeca namespace.
// Must be set at load time so it applies before any injeca.provide() / start().
injeca.setLogger(createLoggLogger(useLogg('injeca').withLogLevel(LogLevel.Warning).useGlobalConfig()))

// Thanks to [@blurymind](https://github.com/blurymind),
//
// When running Electron on Linux, navigator.gpu.requestAdapter() fails.
// In order to enable WebGPU and process the shaders fast enough, we need the following
// command line switches to be set.
//
// https://github.com/electron/electron/issues/41763#issuecomment-2051725363
// https://github.com/electron/electron/issues/41763#issuecomment-3143338995
if (isLinux) {
  app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer')
  app.commandLine.appendSwitch('enable-unsafe-webgpu')
  app.commandLine.appendSwitch('enable-features', 'Vulkan')

  // NOTICE: we need UseOzonePlatform, WaylandWindowDecorations for working on Wayland.
  // Partially related to https://github.com/electron/electron/issues/41551, since X11 is deprecating now,
  // we can safely remove the feature flags for Electron once they made it default supported.
  // Fixes: https://github.com/moeru-ai/airi/issues/757
  // Ref: https://github.com/mmaura/poe2linuxcompanion/blob/90664607a147ea5ccea28df6139bd95fb0ebab0e/electron/main/index.ts#L28-L46
  if (env.XDG_SESSION_TYPE === 'wayland') {
    app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')

    app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform')
    app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations')
  }
}

app.dock?.setIcon(icon)
electronApp.setAppUserModelId('ai.moeru.airi')

initScreenCaptureForMain()

app.whenReady().then(async () => {
  const serverChannel = injeca.provide('modules:channel-server', () => setupServerChannelHandlers())
  const autoUpdater = injeca.provide('services:auto-updater', () => setupAutoUpdater())
  const widgetsManager = injeca.provide('windows:widgets', () => setupWidgetsWindowManager())
  const noticeWindow = injeca.provide('windows:notice', () => setupNoticeWindowManager())
  const aboutWindow = injeca.provide('windows:about', {
    dependsOn: { autoUpdater },
    build: ({ dependsOn }) => setupAboutWindowReusable(dependsOn),
  })

  // BeatSync will create a background window to capture and process audio.
  const beatSync = injeca.provide('windows:beat-sync', () => setupBeatSync())
  const devtoolsMarkdownStressWindow = injeca.provide('windows:devtools:markdown-stress', () => setupDevtoolsWindow())

  const chatWindow = injeca.provide('windows:chat', {
    dependsOn: { widgetsManager },
    build: ({ dependsOn }) => setupChatWindowReusableFunc(dependsOn),
  })

  const settingsWindow = injeca.provide('windows:settings', {
    dependsOn: { widgetsManager, beatSync, autoUpdater, devtoolsMarkdownStressWindow },
    build: async ({ dependsOn }) => setupSettingsWindowReusableFunc(dependsOn),
  })

  const mainWindow = injeca.provide('windows:main', {
    dependsOn: { settingsWindow, chatWindow, widgetsManager, noticeWindow, beatSync, autoUpdater },
    build: async ({ dependsOn }) => setupMainWindow(dependsOn),
  })

  const captionWindow = injeca.provide('windows:caption', {
    dependsOn: { mainWindow },
    build: async ({ dependsOn }) => setupCaptionWindowManager(dependsOn),
  })

  const tray = injeca.provide('app:tray', {
    dependsOn: { mainWindow, settingsWindow, captionWindow, widgetsWindow: widgetsManager, beatSyncBgWindow: beatSync, aboutWindow },
    build: async ({ dependsOn }) => setupTray(dependsOn),
  })

  injeca.invoke({
    dependsOn: { mainWindow, tray, serverChannel },
    callback: noop,
  })

  injeca.start().catch(err => console.error(err))

  // Lifecycle
  emitAppReady()

  // Extra
  openDebugger()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
}).catch((err) => {
  log.withError(err).error('Error during app initialization')
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  emitAppWindowAllClosed()

  if (platform !== 'darwin') {
    app.quit()
  }
})

// Clean up server and intervals when app quits
app.on('before-quit', async () => {
  emitAppBeforeQuit()
  injeca.stop()
})
