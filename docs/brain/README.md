# BRAIN

The **BRAIN** is UNICHAN’s **nanobot**: the AI agent that powers the avatar on desktop, Telegram, and browser. It exposes an HTTP gateway for chat, token research, trading tools, and smart buy/sell logic—so UNICHAN can spot trades, analyze tokens, and act as a helpful companion with wallet-style management.

---

## What it is

- **Python package** in `BRAIN/` (nanobot + bridge).
- **HTTP gateway** on port **18790** by default — Tamagotchi (and optionally Telegram) connect here for chat, token research, and trading tools.
- **Skills** — Built-in skills (GitHub, weather, summarize, tmux, etc.) that the agent can use when you talk to UNICHAN.
- **Token research** — Birdeye (or similar) integration so UNICHAN can analyze tokens and spot trades; the BRAIN serves this to the avatar and the Chrome extension context.

---

## Main features

| Feature | Description |
|--------|-------------|
| **Gateway** | HTTP API on port 18790; Tamagotchi sends chat + context and gets streamed replies. |
| **Skills** | Learnable / callable skills (e.g. `github`, `weather`, `summarize`, `tmux`). |
| **Interacts with UNICHAN** | All chat and tool use from the avatar go through this gateway. |
| **Config** | `~/.unichan/config.json` — API keys, workspace, providers, tools (e.g. token research). |

---

## How it fits in the system

- **Tamagotchi → BRAIN:** HTTP to `http://localhost:18790/v1/` (or your BRAIN URL). Chat, tools, and token research.
- **Chrome extension** does **not** talk to the BRAIN; it only sends context to Tamagotchi. Tamagotchi then sends that context to the BRAIN.

---

## Next

- [Overview](overview.md) — What the BRAIN does and how it’s structured.
- [Installation & Configuration](installation.md) — Install, config file, and providers.
- [Skills](skills.md) — Built-in skills and how they work.
- [Gateway API](gateway.md) — Port, endpoints, and how Tamagotchi uses it.
