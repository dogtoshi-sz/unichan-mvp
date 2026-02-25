// BirdEye API client for token analysis
// Docs: https://docs.birdeye.so
// Called from background service worker ONLY (not content scripts)

const BIRDEYE_BASE = 'https://public-api.birdeye.so'

export interface BirdEyeConfig {
  apiKey: string
  chain?: string
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

  if (!res.ok)
    throw new Error(`BirdEye ${path} HTTP ${res.status}`)
  const json = await res.json()
  if (!json.success)
    throw new Error(json.message ?? 'BirdEye error')
  return json.data
}

/** GET /defi/token_overview — price, mcap, volume, liquidity, holders */
export async function getTokenOverview(config: BirdEyeConfig, address: string) {
  return birdeyeFetch(config, '/defi/token_overview', { address })
}

/** GET /defi/token_security — mint auth, freeze auth, top holders */
export async function getTokenSecurity(config: BirdEyeConfig, address: string) {
  return birdeyeFetch(config, '/defi/token_security', { address })
}

/** GET /defi/token_creation_info — dev wallet, creation timestamp */
export async function getTokenCreationInfo(config: BirdEyeConfig, address: string) {
  return birdeyeFetch(config, '/defi/token_creation_info', { address })
}

/** GET /defi/v3/token/top_traders — top wallets trading this token */
export async function getTopTraders(config: BirdEyeConfig, address: string) {
  return birdeyeFetch(config, '/defi/v3/token/top_traders', {
    address,
    time_frame: '30m',
    sort_by: 'volume',
    sort_type: 'desc',
    limit: '10',
  })
}

/** GET /defi/trades/token — recent trades (for live buy/sell feed) */
export async function getRecentTrades(config: BirdEyeConfig, address: string) {
  return birdeyeFetch(config, '/defi/trades/token', {
    address,
    tx_type: 'swap',
    limit: '20',
    sort_type: 'desc',
  })
}
