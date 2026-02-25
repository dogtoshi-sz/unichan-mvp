# Settings menu audit (Tamagotchi / Unichan desktop)

Which settings entries are actually used vs placeholders or unused. Ordered by menu order.

| # | Section | Route | Used? | Notes |
|---|---------|--------|-------|--------|
| 1 | **Airi Card** | `/settings/airi-card` | ✅ Yes | Character cards; used by character store and card selection in UI. |
| 2 | **Unichan Agent** | `/settings/unichan` | ✅ Yes | Writes `~/.unichan/config.json` (provider, model, personality, Telegram, workspace). Read by Python gateway. |
| 2 | **Modules** | `/settings/modules` | ✅ Yes | Consciousness, Speech, Hearing, Beat Sync, etc. Drive stage-ui stores (consciousness, speech, hearing). |
| 3 | **Scene** | `/settings/scene` | ⚠️ Placeholder | Page says "In development"; no real settings. No code reads scene-specific config from this page. |
| 4 | **Models** | `/settings/models` | ✅ Yes | Live2D/VRM model selection. `stageModelRenderer`, `stageModelSelected`, `stageModelSelectedUrl` used by Stage and main page. |
| 5 | **Memory** | `/settings/memory` | ⚠️ Placeholder | Renders `<WIP />` only. No memory settings UI or store wired to this page. |
| 6 | **Providers** | `/settings/providers` | ✅ Yes | LLM, speech, transcription providers. Used by consciousness, chat, TTS, STT (provider credentials + instances). |
| 7 | **Data** | `/settings/data` | ✅ Yes | Export/import chats, delete models, reset modules, reset app state. Uses `useDataMaintenance()`. |
| 8 | **Connection** | `/settings/connection` | ✅ Yes | WebSocket URL. Stored in `settings/connection/websocket-url`; read by `useModsServerChannelStore` (channel-server.ts) for connecting to server-runtime. |
| 9 | **System** | `/settings/system` | ✅ Yes | Sub-pages: General, Color scheme, Window shortcuts, Developer. See below. |

## System sub-pages

| Sub-page | Used? | Notes |
|----------|-------|--------|
| **General** | ✅ Yes | Language (i18n), dark theme (useTheme), WSS toggle (`websocketSecureEnabled` → restart WebSocket server with TLS). Tamagotchi adds only WSS; base has language + theme. |
| **Color scheme** | ✅ Yes | Theme / primary color. `useSettingsTheme`, `themeColorsHue`, etc. used by stage and UI. |
| **Window shortcuts** | ✅ Yes | Keyboard shortcuts for window (toggle move, resize, ignore mouse). Tamagotchi-specific; used by shortcut handling. |
| **Developer** | ✅ Yes | Disable transitions, page-specific transitions, open DevTools, open Markdown stress window. `disableTransitions`, `usePageSpecificTransitions` read by settings index and icon-animation; devtools open via invoke. |

## Stored but no UI in Tamagotchi (or not read)

- **`allowVisibleOnAllWorkspaces`** – In `settings-controls-island` store and i18n (Cross-Space Visibility). **Never read** by any window or Electron code in this app; setting is saved but has no effect. Could be wired to `BrowserWindow.setVisibleOnAllWorkspaces()` in main.
- **`controlsIslandIconSize`** – **Used** by the controls island component. In Tamagotchi, General uses `SettingsGeneralFields` and does *not* include this field (unlike stage-pages’ general, which does). So the value comes from localStorage default or from a previous session on another platform; there is no Tamagotchi Settings UI to change it unless added.

## Summary

- **Fully used:** Unichan, Modules, Models, Providers, Data, Connection, System (and its sub-pages), Airi Card.
- **Placeholder / not really used:** Scene, Memory (WIP only).
- **Stored but not applied:** `allowVisibleOnAllWorkspaces` (could be hooked to window visibility).
