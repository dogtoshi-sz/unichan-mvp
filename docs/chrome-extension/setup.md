# Setup & connection

## Build the extension

From the **UNICHAN-MVP** root:

```bash
pnpm build:extension
```

This produces the production build. Load the **production** folder (not the dev folder), or the popup may be blank.

**Output folder:**  
`UNICHAN-MVP/CHROME-EXTENSION/.output/chrome-mv3`

(From the repo root the path may be `CHROME-EXTENSION/.output/chrome-mv3`.)

---

## Load in Chrome

1. Open **Chrome** → `chrome://extensions`
2. Turn **Developer mode** on
3. Click **Load unpacked**
4. Select the folder: **`CHROME-EXTENSION/.output/chrome-mv3`**  
   Do **not** use `chrome-mv3-dev` (that build expects the Vite dev server).

---

## Configure in the popup

1. **Connection**
   - **WebSocket URL:** `ws://localhost:6121/ws` (or `ws://<TAMAGOTCHI_IP>:6121/ws` if Tamagotchi is on another PC)
   - Turn **Enable** on
   - Click **Apply**

2. **Preference capture**
   - Enable **Page context** (and **Video** / **Subtitles** if you want)
   - Click **Apply**

---

## Full flow: Tamagotchi + extension

1. **Start the BRAIN** (same PC: port 18790; other PC: ensure it’s reachable).
2. **Start Tamagotchi** (`pnpm dev:tamagotchi` from UNICHAN-MVP). Leave it open.
3. **Point Tamagotchi at the BRAIN**  
   **Settings → Unichan** → “This computer” or “Another computer” (URL `http://<BRAIN_IP>:18790/v1/`) → **Test** → **Save**.  
   **Settings → Consciousness** → **OpenClaw (Unichan brain)**.
4. **Enable voice** in Tamagotchi (mic on, Hearing configured if needed).
5. **Load and configure the extension**  
   Build: `pnpm build:extension`. Load unpacked → `CHROME-EXTENSION/.output/chrome-mv3`.  
   Popup → **Connection**: WebSocket URL = `ws://localhost:6121/ws`, **Enable** on. **Preference capture**: Page context (and Video/Subtitles). **Apply**.
6. **Use it** — Browse in Chrome; talk or type to UNICHAN in Tamagotchi. She gets your words plus the browser context.

If the extension shows **Connection error**, Tamagotchi isn’t running or the WebSocket URL is wrong. Chat is only via Tamagotchi; the extension has no character or Gateway URL.

---

## Which URL?

- **WebSocket URL** (in the popup): where the extension sends page/video/subtitle context. Tamagotchi runs this server.
  - Same PC: `ws://localhost:6121/ws`
  - Tamagotchi on another machine: `ws://<that-ip>:6121/ws`
  - Use `ws://` (not `wss://`) for local.

There is no “Gateway URL” in the extension. All chat and BRAIN connection are configured in **Tamagotchi** (Settings → Unichan, Consciousness).
