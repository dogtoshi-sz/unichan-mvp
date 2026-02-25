# Troubleshooting

## Old UI: “AIRI Web Extension” and “Character” (Model URL, Gateway URL)

You’re on an **old build**. Rebuild and reload:

- From **UNICHAN-MVP** root: `pnpm build:extension`
- In Chrome: `chrome://extensions` → **Reload** on the extension (or Load unpacked from `CHROME-EXTENSION/.output/chrome-mv3`)

The popup should then show only **Connection** + **Preference capture**, and the name should be **“Unichan – Screen context for Tamagotchi”**.

---

## Popup is a tiny white block / blank

You’re loading the **dev** build (e.g. `.output/chrome-mv3-dev`), which expects the Vite dev server. Load the **production** build instead:

1. Remove the extension in Chrome
2. **Load unpacked** and choose **`CHROME-EXTENSION/.output/chrome-mv3`** (not chrome-mv3-dev)
3. Run `pnpm build:extension` first if that folder doesn’t exist

---

## “Offline” or “Connection error”

“Offline” means the extension is not connected to Tamagotchi’s WebSocket. Check:

1. **Tamagotchi is running** — Start the desktop app (`pnpm dev:tamagotchi` from UNICHAN-MVP). It opens the WebSocket server on port 6121 (or 6122–6125 if 6121 is busy). If Tamagotchi isn’t running, the extension stays Offline.
2. **WebSocket URL is correct** — In the popup → Connection, set URL to `ws://localhost:6121/ws` (or `ws://<TAMAGOTCHI_IP>:6121/ws` if Tamagotchi is on another PC). Use `ws://` not `wss://` for local.
3. **Extension is enabled** — In the popup, turn **Enable** on, then click **Apply** so it tries to connect.
4. **You clicked Apply** — After changing the URL or Enable, you must click **Apply** to reconnect.

If the connection fails, an orange **Connection error** box appears with the reason (e.g. “Failed to construct 'WebSocket'”, or connection refused). Fix the cause above and click **Apply** again.

---

## “Connection error” / “WebSocket error”

Same as above: the extension can’t reach Tamagotchi. Start Tamagotchi first, set WebSocket URL to `ws://localhost:6121/ws`, Enable on, Apply. If Tamagotchi is on another PC, use `ws://<TAMAGOTCHI_PC_IP>:6121/ws` and allow that port in the firewall.

---

## Split setup: extension on one PC, BRAIN on another

- **This PC (Chrome + extension):** Run **Tamagotchi** here. Extension → WebSocket URL = `ws://localhost:6121/ws`, Enable, set capture options, Apply.
- **This PC (Tamagotchi):** Settings → Unichan → “Another computer” → Gateway URL = `http://<BRAIN_IP>:18790/v1/`, Test, Save. Consciousness → OpenClaw.
- **Other PC:** Run OpenClaw/Unichan (e.g. on 18790); firewall allows inbound from this PC.

Result: extension sends browser context to Tamagotchi on this PC; Tamagotchi sends messages + context to the BRAIN and streams replies back.
