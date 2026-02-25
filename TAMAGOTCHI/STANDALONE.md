# Tamagotchi standalone – clean repo for OpenClaw or local brain

The Tamagotchi app **does not use nanobot or any Python/core runtime**. It only needs:

- **Brain**: OpenClaw gateway (remote or local) or any OpenAI-compatible HTTP API
- **Config**: `~/.unichan/config.json` for gateway URL and token (same path as Unichan CLI for consistency; no nanobot code is used)

This doc describes how to get a **clean repo** that is only the Tamagotchi and its dependencies (no nanobot, no extra services).

---

## If you use OpenClaw as the brain (required)

Tamagotchi talks to the brain over **HTTP** at `http://<host>:<port>/v1/chat/completions`. **OpenClaw does not expose this by default.**

1. **Enable the HTTP chat endpoint** in OpenClaw’s config:
   - Open **`~/.openclaw/openclaw.json`** (or `%USERPROFILE%\.openclaw\openclaw.json` on Windows).
   - Inside the `"gateway"` object, add:
     ```json
     "http": {
       "endpoints": {
         "chatCompletions": { "enabled": true }
       }
     }
     ```
   - Save the file, then **restart** the gateway (e.g. `openclaw gateway --port 18789`).
2. In the app: **Settings → Unichan** → “This computer”, port **18789**, Model **openclaw** (or `openclaw:main`) → **Save**.
3. **Settings → Consciousness** → select **OpenClaw (Unichan brain)**.

Without step 1, chat will not work even if the gateway is running. See [OpenClaw HTTP API docs](https://docs.openclaw.ai/gateway/openai-http-api).

---

## Option A: Use this monorepo, run only Tamagotchi (simplest)

You can keep the full repo and simply **never run nanobot**:

1. From the **waifu** root (not the repo root that has `core/`):
   ```bash
   cd waifu
   pnpm install
   pnpm dev:tamagotchi
   ```
2. Configure the brain in the app: **Settings → Unichan** (or **Configure remote brain (Unichan)** from Consciousness). Set:
   - **This computer**: Gateway port **18789** (match `openclaw gateway --port 18789`), Model **openclaw**
   - **Another computer**: Brain URL (e.g. `http://192.168.0.169:18789/v1/`) and gateway token
   - If you use **OpenClaw**, you must [enable the HTTP chat endpoint](#if-you-use-openclaw-as-the-brain-required) in `~/.openclaw/openclaw.json` first.
3. **Settings → Consciousness** → **OpenClaw (Unichan brain)**.
4. No need to clone or run anything in `core/` or `core/nanobot`.

---

## Option B: New repo with only Tamagotchi and its dependencies

To create a **separate, minimal repo** that only contains the Tamagotchi and the packages it needs:

### 1. Clone and restrict to `waifu/`

```bash
git clone <your-repo-url> tamagotchi-standalone
cd tamagotchi-standalone
# Remove everything outside waifu (core, etc.) if you want a truly clean root
# Or keep the repo as-is and only work inside waifu/
cd waifu
```

### 2. Minimal workspace (Tamagotchi-only)

Keep only the app and the workspace packages it depends on. From the **waifu** directory you need at least:

- **apps/stage-tamagotchi** – the Electron app
- **packages/** – all packages referenced by Tamagotchi’s `package.json` as `workspace:^` or `workspace:*`:
  - `stage-ui`, `stage-pages`, `stage-layouts`, `stage-shared`, `stage-ui-live2d`, `stage-ui-three`
  - `server-runtime`, `server-sdk`
  - `i18n`, `ui`, `ui-transitions`
  - `ccc`, `audio`, `electron-screen-capture`
  - `font-cjkfonts-allseto`, `font-xiaolai`
  - and any packages those depend on (transitively) inside `packages/`

You can **delete** from the waifu workspace (if you want a minimal tree):

- **apps/** except `stage-tamagotchi` (e.g. stage-web, stage-pocket, server, etc.)
- **services/** (twitter, telegram, discord, minecraft, satori-bot, etc.)
- **plugins/** (or keep only `airi-plugin-web-extension` if you want the browser extension)
- **integrations/** (VSCode, etc.)
- **docs/** (optional)
- **examples/** (optional)

After deleting, run:

```bash
pnpm install
pnpm -rF @proj-airi/stage-tamagotchi run dev
```

If something is missing, `pnpm` will report unresolved workspace dependencies; add back the missing package from the original repo.

### 3. Slim `pnpm-workspace.yaml`

In the minimal repo, `pnpm-workspace.yaml` can be reduced to:

```yaml
packages:
  - 'packages/**'
  - 'apps/**'
  # - 'plugins/**'   # only if you keep the web extension
  # - 'services/**'  # not needed for Tamagotchi
```

Keep the same `catalog` (or a subset) and `overrides` from the original `waifu/pnpm-workspace.yaml` so versions resolve.

### 4. Root `package.json` scripts

In the root (waifu) `package.json`, you only need scripts for Tamagotchi, for example:

```json
{
  "scripts": {
    "dev": "pnpm -rF @proj-airi/stage-tamagotchi run dev",
    "build": "pnpm -rF @proj-airi/stage-tamagotchi run app:build"
  }
}
```

---

## Chat not working with brain?

1. **Using OpenClaw?**  
   - You must enable the HTTP chat endpoint in **`~/.openclaw/openclaw.json`** (see [If you use OpenClaw as the brain](#if-you-use-openclaw-as-the-brain-required) above). Restart the gateway after editing. Without this, chat will never work.

2. **Settings → Unichan**  
   - **This computer**: Port **18789**, Model **openclaw** (or `openclaw:main`).  
   - **Another computer**: Brain URL (e.g. `http://192.168.1.100:18789/v1/`) and gateway token.  
   - Use **Test connection to brain**; it should succeed before chat will work.

3. **Settings → Consciousness**  
   - Connection type must be **OpenClaw (Unichan brain)**. If it’s “Cloud or custom API”, the app won’t use the gateway.

3. **After changing Unichan**  
   - Close the Settings window so the main window re-reads the config, or switch back to the main window (focus triggers a refresh).

4. **On the brain computer**  
   - Gateway must be listening on **all interfaces** (e.g. `0.0.0.0:18789`), not only `127.0.0.1`, so the Tamagotchi PC can reach it.  
   - Firewall must allow **inbound TCP on the gateway port** (e.g. 18789).

5. **URL format**  
   - Use the full base URL including `/v1/`, e.g. `http://BRAIN_IP:18789/v1/` (no trailing path after `v1/`).

---

## Summary

| Goal                         | Approach                                                                 |
|-----------------------------|--------------------------------------------------------------------------|
| No nanobot at runtime       | Already true: Tamagotchi only uses HTTP + `~/.unichan/config.json`.     |
| Use OpenClaw as brain       | Enable HTTP in `~/.openclaw/openclaw.json` (see above), then Settings → Unichan + Consciousness → OpenClaw. |
| Use local gateway           | Settings → Unichan: “This computer” + port 18789, Model openclaw.       |
| Clean repo, same monorepo   | Option A: run only `pnpm dev:tamagotchi` from `waifu/`, ignore `core/`.  |
| Clean repo, new minimal repo| Option B: copy only `waifu/`, delete other apps/services/plugins, then install and run Tamagotchi. |

No nanobot (or other Python) dependencies are required for the Tamagotchi to connect to your brain or a local instance.
