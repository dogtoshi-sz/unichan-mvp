# Page context & research

The extension sends **browser context** to Tamagotchi so UNICHAN can see what you’re looking at and research links (e.g. Twitter posts, websites).

---

## What gets sent

| Context | Description |
|--------|-------------|
| **Page** | Current tab title and URL (e.g. “User is on https://dexscreener.com/solana/…”). |
| **Video** (optional) | On YouTube/Bilibili: video title, channel, progress. |
| **Subtitles** (optional) | Live subtitles from the video. |

Tamagotchi injects this into each chat turn so the BRAIN (and thus UNICHAN) can use it when answering.

---

## What you can ask UNICHAN

- *“What page am I on?”* / *“Summarize what I’m looking at.”*
- *“Check the Twitter posts for this token”* — She sees the URL/title; you can paste or say the token name.
- *“Research this website”* / *“Do a deeper look into this link.”* — She can use the BRAIN’s skills (e.g. summarize) with the URL/title you’re on.

All of this happens in the **Tamagotchi app** (voice or text). The extension only provides context; it does not show a character or chat.

---

## Making UNICHAN use the context

Tamagotchi already injects browser context into each turn. To have her refer to what you’re browsing more proactively, add to her **system prompt** (e.g. Settings → Character/Card):

*“You can see what the user is browsing via a Chrome extension: current page title/URL, and on YouTube/Bilibili the video title and live subtitles. Use this when relevant. The user may ask you to analyze a token chart, check Twitter for a token, or summarize a page.”*

---

## Screenshots and “analyze this chart”

- **Today:** The model gets **text** only (title, URL, video, subtitles). Good for “what page is this?”, “summarize the video,” “what token is in the URL?”. For “analyze this token chart” she has no image yet.
- **Possible later:** Add `chrome.tabs.captureVisibleTab()` and send a screenshot as context so the model can analyze charts, tweets, or any visible content. That would require Tamagotchi/chat to support image context.
