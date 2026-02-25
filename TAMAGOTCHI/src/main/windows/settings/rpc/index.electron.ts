import type { BrowserWindow } from 'electron'

import type { AutoUpdater } from '../../../services/electron/auto-updater'
import type { DevtoolsWindowManager } from '../../devtools'
import type { WidgetsWindowManager } from '../../widgets'

import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { ipcMain } from 'electron'

import { electronOpenDevtoolsWindow, electronOpenSettingsDevtools, unichanConfigGet, unichanConfigSave, unichanTestGateway, type UnichanConfigPayload } from '../../../../shared/eventa'
import { getMainWindowRef } from '../../main/index'
import { createWidgetsService } from '../../../services/airi/widgets'
import { createAutoUpdaterService, createScreenService, createWindowService } from '../../../services/electron'

// Config path: ~/.unichan/config.json (no nanobot dependency).
const UNICHAN_CONFIG_PATH = join(homedir(), '.unichan', 'config.json')

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const out = { ...target }
  for (const key of Object.keys(source)) {
    const s = source[key]
    const t = out[key]
    if (s != null && typeof s === 'object' && !Array.isArray(s) && t != null && typeof t === 'object' && !Array.isArray(t)) {
      out[key] = deepMerge(t as Record<string, unknown>, s as Record<string, unknown>)
    }
    else if (s !== undefined) {
      out[key] = s
    }
  }
  return out
}

export async function setupSettingsWindowInvokes(params: {
  settingsWindow: BrowserWindow
  widgetsManager: WidgetsWindowManager
  autoUpdater: AutoUpdater
  devtoolsMarkdownStressWindow: DevtoolsWindowManager
}) {
  // TODO: once we refactored eventa to support window-namespaced contexts,
  // we can remove the setMaxListeners call below since eventa will be able to dispatch and
  // manage events within eventa's context system.
  ipcMain.setMaxListeners(0)

  const { context } = createContext(ipcMain, params.settingsWindow)

  // When Settings window closes, tell the main window to re-sync from localStorage so its in-memory stores match
  params.settingsWindow.on('close', () => {
    getMainWindowRef()?.webContents?.send('settings-window-closed')
  })

  createScreenService({ context, window: params.settingsWindow })
  createWindowService({ context, window: params.settingsWindow })
  createWidgetsService({ context, widgetsManager: params.widgetsManager, window: params.settingsWindow })
  createAutoUpdaterService({ context, window: params.settingsWindow, service: params.autoUpdater })

  defineInvokeHandler(context, electronOpenSettingsDevtools, async () => params.settingsWindow.webContents.openDevTools({ mode: 'detach' }))
  defineInvokeHandler(context, electronOpenDevtoolsWindow, async (payload) => {
    await params.devtoolsMarkdownStressWindow.openWindow(payload?.route)
  })

  defineInvokeHandler(context, unichanConfigGet, async (): Promise<UnichanConfigPayload> => {
    try {
      const raw = await readFile(UNICHAN_CONFIG_PATH, 'utf-8')
      const data = JSON.parse(raw) as Record<string, unknown>
      return data as UnichanConfigPayload
    }
    catch {
      return {}
    }
  })

  defineInvokeHandler(context, unichanConfigSave, async (payload: UnichanConfigPayload) => {
    let current: Record<string, unknown> = {}
    try {
      const raw = await readFile(UNICHAN_CONFIG_PATH, 'utf-8')
      current = JSON.parse(raw) as Record<string, unknown>
    }
    catch {
      // file missing or invalid
    }
    const merged = deepMerge(current, payload as Record<string, unknown>)
    // When user chose "This computer", payload.gateway.baseUrl is undefined; deepMerge leaves old baseUrl in place.
    // Explicitly clear baseUrl so the saved config does not keep a remote URL (fixes restart showing "Another computer").
    const gwMerged = merged.gateway as { port?: number, baseUrl?: string, apiKey?: string } | undefined
    const gwPayload = (payload as UnichanConfigPayload).gateway
    if (gwMerged && gwPayload && (gwPayload.baseUrl === undefined || gwPayload.baseUrl === null || String(gwPayload.baseUrl).trim() === '')) {
      delete (merged.gateway as Record<string, unknown>).baseUrl
    }
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(homedir(), '.unichan'), { recursive: true })
    await writeFile(UNICHAN_CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8')

    // Tell main window the resolved gateway URL/token so it can set the brain connection without re-reading the config
    const gw = merged.gateway as { port?: number, baseUrl?: string, apiKey?: string } | undefined
    const port = gw?.port ?? 18790
    const baseUrlRaw = (gw?.baseUrl ?? '').trim()
    const baseUrl = baseUrlRaw
      ? `${(baseUrlRaw.replace(/\/models\/?$/i, '').replace(/\/?$/, '') + '/').replace(/^https:\/\//i, 'http://')}`
      : `http://localhost:${port}/v1/`
    const token = String((gw?.apiKey ?? '').trim())
    const sessionKey = String((gw?.sessionKey ?? '').trim())
    getMainWindowRef()?.webContents?.send('unichan-config-saved', { baseUrl, token, sessionKey })
  })

  defineInvokeHandler(context, unichanTestGateway, async (payload: { baseUrl: string, token: string }) => {
    const baseUrl = (payload?.baseUrl ?? '').trim().replace(/\/$/, '')
    if (!baseUrl) {
      return { ok: false, message: 'Enter the brain URL first.' }
    }
    const token = (payload?.token ?? '').trim()
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    let origin: string
    try {
      origin = new URL(baseUrl).origin
    }
    catch {
      return { ok: false, message: 'Invalid URL.' }
    }

    const healthUrl = `${origin}/health`
    const modelsUrl = `${baseUrl.replace(/\/$/, '')}/models`

    async function tryFetch(url: string): Promise<{ ok: boolean, status: number, message: string }> {
      try {
        const res = await fetch(url, { method: 'GET', headers })
        const text = await res.text()
        if (res.status === 401 || res.status === 403) {
          return { ok: false, status: res.status, message: `Authentication failed (${res.status}). Check your Gateway token.` }
        }
        if (!res.ok) {
          return { ok: false, status: res.status, message: `HTTP ${res.status}: ${res.statusText}\n${text.slice(0, 200)}` }
        }
        return { ok: true, status: res.status, message: `OK — gateway replied (${res.status}). Chat should work.` }
      }
      catch (e: any) {
        const msg = e?.message ?? String(e)
        return { ok: false, message: msg || 'Could not reach gateway.' }
      }
    }

    let result = await tryFetch(healthUrl)
    if (!result.ok) result = await tryFetch(modelsUrl)
    return result
  })
}
