// UNICHAN Trading Wallet — pinned left-side panel: contract + quick buy/sell

import { extractCAFromUrl } from '../shared/sites'

const PANEL_ID = 'unichan-trading-wallet'
const JUPITER_SWAP = 'https://jup.ag/swap'

function getContract(): string | null {
  return extractCAFromUrl(location.href)
}

function openBuy(contract: string) {
  window.open(`${JUPITER_SWAP}/SOL-${contract}`, '_blank', 'noopener')
}

function openSell(contract: string) {
  window.open(`${JUPITER_SWAP}/${contract}-SOL`, '_blank', 'noopener')
}

function buildPanel(): HTMLElement {
  const root = document.createElement('div')
  root.id = PANEL_ID
  root.className = 'unichan-wallet-root'

  const tab = document.createElement('button')
  tab.type = 'button'
  tab.className = 'unichan-wallet-tab'
  tab.setAttribute('aria-label', 'Open UNICHAN Trading')
  tab.textContent = 'UNICHAN'

  const panel = document.createElement('div')
  panel.className = 'unichan-wallet-panel'
  panel.setAttribute('data-collapsed', 'true')

  const header = document.createElement('div')
  header.className = 'unichan-wallet-header'
  const title = document.createElement('span')
  title.className = 'unichan-wallet-title'
  title.textContent = 'Trading'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'unichan-wallet-close'
  closeBtn.setAttribute('aria-label', 'Close panel')
  closeBtn.textContent = '×'
  header.append(title, closeBtn)

  const body = document.createElement('div')
  body.className = 'unichan-wallet-body'

  const contractLabel = document.createElement('div')
  contractLabel.className = 'unichan-wallet-contract-label'
  contractLabel.textContent = 'Contract'
  const contractRow = document.createElement('div')
  contractRow.className = 'unichan-wallet-contract-row'
  const contractValue = document.createElement('div')
  contractValue.className = 'unichan-wallet-contract-value'
  contractValue.title = 'Contract address'
  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'unichan-wallet-copy'
  copyBtn.textContent = 'Copy'
  contractRow.append(contractValue, copyBtn)

  const actions = document.createElement('div')
  actions.className = 'unichan-wallet-actions'
  const buyBtn = document.createElement('button')
  buyBtn.type = 'button'
  buyBtn.className = 'unichan-wallet-btn unichan-wallet-btn-buy'
  buyBtn.textContent = 'Quick Buy'
  const sellBtn = document.createElement('button')
  sellBtn.type = 'button'
  sellBtn.className = 'unichan-wallet-btn unichan-wallet-btn-sell'
  sellBtn.textContent = 'Quick Sell'

  function render(contract: string | null) {
    body.querySelector('.unichan-wallet-empty')?.remove()
    if (!contract) {
      contractValue.textContent = ''
      contractValue.setAttribute('title', '')
      buyBtn.style.display = 'none'
      sellBtn.style.display = 'none'
      const el = document.createElement('div')
      el.className = 'unichan-wallet-empty'
      el.textContent = 'Open a token page to see the contract.'
      body.appendChild(el)
      return
    }
    contractValue.textContent = contract
    contractValue.setAttribute('title', contract)
    buyBtn.style.display = 'flex'
    sellBtn.style.display = 'flex'
    buyBtn.onclick = () => openBuy(contract)
    sellBtn.onclick = () => openSell(contract)
  }

  copyBtn.onclick = () => {
    const ca = getContract()
    if (!ca)
      return
    navigator.clipboard.writeText(ca).then(() => {
      copyBtn.textContent = 'Copied'
      copyBtn.setAttribute('data-copied', 'true')
      setTimeout(() => {
        copyBtn.textContent = 'Copy'
        copyBtn.removeAttribute('data-copied')
      }, 2000)
    })
  }

  tab.onclick = () => {
    panel.setAttribute('data-collapsed', 'false')
  }
  closeBtn.onclick = () => {
    panel.setAttribute('data-collapsed', 'true')
  }

  body.append(contractLabel, contractRow, actions)
  actions.append(buyBtn, sellBtn)
  panel.append(header, body)
  root.append(tab, panel)

  function update() {
    render(getContract())
  }

  update()

  // Update when URL changes (SPA navigation)
  let lastUrl = location.href
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      render(getContract())
    }
  })
  observer.observe(document, { subtree: true, childList: true })
  window.addEventListener('popstate', () => render(getContract()))
  window.addEventListener('hashchange', () => render(getContract()))

  return root
}

function mount() {
  if (document.getElementById(PANEL_ID))
    return
  document.body.appendChild(buildPanel())
}

export function initTradingWalletPanel() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount)
  } else {
    mount()
  }
}
