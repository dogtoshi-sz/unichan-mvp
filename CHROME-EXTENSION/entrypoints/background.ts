import type {
  BackgroundToContentMessage,
  BirdEyeTokenData,
  ContentToBackgroundMessage,
  ExtensionSettings,
  TokenScore,
  TradingContentToBackgroundMessage,
  TradingBackgroundToContentMessage,
} from '../src/shared/types'

import { defineInvokeHandler } from '@moeru/eventa'

import { getTokenOverview, getTokenSecurity } from '../src/background/birdeye'
import {
  createClientState,
  ensureClient,
  handlePageContext,
  handleSubtitle,
  handleVideoContext,
  handleVisionFrame,
  sendSparkNotify,
  toStatus,
} from '../src/background/client'
import { scoreToken } from '../src/background/scorer'
import { loadSettings, saveSettings } from '../src/background/storage'
import { DEFAULT_SETTINGS, STORAGE_KEY } from '../src/shared/constants'
import {
  backgroundStatusChanged,
  popupClearError,
  popupGetStatus,
  popupReconnect,
  popupRequestCurrentTabContext,
  popupRequestVisionFrame,
  popupToggleEnabled,
  popupUpdateSettings,
} from '../src/shared/eventa'
import { createRuntimeEventaContext } from '../src/shared/eventa-runtime'
import { detectSiteFromUrl } from '../src/shared/sites'

const state = createClientState()

let settings: ExtensionSettings = { ...DEFAULT_SETTINGS }

const SCORE_CACHE_TTL_MS = 60_000
const scoreCache = new Map<string, { score: TokenScore, at: number }>()

function toMintFreezeAuth(v: unknown): string | null | undefined {
  if (v === null || v === undefined)
    return v
  if (typeof v === 'string')
    return v
  return undefined
}

function mergeBirdEyeData(overview: Record<string, unknown>, security: Record<string, unknown> | null): BirdEyeTokenData {
  const liq = overview.liquidity
  const liquidity = typeof liq === 'number' ? liq : (liq && typeof liq === 'object' && 'usd' in liq) ? Number((liq as { usd?: number }).usd) : undefined

  const vol = overview.v24hUSD ?? overview.volume24h
  const volume24h = typeof vol === 'number' ? vol : undefined

  const top10 = security?.top10HolderPercent
  const top10HolderPercent = typeof top10 === 'number' ? top10 * 100 : undefined

  return {
    price: typeof overview.price === 'number' ? overview.price : undefined,
    priceChange24h: typeof overview.priceChange24hPercent === 'number' ? overview.priceChange24hPercent : undefined,
    marketCap: typeof overview.marketCap === 'number' ? overview.marketCap : undefined,
    liquidity,
    volume24h,
    holder: typeof overview.holder === 'number' ? overview.holder : undefined,
    logoURI: typeof overview.logoURI === 'string' ? overview.logoURI : undefined,
    name: typeof overview.name === 'string' ? overview.name : undefined,
    symbol: typeof overview.symbol === 'string' ? overview.symbol : undefined,
    mintAuthority: toMintFreezeAuth(security?.mint_authority ?? security?.mintAuthority),
    freezeAuthority: toMintFreezeAuth(security?.freeze_authority ?? security?.freezeAuthority),
    top10HolderPercent,
    ownerBalance: typeof security?.ownerBalance === 'number' ? security.ownerBalance : undefined,
    creatorAddress: typeof security?.creatorAddress === 'string' ? security.creatorAddress : undefined,
    createdAt: typeof security?.creationTime === 'number' ? security.creationTime : undefined,
  }
}
let lastVideoNotifyKey = ''
let lastStatusSentAt = 0
let connectionKey = ''
let eventaContext: ReturnType<typeof createRuntimeEventaContext>['context'] | undefined

async function requestVisionFrameFromTamagotchi() {
  const message: BackgroundToContentMessage = { type: 'background:request-vision-frame' }
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (tab?.id != null) {
    await browser.tabs.sendMessage(tab.id, message).catch(() => {})
  }
}

