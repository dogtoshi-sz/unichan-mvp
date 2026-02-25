# Getting Started

This guide gets you from zero to a running UNICHAN: Brain, Tamagotchi (avatar), and Chrome extension.

---

## Prerequisites

- **Node.js** and **pnpm** (for Tamagotchi and extension)
- **Python 3** (for BRAIN)
- **Chrome** (for the extension)

---

## 1. Clone and install

```bash
git clone <your-unichan-mvp-repo>
cd UNICHAN-MVP
pnpm install
pnpm build:packages   # Build shared packages (run from repo root)
```

---

## 2. Run the BRAIN (nanobot)

The BRAIN is the AI gateway. Tamagotchi talks to it over HTTP.

```bash
cd BRAIN
pip install -e .
unichan onboard   # First-time: setup wizard (API key, workspace)
unichan gateway   # Start HTTP API on port 18790
```

Or create `~/.unichan/config.json` manually (see [BRAIN → Installation & Configuration](brain/installation.md)).

Leave the gateway running. Tamagotchi will connect to `http://localhost:18790/v1/`.

---

## 3. Run the Tamagotchi (UNICHAN Avatar)

From the **UNICHAN-MVP** root:

```bash
pnpm dev:tamagotchi
```

The desktop app opens with the Live2D character. Then:

1. **Settings → Unichan** — Set gateway URL to `http://localhost:18790/v1/` (or your BRAIN URL). Test and Save.
2. **Settings → Consciousness** — Choose **OpenClaw (Unichan brain)**.
3. Enable voice (mic) if you want to talk to her.

Leave Tamagotchi open. The Chrome extension will connect to it on port **6121** (WebSocket).

---

## 4. Build and load the Chrome Extension

From the **UNICHAN-MVP** root:

```bash
pnpm build:extension
```

Then in Chrome:

1. Open `chrome://extensions`
2. Turn **Developer mode** on
3. **Load unpacked** → select:  
   `UNICHAN-MVP/CHROME-EXTENSION/.output/chrome-mv3`  
   (Use the production folder, not `chrome-mv3-dev`.)

In the extension popup:

1. **Connection** — WebSocket URL: `ws://localhost:6121/ws`, turn **Enable** on.
2. **Preference capture** — Enable Page context (and Video/Subtitles if you want).
3. Click **Apply**.

---

## 5. Use it

- **Browse** in Chrome. The extension sends page title, URL, and (if enabled) video/subtitle context to Tamagotchi.
- **Talk or type** to UNICHAN in the Tamagotchi app. She gets your words plus the browser context and can answer about the page, research links (e.g. Twitter, websites), and use the BRAIN’s skills.

If the extension shows **Connection error**, Tamagotchi isn’t running or the WebSocket URL is wrong. Fix that and click **Apply** again.

---

## Next steps

- [Tamagotchi (UNICHAN Avatar)](tamagotchi/README.md) — What the avatar does and how she uses the OpenClaw/nanobot interface.
- [BRAIN](brain/README.md) — Config, skills, and gateway.
- [Chrome Extension](chrome-extension/README.md) — What context is sent and how to research pages/links.
