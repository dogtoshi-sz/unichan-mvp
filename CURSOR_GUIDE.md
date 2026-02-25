# UNICHAN MVP — Cursor Implementation Guide

This guide tells Cursor exactly what we are building, what external repos to reference,
and how to wire everything into the existing extension codebase.

---

## Project Structure Overview

```
UNICHAN-MVP/
  BRAIN/                        ← Python nanobot (AI gateway, port 18789)
    nanobot/
      token_research.py         ← BirdEye + DexScreener token lookup (ALREADY EXISTS)
      agent/tools/token.py      ← LLM tool wrapper for token lookup (ALREADY EXISTS)
      gateway_http.py           ← HTTP gateway (ALREADY EXISTS)
  CHROME-EXTENSION/             ← WXT + Vue3 Chrome extension (THIS IS WHAT WE EXTEND)
    src/
      background/
        client.ts               ← WebSocket client → Tamagotchi port 6121 (ALREADY EXISTS)
        storage.ts              ← Extension settings storage (ALREADY EXISTS)
      content/
        index.ts                ← Current content script (YouTube/Bilibili only)
      shared/
        types.ts                ← Shared TypeScript types (ALREADY EXISTS)
        sites.ts                ← Site detection (ALREADY EXISTS)
        constants.ts            ← Default settings (ALREADY EXISTS)
    entrypoints/
      background.ts             ← Service worker entry (ALREADY EXISTS)
      content.ts                ← Content script entry (ALREADY EXISTS)
      popup/                    ← Popup UI (ALREADY EXISTS)
    wxt.config.ts               ← WXT config (NEEDS UPDATING)
  TAMAGOTCHI/                   ← Electron desktop app with Live2D character
  packages/                     ← Shared workspace packages
```

---

## What We Are Building (MVP Scope)

We are adding **Solana token intelligence** to the Chrome extension so it can:

1. **Detect token contract addresses** on any page (GMGN, pump.fun, DexScreener, etc.)
2. **Score tokens** using BirdEye API data (security, liquidity, holders, smart money)
3. **Inject visual overlays** on GMGN trenches page (green/red glow badges per token row)
4. **Show a launch dashboard** side panel for YOUR OWN token during pump.fun launch stream
5. **Fire trading events** to the Tamagotchi via existing WebSocket (port 6121) so the Live2D character reacts

---

## Reference Repos (DO NOT COPY — USE AS LOGIC REFERENCE ONLY)

### Repo 1: degenfrends/solana-rugchecker
**URL:** https://github.com/degenfrends/solana-rugchecker
**Language:** TypeScript
**Stars:** 78

**What it does:**
A modular TypeScript library that analyzes Solana tokens for rug pull risk. It checks:
- Top holder concentration (what % does the top wallet hold?)
- Liquidity pool presence on Raydium
- Token metadata validity via Metaplex
- Calculates a composite risk/rug score

