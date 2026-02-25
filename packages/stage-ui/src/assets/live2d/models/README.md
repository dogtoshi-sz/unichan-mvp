# Live2D models (folder structure, same as landing)

Presets load from **unzipped folders**, not zips. Use the same layout as the landing page.

## Expected structure

```
live2d/models/
├── hiyori/
│   ├── preview.png
│   ├── hiyori_pro_zh/
│   │   └── runtime/
│   │       └── hiyori_pro_t11.model3.json  (+ moc3, textures, motions, etc.)
│   └── hiyori_free_zh/        (optional; if missing, Free preset uses Pro)
│       └── runtime/
│           └── hiyori_free_t04.model3.json
├── nicole/
│   ├── Nicole/
│   │   └── Nicole.model3.json (+ Nicole.8192 textures, moc3, expressions, etc.)
│   └── Nicole-4096/           (Lite: 4096 textures for lower GPU usage)
│       └── Nicole.model3.json (+ Nicole.4096 textures)
├── aliium/
│   ├── preview.png
│   └── ariu/
│       └── ariu.model3.json   (+ moc3, textures, etc.)
└── idol01/                    (optional)
    └── Idol01_1/Idol1_Public_ver_1/Idol1_Public_ver_1.model3.json
```

## How to get the folders

- Copy from your landing repo: `UnichanPump/unichanmintfixed/public/live2d/models/` → paste `hiyori`, `nicole`, `aliium` (and optionally `idol01`) into this `models/` folder.
- Or extract your existing zips (e.g. `hiyori_pro_zh.zip`, `Nicole.zip`, `Aliium...zip`) so the contents match the paths above (e.g. `nicole/Nicole/` with `Nicole.model3.json` inside).

**Desktop Tamagotchi default (Nicole):** The app defaults to the Nicole character. Ensure `Nicole.zip` is present in this `models/` folder (e.g. copy from your landing repo’s live2d assets or from a compatible Live2D Cubism export). If missing, use Settings → Model to switch to Hiyori (Pro), which is downloaded at build time.

Previews: add `preview.png` in each model folder (`hiyori/`, `nicole/`, `aliium/`) for the model selector thumbnails.

---

## Loading as a .zip (extension / URL)

When you load a model from a **URL to a .zip** (e.g. in the browser extension), the zip must contain **all files** that `model3.json` references.

**Nicole** (`Nicole.model3.json`) expects:
- `Nicole.moc3`
- `Nicole.8192/texture_00.png`, `Nicole.8192/texture_01.png`
- `Nicole.physics3.json`, `Nicole.cdi3.json`

**Nicole (Lite)** uses `Nicole.4096/` textures (half resolution). Regenerate with: `pnpm -C packages/stage-ui run generate:nicole-lite`

**ariu** (`ariu.model3.json`) expects:
- `ariu.moc3`
- `ariu.4096/texture_00.png` … `texture_03.png`
- `ariu.physics3.json`, `ariu.cdi3.json`

You can zip either **flat** (all files at root) or **with a root folder** (e.g. `Nicole/Nicole.model3.json`, `Nicole/Nicole.moc3`, `Nicole/Nicole.8192/texture_00.png`). The loader supports both. If the zip is missing `.moc3` or the texture folder, the model will not load.

### Why the same model works on the website but not from zip in the extension

- **Website (e.g. UnichanPump landing):** The frontend loads by **URL to the .model3.json file** (e.g. `./models/nicole/Nicole/Nicole.model3.json`). The server serves **unzipped** files; the browser fetches the JSON, then each asset (moc3, textures) by **relative URL**. **No zip is involved.**
- **Extension (or any “load from zip” flow):** You give a **URL to the .zip**. The app fetches the zip once and reads files **inside** the zip. Path resolution and zip layout can cause “file not found” if the zip structure doesn’t match what the loader expects.

So the “same” content works on the site because the site never uses the zip – it uses the unzipped folder. To get identical behavior in the extension, use the **model3.json URL** (e.g. your deployed site’s URL to `…/Nicole.model3.json`) instead of the zip, if your server allows CORS for the extension.
