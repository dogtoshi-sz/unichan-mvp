export type VideoSite = 'youtube' | 'bilibili' | 'unknown'

export interface PageContextPayload {
  site: VideoSite
  url: string
  title: string
  description?: string
  language?: string
}

export interface VideoContextPayload {
  site: VideoSite
  url: string
  title: string
  channel?: string
  videoId?: string
  durationSec?: number
  currentTimeSec?: number
  isPlaying?: boolean
  isMuted?: boolean
  volume?: number
  playbackRate?: number
  isLive?: boolean
  playerSize?: { width: number, height: number }
}

export interface SubtitlePayload {
  site: VideoSite
  url: string
  videoId?: string
  title?: string
  text: string
  language?: string
  startMs?: number
  endMs?: number
  isAuto?: boolean
}

export interface VisionFramePayload {
  site: VideoSite
  url: string
  videoId?: string
  title?: string
  capturedAt: number
  width: number
  height: number
  dataUrl: string
}

export type ContentToBackgroundMessage
  = | { type: 'content:page', payload: PageContextPayload }
    | { type: 'content:video', payload: VideoContextPayload }
    | { type: 'content:subtitle', payload: SubtitlePayload }
    | { type: 'content:vision:frame', payload: VisionFramePayload }

export interface ExtensionSettings {
  wsUrl: string
  token: string
  enabled: boolean
  sendPageContext: boolean
  sendVideoContext: boolean
  sendSubtitles: boolean
  sendSparkNotify: boolean
  enableVision: boolean
  /** Show Live2D character widget on every page (bottom-right). */
  characterWidgetEnabled: boolean
  /** URL to a Live2D model .zip (used by character widget). Empty = standalone placeholder. */
  characterModelUrl: string
  /** Optional gateway URL for future (e.g. http://localhost:18790/v1/) */
  gatewayUrl: string
  /** If true, menu (drag, Chat, Settings) is hidden until you hover over the widget. If false, menu is always visible. */
  characterMenuOnHoverOnly: boolean
  /** Character widget box width (px). */
  characterWidth: number
  /** Character widget box height (px). */
  characterHeight: number
  /** Model scale (e.g. 0.5 = smaller, 1.2 = larger). */
  characterScale: number
  /** Shift character horizontally inside the box (px). */
  characterOffsetX: number
  /** Shift character vertically inside the box (px). */
  characterOffsetY: number
  /** Enable auto blink. */
  characterBlinkEnabled: boolean
  /** Enable idle animation. */
  characterIdleAnimationEnabled: boolean
  /** Enable model shadow. */
  characterShadowEnabled: boolean
  /** When true, widget is always fixed to bottom-right of the viewport (does not disappear on window resize). */
  characterSnapToBottomRight: boolean
  /** Character box background: 'transparent' or a CSS value (e.g. 'rgba(255,255,255,0.95)' or '#fff'). */
  characterBackground: string
  /** Character box border radius (px). 0 = square. */
  characterBorderRadius: number
  /** Character box shadow: 'none' or a CSS box-shadow value. */
  characterBoxShadow: string
  /** BirdEye API key for token scoring. */
  birdeyeApiKey: string
  /** Master toggle for trading features (GMGN badges, pump.fun overlay). */
  tradingEnabled: boolean
  /** Alert when buy > this amount. */
  whaleAlertThresholdSol: number
}

export interface ExtensionStatus {
  connected: boolean
  lastError?: string
  settings: ExtensionSettings
  lastPage?: PageContextPayload
  lastVideo?: VideoContextPayload
  lastSubtitle?: SubtitlePayload
  lastVisionFrameAt?: number
}

export type BackgroundToContentMessage
  = | { type: 'background:request-vision-frame' }
  | { type: 'background:request-page-context' }

// ── Trading / Solana types ──────────────────────────────────────────

export type TradingSite = 'gmgn' | 'pumpfun' | 'dexscreener' | 'axiom' | 'unknown'

export interface TokenScore {
  contractAddress: string
  symbol?: string
  name?: string
  logoUri?: string
  score: number
  verdict: 'bullish' | 'neutral' | 'bearish' | 'danger'
  reasons: ScoreReason[]
  rawData?: BirdEyeTokenData
  scoredAt: number
}

export interface ScoreReason {
  label: string
  impact: 'positive' | 'negative' | 'neutral'
  points: number
}

export interface BirdEyeTokenData {
  price?: number
  priceChange24h?: number
  marketCap?: number
  liquidity?: number
  volume24h?: number
  holder?: number
  logoURI?: string
  name?: string
  symbol?: string
  mintAuthority?: string | null
  freezeAuthority?: string | null
  top10HolderPercent?: number
  ownerBalance?: number
  creatorAddress?: string
  createdAt?: number
}

export interface WhaleAlert {
  contractAddress: string
  walletAddress: string
  amountSol: number
  amountUsd: number
  type: 'buy' | 'sell'
  timestamp: number
  tokenSymbol?: string
}

export interface LaunchStats {
  contractAddress: string
  symbol: string
  name: string
  price: number
  priceChange: number
  marketCap: number
  holders: number
  volume24h: number
  liquidity: number
  bondingCurveProgress?: number
  logoUri?: string
  updatedAt: number
}

export type TradingContentToBackgroundMessage =
  | { type: 'trading:contract-detected', payload: { contractAddress: string, site: TradingSite, url: string } }
  | { type: 'trading:request-score', payload: { contractAddress: string } }
  | { type: 'trading:request-launch-stats', payload: { contractAddress: string } }

export type TradingBackgroundToContentMessage =
  | { type: 'trading:score-ready', payload: TokenScore }
  | { type: 'trading:launch-stats-ready', payload: LaunchStats }
  | { type: 'trading:whale-alert', payload: WhaleAlert }
  | { type: 'trading:error', payload: { contractAddress: string, error: string } }
