# Chrome Extension

The **Chrome Extension** is UNICHAN in your **browser**: it sends what you’re looking at (page, URL, video, subtitles) to the **desktop avatar** (Tamagotchi) so she can see what you see, spot trades, analyze tokens, and answer questions—all as one helpful companion with the same brain.

---

## What it is

- **WXT** browser extension (project: `CHROME-EXTENSION/`).
- **UNICHAN in the browser** — She doesn’t show a character on the page; chat happens in the **Tamagotchi app** (desktop). The extension sends **browser context** so the avatar can spot trades, analyze tokens, and support smart buy/sell.
- **Connects to Tamagotchi** over **WebSocket** (default: `ws://localhost:6121/ws`). It does **not** connect to the BRAIN directly.

---

## What you can do today

| Feature | Description |
|--------|-------------|
| **Page context** | Title and URL of the current tab (e.g. “User is on https://dexscreener.com/solana/…”). |
| **Video context** | On YouTube/Bilibili: video title, channel, progress. |
| **Subtitles** | Live subtitles from the video. |

With that, you can ask UNICHAN (in the Tamagotchi app):

- *“What page am I on?”* / *“Summarize what I’m looking at.”*
- *“Check the Twitter posts for this token”* (she sees the URL/title; you can paste or say the token name).
- *“Research this website”* — She can do a deeper look using the BRAIN’s skills (e.g. summarize) and the context the extension sends.

All chat is in the **Tamagotchi app** (voice or text). The extension only sends context; it does not show a character or chat UI.

---

## How it fits in the system

| Step | Who | Where |
|------|-----|--------|
| 1 | **Extension** (Chrome) | Sends page/video/subtitle context via **WebSocket** to Tamagotchi. |
| 2 | **Tamagotchi** (desktop app) | Receives context on port **6121**; when you chat, it sends your message + context to the BRAIN via **HTTP**. |
| 3 | **BRAIN** (OpenClaw/Unichan) | Runs on port **18790**; does the AI and streams the reply back to Tamagotchi. |

In the extension popup you only set the **WebSocket URL** = where **Tamagotchi** is (e.g. `ws://localhost:6121/ws`). The **BRAIN** is configured only in **Tamagotchi** (Settings → Unichan).

---

## Next

- [Overview](overview.md) — What the extension sends and how it’s built.
- [Setup & Connection](setup.md) — Build, load unpacked, and connect to Tamagotchi.
- [Page Context & Research](context-and-research.md) — What context is sent and how UNICHAN can research links.
- [Troubleshooting](troubleshooting.md) — Connection errors, popup blank, etc.
