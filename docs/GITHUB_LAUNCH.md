# GitHub & Token Launch – Repo Cleanup Guide

Guide to cleaning up UNICHAN-MVP before uploading to GitHub and launching your token.

---

## 1. One repo vs separate repos

**Recommendation: keep the whole project as one monorepo.**

| Reason | Detail |
|--------|--------|
| **Shared packages** | Tamagotchi and Chrome extension both depend on `packages/*` (`@proj-airi/server-sdk`, `@proj-airi/ui`, `stage-ui-live2d`, etc.). Splitting would require publishing those to npm or copying code. |
| **Single clone, single CI** | One repo = one `pnpm install` and `pnpm build:packages`; one place for issues and docs. |
| **Brain is already separate** | BRAIN (Python nanobot + bridge) is not in the pnpm workspace; it’s a separate section with its own `pip install -e .`. You still ship it in the same repo as “BRAIN / nanobot” for consistency. |
| **Token / branding** | One “UNICHAN” repo is clearer for community and token narrative: “Desktop + Chrome + Brain in one place.” |

If you ever split (e.g. “unichan-extension” only), you’d need to either publish `@proj-airi/*` to npm or vendor the shared code into that repo. For launch, one repo is simpler and accurate.

---

## 2. Repo layout (what to upload)

Upload the **entire UNICHAN-MVP repo** with these sections:

```
UNICHAN-MVP/
├── BRAIN/              # Python nanobot + bridge (separate from pnpm)
├── CHROME-EXTENSION/   # WXT extension (in pnpm workspace)
├── TAMAGOTCHI/         # Electron app (in pnpm workspace)
├── packages/           # Shared packages (required by extension + tamagotchi)
├── docs/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── ...
```

- **Chrome extension** = `CHROME-EXTENSION/` (built with `pnpm build:extension`).
- **Brain** = `BRAIN/` (nanobot + optional bridge; `pip install -e .` then `unichan gateway`).
- **Tamagotchi** = `TAMAGOTCHI/` (Electron; `pnpm dev:tamagotchi`).

No need to create separate GitHub repos for these unless you have a specific reason (e.g. closed-source brain).

---

## 3. Cleanup before pushing

### 3.1 Secrets and local paths

- **Already ignored** (in `.gitignore`): `.env`, `.env.*`, `config.json`, `*.pem`, `.unichan/`.  
  Ensure no real API keys or `config.json` with secrets are ever committed.

- **Fix hardcoded paths**: Replace any path that contains your machine name or username (e.g. `C:\Users\...`) with a generic path in README/docs.  
  Example: “Load unpacked from `CHROME-EXTENSION/.output/chrome-mv3`” instead of a full Windows path.

- **BRAIN**: Only `BRAIN/config.example.json` (no secrets) should be in git. Users copy it to `~/.unichan/config.json` and add their own keys.

### 3.2 What to add to `.gitignore` (optional)

- **`launchstrat`** – If that file contains private launch/marketing notes, add `launchstrat` to `.gitignore` and don’t commit it. If it’s generic enough for the repo, you can commit it (e.g. under `docs/`).

### 3.3 Build artifacts and caches

Already ignored: `node_modules/`, `dist/`, `out/`, `.output/`, `.turbo/`, `.cache/`, `*.tsbuildinfo`, `.wxt/`, etc.  
Before first push, run a quick check:

```bash
git status
```

and ensure no `node_modules`, `.output`, or `.env` are staged.

### 3.4 Optional: `.env.example`

If the project or any part (e.g. Tamagotchi) uses env vars, add a root or per-app `.env.example` with placeholder variable names (no real values). Your `.gitignore` already has `!.env.example` so it can be committed.

---

## 4. Pre-push checklist

- [ ] No `.env`, `config.json`, or `*.pem` in the tree (only example files).
- [ ] No hardcoded paths with your username in README/docs (or they’re generic).
- [ ] `launchstrat` either in `.gitignore` or moved to `docs/` and committed intentionally.
- [ ] `pnpm install` and `pnpm build:packages` run at root; Tamagotchi and extension build successfully.
- [ ] BRAIN: `config.example.json` is committed; real config lives in `~/.unichan/` (ignored).

---

## 5. After uploading to GitHub

- Add a short **README** (or keep the current one) that states: Brain (nanobot), Tamagotchi (desktop), Chrome extension, and that they share the same “brain” (gateway).
- In README, use relative or generic paths for “load extension” (e.g. `CHROME-EXTENSION/.output/chrome-mv3`).
- If you have a token or landing page, add the repo link and a one-liner (e.g. “UNICHAN – AI degen waifu: Desktop + Chrome + Telegram, one brain.”).

This keeps one clean, public monorepo that matches your “Desktop + Chrome + Brain” story and is ready for token launch.