**How to use it in our extension:**
- DO NOT install it as a dependency (it's a CLI/Node tool, not browser-safe)
- READ its scoring logic and port the relevant math into our own
  `CHROME-EXTENSION/src/background/scorer.ts`
- Specifically look at how it calculates holder concentration score and
  liquidity score — use those formulas in our weighted scorer
- We get the raw data from BirdEye API (not from their RPC calls),
  so just borrow the SCORING LOGIC, not the data fetching

**Key files to reference in that repo:**
- `src/rugcheck.ts` — main scoring logic
- `src/types.ts` — data shape for token analysis result

---

### Repo 2: safuco/solana-token-analyzer
**URL:** https://github.com/safuco/solana-token-analyzer
**Language:** JavaScript
**Stars:** 10

**What it does:**
A Node.js CLI that fetches token data and outputs a structured risk analysis with:
- Numerical risk score (0-100)
- Risk level label (LOW / MEDIUM / HIGH / CRITICAL)
- Liquidity metrics breakdown
- Holder distribution analysis
- Can export SVG/PNG analysis banners (useful for stream overlays)

**How to use it in our extension:**
- Reference its **risk scoring thresholds** (what score = LOW vs HIGH risk)
- Reference its **score weighting** (how much does liquidity matter vs holders vs mint auth)
- Reference the **visual badge design** — we want a similar 0-100 score badge
  injected into GMGN token rows
- The SVG banner export pattern could inspire our hover tooltip design

**Key files to reference:**
- `index.js` — main scoring + output logic
- Look at its threshold constants (e.g. `RISK_THRESHOLDS`)

---

### Repo 3: Mejatintiwari/rug-pull-detector-extension
**URL:** https://github.com/Mejatintiwari/rug-pull-detector-extension
**Language:** JavaScript (Chrome Extension MV3)
**Stars:** 0 (but readable source)

**What it does:**
A basic Chrome extension that detects rug pull risk on pump.fun and DexScreener pages.
It injects a floating risk panel showing:
- Rug Pull Risk Score (0-100)
- Contract renouncement status
- Liquidity lock status
- Ownership concentration warning
- Color-coded risk indicators

**How to use it in our extension:**
- This is the most directly useful reference because it IS a Chrome extension
- Reference its **content script injection pattern** for pump.fun and DexScreener
  — how does it find the contract address on the page?
- Reference its **DOM injection approach** — how does it add the floating panel
  without breaking the page layout?
- Reference its **manifest.json** for content script URL patterns and permissions
- Port the CA detection regex pattern into our `src/content/gmgn.ts`

**Key files to reference:**
- `manifest.json` — content script URL patterns
- `content.js` — how it finds CA on page, DOM injection
- `popup.js` — risk display logic

---

## What to Build: File by File

### STEP 1 — Add Trading Types
**File:** `CHROME-EXTENSION/src/shared/types.ts`
**Action:** ADD new types at the bottom (do not remove existing types)

```typescript
// ── Trading / Solana types ──────────────────────────────────────────

export type TradingSite = 'gmgn' | 'pumpfun' | 'dexscreener' | 'axiom' | 'unknown'

export interface TokenScore {
  contractAddress: string
  symbol?: string
  name?: string
  logoUri?: string
  score: number               // 0-100 (100 = most bullish)
  verdict: 'bullish' | 'neutral' | 'bearish' | 'danger'
  reasons: ScoreReason[]
  rawData?: BirdEyeTokenData
  scoredAt: number
}

export interface ScoreReason {
  label: string               // e.g. "No mint authority"
  impact: 'positive' | 'negative' | 'neutral'
  points: number              // e.g. +20 or -30
}

export interface BirdEyeTokenData {
  // token_overview fields
  price?: number
  priceChange24h?: number
  marketCap?: number
  liquidity?: number
  volume24h?: number
  holder?: number
  logoURI?: string
  name?: string
  symbol?: string
  // token_security fields
  mintAuthority?: string | null
  freezeAuthority?: string | null
  top10HolderPercent?: number
  ownerBalance?: number
  creatorAddress?: string
  // creation info
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
  bondingCurveProgress?: number   // 0-100, pump.fun graduation progress
  logoUri?: string
  updatedAt: number
}

// New message types (add to existing union types below)
export type TradingContentToBackgroundMessage =
  | { type: 'trading:contract-detected', payload: { contractAddress: string, site: TradingSite, url: string } }
  | { type: 'trading:request-score', payload: { contractAddress: string } }
  | { type: 'trading:request-launch-stats', payload: { contractAddress: string } }

export type TradingBackgroundToContentMessage =
  | { type: 'trading:score-ready', payload: TokenScore }
  | { type: 'trading:launch-stats-ready', payload: LaunchStats }
  | { type: 'trading:whale-alert', payload: WhaleAlert }
  | { type: 'trading:error', payload: { contractAddress: string, error: string } }
```

---

### STEP 2 — Update Site Detection
**File:** `CHROME-EXTENSION/src/shared/sites.ts`
**Action:** ADD TradingSite detection alongside existing VideoSite detection

```typescript
import type { TradingSite } from './types'

export function detectTradingSite(url: string): TradingSite {
  try {
    const host = new URL(url).hostname
    if (host.includes('gmgn.ai')) return 'gmgn'
    if (host.includes('pump.fun')) return 'pumpfun'
    if (host.includes('dexscreener.com')) return 'dexscreener'
    if (host.includes('axiom.trade')) return 'axiom'
    return 'unknown'
  }
  catch {
    return 'unknown'
  }
}

// Solana CA regex (base58, 32-44 chars)
export const SOLANA_CA_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g

export function extractSolanaAddresses(text: string): string[] {
  return [...new Set(text.match(SOLANA_CA_REGEX) ?? [])]
}

export function extractCAFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    // pump.fun/coin/ADDRESS
    // gmgn.ai/sol/token/ADDRESS
    // dexscreener.com/solana/ADDRESS
    const parts = parsed.pathname.split('/').filter(Boolean)
    for (const part of parts) {
      if (part.length >= 32 && part.length <= 44 && SOLANA_CA_REGEX.test(part)) {
        return part
      }
    }
    return null
  }
  catch {
    return null
  }
}
```

---

### STEP 3 — BirdEye API Client
**File:** `CHROME-EXTENSION/src/background/birdeye.ts` (NEW FILE)
**Action:** CREATE this file

```typescript
// BirdEye API client for token analysis
// Docs: https://docs.birdeye.so
// Called from background service worker ONLY (not content scripts)

const BIRDEYE_BASE = 'https://public-api.birdeye.so'

export interface BirdEyeConfig {
  apiKey: string
  chain?: string  // default: 'solana'
}

async function birdeyeFetch(
  config: BirdEyeConfig,
  path: string,
  params: Record<string, string> = {},
) {
  const url = new URL(`${BIRDEYE_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      'X-API-KEY': config.apiKey,
      'Accept': 'application/json',
      'x-chain': config.chain ?? 'solana',
    },
  })

  if (!res.ok) throw new Error(`BirdEye ${path} HTTP ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.message ?? 'BirdEye error')
  return json.data
}

// GET /defi/token_overview — price, mcap, volume, liquidity, holders
export async function getTokenOverview(config: BirdEyeConfig, address: string) {
  return birdeyeFetch(config, '/defi/token_overview', { address })
}

// GET /defi/token_security — mint auth, freeze auth, top holders
export async function getTokenSecurity(config: BirdEyeConfig, address: string) {
  return birdeyeFetch(config, '/defi/token_security', { address })
}

// GET /defi/token_creation_info — dev wallet, creation timestamp
export async function getTokenCreationInfo(config: BirdEyeConfig, address: string) {
  return birdeyeFetch(config, '/defi/token_creation_info', { address })
}

// GET /defi/v3/token/top_traders — top wallets trading this token
export async function getTopTraders(config: BirdEyeConfig, address: string) {
  return birdeyeFetch(config, '/defi/v3/token/top_traders', {
    address,
    time_frame: '30m',
    sort_by: 'volume',
    sort_type: 'desc',
    limit: '10',
  })
}

// GET /defi/trades/token — recent trades (for live buy/sell feed)
export async function getRecentTrades(config: BirdEyeConfig, address: string) {
  return birdeyeFetch(config, '/defi/trades/token', {
    address,
    tx_type: 'swap',
    limit: '20',
    sort_type: 'desc',
  })
}
```

---

### STEP 4 — Token Scoring Engine
**File:** `CHROME-EXTENSION/src/background/scorer.ts` (NEW FILE)
**Action:** CREATE this file
**Reference:** degenfrends/solana-rugchecker scoring logic + safuco/solana-token-analyzer thresholds

```typescript
// Token scoring engine
// Combines BirdEye data into a 0-100 bullish score
// Higher = more bullish/safer. Lower = more bearish/dangerous.
// Reference: degenfrends/solana-rugchecker (holder + liquidity scoring)
// Reference: safuco/solana-token-analyzer (risk thresholds)

import type { BirdEyeTokenData, ScoreReason, TokenScore } from '../shared/types'

const WEIGHTS = {
  noMintAuthority: 25,        // huge — can't print more tokens
  noFreezeAuthority: 15,      // important — can't freeze wallets
  liquidityAbove10k: 15,      // basic liquidity requirement
  liquidityAbove50k: 10,      // bonus for solid liquidity
  top10HoldersUnder30: 15,    // low concentration = good
  top10HoldersUnder15: 10,    // bonus for very low concentration
  hasTradeVolume: 10,         // there is actual activity
}

// Total possible: 100 points

export function scoreToken(address: string, data: BirdEyeTokenData): TokenScore {
  const reasons: ScoreReason[] = []
  let score = 0

  // ── Mint Authority ──────────────────────────────────────────────
  if (data.mintAuthority === null || data.mintAuthority === '') {
    score += WEIGHTS.noMintAuthority
    reasons.push({ label: 'No mint authority ✅', impact: 'positive', points: WEIGHTS.noMintAuthority })
  }
  else {
    reasons.push({ label: 'Mint authority active ⚠️', impact: 'negative', points: 0 })
  }

  // ── Freeze Authority ────────────────────────────────────────────
  if (data.freezeAuthority === null || data.freezeAuthority === '') {
    score += WEIGHTS.noFreezeAuthority
    reasons.push({ label: 'No freeze authority ✅', impact: 'positive', points: WEIGHTS.noFreezeAuthority })
  }
  else {
    reasons.push({ label: 'Freeze authority active ⚠️', impact: 'negative', points: 0 })
  }

  // ── Liquidity ───────────────────────────────────────────────────
  const liq = data.liquidity ?? 0
  if (liq >= 50_000) {
    score += WEIGHTS.liquidityAbove10k + WEIGHTS.liquidityAbove50k
    reasons.push({ label: `Liquidity $${(liq / 1000).toFixed(0)}K ✅`, impact: 'positive', points: WEIGHTS.liquidityAbove10k + WEIGHTS.liquidityAbove50k })
  }
  else if (liq >= 10_000) {
    score += WEIGHTS.liquidityAbove10k
    reasons.push({ label: `Liquidity $${(liq / 1000).toFixed(0)}K 🟡`, impact: 'positive', points: WEIGHTS.liquidityAbove10k })
  }
  else {
    reasons.push({ label: `Low liquidity $${liq.toFixed(0)} ❌`, impact: 'negative', points: 0 })
  }

  // ── Holder Concentration ────────────────────────────────────────
  const top10 = data.top10HolderPercent ?? 100
  if (top10 <= 15) {
    score += WEIGHTS.top10HoldersUnder30 + WEIGHTS.top10HoldersUnder15
    reasons.push({ label: `Top 10 holders: ${top10.toFixed(1)}% ✅`, impact: 'positive', points: WEIGHTS.top10HoldersUnder30 + WEIGHTS.top10HoldersUnder15 })
  }
  else if (top10 <= 30) {
    score += WEIGHTS.top10HoldersUnder30
    reasons.push({ label: `Top 10 holders: ${top10.toFixed(1)}% 🟡`, impact: 'positive', points: WEIGHTS.top10HoldersUnder30 })
  }
  else {
    reasons.push({ label: `Top 10 holders: ${top10.toFixed(1)}% ❌`, impact: 'negative', points: 0 })
  }

  // ── Volume ──────────────────────────────────────────────────────
  const vol = data.volume24h ?? 0
  if (vol > 1000) {
    score += WEIGHTS.hasTradeVolume
    reasons.push({ label: `24h volume $${(vol / 1000).toFixed(0)}K ✅`, impact: 'positive', points: WEIGHTS.hasTradeVolume })
  }
  else {
    reasons.push({ label: 'Low/no trading volume ❌', impact: 'negative', points: 0 })
  }

  // ── Verdict ─────────────────────────────────────────────────────
  const verdict
    = score >= 75 ? 'bullish'
      : score >= 50 ? 'neutral'
        : score >= 25 ? 'bearish'
          : 'danger'

  return {
    contractAddress: address,
    symbol: data.symbol,
    name: data.name,
    logoUri: data.logoURI,
    score,
    verdict,
    reasons,
    rawData: data,
    scoredAt: Date.now(),
  }
}
```

---

### STEP 5 — GMGN Content Script
**File:** `CHROME-EXTENSION/src/content/gmgn.ts` (NEW FILE)
**Action:** CREATE this file
**Reference:** Mejatintiwari/rug-pull-detector-extension content.js (CA detection + DOM injection)

```typescript
// GMGN.ai content script
// Watches the trenches page for new token rows,
// extracts contract addresses, requests scores from background,
// and injects bullish/bearish overlay badges.

import { extractCAFromUrl } from '../shared/sites'
import type { TradingBackgroundToContentMessage, TradingContentToBackgroundMessage } from '../shared/types'

const PROCESSED_ATTR = 'data-openclaw-processed'
const BADGE_CLASS = 'openclaw-badge'

// Cache so we don't re-request the same CA
const scoreCache = new Map<string, { score: number, verdict: string, reasons: string[] }>()
const pendingCAs = new Set<string>()

function sendToBackground(msg: TradingContentToBackgroundMessage) {
  browser.runtime.sendMessage(msg).catch(() => {})
}

// ── Badge Injection ──────────────────────────────────────────────────
function injectBadge(row: Element, ca: string) {
  if (row.querySelector(`.${BADGE_CLASS}`)) return

  const cached = scoreCache.get(ca)

  const badge = document.createElement('div')
  badge.className = BADGE_CLASS
  badge.dataset.ca = ca

  if (cached) {
    renderBadge(badge, cached)
  }
  else {
    badge.innerHTML = `<span class="openclaw-loading">🦞 ...</span>`
    if (!pendingCAs.has(ca)) {
      pendingCAs.add(ca)
      sendToBackground({ type: 'trading:request-score', payload: { contractAddress: ca } })
    }
  }

  // Insert at the start of the row
  row.prepend(badge)
}

function renderBadge(badge: HTMLElement, data: { score: number, verdict: string, reasons: string[] }) {
  const color = data.verdict === 'bullish' ? '#00ff88'
    : data.verdict === 'neutral' ? '#f59e0b'
      : data.verdict === 'bearish' ? '#ff6b35'
        : '#ff4444'

  badge.innerHTML = `
    <div class="openclaw-score" style="color: ${color}; border-color: ${color}">
      <span class="openclaw-score-num">${data.score}</span>
      <span class="openclaw-score-label">${data.verdict.toUpperCase()}</span>
      <div class="openclaw-tooltip">
        <div class="openclaw-tooltip-title">🦞 OpenClaw Score: ${data.score}/100</div>
        ${data.reasons.map(r => `<div class="openclaw-tooltip-row">${r}</div>`).join('')}
      </div>
    </div>
  `

  // Glow effect on the parent row
  const row = badge.closest('tr, [class*="row"], [class*="item"]') as HTMLElement | null
  if (row) {
    row.style.boxShadow = `inset 3px 0 0 ${color}`
    row.style.transition = 'box-shadow 0.3s ease'
  }
}

// ── Row Scanner ──────────────────────────────────────────────────────
function scanRows() {
  // Strategy 1: find all links to token pages and get their parent rows
  const tokenLinks = document.querySelectorAll<HTMLAnchorElement>(
    'a[href*="/sol/token/"], a[href*="/token/"]'
  )

  tokenLinks.forEach((link) => {
    const ca = extractCAFromUrl(link.href)
    if (!ca) return

    // Walk up to the row container
    const row = link.closest('tr, [class*="row"], [class*="item"], [class*="token"]') ?? link.parentElement
    if (!row || row.hasAttribute(PROCESSED_ATTR)) return

    row.setAttribute(PROCESSED_ATTR, 'true')
    injectBadge(row, ca)
  })
}

// ── Listen for scores from background ───────────────────────────────
browser.runtime.onMessage.addListener((msg: TradingBackgroundToContentMessage) => {
  if (msg.type !== 'trading:score-ready') return

  const { contractAddress, score, verdict, reasons } = msg.payload
  const reasonLabels = reasons.map(r => r.label)

  scoreCache.set(contractAddress, { score, verdict, reasons: reasonLabels })
  pendingCAs.delete(contractAddress)

  // Update any badge already in DOM for this CA
  document.querySelectorAll<HTMLElement>(`.${BADGE_CLASS}[data-ca="${contractAddress}"]`).forEach((badge) => {
    renderBadge(badge, { score, verdict, reasons: reasonLabels })
  })
})

// ── MutationObserver (GMGN is a React SPA) ──────────────────────────
const observer = new MutationObserver(() => scanRows())
observer.observe(document.body, { childList: true, subtree: true })

// Initial scan
scanRows()

// Also re-scan on navigation (SPA route changes)
let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(scanRows, 500) // wait for React to render
  }
}).observe(document, { subtree: true, childList: true })
```

---

### STEP 6 — GMGN CSS
**File:** `CHROME-EXTENSION/src/content/gmgn.css` (NEW FILE)

```css
.openclaw-badge {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin-right: 6px;
  position: relative;
  z-index: 9999;
}

.openclaw-loading {
  font-size: 10px;
  opacity: 0.5;
  animation: openclaw-pulse 1.5s infinite;
}

.openclaw-score {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid currentColor;
  background: rgba(0, 0, 0, 0.5);
  cursor: pointer;
  font-family: ui-monospace, monospace;
  line-height: 1;
  min-width: 40px;
}

.openclaw-score-num {
  font-size: 13px;
  font-weight: 800;
}

.openclaw-score-label {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.05em;
  opacity: 0.8;
}

/* Tooltip */
.openclaw-tooltip {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: #0f0f17;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 10px;
  padding: 10px 12px;
  width: 220px;
  z-index: 99999;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}

.openclaw-score:hover .openclaw-tooltip {
  display: block;
}

.openclaw-tooltip-title {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 6px;
  font-family: ui-monospace, monospace;
}

.openclaw-tooltip-row {
  font-size: 11px;
  color: rgba(255,255,255,0.75);
  padding: 2px 0;
  font-family: ui-rounded, system-ui, sans-serif;
}

@keyframes openclaw-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}
```

---

### STEP 7 — Update WXT Config
**File:** `CHROME-EXTENSION/wxt.config.ts`
**Action:** Add new content scripts for GMGN and pump.fun

Add inside the `manifest` object:
```typescript
content_scripts: [
  {
    matches: ['https://gmgn.ai/*'],
    js: ['src/content/gmgn.ts'],
    css: ['src/content/gmgn.css'],
    run_at: 'document_idle',
  },
  {
    matches: ['https://pump.fun/*'],
    js: ['src/content/pumpfun.ts'],
    css: ['src/content/gmgn.css'],  // reuse same CSS
    run_at: 'document_idle',
  },
],
```

---

### STEP 8 — Update Background to Handle Trading Messages
**File:** `CHROME-EXTENSION/entrypoints/background.ts`
**Action:** ADD trading message handler alongside existing handlers

When background receives `trading:request-score`:
1. Call `getTokenOverview()` + `getTokenSecurity()` from `birdeye.ts`
2. Merge results into `BirdEyeTokenData`
3. Call `scoreToken()` from `scorer.ts`
4. Send `trading:score-ready` back to the tab that requested it
5. Also forward a `spark:notify` to Tamagotchi via existing `sendSparkNotify()` if score > 75

Use `chrome.tabs.sendMessage(tabId, msg)` to reply to the content script.
Get the `tabId` from the `sender` parameter of `chrome.runtime.onMessage`.

---

### STEP 9 — Add BirdEye Key to Settings
**File:** `CHROME-EXTENSION/src/shared/types.ts`
**Action:** Add to `ExtensionSettings` interface:

```typescript
// Trading settings
birdeyeApiKey: string           // BirdEye API key
tradingEnabled: boolean         // Master toggle for trading features
whaleAlertThresholdSol: number  // Alert when buy > this amount (default: 1)
```

**File:** `CHROME-EXTENSION/src/shared/constants.ts`
**Action:** Add defaults:

```typescript
birdeyeApiKey: '',
tradingEnabled: true,
whaleAlertThresholdSol: 1,
```

**File:** `CHROME-EXTENSION/entrypoints/popup/App.vue`
**Action:** Add a "Trading" settings section with BirdEye API key input field.

---

## Data Flow Summary

```
User opens gmgn.ai/sol/trenches
         │
         ▼
gmgn.ts content script runs
  MutationObserver watches for new token rows
  Finds <a href="/sol/token/XXXXXXXXX"> links
  Extracts contract address
  Injects loading badge into row
  Sends { type: 'trading:request-score', ca: 'XXX' } to background
         │
         ▼
background.ts service worker
  Receives request
  Calls BirdEye:
    - getTokenOverview(ca)    → price, mcap, volume, liquidity, holders
    - getTokenSecurity(ca)    → mintAuth, freezeAuth, top10Holders
  Merges into BirdEyeTokenData
  Calls scoreToken(ca, data) → TokenScore { score: 82, verdict: 'bullish', reasons: [...] }
  Sends { type: 'trading:score-ready', payload: TokenScore } back to tab
  If score > 75: sends spark:notify to Tamagotchi (port 6121)
         │
         ▼
gmgn.ts receives score
  Updates badge: green glow, "82 BULLISH"
  Hover tooltip shows breakdown
         │
         ▼ (if score > 75)
Tamagotchi (Electron)
  Receives spark:notify
  Live2D character reacts: excited animation + voice line
```

---

## BirdEye Endpoints Used in MVP

| Endpoint | Purpose | Called When |
|----------|---------|------------|
| `GET /defi/token_overview` | Price, mcap, volume, liquidity, holders | Every token in GMGN row |
| `GET /defi/token_security` | Mint auth, freeze auth, top 10 holders | Every token in GMGN row |
| `GET /defi/token_creation_info` | Dev wallet, created timestamp | Phase 2 |
| `GET /defi/v3/token/top_traders` | Smart money detection | On hover/click (Phase 2) |
| `GET /defi/trades/token` | Live buy/sell feed | Launch dashboard polling |

---

## Important Notes for Cursor

1. **Do NOT install solana-rugchecker as a package** — it's Node.js, not browser-safe.
   Only borrow its scoring math/logic and port to TypeScript manually.

2. **All BirdEye calls go in background.ts ONLY** — content scripts cannot make
   cross-origin requests to BirdEye API. Only the service worker can.

3. **The existing WebSocket to Tamagotchi (port 6121) is already wired.**
   Use the existing `sendSparkNotify()` in `client.ts` to send trading events.
   Do NOT create a second WebSocket connection.

4. **GMGN uses React (SPA)** — DOM changes without page reload. Always use
   MutationObserver + check if already processed via `data-openclaw-processed` attr.

5. **Class names on GMGN are obfuscated** — use stable selectors like
   `a[href*="/sol/token/"]` instead of class names. Class names change with deploys.

6. **The nanobot (BRAIN/) already has BirdEye wired** via `token_research.py`.
   The extension calls BirdEye DIRECTLY (not through nanobot) to avoid latency.
   Nanobot is used for AI chat/reasoning only.

7. **Build order matters:**
   - First: types.ts + sites.ts (shared foundation)
   - Then: birdeye.ts + scorer.ts (background logic)
   - Then: gmgn.ts + gmgn.css (content script)
   - Then: update background.ts to wire it all together
   - Last: popup settings UI
