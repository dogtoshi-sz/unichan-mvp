# UNICHAN Documentation

UNICHAN is a 3-piece AI companion: a **desktop avatar** (Tamagotchi), an **AI brain** (BRAIN), and a **Chrome extension** so she can see what you see and research the web with you.

---

## Source code

**[UNICHAN MVP on GitHub](https://github.com/dogtoshi-sz/unichan-mvp)** — Clone, open issues, and contribute.

---

## The three pillars

| Component | What it is | Role |
|-----------|------------|------|
| **Tamagotchi (UNICHAN Avatar)** | Desktop app (Electron) with a Live2D character | Sits on your desktop, reacts to you, uses the BRAIN for chat and tools. Voice and screen. |
| **BRAIN** | Python nanobot | AI gateway: chat, token research, skills. HTTP API on port 18790 for Tamagotchi. |
| **Chrome Extension** | Browser extension (WXT) | Sends page title, URL, video/subtitles to Tamagotchi so UNICHAN can “see” what you’re browsing. |

---

## How they connect

```
┌─────────────────────┐     WebSocket (6121)      ┌──────────────────────┐     HTTP (18790)      ┌─────────────┐
│  Chrome Extension   │ ───────────────────────► │  Tamagotchi (Avatar) │ ────────────────────► │    BRAIN    │
│  (page context,     │   page / video /          │  Live2D, voice,      │   chat, tools,        │  (nanobot)  │
│   video, subtitles) │   subtitles              │  OpenClaw UI         │   token research     │  gateway    │
└─────────────────────┘                           └──────────────────────┘                       └─────────────┘
```

- **Extension → Tamagotchi:** Browser context over WebSocket (port 6121).
- **Tamagotchi → BRAIN:** Chat and tools over HTTP (port 18790).

Chat and AI always go through **Tamagotchi**. The extension only provides context. Configure the BRAIN in **Settings → Unichan** inside the Tamagotchi app.

---

## Documentation index

| Doc | Description |
|-----|--------------|
| [Getting Started](getting-started.md) | Install and run all three pieces step by step. |
| [Tamagotchi (UNICHAN Avatar)](tamagotchi/README.md) | Desktop character, OpenClaw interface, reactions. |
| [BRAIN](brain/README.md) | Nanobot, skills, gateway, config. |
| [Chrome Extension](chrome-extension/README.md) | What the extension sends, setup, research features. |
| [Architecture](architecture.md) | Repo layout, ports, and data flow. |