async function requestCurrentTabPageContext() {
  const message: BackgroundToContentMessage = { type: 'background:request-page-context' }
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (tab?.id != null) {
    await browser.tabs.sendMessage(tab.id, message).catch(() => {})
  }
}

async function refreshClient() {
  const nextKey = `${settings.enabled}:${settings.wsUrl}:${settings.token}`
  if (nextKey !== connectionKey) {
    connectionKey = nextKey
    if (state.client)
      state.client.close()
    state.client = null
    state.connected = false
  }
  await ensureClient(state, settings, { onRequestVisionFrame: requestVisionFrameFromTamagotchi })
}

function buildNotifyKey(payload: { url: string, title?: string, videoId?: string }) {
  return [payload.videoId, payload.title, payload.url].filter(Boolean).join('|')
}

function shouldNotifyVideo(payload: { url: string, title?: string, videoId?: string }) {
  const key = buildNotifyKey(payload)
  if (!key || key === lastVideoNotifyKey)
    return false
  lastVideoNotifyKey = key
  return true
}

function updateBadge() {
  if (!settings.enabled) {
    browser.action.setBadgeText({ text: 'OFF' })
    browser.action.setBadgeBackgroundColor({ color: '#64748b' })
  }
  else if (state.connected) {
    browser.action.setBadgeText({ text: 'ON' })
    browser.action.setBadgeBackgroundColor({ color: '#22c55e' })
  }
  else if (state.lastError) {
    browser.action.setBadgeText({ text: '!' })
    browser.action.setBadgeBackgroundColor({ color: '#ef4444' })
  }
  else {
    browser.action.setBadgeText({ text: '…' })
    browser.action.setBadgeBackgroundColor({ color: '#f59e0b' })
  }
}

function emitStatus() {
  const now = Date.now()
  if (now - lastStatusSentAt < 300)
    return

  lastStatusSentAt = now
  updateBadge()
  eventaContext?.emit(backgroundStatusChanged, toStatus(state, settings))
}

async function updateSettings(partial: Partial<ExtensionSettings>) {
  settings = await saveSettings(partial)
  await refreshClient()
  emitStatus()
}

async function init() {
  settings = await loadSettings()
  await refreshClient()
  emitStatus()
}

