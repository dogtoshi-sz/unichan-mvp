"""Token lookup tool (Birdeye) – agent skill for looking up token info by address."""

from typing import Any

from nanobot.agent.tools.base import Tool


class TokenLookupTool(Tool):
    """
    Look up a crypto token by its contract address (Solana or EVM).
    Returns name, symbol, price, liquidity, and a short summary.
    Uses Birdeye when API key is configured; otherwise DexScreener for EVM only.
    """

    name = "token_lookup"
    description = (
        "Look up a crypto token by its contract address. Use when the user asks about a token, "
        "token address, or wants price/liquidity info. Accepts Solana (base58, 32-44 chars) or "
        "EVM (0x + 40 hex) addresses. Returns token name, symbol, price, liquidity, and summary."
    )
    parameters = {
        "type": "object",
        "properties": {
            "address": {
                "type": "string",
                "description": "Token contract address (Solana or EVM 0x...)",
            },
            "chain": {
                "type": "string",
                "description": "Optional chain hint: ethereum, solana, base, bsc, etc.",
            },
        },
        "required": ["address"],
    }

    def __init__(self, api_key: str | None = None):
        self.api_key = (api_key or "").strip()

    async def execute(
        self,
        address: str,
        chain: str | None = None,
        **kwargs: Any,
    ) -> str:
        if not address or not isinstance(address, str):
            return "Error: address is required."
        address = address.strip()
        chain_hint = (chain or "").strip() or None
        from nanobot.token_research import research_token
        result = await research_token(
            address,
            chain_hint=chain_hint,
            api_key=self.api_key or None,
        )
        if not result.get("ok"):
            return result.get("summary") or "Token lookup failed."
        parts = [result.get("summary") or "Token found."]
        if result.get("token_name") or result.get("token_symbol"):
            parts.insert(0, f"{result.get('token_name', '')} (${result.get('token_symbol', '')})".strip())
        return "\n".join(parts).strip() or result.get("summary", "Done.")
