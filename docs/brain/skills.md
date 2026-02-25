# Skills

The BRAIN (nanobot) supports **skills**: capabilities the agent can use when you chat with UNICHAN (e.g. “what’s the weather?”, “summarize this URL”).

---

## Skill format

Each skill lives under `BRAIN/nanobot/skills/` as a directory with:

- **YAML frontmatter** in a `SKILL.md` file (name, description, metadata)
- **Markdown instructions** for the agent

The format follows [OpenClaw](https://github.com/openclaw/openclaw) conventions.

---

## Built-in skills

| Skill | Description |
|-------|-------------|
| **github** | Interact with GitHub using the `gh` CLI |
| **weather** | Get weather info (e.g. wttr.in, Open-Meteo) |
| **summarize** | Summarize URLs, files, and YouTube videos |
| **tmux** | Remote-control tmux sessions |
| **skill-creator** | Create new skills |

---

## How UNICHAN uses them

When you talk to the Tamagotchi (UNICHAN avatar), your message is sent to the BRAIN. The BRAIN may decide to call a skill (e.g. weather, summarize). The result is streamed back to the Tamagotchi and shown or spoken by the character. No extra configuration is needed in the Tamagotchi; it’s all driven by the BRAIN gateway.
