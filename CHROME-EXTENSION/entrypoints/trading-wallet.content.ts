import '../src/content/trading-wallet-panel.css'
import { initTradingWalletPanel } from '../src/content/trading-wallet-panel'

export default defineContentScript({
  matches: [
    'https://gmgn.ai/*',
    'https://pump.fun/*',
    'https://dexscreener.com/*',
  ],
  runAt: 'document_idle',
  main() {
    initTradingWalletPanel()
  },
})
