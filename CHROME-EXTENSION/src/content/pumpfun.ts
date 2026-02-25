// pump.fun content script
// Token page: floating verdict badge.
// Listing page: inline badges + pink BUY button.

import { extractCAFromUrl } from '../shared/sites'
import type { TradingBackgroundToContentMessage, TradingContentToBackgroundMessage } from '../shared/types'
import { applyVerdict, runListingScan, scoreCache, pendingCAs } from './listing-shared'

const BADGE_ID = 'openclaw-pf-badge'
const TOKEN_LINK_SELECTOR = 'a[href*="/coin/"]'

function sendToBackground(msg: TradingContentToBackgroundMessage) {
  browser.runtime.sendMessage(msg).catch(() => {})
}

function isTokenPage(): boolean {
  return !!extractCAFromUrl(location.href)
}

function verdictToLabel(verdict: string): { text: string, attr: string } {
  if (verdict === 'bullish')
    return { text: 'GOOD', attr: 'good' }
  if (verdict === 'neutral')
    return { text: 'CAUTION', attr: 'caution' }
  return { text: 'DANGER', attr: 'danger' }
}

function ensureBadge(): HTMLElement {
  let el = document.getElementById(BADGE_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = BADGE_ID
    el.className = 'openclaw-pf-badge'
    el.innerHTML = '<span class="openclaw-pf-dot"></span><span class="openclaw-pf-text"></span>'
    document.body.appendChild(el)
  }
  return el
}

function setBadgeVerdict(verdict: string) {
  const badge = ensureBadge()
  const { text, attr } = verdictToLabel(verdict)
  badge.setAttribute('data-verdict', attr)
  const textEl = badge.querySelector('.openclaw-pf-text')
  if (textEl)
    textEl.textContent = text
}

function setBadgeLoading() {
  const badge = ensureBadge()
  badge.setAttribute('data-verdict', 'loading')
  const textEl = badge.querySelector('.openclaw-pf-text')
  if (textEl)
    textEl.textContent = 'Scanning…'
}

function setBadgeError() {
  const badge = ensureBadge()
  badge.setAttribute('data-verdict', 'danger')
  const textEl = badge.querySelector('.openclaw-pf-text')
  if (textEl)
    textEl.textContent = 'Error'
}

function removeBadge() {
  document.getElementById(BADGE_ID)?.remove()
}

function showBadge() {
  const ca = extractCAFromUrl(location.href)
  if (!ca) {
    removeBadge()
    return
  }

  setBadgeLoading()
  sendToBackground({ type: 'trading:request-score', payload: { contractAddress: ca } })
}

// Listen for scores coming back
browser.runtime.onMessage.addListener((msg: TradingBackgroundToContentMessage) => {
  if (msg.type === 'trading:score-ready') {
    const currentCa = extractCAFromUrl(location.href)
    if (currentCa && msg.payload.contractAddress === currentCa) {
      setBadgeVerdict(msg.payload.verdict)
    }
    // Also update listing badges when on listing page
    if (!currentCa) {
      const { contractAddress, verdict } = msg.payload
      scoreCache.set(contractAddress, { verdict })
      pendingCAs.delete(contractAddress)
      document.querySelectorAll<HTMLAnchorElement>(`a[href*="${contractAddress}"]`).forEach((link) => {
        if (extractCAFromUrl(link.href) === contractAddress)
          applyVerdict(link, contractAddress, verdict)
      })
    }
  }
  else if (msg.type === 'trading:error') {
    const currentCa = extractCAFromUrl(location.href)
    if (currentCa && msg.payload.contractAddress === currentCa)
      setBadgeError()
  }
})

function runPageLogic() {
  if (isTokenPage()) {
    removeBadge()
    showBadge()
  }
  else {
    removeBadge()
    runListingScan(TOKEN_LINK_SELECTOR)
  }
}

function scanListing() {
  if (!isTokenPage())
    runListingScan(TOKEN_LINK_SELECTOR)
}

// Initial load
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', runPageLogic)
else
  runPageLogic()

// SPA URL changes + DOM mutations for listing
let lastUrl = location.href
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    runPageLogic()
  }
  else {
    scanListing()
  }
})
observer.observe(document, { subtree: true, childList: true })
