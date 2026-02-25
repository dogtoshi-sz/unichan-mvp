# Chrome Extension overview

The extension is a **context bridge** between Chrome and the Tamagotchi (UNICHAN avatar). It does not render a character or chat UI.

---

## Product roles

| Component | Role |
|-----------|------|
| **Landing** | Marketing/onboarding (e.g. Unichan landing with Live2D; optional web demo). |
| **Tamagotchi** | The product: desktop app where you chat with the character and connect to OpenClaw. |
| **This extension** | Feeds Chrome (page title, URL, video, subtitles) to Tamagotchi so UNICHAN can “see” what you’re browsing. |

---

## What the extension sends

- **Page context** — Current tab title and URL.
- **Video context** (optional) — On YouTube/Bilibili: video title, channel, progress.
- **Subtitles** (optional) — Live subtitles from the video.

Tamagotchi injects this into each turn when you chat, so UNICHAN can answer about the page, research links (e.g. Twitter, websites), and summarize or analyze based on URL/title. For “analyze this chart” she currently gets **text** (title/URL); adding tab screenshots would be a future enhancement.

---

## Tech

- **WXT** — Builds the extension (e.g. `.output/chrome-mv3` for production).
- **WebSocket client** — Connects to Tamagotchi’s WebSocket server (port 6121 by default).
- **Content / background** — Captures page/video/subtitle data and sends it over the WebSocket.

Chat and BRAIN connection are **only** in Tamagotchi; the extension has no Gateway URL or character UI.
