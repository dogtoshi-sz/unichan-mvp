# Running the Tamagotchi

## From repo root

```bash
pnpm dev:tamagotchi
```

This runs the Electron app in development mode. The Live2D character window opens.

---

## First-time setup in the app

1. **Settings → Unichan**
   - **This computer:** `http://localhost:18790/v1/` (default BRAIN gateway).
   - **Another computer:** `http://<BRAIN_IP>:18790/v1/`
   - Click **Test**, then **Save**.

2. **Settings → Consciousness**
   - Select **OpenClaw (Unichan brain)** so the avatar uses that gateway.

3. **Voice (optional)**
   - Enable microphone and configure hearing so you can talk to UNICHAN.

---

## Ports

| Port | Role |
|------|------|
| **6121** | WebSocket server for the Chrome extension (page/video/subtitle context). If 6121 is in use, the app may use 6122–6125. |

The Tamagotchi does not listen on 18790; that is the BRAIN. The Tamagotchi *connects* to the BRAIN as a client.

---

## Build (production)

From repo root:

```bash
pnpm build:tamagotchi
```

Artifacts are produced by electron-builder (see `TAMAGOTCHI/package.json` scripts: `build:win`, `build:mac`, `build:linux`).
