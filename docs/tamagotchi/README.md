# Tamagotchi (UNICHAN Avatar)

The **Tamagotchi** is UNICHAN’s avatar on your **desktop**: a Live2D character that lives there, reacts to you, and connects to the BRAIN, the Chrome extension, and (optionally) Telegram. She’s your helpful companion—spot trades, analyze tokens, and wallet-style smart buy/sell management flow through her.

---

## What it is

- **Electron app** (project: `TAMAGOTCHI/`, package: `@proj-airi/stage-tamagotchi`).
- **Live2D avatar** on your desktop that reacts to you and uses the BRAIN for chat, token research, and trading tools.
- **Voice and text chat** — you talk or type; the avatar responds using the BRAIN (OpenClaw/nanobot).
- **OpenClaw / nanobot interface** — the avatar can use the BRAIN’s skills (chat, token research, trading, smart buy/sell logic).
- **WebSocket server** on port **6121** — the Chrome extension connects here and sends page/video/subtitle context so UNICHAN can “see” what you’re browsing and spot trades or analyze tokens.

---

## Main features

| Feature | Description |
|--------|-------------|
| **Live2D avatar** | Animated character on the desktop (stage-ui, stage-ui-live2d). |
| **Reactions** | Responds to input, chat, and context from the extension. |
| **OpenClaw / nanobot** | Connects to the BRAIN; can use its skills and tools. |
| **Voice** | Mic input and (optional) TTS so you can talk to her. |
| **Context from browser** | Receives page title, URL, video, subtitles from the Chrome extension over WebSocket. |

---

## How it fits in the system

- **Extension → Tamagotchi:** Browser context (page, video, subtitles) over WebSocket (`ws://localhost:6121/ws`).
- **Tamagotchi → BRAIN:** Your messages + context over HTTP (`http://localhost:18790/v1/`). BRAIN runs the AI and tools; Tamagotchi streams the reply back and drives the character.

All chat and AI go through Tamagotchi. The extension does not talk to the BRAIN directly.

---

## Next

- [Overview](overview.md) — High-level architecture of the Tamagotchi app.
- [Running the Tamagotchi](running.md) — How to start and configure it.
- [OpenClaw / Nanobot Interface](openclaw-interface.md) — How the avatar uses the BRAIN.
