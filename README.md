# UNICHAN MVP

A clean, working 3-piece AI waifu system:

1. **BRAIN** — Python nanobot (AI agent, token research, gateway)
2. **TAMAGOTCHI** — Electron desktop app (Live2D character, voice, screen)
3. **CHROME-EXTENSION** — Browser extension (reads pages, analyzes tokens, WebSocket to tamagotchi)

**📚 [Full documentation (GitBook-style)](docs/README.md)** — Overview, getting started, Tamagotchi (UNICHAN Avatar), BRAIN, Chrome Extension, and architecture.

---

## Quick Start

### 1. Install dependencies

```bash
pnpm install
pnpm build:packages   # Build shared packages (run from repo root)
```

### 2. Run the Brain (nanobot)

```bash
cd BRAIN
pip install -e .
unichan onboard   # First-time: setup wizard for API key, workspace
unichan gateway   # Start HTTP API on port 18790
```

Or create `~/.unichan/config.json` manually (see [BRAIN/README.md](BRAIN/README.md) and `BRAIN/config.example.json`).

### 3. Run the Tamagotchi

```bash
pnpm dev:tamagotchi
```

### 4. Build & load the Chrome Extension

```bash
pnpm build:extension
# Then load unpacked: C:\Users\emilk\Desktop\UNICHAN-MVP\CHROME-EXTENSION\.output\chrome-mv3
```

---

## Structure

```
UNICHAN-MVP/
├── BRAIN/           # Python nanobot (nanobot + bridge)
├── TAMAGOTCHI/      # Electron app (stage-tamagotchi)
├── CHROME-EXTENSION/# WXT browser extension
├── packages/        # Shared packages (stage-ui, server-sdk, etc.)
└── pnpm-workspace.yaml
```

---

## Connections

- **Extension → Tamagotchi**: WebSocket on port 6121
- **Tamagotchi → Brain**: HTTP gateway on port 18790 (nanobot default)
