# UNICHAN Brain (nanobot)

The AI agent that powers UNICHAN: HTTP gateway for Tamagotchi, token research for the Chrome Extension.

## Quick Start

### 1. Install

```bash
cd BRAIN
pip install -e .
```

For optional channels (Telegram, Discord, Slack, etc.):

```bash
pip install -e ".[channels]"
```

### 2. Configure

Create `~/.unichan/config.json` (or `%USERPROFILE%\.unichan\config.json` on Windows):

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

Or run the setup wizard:

```bash
unichan onboard
```

### 3. Start the gateway

```bash
unichan gateway
```

Gateway runs on **port 18790** by default. Tamagotchi connects to `http://localhost:18790/v1/`.

## Commands

| Command | Description |
|---------|-------------|
| `unichan gateway` | Start HTTP API (chat, token research) for Tamagotchi |
| `unichan agent` | Interactive CLI chat |
| `unichan onboard` | Setup wizard (API key, workspace, etc.) |
| `unichan tamagotchi` | Start Tamagotchi app (from UNICHAN-MVP root) |
| `unichan status` | Show config and provider status |

## Config locations

- **Config**: `~/.unichan/config.json`
- **Workspace**: `~/.unichan/workspace` (memory, skills)
- **History**: `~/.unichan/history/`

## Supported providers

OpenAI, Anthropic, OpenRouter, DeepSeek, Groq, Gemini, and more via LiteLLM. Set `providers.<name>.apiKey` in config.

## Token research (Birdeye)

For the Chrome Extension's token lookup, add your Birdeye API key:

```json
{
  "tools": {
    "tokenResearch": {
      "birdeyeApiKey": "your-birdeye-key"
    }
  }
}
```
