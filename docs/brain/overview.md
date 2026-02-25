# BRAIN overview

The BRAIN is a **lightweight nanobot** that:

1. **Runs the AI** — LLM-backed chat and tool use (OpenAI, Anthropic, OpenRouter, etc. via config).
2. **Learns and runs skills** — Built-in skills (GitHub, weather, summarize, tmux, skill-creator) extend what UNICHAN can do.
3. **Interacts with UNICHAN** — The Tamagotchi (avatar) is the only client that talks to the BRAIN; all chat and tools go through the gateway.
4. **Token research** — Optional tool (e.g. Birdeye API) for token lookup; used when the Chrome extension sends token/page context via Tamagotchi.

---

## Repo layout (BRAIN)

```
BRAIN/
├── nanobot/           # Core agent, gateway, skills
│   ├── skills/        # Built-in skills (github, weather, summarize, etc.)
│   └── ...
├── bridge/            # Optional bridge components
├── config.example.json
└── README.md
```

---

## Attribution

The skill format and metadata follow [OpenClaw](https://github.com/openclaw/openclaw) conventions for compatibility.
