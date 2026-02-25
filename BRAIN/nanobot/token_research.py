"""
Temporary module: token/chain research for the extension.

Supports EVM (DexScreener, no key) and Birdeye (optional API key) for EVM + Solana.
Returns a "card" with image, name, symbol, summary when Birdeye is used.

TODO: Replace with production module (more sources, scam checks, etc.).
"""

from __future__ import annotations

import os
import re
from typing import Any

import aiohttp

# Ethereum-style address (0x + 40 hex)
EVM_ADDRESS_RE = re.compile(r"0x[a-fA-F0-9]{40}")
# Solana base58 (32-44 chars, no 0x)
SOLANA_ADDRESS_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")

DEXSCREENER_SEARCH = "https://api.dexscreener.com/latest/dex/search"
BIRDEYE_BASE = "https://public-api.birdeye.so"
BIRDEYE_TOKEN_OVERVIEW = "/defi/token_overview"


def _is_evm(addr: str) -> bool:
    s = (addr or "").strip()
    if not s.startswith("0x"):
        s = "0x" + s
    return bool(EVM_ADDRESS_RE.fullmatch(s))


def _is_solana(addr: str) -> bool:
    s = (addr or "").strip()
    return len(s) >= 32 and len(s) <= 44 and bool(SOLANA_ADDRESS_RE.fullmatch(s))


def _normalize_evm(addr: str) -> str | None:
    s = (addr or "").strip()
    if not s.startswith("0x"):
        s = "0x" + s
    if EVM_ADDRESS_RE.fullmatch(s):
        return s.lower()
    return None


def _resolve_chain(address: str, chain_hint: str | None) -> str:
    """Resolve chain for Birdeye. Prefer address format over URL hint when they conflict."""
    # Address format wins: Solana (base58) and EVM (0x+40 hex) are unambiguous
    if _is_solana(address):
        return "solana"
    if _is_evm(address):
        return "ethereum"
    # No clear address format: use hint from URL/payload
    if chain_hint and chain_hint.lower() in ("ethereum", "eth", "solana", "sol", "base", "bsc"):
        c = chain_hint.lower()
        if c in ("eth", "ethereum"):
            return "ethereum"
        if c in ("sol", "solana"):
            return "solana"
        return c
    return "ethereum"


