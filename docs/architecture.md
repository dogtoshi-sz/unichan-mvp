# Architecture

High-level layout of UNICHAN-MVP: an AI avatar that lives on your desktop, in Telegram, and in your browser—one companion that can spot trades, analyze tokens, and support wallet-style smart buy/sell. The three main pieces connect as follows.

---

## Repo structure

```
UNICHAN-MVP/
├── BRAIN/              # Python nanobot (nanobot + bridge)
│   ├── nanobot/        # Core agent, gateway, skills
│   │   └── skills/     # github, weather, summarize, tmux, skill-creator
│   └── bridge/
├── TAMAGOTCHI/         # Electron app (UNICHAN Avatar)
│   └── src/            # main, renderer (Live2D, chat, WebSocket server)
├── CHROME-EXTENSION/   # WXT browser extension
│   └── .output/        # chrome-mv3 (production build)
├── packages/           # Shared packages (stage-ui, server-sdk, etc.)
├── docs/               # This GitBook-style documentation
├── package.json
└── pnpm-workspace.yaml
```

---

## Data flow

| From | To | Protocol | Port | What |
|------|----|----------|------|------|
| **Chrome Extension** | **Tamagotchi** | WebSocket | 6121 | Page title, URL, video, subtitles |
| **Tamagotchi** | **BRAIN** | HTTP | 18790 | Chat messages + context; streamed replies |

The extension never talks to the BRAIN. All chat and tools go: **User → Tamagotchi → BRAIN → Tamagotchi → User**.

---

## Ports summary

| Port | Service | Role |
|------|---------|------|
| **6121** | Tamagotchi | WebSocket server for the Chrome extension (browser context). If busy, 6122–6125 may be used. |
| **18790** | BRAIN | HTTP gateway for Tamagotchi (chat, tools, token research). |

---

## Config and state

| Component | Config / state |
|-----------|-----------------|
| **BRAIN** | `~/.unichan/config.json`, `~/.unichan/workspace`, `~/.unichan/history/` |
| **Tamagotchi** | In-app settings (Unichan URL, Consciousness, voice). No separate config file required. |
| **Extension** | Popup only: WebSocket URL, Enable, Preference capture (page/video/subtitles). Stored in extension storage. |

---

## Related docs

- [Introduction](README.md)
- [Getting Started](getting-started.md)
- [Tamagotchi (UNICHAN Avatar)](tamagotchi/README.md)
- [BRAIN](brain/README.md)
- [Chrome Extension](chrome-extension/README.md)
