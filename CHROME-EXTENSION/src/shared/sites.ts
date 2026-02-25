import type { TradingSite, VideoSite } from './types'

export function detectSiteFromUrl(url: string): VideoSite {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    if (host.includes('youtube.com') || host.includes('youtu.be'))
      return 'youtube'
    if (host.includes('bilibili.com') || host.includes('b23.tv'))
      return 'bilibili'
    return 'unknown'
  }
  catch {
    return 'unknown'
  }
}

export function extractVideoId(site: VideoSite, url: string): string | undefined {
  try {
    const parsed = new URL(url)
    if (site === 'youtube') {
      if (parsed.hostname.includes('youtu.be'))
        return parsed.pathname.replace('/', '') || undefined
      return parsed.searchParams.get('v') || undefined
    }
    if (site === 'bilibili') {
      const parts = parsed.pathname.split('/').filter(Boolean)
      const videoIndex = parts.findIndex(part => part === 'video')
      if (videoIndex >= 0)
        return parts[videoIndex + 1]
      return parts[0]
    }
  }
  catch {
    return undefined
  }

  return undefined
}

export function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || ''
}

// ── Trading site detection ──────────────────────────────────────────

export function detectTradingSite(url: string): TradingSite {
  try {
    const host = new URL(url).hostname
    if (host.includes('gmgn.ai'))
      return 'gmgn'
    if (host.includes('pump.fun'))
      return 'pumpfun'
    if (host.includes('dexscreener.com'))
      return 'dexscreener'
    if (host.includes('axiom.trade'))
      return 'axiom'
    return 'unknown'
  }
  catch {
    return 'unknown'
  }
}

/** Solana CA regex (base58, 32-44 chars) */
export const SOLANA_CA_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g

export function extractSolanaAddresses(text: string): string[] {
  return [...new Set(text.match(SOLANA_CA_REGEX) ?? [])]
}

const SOLANA_CA_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function extractCAFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    for (const part of parts) {
      if (SOLANA_CA_PATTERN.test(part))
        return part
    }
    return null
  }
  catch {
    return null
  }
}