async def _birdeye_overview(
    api_key: str, chain: str, address: str
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Fetch token overview from Birdeye.
    Returns (data, None) on success, (None, error_message) on error.
    """
    url = f"{BIRDEYE_BASE}{BIRDEYE_TOKEN_OVERVIEW}"
    params = {"address": address}
    headers = {"X-API-KEY": api_key, "Accept": "application/json", "x-chain": chain}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                raw = await resp.json()
                if resp.status != 200:
                    msg = raw.get("message") or raw.get("error") or f"HTTP {resp.status}"
                    return None, msg
                if not raw.get("success"):
                    msg = raw.get("message") or raw.get("error") or "Token not found"
                    return None, msg
                return raw.get("data") or {}, None
    except Exception as e:
        return None, str(e)


async def research_token(
    address: str,
    chain_hint: str | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    """
    Look up a token by address. Uses Birdeye if api_key or BIRDEYE_API_KEY is set (EVM + Solana),
    else DexScreener for EVM only.

    Returns a dict with:
      - ok: bool
      - address: str
      - chain_id: str | None
      - token_name: str | None
      - token_symbol: str | None
      - image: str | None (logo URL for card)
      - liquidity_usd: float | None
      - price_usd: str | None
      - summary: str
      - pairs: list (DexScreener only)
    """
    address = (address or "").strip()
    if not address:
        return {
            "ok": False,
            "address": "",
            "chain_id": None,
            "token_name": None,
            "token_symbol": None,
            "image": None,
            "liquidity_usd": None,
            "price_usd": None,
            "summary": "No address provided.",
            "pairs": [],
        }
    chain = _resolve_chain(address, chain_hint)
    key = (api_key or os.environ.get("BIRDEYE_API_KEY") or "").strip()

    if key:
        data, birdeye_error = await _birdeye_overview(key, chain, address)
        if data:
            name = data.get("name") or "Unknown"
            symbol = data.get("symbol") or "???"
            logo_uri = data.get("logoURI")
            price = data.get("price")
            liquidity = data.get("liquidity")
            if liquidity is not None and isinstance(liquidity, dict):
                liquidity = liquidity.get("usd")
            parts = [symbol, f"({name})" if name != symbol else None, f"on {chain}"]
            if liquidity is not None:
                try:
                    liq = float(liquidity)
                    if liq >= 1_000_000:
                        parts.append(f"liquidity ${liq/1_000_000:.1f}M")
                    elif liq >= 1_000:
                        parts.append(f"liquidity ${liq/1_000:.1f}K")
                    else:
                        parts.append(f"liquidity ${liq:.0f}")
                except (TypeError, ValueError):
                    pass
            if price is not None:
                parts.append(f"price ${price}")
            summary = " · ".join(p for p in parts if p)
            return {
                "ok": True,
                "address": address,
                "chain_id": chain,
                "token_name": name,
                "token_symbol": symbol,
                "image": logo_uri,
                "liquidity_usd": float(liquidity) if liquidity is not None else None,
                "price_usd": str(price) if price is not None else None,
                "summary": summary,
                "pairs": [],
            }
        # Birdeye returned no data: for Solana we have no fallback; for EVM we try DexScreener below
        if _is_solana(address):
            err = birdeye_error or "Token not found"
            summary = f"Token not found on Birdeye (chain={chain}). {err}"
            return {
                "ok": False,
                "address": address,
                "chain_id": chain,
                "token_name": None,
                "token_symbol": None,
                "image": None,
                "liquidity_usd": None,
                "price_usd": None,
                "summary": summary,
                "pairs": [],
            }

    # EVM fallback: DexScreener (when no key, or Birdeye failed for EVM)
    norm = _normalize_evm(address)
    if not norm:
        return {
            "ok": False,
            "address": address[:50],
            "chain_id": None,
            "token_name": None,
            "token_symbol": None,
            "image": None,
            "liquidity_usd": None,
            "price_usd": None,
            "summary": "Invalid address. For Solana, set BIRDEYE_API_KEY.",
            "pairs": [],
        }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(DEXSCREENER_SEARCH, params={"q": norm}) as resp:
                if resp.status != 200:
                    return {
                        "ok": False,
                        "address": norm,
                        "chain_id": None,
                        "token_name": None,
                        "token_symbol": None,
                        "image": None,
                        "liquidity_usd": None,
                        "price_usd": None,
                        "summary": f"DexScreener returned HTTP {resp.status}.",
                        "pairs": [],
                    }
                data = await resp.json()
    except Exception as e:
        return {
            "ok": False,
            "address": norm,
            "chain_id": None,
            "token_name": None,
            "token_symbol": None,
            "image": None,
            "liquidity_usd": None,
            "price_usd": None,
            "summary": f"Lookup failed: {e!s}",
            "pairs": [],
        }

    pairs = data.get("pairs") or []
    if not pairs:
        return {
            "ok": True,
            "address": norm,
            "chain_id": None,
            "token_name": None,
            "token_symbol": None,
            "image": None,
            "liquidity_usd": None,
            "price_usd": None,
            "summary": f"No pairs found for {norm[:10]}…{norm[-6:]}.",
            "pairs": [],
        }

    p = pairs[0]
    base = p.get("baseToken") or {}
    chain_id = p.get("chainId") or None
    token_name = base.get("name") or None
    token_symbol = base.get("symbol") or None
    image = base.get("logoURI") if isinstance(base.get("logoURI"), str) else None
    liquidity = p.get("liquidity", {})
    liquidity_usd = None
    if isinstance(liquidity, dict):
        liquidity_usd = liquidity.get("usd")
    elif isinstance(liquidity, (int, float)):
        liquidity_usd = float(liquidity)
    price_usd = p.get("priceUsd") or None

    parts = []
    if token_symbol:
        parts.append(token_symbol)
    if token_name and token_name != token_symbol:
        parts.append(f"({token_name})")
    if chain_id:
        parts.append(f"on {chain_id}")
    if liquidity_usd is not None:
        try:
            liq = float(liquidity_usd)
            if liq >= 1_000_000:
                parts.append(f"liquidity ${liq/1_000_000:.1f}M")
            elif liq >= 1_000:
                parts.append(f"liquidity ${liq/1_000:.1f}K")
            else:
                parts.append(f"liquidity ${liq:.0f}")
        except (TypeError, ValueError):
            pass
    if price_usd:
        parts.append(f"price ${price_usd}")
    summary = " · ".join(parts) if parts else "Token found (see pairs for details)."

    return {
        "ok": True,
        "address": norm,
        "chain_id": chain_id,
        "token_name": token_name,
        "token_symbol": token_symbol,
        "image": image,
        "liquidity_usd": liquidity_usd,
        "price_usd": price_usd,
        "summary": summary,
        "pairs": pairs[:5],
    }
