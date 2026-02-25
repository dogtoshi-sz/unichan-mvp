// GMGN.ai content script
// Token verdict badges (next to name, not avatar) + pink BUY button

import { extractCAFromUrl } from '../shared/sites'
import type { TradingBackgroundToContentMessage } from '../shared/types'
import { applyVerdict, runListingScan, scoreCache, pendingCAs } from './listing-shared'

const TOKEN_LINK_SELECTOR = 'a[href*="/sol/token/"], a[href*="/token/"]'

// Listen for scores coming back from background
browser.runtime.onMessage.addListener((msg: TradingBackgroundToContentMessage) => {
  if (msg.type !== 'trading:score-ready')
    return

  const { contractAddress, verdict } = msg.payload
  scoreCache.set(contractAddress, { verdict })
  pendingCAs.delete(contractAddress)

  document.querySelectorAll<HTMLAnchorElement>(`a[href*="${contractAddress}"]`).forEach((link) => {
    if (extractCAFromUrl(link.href) === contractAddress)
      applyVerdict(link, contractAddress, verdict)
  })
})

function scan() {
  runListingScan(TOKEN_LINK_SELECTOR)
}

// Watch for SPA DOM mutations
const observer = new MutationObserver(() => scan())
observer.observe(document.body, { childList: true, subtree: true })

scan()

// Watch for SPA URL changes
let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(scan, 500)
  }
}).observe(document, { subtree: true, childList: true })
