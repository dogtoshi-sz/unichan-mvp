// Shared listing logic for GMGN and pump.fun
// Token badges + pink BUY button

import { extractCAFromUrl } from '../shared/sites'
import type { TradingContentToBackgroundMessage } from '../shared/types'

const BADGE_CLASS = 'openclaw-gmgn-badge'
const BADGE_ATTR = 'data-openclaw-badge'
const BOX_ATTR = 'data-openclaw-box'
const PINK_BUY_CLASS = 'openclaw-pink-buy'

/** Find the token row/box container (the whole card) */
function findTokenBox(link: Element): HTMLElement | null {
  let el: Element | null = link
  while (el?.parentElement) {
    el = el.parentElement
    const hasBuy = Array.from(el.querySelectorAll('button, a[role="button"]')).some(
      b => (b.textContent ?? '').toLowerCase().includes('buy'),
    )
    if (hasBuy && (el as HTMLElement).getBoundingClientRect().width >= 200)
      return el as HTMLElement
  }
  return (link.closest('tr, [class*="row"], [class*="item"], [class*="rounded"]') ?? link.parentElement?.parentElement) as HTMLElement | null
}

export const scoreCache = new Map<string, { verdict: string }>()
export const pendingCAs = new Set<string>()

function sendToBackground(msg: TradingContentToBackgroundMessage) {
  browser.runtime.sendMessage(msg).catch(() => {})
}

function verdictToLabel(verdict: string): { tag: string, attr: string } {
  if (verdict === 'bullish')
    return { tag: 'GOOD', attr: 'good' }
  if (verdict === 'neutral')
    return { tag: 'CAUTION', attr: 'caution' }
  return { tag: 'DANGER', attr: 'danger' }
}

function isNameLink(link: HTMLAnchorElement): boolean {
  const text = link.textContent?.trim() ?? ''
  const hasImg = link.querySelector('img')
  return text.length >= 2 && !(hasImg && text.length < 3)
}

function ensureBadge(link: HTMLAnchorElement, ca: string, verdict: string | null): HTMLElement {
  let badge = link.nextElementSibling as HTMLElement | null
  if (badge?.classList.contains(BADGE_CLASS))
    return badge

  badge = document.createElement('span')
  badge.className = BADGE_CLASS
  badge.setAttribute(BADGE_ATTR, ca)
  link.insertAdjacentElement('afterend', badge)
  return badge
}

function applyBoxHue(box: HTMLElement | null, ca: string, verdict: string | null) {
  if (!box)
    return
  box.setAttribute(BOX_ATTR, ca)
  box.setAttribute('data-openclaw-verdict', verdict ?? 'loading')
}

export function applyVerdict(link: HTMLAnchorElement, ca: string, verdict: string) {
  const { tag, attr } = verdictToLabel(verdict)
  const badge = ensureBadge(link, ca, verdict)
  badge.textContent = tag
  badge.setAttribute('data-verdict', attr)
  applyBoxHue(findTokenBox(link), ca, verdict)
}

function markLoading(link: HTMLAnchorElement, ca: string) {
  const badge = ensureBadge(link, ca, null)
  badge.textContent = '···'
  badge.setAttribute('data-verdict', 'loading')
}

function processLink(link: HTMLAnchorElement) {
  const ca = extractCAFromUrl(link.href)
  if (!ca)
    return

  if (!isNameLink(link))
    return

  const existing = link.nextElementSibling
  if (existing?.classList.contains(BADGE_CLASS) && existing.getAttribute(BADGE_ATTR) === ca)
    return

  const cached = scoreCache.get(ca)
  if (cached) {
    applyVerdict(link, ca, cached.verdict)
  }
  else {
    markLoading(link, ca)
    applyBoxHue(findTokenBox(link), ca, 'loading')
    if (!pendingCAs.has(ca)) {
      pendingCAs.add(ca)
      sendToBackground({ type: 'trading:request-score', payload: { contractAddress: ca } })
    }
  }
}

function injectPinkBuyButtons() {
  document.querySelectorAll('button, a[role="button"]').forEach((btn) => {
    const text = (btn.textContent ?? '').trim().toLowerCase()
    if (text !== 'buy' && !text.startsWith('buy '))
      return
    if (btn.nextElementSibling?.classList.contains(PINK_BUY_CLASS))
      return

    const pink = document.createElement('button')
    pink.className = PINK_BUY_CLASS
    pink.textContent = 'BUY'
    pink.type = 'button'
    pink.setAttribute('data-openclaw-pink', 'true')
    btn.insertAdjacentElement('afterend', pink)
  })
}

export function runListingScan(tokenLinkSelector: string) {
  document.querySelectorAll<HTMLAnchorElement>(tokenLinkSelector).forEach((link) => {
    if (!extractCAFromUrl(link.href))
      return
    processLink(link)
  })
  injectPinkBuyButtons()
}
