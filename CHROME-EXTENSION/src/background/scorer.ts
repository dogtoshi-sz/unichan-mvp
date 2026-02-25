// Token scoring engine
// Combines BirdEye data into a 0-100 bullish score
// Higher = more bullish/safer. Lower = more bearish/dangerous.
// Reference: degenfrends/solana-rugchecker (holder + liquidity scoring)
// Reference: safuco/solana-token-analyzer (risk thresholds)

import type { BirdEyeTokenData, ScoreReason, TokenScore } from '../shared/types'

const WEIGHTS = {
  noMintAuthority: 25,
  noFreezeAuthority: 15,
  liquidityAbove10k: 15,
  liquidityAbove50k: 10,
  top10HoldersUnder30: 15,
  top10HoldersUnder15: 10,
  hasTradeVolume: 10,
}

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
