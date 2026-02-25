# Gateway API

The BRAIN exposes an **HTTP gateway** that the Tamagotchi (UNICHAN avatar) uses for chat and tools.

---

## Port and URL

| Default port | URL Tamagotchi uses |
|-------------|---------------------|
| **18790** | `http://localhost:18790/v1/` |

Configure this in Tamagotchi: **Settings → Unichan** (e.g. “This computer” or “Another computer” with `http://<BRAIN_IP>:18790/v1/`).

---

## Start the gateway

```bash
cd BRAIN
unichan gateway
```

Leave it running. Tamagotchi connects to it for:

- **Chat** — Send user message + optional browser context; receive streamed LLM reply.
- **Tools** — Token research, skills (weather, summarize, etc.) as needed by the agent.

---

## Who connects to the gateway

- **Tamagotchi** — Yes. It is the only app that talks to the BRAIN.
- **Chrome extension** — No. The extension talks only to Tamagotchi (WebSocket 6121). Tamagotchi forwards context and chat to the BRAIN.

---

## Other commands

| Command | Description |
|---------|-------------|
| `unichan gateway` | Start HTTP API (chat, token research) for Tamagotchi |
| `unichan agent` | Interactive CLI chat |
| `unichan onboard` | Setup wizard (API key, workspace, etc.) |
| `unichan tamagotchi` | Start Tamagotchi app (from UNICHAN-MVP root) |
| `unichan status` | Show config and provider status |