async function fetchBrainVerdict(score: TokenScore): Promise<string | null> {
  const brainUrl = (settings.gatewayUrl || 'http://localhost:18790').replace(/\/+$/, '')
  try {
    const res = await fetch(`${brainUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'unichan',
        stream: false,
        messages: [{
          role: 'user',
          content: `Quick 1-sentence take on this Solana token as Unichan: ${score.symbol ?? 'unknown'} | Score: ${score.score}/100 | ${score.verdict} | ${score.reasons.map(r => r.label).join(', ')}`,
        }],
      }),
    })
    if (!res.ok)
      return null
    const json = await res.json()
    return json?.choices?.[0]?.message?.content ?? null
  }
  catch {
    return null
  }
}

async function notifyWithBrain(score: TokenScore, ca: string): Promise<void> {
  if (score.score <= 75 || !state.connected)
    return

  const aiVerdict = await fetchBrainVerdict(score)
  sendSparkNotify(state, {
    headline: `Bullish token: ${score.symbol ?? ca.slice(0, 8)}… (${score.score}/100)`,
    note: aiVerdict ?? score.name ?? '',
    payload: { tokenScore: score, aiVerdict },
  })
}

async function handleTradingMessage(
  message: TradingContentToBackgroundMessage,
  sender: { tab?: { id?: number } },
): Promise<void> {
  if (!settings.tradingEnabled || !settings.birdeyeApiKey?.trim())
    return

  const tabId = sender.tab?.id
  if (tabId == null)
    return

  const ca = message.type === 'trading:request-score' || message.type === 'trading:request-launch-stats'
    ? message.payload.contractAddress
    : message.payload.contractAddress

  const cached = scoreCache.get(ca)
  if (cached && Date.now() - cached.at < SCORE_CACHE_TTL_MS) {
    const reply: TradingBackgroundToContentMessage = { type: 'trading:score-ready', payload: cached.score }
    await browser.tabs.sendMessage(tabId, reply).catch(() => {})
    void notifyWithBrain(cached.score, ca)
    return
  }

  try {
    const config = { apiKey: settings.birdeyeApiKey }
    const [overview, security] = await Promise.all([
      getTokenOverview(config, ca),
      getTokenSecurity(config, ca).catch(() => null),
    ])

    const data = mergeBirdEyeData(
      overview as Record<string, unknown>,
      security as Record<string, unknown> | null,
    )
    const score = scoreToken(ca, data)
    scoreCache.set(ca, { score, at: Date.now() })

    const reply: TradingBackgroundToContentMessage = { type: 'trading:score-ready', payload: score }
    await browser.tabs.sendMessage(tabId, reply).catch(() => {})

    void notifyWithBrain(score, ca)
  }
  catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const reply: TradingBackgroundToContentMessage = {
      type: 'trading:error',
      payload: { contractAddress: ca, error: errorMsg },
    }
    await browser.tabs.sendMessage(tabId, reply).catch(() => {})
  }
}

function handleContentMessage(message: ContentToBackgroundMessage) {
  switch (message.type) {
    case 'content:page': {
      const payload = {
        ...message.payload,
        site: message.payload.site === 'unknown' ? detectSiteFromUrl(message.payload.url) : message.payload.site,
      }
      handlePageContext(state, settings, payload)
      emitStatus()
      break
    }
    case 'content:video': {
      const payload = {
        ...message.payload,
        site: message.payload.site === 'unknown' ? detectSiteFromUrl(message.payload.url) : message.payload.site,
      }
      handleVideoContext(state, settings, payload, { notify: shouldNotifyVideo(payload) })
      emitStatus()
      break
    }
    case 'content:subtitle': {
      const payload = {
        ...message.payload,
        site: message.payload.site === 'unknown' ? detectSiteFromUrl(message.payload.url) : message.payload.site,
      }
      handleSubtitle(state, settings, payload)
      emitStatus()
      break
    }
    case 'content:vision:frame': {
      handleVisionFrame(state, settings, message.payload)
      emitStatus()
      break
    }
  }
}

export default defineBackground(() => {
  const { context } = createRuntimeEventaContext()
  eventaContext = context

  defineInvokeHandler(context, popupGetStatus, () => toStatus(state, settings))
  defineInvokeHandler(context, popupUpdateSettings, async (partial) => {
    await updateSettings(partial)
    return toStatus(state, settings)
  })

  defineInvokeHandler(context, popupToggleEnabled, async (enabled) => {
    await updateSettings({ enabled })
    return toStatus(state, settings)
  })

  defineInvokeHandler(context, popupReconnect, async () => {
    connectionKey = ''
    if (state.client) {
      state.client.close()
      state.client = null
    }
    state.lastError = undefined
    await refreshClient()
    emitStatus()
    return toStatus(state, settings)
  })

  defineInvokeHandler(context, popupRequestCurrentTabContext, async () => {
    await requestCurrentTabPageContext()
  })

  defineInvokeHandler(context, popupRequestVisionFrame, async () => {
    await requestVisionFrameFromTamagotchi()
    return toStatus(state, settings)
  })

  defineInvokeHandler(context, popupClearError, () => {
    state.lastError = undefined
    emitStatus()
    return toStatus(state, settings)
  })

  void init()

  browser.tabs.onActivated.addListener(() => {
    void requestCurrentTabPageContext()
  })

  browser.runtime.onMessage.addListener((message: unknown, sender: { tab?: { id?: number } }) => {
    if (!message || typeof message !== 'object')
      return
    if ('__eventa' in message)
      return
    const msg = message as { type?: string }
    if (typeof msg.type !== 'string')
      return
    if (msg.type.startsWith('content:')) {
      handleContentMessage(message as ContentToBackgroundMessage)
    }
    else if (msg.type.startsWith('trading:')) {
      void handleTradingMessage(message as TradingContentToBackgroundMessage, sender)
      return true
    }
  })

  browser.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEY]) {
      const next = changes[STORAGE_KEY].newValue as ExtensionSettings | undefined
      settings = { ...DEFAULT_SETTINGS, ...next }
      void refreshClient()
      emitStatus()
    }
  })
})
