# Getting Started

This guide gets you from zero to a running UNICHAN: an AI avatar on your desktop, in your browser, and (optionally) on Telegram—a helpful companion that can spot trades, analyze tokens, and support wallet-style smart buy/sell management.

---

## Prerequisites

- **Node.js** and **pnpm** (for Tamagotchi and extension)
- **Python 3** (for BRAIN)
- **Chrome** (for the extension)

---

## 1. Clone and install

```bash
git clone https://github.com/dogtoshi-sz/unichan-mvp
cd unichan-mvp
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

First-time setup runs the **onboard wizard**. You’ll see something like this:

![UNICHAN onboard wizard](../tomigatchi-readme/uni-brain-onboard.png)

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
2. **Settings → Consciousness** — Choose **OpenClaw (Unichan brain)** (works for both the UNICHAN brain and OpenClaw).
3. Enable voice (mic) if you want to talk to her.

Leave Tamagotchi open. The Chrome extension will connect to it on port **6121** (WebSocket).

**Alternative: Connect Tamagotchi to OpenClaw** — You can use [OpenClaw](https://openclaw.ai) instead of the UNICHAN brain. (1) In OpenClaw’s config `~/.openclaw/openclaw.json`, add under `"gateway"`: `"http": { "endpoints": { "chatCompletions": { "enabled": true } } }`, then restart OpenClaw (e.g. `openclaw gateway --port 18789`). (2) In Tamagotchi: **Settings → Unichan** → set URL to `http://localhost:18789/v1/` (or your OpenClaw host), model **openclaw** → Save. (3) **Settings → Consciousness** → **OpenClaw (Unichan brain)**. See [Tamagotchi → Connecting to OpenClaw](tamagotchi/README.md#connecting-to-openclaw).

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

- **Desktop** — Talk or type to UNICHAN in the Tamagotchi app; she’s your companion with voice and chat.
- **Browser** — Browse in Chrome; the extension sends page context so she can see what you see, spot trades, analyze tokens, and answer questions.
- **Telegram** — (Optional) Connect the BRAIN to Telegram so UNICHAN can help you there too.
- One avatar, one brain: token research, smart buy/sell ideas, and wallet-style management flow through the same UNICHAN.

If the extension shows **Connection error**, Tamagotchi isn’t running or the WebSocket URL is wrong. Fix that and click **Apply** again.

**See it in action:** [Example on a token dashboard (GMGN)](../tomigatchi-readme/example-on-GMGN.png) — UNICHAN spotting trades and giving context-aware warnings. Video: [tomigatchi-example.mp4](../tomigatchi-readme/tomigatchi-example.mp4).

---

## Next steps

- [Tamagotchi (UNICHAN Avatar)](tamagotchi/README.md) — What the avatar does and how she uses the OpenClaw/nanobot interface.
- [BRAIN](brain/README.md) — Config, skills, and gateway.
- [Chrome Extension](chrome-extension/README.md) — What context is sent and how to research pages/links.
