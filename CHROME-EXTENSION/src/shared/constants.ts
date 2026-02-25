import type { ExtensionSettings } from './types'

export const DEFAULT_WS_URL = 'ws://localhost:6121/ws'

export const DEFAULT_SETTINGS: ExtensionSettings = {
  wsUrl: DEFAULT_WS_URL,
  token: '',
  enabled: true,
  sendPageContext: true,
  sendVideoContext: true,
  sendSubtitles: true,
  sendSparkNotify: true,
  enableVision: false,
  characterWidgetEnabled: true,
  characterModelUrl: '',
  gatewayUrl: 'http://localhost:18790',
  characterMenuOnHoverOnly: false,
  characterWidth: 240,
  characterHeight: 400,
  characterScale: 0.85,
  characterOffsetX: 0,
  characterOffsetY: 0,
  characterBlinkEnabled: true,
  characterIdleAnimationEnabled: true,
  characterShadowEnabled: true,
  characterSnapToBottomRight: true,
  characterBackground: 'transparent',
  characterBorderRadius: 0,
  characterBoxShadow: 'none',
  birdeyeApiKey: '',
  tradingEnabled: true,
  whaleAlertThresholdSol: 1,
}

export const STORAGE_KEY = 'airi:web-extension:settings'

/** Character widget position (bottom/right or top/left). Clear this to reset to default. */
export const CHARACTER_POSITION_STORAGE_KEY = 'airi:web-extension:character-widget-position'

/** postMessage type from content script to character iframe for mouse-follow. */
export const CHARACTER_MOUSE_POSITION_MESSAGE = 'CHARACTER_MOUSE_POSITION'

/** postMessage: content → character iframe, mouse entered/left widget (for duck). */
export const CHARACTER_HOVER_MESSAGE = 'CHARACTER_HOVER'

/** postMessage: content → character iframe, send chat message (payload: { text }). */
export const CHAT_SEND_MESSAGE = 'CHAT_SEND'

/** postMessage: character iframe → content, chat response (payload: { content?, error? }). */
export const CHAT_RESPONSE_MESSAGE = 'CHAT_RESPONSE'
