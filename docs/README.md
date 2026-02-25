# UNICHAN Documentation

Welcome to the **UNICHAN MVP** documentation. UNICHAN is a 3-piece AI companion system: a desktop avatar that reacts to you, a lightweight brain that learns and talks to her, and a browser extension so she can see what you see and research the web with you.

---

## The three pillars

| Component | What it is | Role |
|-----------|------------|------|
| **Tamagotchi (UNICHAN Avatar)** | Desktop app (Electron) with a Live2D character | Sits on your desktop, reacts to user input, navigates the OpenClaw/nanobot interface, voice, and chat. |
| **BRAIN** | Lightweight nanobot (Python) | Learns skills, runs the AI, interacts with UNICHAN. HTTP gateway for Tamagotchi and token research for the extension. |
| **Chrome Extension** | Browser extension (WXT) | Lets UNICHAN interact with the web: see what you see, research links (e.g. Twitter posts, websites), deeper look into pages. |

---

## How they connect

```
┌─────────────────────┐     WebSocket (6121)      ┌──────────────────────┐     HTTP (18790)      ┌─────────────┐
│  Chrome Extension   │ ───────────────────────► │  Tamagotchi (Avatar) │ ────────────────────► │    BRAIN    │
│  (page context,     │   page / video /          │  Live2D, voice,      │   chat, tools,        │  (nanobot)  │
│   video, subtitles) │   subtitles              │  OpenClaw UI         │   token research     │  gateway    │
└─────────────────────┘                           └──────────────────────┘                       └─────────────┘
```

- **Extension → Tamagotchi:** Sends browser context (current page, URL, video, subtitles) over WebSocket so the avatar can “see” what you’re browsing.
- **Tamagotchi → BRAIN:** Sends your messages and context to the nanobot over HTTP; streams replies back and drives the character.

Chat and AI always go through **Tamagotchi**; the extension only provides context. The BRAIN is configured in Tamagotchi (Settings → Unichan), not in the extension.

---

## Quick links

- [Getting Started](getting-started.md) — Install and run all three pieces.
- [Tamagotchi (UNICHAN Avatar)](tamagotchi/README.md) — Desktop character, OpenClaw interface, reactions.
- [BRAIN](brain/README.md) — Nanobot, skills, gateway, config.
- [Chrome Extension](chrome-extension/README.md) — What the extension sends, how to connect it, research features.
- [Architecture](architecture.md) — Repo layout and connections.
