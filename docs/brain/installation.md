# Installation & configuration

## Install

```bash
cd BRAIN
pip install -e .
```

For optional channels (Telegram, Discord, Slack, etc.):

```bash
pip install -e ".[channels]"
```

---

## Config file

Create **`~/.unichan/config.json`** (on Windows: `%USERPROFILE%\.unichan\config.json`).

### Minimal example

```json
{
  "agents": {
    "defaults": {
      "model": "gpt-4o-mini",
      "workspace": "~/.unichan/workspace"
    }
  },
  "providers": {
    "openai": { "apiKey": "sk-your-openai-key" }
  },
  "gateway": {
    "port": 18790
  }
}
```

### Setup wizard

Instead of editing by hand:

```bash
unichan onboard
```

This walks you through API key, workspace, and basic settings.

---

## Config locations

| Item | Path |
|------|------|
| **Config** | `~/.unichan/config.json` |
| **Workspace** | `~/.unichan/workspace` (memory, skills) |
| **History** | `~/.unichan/history/` |

---

## Providers

The BRAIN supports multiple LLM providers (OpenAI, Anthropic, OpenRouter, DeepSeek, Groq, Gemini, etc., often via LiteLLM). Set `providers.<name>.apiKey` (or equivalent) in `config.json`. See the main [BRAIN README](../../BRAIN/README.md) for provider-specific keys.

---

## Token research (Birdeye)

For the Chrome extension’s token lookup, add your Birdeye API key:

```json
{
  "tools": {
    "tokenResearch": {
      "birdeyeApiKey": "your-birdeye-key"
    }
  }
}
```

Tamagotchi will then be able to use token research when you ask about tokens or when the extension sends page/URL context.
