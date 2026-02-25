# Character widget (bottom-right overlay)

Goal: when the browser is opened, the Live2D character appears in the bottom-right of the screen (like the desktop tamagotchi). Later: use her to do things in the browser.

## Difficulty: **medium** (~3–5 days for someone familiar with the stack)

- You already have the web extension (WXT + Vue), content script, and popup.
- The hard parts: (1) fitting the Live2D stack into an extension context, (2) model size vs extension size limits, (3) one minimal “character-only” UI.

---

## Architecture

1. **Content script**  
   Injects a fixed-position container (bottom-right) on every page (or only on chosen sites).  
   Inside: an **iframe** whose `src` is the extension’s character page (e.g.  
   `chrome-extension://<id>/character.html`).  
   - Iframe runs in the extension origin → no CSP/cross-origin issues for extension assets.  
   - Widget can be draggable/resizable and preference stored in `storage.local`.

2. **Character entrypoint**  
   New WXT entrypoint: a small Vue app that only renders the Live2D scene (reuse  
   `@proj-airi/stage-ui-live2d` + one preset model).  
   - No full stage UI, no settings page — just canvas + optional WebSocket for events later.

3. **Model**  
   - **Option A**: Bundle one small model in the extension (e.g. a single zip).  
     Con: extension size can grow a lot (Chrome unpacked limit is high; store has ~20MB-ish limits).  
   - **Option B**: Load model from URL (e.g. your stage-web or a CDN).  
     Pro: small extension. Con: needs network and a stable URL.  
   - **Option C**: Ship a very small “placeholder” model and allow “custom model URL” in popup later.

4. **“Always starts”**  
   - Content script `matches: ['*://*/*']` and `runAt: 'document_idle'` (already broad).  
   - In the injected UI, read a pref from `storage.local` (e.g. `characterWidgetEnabled`, default `true`).  
   - If enabled, create the iframe; otherwise skip. Popup can expose a “Show character on pages” toggle.

---

## Implementation steps

1. **New entrypoint: character page**  
   - Add `entrypoints/character/` (index.html + main.ts + App.vue).  
   - App.vue: single full-screen div; mount the Live2D canvas (from `@proj-airi/stage-ui-live2d`).  
   - Resolve model: either bundle one preset (zip in `public/`) or pass `modelUrl` via postMessage from content script (from storage or default URL).  
   - Register in `wxt.config.ts` if needed (WXT usually auto-discovers entrypoints).

2. **Content script: inject widget**  
   - In `content.ts` (or a second content script), after `startContentObserver()`:  
     - Check `characterWidgetEnabled` from storage.  
     - If true, create a container:  
       - `position: fixed; bottom: 20px; right: 20px; width: 200px; height: 320px; z-index: 2147483647;`  
       - Optional: drag handle, resize handle, “collapse” to a small pill.  
     - Append an iframe: `src: browser.runtime.getURL('character.html')` (or the real path WXT generates).  
   - Listen for storage changes to show/hide or reload iframe when user toggles the pref.

3. **Popup: “Show character” toggle**  
   - Add a checkbox (e.g. in PreferenceCapture or a new section): “Show character on every page”.  
   - Save to `storage.local` and have the content script react to it.

4. **Optional: WebSocket**  
   - Character page can open a WebSocket to the same backend as tamagotchi (URL from storage).  
   - Then later you can send events (e.g. “notify”, “focus”) so the character reacts to browser events (tabs, captions, etc.).

5. **Future: “use her to do things in the browser”**  
   - Content script already captures page/video context and can send to background.  
   - Add a minimal “action” API (e.g. from character UI or popup): “highlight element”, “fill form”, “click”, etc., and have the background/content script execute (with permissions and user consent).

---

## Dependencies to add

- `@proj-airi/stage-ui-live2d` (and its deps: pixi, jszip, etc.) in the extension’s `package.json`.  
- If you use a bundled model, add the zip under `public/` and reference it from the character app.

---

## Troubleshooting: character not showing on Google (or some sites)

- **Host permissions**: The extension needs access to all sites. In `wxt.config.ts`, `host_permissions` must include `https://*/*` and `http://*/*`. After changing this, **reload the extension** in `chrome://extensions`.
- **Re-grant permissions**: If you had the extension installed before adding these permissions, remove it and **Load unpacked** again from the build folder (`.output/chrome-mv3`). Accept the prompt “Read and change your data on all websites” so the content script can run on Google, etc.
- **Content script matches**: The content script uses `matches: ['https://*/*', 'http://*/*']` and `runAt: 'document_idle'` so it runs after the page loads. The widget is re-attached every 1.5s if the page removes it (e.g. SPAs).

---

## Summary

| Item                         | Effort |
|------------------------------|--------|
| Character entrypoint (Vue + Live2D) | 1–2 days |
| Content script widget + iframe      | 0.5 day  |
| Storage + “always show” toggle      | 0.5 day  |
| Model choice (bundle vs URL)       | 0.5–1 day |
| Polish (drag, resize, collapse)     | 0.5–1 day |

Total: **medium** — doable in under a week with the existing extension and stage-ui-live2d.
