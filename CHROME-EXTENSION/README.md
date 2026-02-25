# Unichan Web Extension – Screen context for desktop Tamagotchi

> Sends what you’re looking at in the browser to your **desktop Tamagotchi** so she can intelligently see your screen and answer questions about it.

This extension does **not** show a character on the page. Chat happens in the **Tamagotchi app** (desktop). The extension only **communicates browser/screen context** to Tamagotchi so the AI can reference the current page, video, or (in the future) screenshots.

## Product setup

- **Landing** – Marketing/onboarding (e.g. Unichan landing with Live2D; optional web demo).
- **Tamagotchi** – The product: desktop app users download to chat with the character and connect to OpenClaw.
- **This extension** – Feeds Chrome (page title, URL, video, subtitles) to Tamagotchi so she can “see” what you’re browsing.

## What you can do today

- **Page context** – Title and URL of the current tab (e.g. “User is on https://dexscreener.com/solana/…”).
- **Video context** – On YouTube/Bilibili: video title, channel, progress.
- **Subtitles** – Live subtitles from the video.

With that, you can ask your Tamagotchi things like:

- *“What page am I on?”* / *“Summarize what I’m looking at.”*
- *“Check the Twitter posts for this token”* (she sees the URL/title; you can paste or say the token name).
- *“Analyze this token chart”* – Today she gets **text** (page title/URL, no image). For real chart analysis we’d add **tab screenshot** as context in a future update.

All chat is in the **Tamagotchi app** (voice or text). The extension only sends context; it does not show a character or chat UI.

## How to rebuild the extension

From the **waifu** folder:

```bash
pnpm -F @proj-airi/airi-plugin-web-extension dev
```

This **builds once and exits** (no dev server, no browser). **Use the production folder** **`.output/chrome-mv3`** when you Load unpacked—not `chrome-mv3-dev`, or the popup will be a white block. Then in Chrome go to `chrome://extensions` and click **reload** on the extension. Refresh any tab you’re testing.

---

## Connect extension → Tamagotchi → Brain (not extension → Brain)

The extension talks to **Tamagotchi**, not to the Brain. Tamagotchi talks to the Brain.

| Step | Who | Where |
|------|-----|--------|
| 1 | **Extension** (Chrome) | Sends page/video/subtitle context via **WebSocket** to Tamagotchi. |
| 2 | **Tamagotchi** (desktop app) | Receives context on port **6121**; when you chat, it sends your message + context to the Brain via **HTTP**. |
| 3 | **Brain** (OpenClaw/Unichan) | Runs on port **18790**; does the AI and streams the reply back to Tamagotchi. |

So in the extension popup you only set the **WebSocket URL** = where **Tamagotchi** is:

- **Chrome and Tamagotchi on the same PC:** `ws://localhost:6121/ws`
- **Tamagotchi on another PC:** `ws://<TAMAGOTCHI_PC_IP>:6121/ws` (that PC must be running Tamagotchi and have port 6121 reachable)

The **Brain** is configured only in **Tamagotchi**: Settings → Unichan (e.g. “Another computer” → `http://<BRAIN_IP>:18790/v1/`). The extension never connects to the Brain.

---

## Quick start

1. **Build once** from **waifu**: `pnpm -F @proj-airi/airi-plugin-web-extension dev`. This produces **`.output/chrome-mv3`** (production). Use that folder—not `chrome-mv3-dev`, or the popup will be blank.
2. In Chrome: **Load unpacked** (Developer mode → Load unpacked) and select **`.output/chrome-mv3`**.
3. In the popup: **Connection** → WebSocket URL = `ws://localhost:6121/ws` (or Tamagotchi’s IP if she’s on another PC), turn **Enable** on. **Preference capture** → Page context (and Video/Subtitles if you want). **Apply**.

## Full setup: Tamagotchi + extension so she “sees” your screen

1. **Start your brain** (OpenClaw/Unichan). Same PC: port 18790. Other PC: ensure it’s reachable.

2. **Start Tamagotchi** on this computer (`pnpm dev:tamagotchi` from waifu). Leave it open.

3. **Point Tamagotchi at the brain**  
   **Settings** → **Unichan** → “This computer” or “Another computer” (URL `http://<BRAIN_IP>:18790/v1/`) → **Test** → **Save**.  
   **Settings** → **Consciousness** → **OpenClaw (Unichan brain)**.

4. **Enable voice** in Tamagotchi (mic on, Hearing configured if needed).

5. **Load and configure the extension**  
   Build once: `pnpm -F @proj-airi/airi-plugin-web-extension dev`. Load unpacked in Chrome → `waifu/plugins/airi-plugin-web-extension/.output/chrome-mv3` (production; do not use chrome-mv3-dev).  
   Popup → **Connection**: WebSocket URL = `ws://localhost:6121/ws`, **Enable** on. **Preference capture**: Page context (and Video/Subtitles). **Apply**.

6. **Use it.** Browse in Chrome; talk to Tamagotchi (mic or text). She gets your words plus the browser context (page, video, subtitles).

If the extension shows “Connection error,” Tamagotchi isn’t running or the WebSocket URL is wrong. Chat is only via Tamagotchi; the extension has no character or Gateway URL setting.

## Which URL?

- **WebSocket URL** (in the popup): default is `ws://localhost:6121` (no path).  
  Where the extension sends page/video/subtitle context. Tamagotchi runs this server. If Tamagotchi is on another machine, use `ws://<that-ip>:6121`. If your server expects a path (e.g. `/ws`), add it: `ws://localhost:6121/ws`.

There is no “Gateway URL” in the extension anymore. All chat and brain connection are configured in **Tamagotchi** (Settings → Unichan, Consciousness).

## Troubleshooting

**You still see "AIRI Web Extension" and a "Character" section (Model URL, Gateway URL, etc.)**  
You're on an **old build**. Rebuild and reload: from **waifu** run `pnpm -F @proj-airi/airi-plugin-web-extension dev`, then in Chrome go to `chrome://extensions` and click **Reload** on the extension (or Load unpacked from `waifu/plugins/airi-plugin-web-extension/.output/chrome-mv3`). The popup should then show only Connection + Preference capture, and the name should be **"Unichan – Screen context for Tamagotchi"**.

**Popup is a tiny white block / blank**
You're loading the **dev** build (`.output/chrome-mv3-dev`), which needs the Vite dev server. Load the **production** build instead: remove the extension in Chrome, then **Load unpacked** and choose **`waifu/plugins/airi-plugin-web-extension/.output/chrome-mv3`** (not chrome-mv3-dev). Run `pnpm -F @proj-airi/airi-plugin-web-extension dev` first if that folder doesn't exist yet.

**Why does the extension show "Offline"?**  
"Offline" means the extension is not connected to Tamagotchi’s WebSocket. Check:

1. **Tamagotchi is running** – Start the desktop app (`pnpm dev:tamagotchi` from waifu). It opens the WebSocket server on port 6121 (or 6122–6125 if 6121 is busy). If Tamagotchi isn’t running, the extension will stay Offline.
2. **WebSocket URL is correct** – In the popup → Connection, set URL to `ws://localhost:6121/ws` (or `ws://<TAMAGOTCHI_IP>:6121/ws` if Tamagotchi is on another PC). Use `ws://` not `wss://` for local.
3. **Extension is enabled** – In the popup, turn **Enable** on, then click **Apply** so it tries to connect.
4. **You clicked Apply** – After changing the URL or Enable, you must click **Apply** to reconnect.

If the connection fails, an orange **Connection error** box appears in the popup with the reason (e.g. "Failed to construct 'WebSocket'", or connection refused). Fix the cause above and click **Apply** again.

**"Connection error" / "WebSocket error"**  
Same as above: the extension can’t reach Tamagotchi. Start Tamagotchi first, set WebSocket URL to `ws://localhost:6121/ws`, Enable on, Apply. If Tamagotchi is on another PC, use `ws://<TAMAGOTCHI_PC_IP>:6121/ws` and allow that port in the firewall.

## Split setup: extension on one PC, brain on another

- **This PC (Chrome + extension):** Run **Tamagotchi** here. Extension → WebSocket URL = `ws://localhost:6121/ws`, Enable, set capture options, Apply.
- **This PC (Tamagotchi):** Settings → Unichan → “Another computer” → Gateway URL = `http://<BRAIN_IP>:18790/v1/`, Test, Save. Consciousness → OpenClaw.
- **Other PC:** Run OpenClaw/Unichan (e.g. 18790); firewall allows inbound from this PC.

Result: extension sends browser context to Tamagotchi on this PC; Tamagotchi sends messages + context to the brain and streams replies back.

## Making Tamagotchi use the browser context

Tamagotchi already injects browser context (page, video, subtitles) into each turn. To have her **proactively** refer to what you’re browsing, add to her **system prompt** (Settings → Character/Card → System prompt):

*“You can see what the user is browsing via a Chrome extension: current page title/URL, and on YouTube/Bilibili the video title and live subtitles. Use this when relevant. The user may ask you to analyze a token chart, check Twitter for a token, or summarize a page.”*

## Screenshots and “analyze this chart”

- **Today:** The model gets **text** only (title, URL, video, subtitles). Good for “what page is this?”, “summarize the video,” “what token is in the URL?”. For “analyze this token chart” she has no image yet.
- **Possible later:** Add `chrome.tabs.captureVisibleTab()` and send a screenshot as context so the model can analyze charts, tweets, or any visible content. Would require Tamagotchi/chat to support image context.

## Character widget (removed)

The in-page Live2D character and its Chat/Gateway URL are **removed**. Chat only in the **desktop Tamagotchi** app. The extension is only for sending browser/screen context to Tamagotchi.
