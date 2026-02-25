# UNICHAN MVP

**UNICHAN** is your AI degen companion: a desktop avatar (Tamagotchi), an AI brain (BRAIN), and a Chrome extension that lets her see what you see. One system across Desktop → Chrome → (optional) Telegram.

---

## What’s in this repo

| Part | What it is | Role |
|------|------------|------|
| **BRAIN** | Python nanobot (AI agent) | HTTP gateway for Tamagotchi: chat, token research, tools. Runs on port **18790**. |
| **TAMAGOTCHI** | Electron desktop app | Live2D character, voice, chat, screen. Connects to BRAIN and exposes WebSocket on port **6121** for the extension. |
| **CHROME-EXTENSION** | Browser extension (WXT) | Sends page title, URL, video/subtitles to Tamagotchi so UNICHAN can “see” what you’re browsing. |

**Full documentation:** [docs/README.md](docs/README.md) — getting started, each component, and architecture.

---

## Prerequisites

- **Node.js** (v20+) and **pnpm** — for Tamagotchi and the Chrome extension
- **Python 3** — for the BRAIN (nanobot)
- **Chrome** — to load the extension

---

## Quick start (install & run)

Do these in order:

### 1. Clone and install

```bash
git clone https://github.com/dogtoshi-sz/unichan-mvp
cd unichan-mvp
pnpm install
pnpm build:packages
```


### 2. Run the BRAIN

The BRAIN is the AI. Tamagotchi talks to it over HTTP. Leave this running.

```bash
cd BRAIN
pip install -e .
unichan onboard   # First time only: API key, workspace
unichan gateway   # Starts HTTP API on port 18790
```

Or create `~/.unichan/config.json` manually (see [BRAIN/README.md](BRAIN/README.md) and `BRAIN/config.example.json`).

### 3. Run Tamagotchi (desktop avatar)

From the **UNICHAN-MVP** root:

```bash
pnpm dev:tamagotchi
```

In the app:

1. **Settings → Unichan** — Gateway URL: `http://localhost:18790/v1/` → Test → Save.
2. **Settings → Consciousness** — Choose **OpenClaw (Unichan brain)**.
3. Turn on the mic if you want voice.

### 4. Build and load the Chrome extension

From the **UNICHAN-MVP** root:

```bash
pnpm build:extension
```

In Chrome:

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → select folder: `CHROME-EXTENSION/.output/chrome-mv3` (inside your clone).
3. In the extension popup: WebSocket URL `ws://localhost:6121/ws`, enable it, enable **Page context**, then **Apply**.

### 5. Use it

- Browse in Chrome — the extension sends the page to UNICHAN.
- Talk or type in the Tamagotchi app — she sees what you see and can answer, research links, and use the BRAIN.

---

## Repo structure

```
UNICHAN-MVP/
├── BRAIN/              # Python nanobot (nanobot + bridge)
├── TAMAGOTCHI/         # Electron desktop app (UNICHAN Avatar)
├── CHROME-EXTENSION/   # WXT browser extension
├── packages/           # Shared packages (stage-ui, server-sdk, etc.)
├── docs/               # Full documentation
├── package.json
└── pnpm-workspace.yaml
```

---

## Connections & ports

| From | To | Protocol | Port |
|------|----|----------|------|
| Chrome Extension | Tamagotchi | WebSocket | 6121 |
| Tamagotchi | BRAIN | HTTP | 18790 |

Chat and AI always go through **Tamagotchi**; the extension only provides browser context.

---

## Troubleshooting

- **Extension: “Connection error”** — Tamagotchi must be running and WebSocket URL must be `ws://localhost:6121/ws`.
- **Tamagotchi: no chat** — BRAIN must be running; in Settings → Unichan set gateway to `http://localhost:18790/v1/` and Test.
- **Extension popup blank** — Load the **production** build: `CHROME-EXTENSION/.output/chrome-mv3`, not `chrome-mv3-dev`.

More: [docs/README.md](docs/README.md) and [Chrome Extension troubleshooting](docs/chrome-extension/troubleshooting.md).

---

## License

MIT.
