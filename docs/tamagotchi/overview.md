# Tamagotchi overview

The Tamagotchi is an **Electron** app that provides:

1. **Stage UI** — Layout and pages (stage-ui, stage-layouts, stage-pages).
2. **Live2D character** — Rendered via stage-ui-live2d; the character reacts to input and chat.
3. **Chat & voice** — Text and microphone input; responses are streamed from the BRAIN.
4. **WebSocket server** — Listens on port 6121 (or 6122–6125 if 6121 is busy) for the Chrome extension to send browser context.
5. **BRAIN client** — Sends chat + context to the BRAIN gateway (HTTP) and streams replies back.

---

## Tech stack

- **Electron** + **Vite** (electron-vite)
- **Vue** + **Pinia** for the renderer UI
- **Live2D** (Cubism) for the avatar
- **crossws** for the WebSocket server
- **server-sdk** to talk to the BRAIN HTTP gateway

---

## Repo layout (Tamagotchi)

```
TAMAGOTCHI/
├── src/
│   ├── main/          # Electron main process
│   ├── renderer/      # Vue app, Live2D, chat UI
│   └── preload/
├── packages/          # Shared packages (stage-ui, server-sdk, etc.) live in UNICHAN-MVP/packages/
└── package.json      # @proj-airi/stage-tamagotchi
```

The avatar and OpenClaw/nanobot integration live in the renderer and use the same BRAIN gateway URL you set in Settings → Unichan.
