"""CLI commands for nanobot."""

from __future__ import annotations

import asyncio
import os
import signal
from pathlib import Path
import select
import sys
from typing import TYPE_CHECKING

import questionary
import typer

if TYPE_CHECKING:
    from nanobot.config.schema import Config
from rich.console import Console
from rich.markdown import Markdown
from rich.table import Table
from rich.text import Text

from prompt_toolkit import PromptSession
from prompt_toolkit.formatted_text import HTML
from prompt_toolkit.history import FileHistory
from prompt_toolkit.patch_stdout import patch_stdout

from nanobot import __version__, __logo__
from nanobot.providers.litellm_provider import LiteLLMProvider

app = typer.Typer(
    name="unichan",
    help=f"{__logo__} unichan - Personal AI Agent",
    no_args_is_help=True,
)

console = Console()
EXIT_COMMANDS = {"exit", "quit", "/exit", "/quit", ":q"}


def _redact_path(path: Path) -> str:
    """Return path with home directory replaced by ~ and username by USER to avoid exposing in logs."""
    try:
        home = Path.home()
        p = path.resolve()
        s = str(p)
        home_s = str(home)
        if p == home or (len(home_s) < len(s) and (s.startswith(home_s + os.sep) or s.startswith(home_s + "/"))):
            return "~" + str(p.relative_to(home)).replace("\\", "/")
        # Path not under home (e.g. project dir): still redact username (e.g. C:\Users\emilk -> C:\Users\USER)
        if os.name == "nt" and home_s.count(os.sep) >= 2:
            # e.g. C:\Users\emilk -> replace "emilk" with "USER"
            username = home_s.rstrip(os.sep).split(os.sep)[-1]
            if username and username in s:
                s = s.replace(username, "USER")
        return s
    except (ValueError, RuntimeError):
        return str(path)

# ---------------------------------------------------------------------------
# CLI input: prompt_toolkit for editing, paste, history, and display
# ---------------------------------------------------------------------------

_PROMPT_SESSION: PromptSession | None = None
_SAVED_TERM_ATTRS = None  # original termios settings, restored on exit


def _flush_pending_tty_input() -> None:
    """Drop unread keypresses typed while the model was generating output."""
    try:
        fd = sys.stdin.fileno()
        if not os.isatty(fd):
            return
    except Exception:
        return

    try:
        import termios
        termios.tcflush(fd, termios.TCIFLUSH)
        return
    except Exception:
        pass

    try:
        while True:
            ready, _, _ = select.select([fd], [], [], 0)
            if not ready:
                break
            if not os.read(fd, 4096):
                break
    except Exception:
        return


def _restore_terminal() -> None:
    """Restore terminal to its original state (echo, line buffering, etc.)."""
    if _SAVED_TERM_ATTRS is None:
        return
    try:
        import termios
        termios.tcsetattr(sys.stdin.fileno(), termios.TCSADRAIN, _SAVED_TERM_ATTRS)
    except Exception:
        pass


def _init_prompt_session() -> None:
    """Create the prompt_toolkit session with persistent file history."""
    global _PROMPT_SESSION, _SAVED_TERM_ATTRS

    # Save terminal state so we can restore it on exit
    try:
        import termios
        _SAVED_TERM_ATTRS = termios.tcgetattr(sys.stdin.fileno())
    except Exception:
        pass

    history_file = Path.home() / ".unichan" / "history" / "cli_history"
    history_file.parent.mkdir(parents=True, exist_ok=True)

    _PROMPT_SESSION = PromptSession(
        history=FileHistory(str(history_file)),
        enable_open_in_editor=False,
        multiline=False,   # Enter submits (single line mode)
    )


def _print_agent_response(response: str, render_markdown: bool) -> None:
    """Render assistant response with consistent terminal styling."""
    content = response or ""
    body = Markdown(content) if render_markdown else Text(content)
    console.print()
    console.print(f"[cyan]{__logo__} unichan[/cyan]")
    console.print(body)
    console.print()


def _is_exit_command(command: str) -> bool:
    """Return True when input should end interactive chat."""
    return command.lower() in EXIT_COMMANDS


async def _read_interactive_input_async() -> str:
    """Read user input using prompt_toolkit (handles paste, history, display).

    prompt_toolkit natively handles:
    - Multiline paste (bracketed paste mode)
    - History navigation (up/down arrows)
    - Clean display (no ghost characters or artifacts)
    """
    if _PROMPT_SESSION is None:
        raise RuntimeError("Call _init_prompt_session() first")
    try:
        with patch_stdout():
            return await _PROMPT_SESSION.prompt_async(
                HTML("<b fg='ansiblue'>You:</b> "),
            )
    except EOFError as exc:
        raise KeyboardInterrupt from exc



def version_callback(value: bool):
    if value:
        console.print(f"{__logo__} nanobot v{__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: bool = typer.Option(
        None, "--version", "-v", callback=version_callback, is_eager=True
    ),
):
    """nanobot - Personal AI Assistant."""
    from nanobot.redact import install_redact
    install_redact()
    pass


# ============================================================================
# Onboard / Setup
# ============================================================================


@app.command()
def onboard():
    """Interactive setup wizard: configure AI provider, Telegram, gateway, workspace (no manual config edit)."""
    from nanobot.config.loader import get_config_path, load_config, save_config
    from nanobot.config.schema import Config

    from questionary import Style

    cute_style = Style([
        ("qmark", "fg:#ff69b4 bold"),
        ("question", "fg:#ff1493 bold"),
        ("answer", "fg:#ff69b4 bold"),
        ("pointer", "fg:#ff1493 bold"),
        ("highlighted", "fg:#ff69b4 bold"),
        ("selected", "fg:#ff1493"),
        ("separator", "fg:#ffb6c1"),
        ("instruction", "fg:#ffb6c1"),
    ])

    banner = """
[bold magenta]
    ╔══════════════════════════════════════════════════════════╗
    ║     💖  U N I C H A N   S E T U P   W I Z A R D  💖     ║
    ║          ～ Configure everything in one place ～         ║
    ╚══════════════════════════════════════════════════════════╝
[/bold magenta]
    """
    console.print(banner)
    config_path = get_config_path()
    config_path.parent.mkdir(parents=True, exist_ok=True)

    if config_path.exists():
        config = load_config(config_path)
        console.print(f"[green]✓[/green] Loaded config from [dim]{_redact_path(config_path)}[/dim]\n")
    else:
        config = Config()
        save_config(config)
        console.print(f"[green]✓[/green] Created config at [dim]{_redact_path(config_path)}[/dim]\n")
        workspace = Path(config.agents.defaults.workspace).expanduser()
        workspace.mkdir(parents=True, exist_ok=True)
        _create_workspace_templates(workspace)

    while True:
        status = _onboard_menu_status(config)
        main_choices = [
            f"🌸 AI Provider & Model — {status['ai']}",
            f"🎭 Personality / voice — {status['personality']}",
            f"📱 Telegram — {status['telegram']}",
            f"🔌 Gateway — {status['gateway']}",
            f"📂 Workspace — {status['workspace']}",
            f"🔍 Birdeye (token lookup) — {status['birdeye']}",
            "💾 Save and exit",
        ]
        console.print("[bold magenta]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold magenta]")
        choice = questionary.select(
            "What do you want to configure?",
            choices=main_choices,
            style=cute_style,
        ).ask()

        if not choice:
            raise typer.Exit()

        if "AI Provider" in choice:
            _onboard_section_provider(config, cute_style)
        elif "Personality" in choice:
            _onboard_section_personality(config, cute_style)
        elif "Telegram" in choice:
            _onboard_section_telegram(config, cute_style)
        elif "Gateway" in choice:
            _onboard_section_gateway(config, cute_style)
        elif "Workspace" in choice:
            _onboard_section_workspace(config, cute_style)
        elif "Birdeye" in choice:
            _onboard_section_birdeye(config, cute_style)
        elif "Save" in choice:
            break

    save_config(config)
    workspace = Path(config.agents.defaults.workspace).expanduser()
    workspace.mkdir(parents=True, exist_ok=True)
    _create_workspace_templates(workspace)

    console.print("\n[green]✨ Config saved! ✨[/green]\n")
    console.print(f"[bright_cyan]📁 Config:[/bright_cyan] [dim]{_redact_path(config_path)}[/dim]")
    console.print(f"[bright_cyan]📂 Workspace:[/bright_cyan] [dim]{_redact_path(workspace)}[/dim]\n")
    console.print("[bold bright_magenta]Next steps:[/bold bright_magenta]")
    console.print("  • Chat: [cyan]unichan agent -m \"Hello!\"[/cyan]")
    console.print("  • Start gateway (for desktop/web/Telegram): [cyan]unichan gateway[/cyan]")
    console.print("  • Desktop 3D: [cyan]cd waifu && pnpm dev:tamagotchi[/cyan]")
    console.print("  • Web: [cyan]cd waifu && pnpm dev:web[/cyan]\n")
    console.print("[bold bright_magenta]✨ Arigatou! Have fun with UNICHAN! ✨[/bold bright_magenta]\n")


_PROVIDER_NAMES = (
    "openrouter", "openai", "anthropic", "deepseek", "groq",
    "moonshot", "minimax", "zhipu", "dashscope",
)


def _onboard_menu_status(config: "Config") -> dict[str, str]:
    """Return short plain-text status for each onboard section (set vs not set)."""
    has_key = any(
        getattr(config.providers, p, None) and getattr(getattr(config.providers, p), "api_key", None)
        for p in _PROVIDER_NAMES
        if hasattr(config.providers, p)
    )
    model = (config.agents.defaults.model or "").strip()
    if has_key and model:
        ai_status = f"✓ model: {model}"
    elif has_key:
        ai_status = "⚠ key set, no default model"
    elif model:
        ai_status = "⚠ model set, no API key"
    else:
        ai_status = "✗ not set"

    tg = config.channels.telegram
    if not tg.enabled:
        tg_status = "disabled"
    elif tg.token and tg.token.strip():
        tg_status = "✓ enabled (token set)"
    else:
        tg_status = "✗ enabled but no token"

    gw_status = f"✓ port {config.gateway.port}"
    ws = (config.agents.defaults.workspace or "").strip() or "~/.unichan/workspace"
    ws_status = f"✓ {ws}"

    pers = (config.agents.defaults.personality or "").strip()
    personality_status = f"✓ set ({len(pers)} chars)" if pers else "✗ not set (default voice)"

    birdeye = (getattr(getattr(config.tools, "token_research", None), "birdeye_api_key", None) or "").strip()
    birdeye_status = "✓ set" if birdeye else "✗ not set"

    return {"ai": ai_status, "personality": personality_status, "telegram": tg_status, "gateway": gw_status, "workspace": ws_status, "birdeye": birdeye_status}


def _validate_llm_key(provider_name: str, api_key: str, model: str) -> tuple[bool, str | None]:
    """Test provider + API key + model with a minimal completion. Returns (True, None) or (False, error_message)."""
    if not api_key or not model:
        return False, "API key and model are required."
    provider = LiteLLMProvider(
        api_key=api_key,
        default_model=model,
        provider_name=provider_name,
    )

    async def _test() -> str | None:
        try:
            resp = await provider.chat(
                [{"role": "user", "content": "Hi"}],
                model=model,
                max_tokens=5,
            )
            if resp.finish_reason == "error" and resp.content and "Error" in resp.content:
                return resp.content
            return None
        except Exception as e:
            return str(e)

    try:
        err = asyncio.run(_test())
        return (True, None) if err is None else (False, err)
    except Exception as e:
        return False, str(e)


# Where to get the API key and short hint (so users don't use the wrong key)
_ONBOARD_PROVIDER_KEY_HINTS: dict[str, tuple[str, str]] = {
    "openrouter": (
        "https://openrouter.ai/keys",
        "Use your OpenRouter key here (not your OpenAI key). OpenRouter lets you use GPT-4, Claude, etc. with one key.",
    ),
    "openai": (
        "https://platform.openai.com/api-keys",
        "Use your OpenAI API key from the link above.",
    ),
    "anthropic": (
        "https://console.anthropic.com/settings/keys",
        "Use your Anthropic API key (for Claude models).",
    ),
    "deepseek": (
        "https://platform.deepseek.com/api_keys",
        "Use your DeepSeek API key.",
    ),
    "groq": (
        "https://console.groq.com/keys",
        "Use your Groq API key.",
    ),
    "moonshot": ("https://platform.moonshot.cn/console/api-keys", "Use your Moonshot (Kimi) API key."),
    "minimax": ("https://api.minimax.chat/", "Use your MiniMax API key."),
    "zhipu": ("https://open.bigmodel.cn/", "Use your Zhipu (GLM) API key."),
    "dashscope": ("https://dashscope.console.aliyun.com/", "Use your Alibaba DashScope (Qwen) API key."),
}

# (model_id, display_label) per provider for onboard model selector
_ONBOARD_MODEL_CHOICES: dict[str, list[tuple[str, str]]] = {
    "openrouter": [
        ("anthropic/claude-3.5-sonnet", "Claude 3.5 Sonnet"),
        ("anthropic/claude-3-opus", "Claude 3 Opus"),
        ("openai/gpt-4-turbo", "GPT-4 Turbo"),
        ("openai/gpt-4o", "GPT-4o"),
        ("google/gemini-pro", "Gemini Pro"),
        ("meta-llama/llama-3-70b-instruct", "Llama 3 70B"),
        ("mistralai/mistral-large", "Mistral Large"),
    ],
    "openai": [
        ("gpt-4-turbo", "GPT-4 Turbo"),
        ("gpt-4o", "GPT-4o"),
        ("gpt-4o-mini", "GPT-4o Mini"),
        ("gpt-3.5-turbo", "GPT-3.5 Turbo"),
    ],
    "anthropic": [
        ("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet"),
        ("claude-3-opus-20240229", "Claude 3 Opus"),
        ("claude-3-sonnet-20240229", "Claude 3 Sonnet"),
        ("claude-3-haiku-20240307", "Claude 3 Haiku"),
    ],
    "deepseek": [
        ("deepseek-chat", "DeepSeek Chat"),
        ("deepseek-coder", "DeepSeek Coder"),
    ],
    "groq": [
        ("llama3-70b-8192", "Llama 3 70B"),
        ("llama3-8b-8192", "Llama 3 8B"),
        ("mixtral-8x7b-32768", "Mixtral 8x7B"),
    ],
    "moonshot": [
        ("moonshot-v1-8k", "Moonshot 8K"),
        ("moonshot-v1-32k", "Moonshot 32K"),
        ("moonshot-v1-128k", "Moonshot 128K"),
    ],
    "minimax": [
        ("abab6.5s-chat", "ABAB 6.5s Chat"),
        ("abab5.5-chat", "ABAB 5.5 Chat"),
    ],
    "zhipu": [
        ("glm-4", "GLM-4"),
        ("glm-3-turbo", "GLM-3 Turbo"),
    ],
    "dashscope": [
        ("qwen-turbo", "Qwen Turbo"),
        ("qwen-plus", "Qwen Plus"),
        ("qwen-max", "Qwen Max"),
    ],
}


def _onboard_section_provider(config: "Config", style) -> None:
    """Configure AI provider, API key, and default model."""
    console.print("\n[bold bright_magenta]🌸 AI Provider & Model 🌸[/bold bright_magenta]\n")
    choices = [
        "openrouter 🌐",
        "openai 🤖",
        "anthropic 🧠",
        "deepseek 🔍",
        "groq ⚡",
        "moonshot 🌙",
        "minimax 🎯",
        "zhipu 📚",
        "dashscope 🔭",
    ]
    provider_choice = questionary.select(
        "Which AI provider?",
        choices=choices,
        default="openrouter 🌐",
        style=style,
    ).ask()
    if not provider_choice:
        return
    provider_name = provider_choice.split()[0]

    url, hint = _ONBOARD_PROVIDER_KEY_HINTS.get(
        provider_name,
        (f"the {provider_name} website", f"Paste your {provider_name} API key."),
    )
    console.print(f"[dim]Get your key: [cyan]{url}[/cyan][/dim]")
    console.print(f"[dim]{hint}[/dim]\n")
    api_key = questionary.password(
        f"API key for {provider_name}:",
        style=style,
    ).ask()
    if not api_key:
        console.print("[yellow]No API key entered; skipping.[/yellow]\n")
        return

    # Model: select from list or type custom (needed for validation)
    model_choices = _ONBOARD_MODEL_CHOICES.get(provider_name, [])
    other_label = "Other (enter model ID manually)"
    if model_choices:
        choice_strings = [f"{label} — {mid}" for mid, label in model_choices] + [other_label]
        default = choice_strings[0]
        current = config.agents.defaults.model
        for mid, label in model_choices:
            if mid == current:
                default = f"{label} — {mid}"
                break
        model_choice = questionary.select(
            "Default model:",
            choices=choice_strings,
            default=default,
            style=style,
        ).ask()
        if not model_choice:
            return
        if model_choice == other_label:
            model = questionary.text(
                "Model ID:",
                default=config.agents.defaults.model or "",
                style=style,
            ).ask()
        else:
            model = model_choice.rsplit(" — ", 1)[-1].strip() if " — " in model_choice else model_choice
    else:
        model = questionary.text(
            "Default model:",
            default=config.agents.defaults.model or "gpt-3.5-turbo",
            style=style,
        ).ask()
    if not model:
        console.print("[yellow]No model entered; skipping.[/yellow]\n")
        return

    # Validate before saving: do not accept keys that fail auth
    console.print("[dim]Verifying API key and model...[/dim]")
    ok, err = _validate_llm_key(provider_name, api_key, model)
    if not ok:
        console.print("[red]Auth failed. Your key or model was rejected by the provider.[/red]")
        console.print(f"[red]{err}[/red]\n")
        console.print("[dim]Nothing was saved. Fix your key or try a different provider/model, then run this section again.[/dim]\n")
        return

    # Save only after successful validation (strip so newlines never get saved)
    if hasattr(config.providers, provider_name):
        getattr(config.providers, provider_name).api_key = api_key.strip()
    config.agents.defaults.model = model
    console.print("[green]✓[/green] Provider & model verified and saved.\n")


def _onboard_section_personality(config: "Config", style) -> None:
    """Configure how Unichan speaks (personality / voice)."""
    console.print("\n[bold bright_magenta]🎭 Personality / voice 🎭[/bold bright_magenta]\n")
    console.print("[dim]Describe how Unichan should sound: warm, playful, formal, shy, etc.[/dim]")
    console.print("[dim]This is injected into the system prompt so replies feel less robotic.[/dim]\n")
    current = (config.agents.defaults.personality or "").strip()
    example = "Speak in a warm, friendly way. Use light humor when appropriate. You're Unichan, a helpful AI companion—be concise but not cold."
    text = questionary.text(
        "Personality (one line or short paragraph):",
        default=current or example,
        style=style,
    ).ask()
    if text is not None:
        config.agents.defaults.personality = text.strip()
    if config.agents.defaults.personality:
        console.print("[green]✓[/green] Personality updated.\n")
    else:
        console.print("[dim]Cleared; default voice will be used.[/dim]\n")


def _onboard_section_telegram(config: "Config", style) -> None:
    """Configure Telegram bot token and allow list."""
    console.print("\n[bold bright_magenta]📱 Telegram 📱[/bold bright_magenta]\n")
    console.print("[dim]Create a bot with @BotFather in Telegram, then paste the token here.[/dim]\n")

    enable = questionary.confirm(
        "Enable Telegram bot?",
        default=config.channels.telegram.enabled,
        style=style,
    ).ask()
    if enable is None:
        return
    config.channels.telegram.enabled = enable

    if enable:
        token = questionary.password(
            "Bot token from @BotFather:",
            default=config.channels.telegram.token or "",
            style=style,
        ).ask()
        if token is not None:
            config.channels.telegram.token = token
        who = questionary.text(
            "Allowed usernames (comma-separated; leave empty = anyone):",
            default=",".join(config.channels.telegram.allow_from) if config.channels.telegram.allow_from else "",
            style=style,
        ).ask()
        if who is not None:
            config.channels.telegram.allow_from = [u.strip() for u in who.split(",") if u.strip()]
    console.print("[green]✓[/green] Telegram settings updated.\n")


def _onboard_section_gateway(config: "Config", style) -> None:
    """Configure gateway host and port."""
    console.print("\n[bold bright_magenta]🔌 Gateway 🔌[/bold bright_magenta]\n")
    console.print("[dim]Desktop, web, and Telegram use this port to talk to the agent.[/dim]\n")
    port_str = questionary.text(
        "Gateway port:",
        default=str(config.gateway.port),
        style=style,
    ).ask()
    if port_str is not None and port_str.strip().isdigit():
        config.gateway.port = int(port_str.strip())
    console.print("[green]✓[/green] Gateway port updated.\n")


def _onboard_section_workspace(config: "Config", style) -> None:
    """Configure workspace path."""
    console.print("\n[bold bright_magenta]📂 Workspace 📂[/bold bright_magenta]\n")
    console.print("[dim]Where agent memory and workspace files live (e.g. ~/.unichan/workspace).[/dim]\n")
    path = questionary.text(
        "Workspace path:",
        default=config.agents.defaults.workspace,
        style=style,
    ).ask()
    if path is not None and path.strip():
        config.agents.defaults.workspace = path.strip()
    console.print("[green]✓[/green] Workspace updated.\n")


def _onboard_section_birdeye(config: "Config", style) -> None:
    """Configure Birdeye API key for token lookup (extension + agent skill)."""
    console.print("\n[bold bright_magenta]🔍 Birdeye (token lookup) 🔍[/bold bright_magenta]\n")
    console.print("[dim]Used by the browser extension token bubble and by the agent when you ask about tokens.[/dim]")
    console.print("[dim]Get a key: https://birdeye.so/ (API / Developer).[/dim]\n")
    current = (getattr(getattr(config.tools, "token_research", None), "birdeye_api_key", None) or "").strip()
    key = questionary.password(
        "Birdeye API key (leave blank to keep current or clear):",
        default=current if current else "",
        style=style,
    ).ask()
    if key is not None:
        config.tools.token_research.birdeye_api_key = key.strip()
    console.print("[green]✓[/green] Birdeye key updated.\n")


def _create_workspace_templates(workspace: Path):
    """Create default workspace template files."""
    templates = {
        "AGENTS.md": """# Agent Instructions

You are a helpful AI assistant. Be concise, accurate, and friendly.

## Guidelines

- Always explain what you're doing before taking actions
- Ask for clarification when the request is ambiguous
- Use tools to help accomplish tasks
- Remember important information in your memory files
""",
        "SOUL.md": """# Soul

I am unichan, a lightweight/local AI agent.

## Personality

- Helpful and friendly
- Concise and to the point
- Curious and eager to learn

## Values

- Accuracy over speed
- User privacy and safety
- Transparency in actions
""",
        "USER.md": """# User

Information about the user goes here.

## Preferences

- Communication style: (casual/formal)
- Timezone: (your timezone)
- Language: (your preferred language)
""",
        "SKILLS.md": """# Skills (OpenClaw-style)

Skills extend what Unichan can do. Each skill is a folder with a **SKILL.md** file.

## Built-in skills

Unichan ships with: cron, github, summarize, tmux, weather, skill-creator. The agent sees a list and can load a skill when needed (via read_file).

## Add your own skill

1. Create a folder: `skills/<skill-name>/`
2. Add `SKILL.md` with YAML frontmatter and instructions:

```markdown
---
name: my-skill
description: When to use this skill (the agent matches on this).
---

## Instructions (Markdown)

Step-by-step how to use this skill. The agent reads this when the skill is relevant.
```

3. Optional: add `scripts/`, `references/`, or `assets/` in the same folder. Reference them in SKILL.md.

Workspace skills override built-in ones with the same name. Restart the gateway after adding skills.
""",
    }
    
    for filename, content in templates.items():
        file_path = workspace / filename
        if not file_path.exists():
            file_path.write_text(content)
            console.print(f"  [dim]Created {filename}[/dim]")
    
    # Create memory directory and MEMORY.md
    memory_dir = workspace / "memory"
    memory_dir.mkdir(exist_ok=True)
    memory_file = memory_dir / "MEMORY.md"
    if not memory_file.exists():
        memory_file.write_text("""# Long-term Memory

This file stores important information that should persist across sessions.

## User Information

(Important facts about the user)

## Preferences

(User preferences learned over time)

## Important Notes

(Things to remember)
""")
        console.print("  [dim]Created memory/MEMORY.md[/dim]")

    # Create skills directory for custom user skills
    skills_dir = workspace / "skills"
    skills_dir.mkdir(exist_ok=True)


def _make_provider(config):
    """Create LiteLLMProvider from config. Exits if no API key found."""
    from nanobot.providers.litellm_provider import LiteLLMProvider
    p = config.get_provider()
    model = config.agents.defaults.model or ""
    if not (p and p.api_key) and not model.startswith("bedrock/"):
        console.print("[red]Error: No LLM provider configured.[/red]")
        console.print("Set an API key in one of:")
        console.print("  • Tamagotchi: Settings → Unichan → Provider (OpenAI) + API Key → Save")
        console.print("  • Config file: ~/.unichan/config.json → providers.openai.apiKey")
        console.print("Then restart the gateway: unichan gateway")
        raise typer.Exit(1)
    return LiteLLMProvider(
        api_key=p.api_key if p else None,
        api_base=config.get_api_base(),
        default_model=model,
        extra_headers=p.extra_headers if p else None,
        provider_name=config.get_provider_name(),
    )


# ============================================================================
# Gateway / Server
# ============================================================================


@app.command()
def gateway(
    port: int = typer.Option(18790, "--port", "-p", help="Gateway port"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
):
    """Start the nanobot gateway."""
    from nanobot.config.loader import load_config, get_data_dir
    from nanobot.bus.queue import MessageBus
    from nanobot.agent.loop import AgentLoop
    from nanobot.channels.manager import ChannelManager
    from nanobot.session.manager import SessionManager
    from nanobot.cron.service import CronService
    from nanobot.cron.types import CronJob
    from nanobot.heartbeat.service import HeartbeatService
    
    if verbose:
        import logging
        logging.basicConfig(level=logging.DEBUG)
    
    console.print(f"{__logo__} Starting unichan gateway on port {port}...")
    
    config = load_config()
    bus = MessageBus()
    provider = _make_provider(config)
    provider_name = config.get_provider_name() or "unknown"
    model = config.agents.defaults.model or "unknown"
    console.print(f"[dim]Using provider: [cyan]{provider_name}[/cyan], model: [cyan]{model}[/cyan][/dim]")
    session_manager = SessionManager(config.workspace_path)
    
    # Create cron service first (callback set after agent creation)
    cron_store_path = get_data_dir() / "cron" / "jobs.json"
    cron = CronService(cron_store_path)
    
    # Create agent with cron service
    agent = AgentLoop(
        bus=bus,
        provider=provider,
        workspace=config.workspace_path,
        model=config.agents.defaults.model,
        max_iterations=config.agents.defaults.max_tool_iterations,
        brave_api_key=config.tools.web.search.api_key or None,
        birdeye_api_key=config.tools.token_research.birdeye_api_key or None,
        exec_config=config.tools.exec,
        cron_service=cron,
        restrict_to_workspace=config.tools.restrict_to_workspace,
        session_manager=session_manager,
        personality=config.agents.defaults.personality or None,
    )
    
    # Set cron callback (needs agent)
    async def on_cron_job(job: CronJob) -> str | None:
        """Execute a cron job through the agent."""
        response = await agent.process_direct(
            job.payload.message,
            session_key=f"cron:{job.id}",
            channel=job.payload.channel or "cli",
            chat_id=job.payload.to or "direct",
        )
        if job.payload.deliver and job.payload.to:
            from nanobot.bus.events import OutboundMessage
            await bus.publish_outbound(OutboundMessage(
                channel=job.payload.channel or "cli",
                chat_id=job.payload.to,
                content=response or ""
            ))
        return response
    cron.on_job = on_cron_job
    
    # Create heartbeat service
    async def on_heartbeat(prompt: str) -> str:
        """Execute heartbeat through the agent."""
        return await agent.process_direct(prompt, session_key="heartbeat")
    
    heartbeat = HeartbeatService(
        workspace=config.workspace_path,
        on_heartbeat=on_heartbeat,
        interval_s=30 * 60,  # 30 minutes
        enabled=True
    )
    
    # Create channel manager
    channels = ChannelManager(config, bus, session_manager=session_manager)
    
    if channels.enabled_channels:
        console.print(f"[green]✓[/green] Channels enabled: {', '.join(channels.enabled_channels)}")
    else:
        console.print("[yellow]Warning: No channels enabled[/yellow]")
    
    cron_status = cron.status()
    if cron_status["jobs"] > 0:
        console.print(f"[green]✓[/green] Cron: {cron_status['jobs']} scheduled jobs")
    
    console.print(f"[green]✓[/green] Heartbeat: every 30m")
    
    # HTTP API (OpenAI-compatible) so waifu/tamagotchi can use this agent
    from nanobot.gateway_http import create_app
    from aiohttp import web
    from aiohttp.web import AppRunner, TCPSite
    http_app = create_app(agent, config=config)
    runner = AppRunner(http_app)
    
    async def run():
        await runner.setup()
        site = TCPSite(runner, "0.0.0.0", port)
        await site.start()
        console.print(f"[green]✓[/green] HTTP API: http://localhost:{port}/ (health, /v1/chat/completions)")
        try:
            await cron.start()
            await heartbeat.start()
            await asyncio.gather(
                agent.run(),
                channels.start_all(),
            )
        except KeyboardInterrupt:
            console.print("\nShutting down...")
            heartbeat.stop()
            cron.stop()
            agent.stop()
            await channels.stop_all()
        finally:
            await runner.cleanup()
    
    asyncio.run(run())




# ============================================================================
# Agent Commands
# ============================================================================


@app.command()
def agent(
    message: str = typer.Option(None, "--message", "-m", help="Message to send to the agent"),
    session_id: str = typer.Option("cli:default", "--session", "-s", help="Session ID"),
    markdown: bool = typer.Option(True, "--markdown/--no-markdown", help="Render assistant output as Markdown"),
    logs: bool = typer.Option(False, "--logs/--no-logs", help="Show nanobot runtime logs during chat"),
):
    """Interact with the agent directly."""
    from nanobot.config.loader import load_config
    from nanobot.bus.queue import MessageBus
    from nanobot.agent.loop import AgentLoop
    from loguru import logger
    
    config = load_config()
    
    bus = MessageBus()
    provider = _make_provider(config)

    if logs:
        logger.enable("nanobot")
    else:
        logger.disable("nanobot")
    
    agent_loop = AgentLoop(
        bus=bus,
        provider=provider,
        workspace=config.workspace_path,
        brave_api_key=config.tools.web.search.api_key or None,
        birdeye_api_key=config.tools.token_research.birdeye_api_key or None,
        exec_config=config.tools.exec,
        restrict_to_workspace=config.tools.restrict_to_workspace,
        personality=config.agents.defaults.personality or None,
    )

    # Show spinner when logs are off (no output to miss); skip when logs are on
    def _thinking_ctx():
        if logs:
            from contextlib import nullcontext
            return nullcontext()
        # Animated spinner is safe to use with prompt_toolkit input handling
        return console.status("[dim]unichan is thinking...[/dim]", spinner="dots")

    if message:
        # Single message mode
        async def run_once():
            with _thinking_ctx():
                response = await agent_loop.process_direct(message, session_id)
            _print_agent_response(response, render_markdown=markdown)
        
        asyncio.run(run_once())
    else:
        # Interactive mode
        _init_prompt_session()
        console.print(f"{__logo__} Interactive mode (type [bold]exit[/bold] or [bold]Ctrl+C[/bold] to quit)\n")

        def _exit_on_sigint(signum, frame):
            _restore_terminal()
            console.print("\nGoodbye!")
            os._exit(0)

        signal.signal(signal.SIGINT, _exit_on_sigint)
        
        async def run_interactive():
            while True:
                try:
                    _flush_pending_tty_input()
                    user_input = await _read_interactive_input_async()
                    command = user_input.strip()
                    if not command:
                        continue

                    if _is_exit_command(command):
                        _restore_terminal()
                        console.print("\nGoodbye!")
                        break
                    
                    with _thinking_ctx():
                        response = await agent_loop.process_direct(user_input, session_id)
                    _print_agent_response(response, render_markdown=markdown)
                except KeyboardInterrupt:
                    _restore_terminal()
                    console.print("\nGoodbye!")
                    break
                except EOFError:
                    _restore_terminal()
                    console.print("\nGoodbye!")
                    break
        
        asyncio.run(run_interactive())


# ============================================================================
# Channel Commands
# ============================================================================


channels_app = typer.Typer(help="Manage channels")
app.add_typer(channels_app, name="channels")


@channels_app.command("status")
def channels_status():
    """Show channel status."""
    from nanobot.config.loader import load_config

    config = load_config()

    table = Table(title="Channel Status")
    table.add_column("Channel", style="cyan")
    table.add_column("Enabled", style="green")
    table.add_column("Configuration", style="yellow")

    # WhatsApp
    wa = config.channels.whatsapp
    table.add_row(
        "WhatsApp",
        "✓" if wa.enabled else "✗",
        wa.bridge_url
    )

    dc = config.channels.discord
    table.add_row(
        "Discord",
        "✓" if dc.enabled else "✗",
        dc.gateway_url
    )

    # Feishu
    fs = config.channels.feishu
    fs_config = f"app_id: {fs.app_id[:10]}..." if fs.app_id else "[dim]not configured[/dim]"
    table.add_row(
        "Feishu",
        "✓" if fs.enabled else "✗",
        fs_config
    )

    # Mochat
    mc = config.channels.mochat
    mc_base = mc.base_url or "[dim]not configured[/dim]"
    table.add_row(
        "Mochat",
        "✓" if mc.enabled else "✗",
        mc_base
    )
    
    # Telegram
    tg = config.channels.telegram
    tg_config = f"token: {tg.token[:10]}..." if tg.token else "[dim]not configured[/dim]"
    table.add_row(
        "Telegram",
        "✓" if tg.enabled else "✗",
        tg_config
    )

    # Slack
    slack = config.channels.slack
    slack_config = "socket" if slack.app_token and slack.bot_token else "[dim]not configured[/dim]"
    table.add_row(
        "Slack",
        "✓" if slack.enabled else "✗",
        slack_config
    )

    console.print(table)


def _get_bridge_dir() -> Path:
    """Get the bridge directory, setting it up if needed."""
    import shutil
    import subprocess
    
    # User's bridge location
    user_bridge = Path.home() / ".unichan" / "bridge"
    
    # Check if already built
    if (user_bridge / "dist" / "index.js").exists():
        return user_bridge
    
    # Check for npm
    if not shutil.which("npm"):
        console.print("[red]npm not found. Please install Node.js >= 18.[/red]")
        raise typer.Exit(1)
    
    # Find source bridge: first check package data, then source dir
    pkg_bridge = Path(__file__).parent.parent / "bridge"  # nanobot/bridge (installed)
    src_bridge = Path(__file__).parent.parent.parent / "bridge"  # repo root/bridge (dev)
    
    source = None
    if (pkg_bridge / "package.json").exists():
        source = pkg_bridge
    elif (src_bridge / "package.json").exists():
        source = src_bridge
    
    if not source:
        console.print("[red]Bridge source not found.[/red]")
        console.print("Try reinstalling: pip install --force-reinstall nanobot")
        raise typer.Exit(1)
    
    console.print(f"{__logo__} Setting up bridge...")
    
    # Copy to user directory
    user_bridge.parent.mkdir(parents=True, exist_ok=True)
    if user_bridge.exists():
        shutil.rmtree(user_bridge)
    shutil.copytree(source, user_bridge, ignore=shutil.ignore_patterns("node_modules", "dist"))
    
    # Install and build
    try:
        console.print("  Installing dependencies...")
        subprocess.run(["npm", "install"], cwd=user_bridge, check=True, capture_output=True)
        
        console.print("  Building...")
        subprocess.run(["npm", "run", "build"], cwd=user_bridge, check=True, capture_output=True)
        
        console.print("[green]✓[/green] Bridge ready\n")
    except subprocess.CalledProcessError as e:
        console.print(f"[red]Build failed: {e}[/red]")
        if e.stderr:
            console.print(f"[dim]{e.stderr.decode()[:500]}[/dim]")
        raise typer.Exit(1)
    
    return user_bridge


@channels_app.command("login")
def channels_login():
    """Link device via QR code."""
    import subprocess
    
    bridge_dir = _get_bridge_dir()
    
    console.print(f"{__logo__} Starting bridge...")
    console.print("Scan the QR code to connect.\n")
    
    try:
        subprocess.run(["npm", "start"], cwd=bridge_dir, check=True)
    except subprocess.CalledProcessError as e:
        console.print(f"[red]Bridge failed: {e}[/red]")
    except FileNotFoundError:
        console.print("[red]npm not found. Please install Node.js.[/red]")


# ============================================================================
# Cron Commands
# ============================================================================

cron_app = typer.Typer(help="Manage scheduled tasks")
app.add_typer(cron_app, name="cron")


@cron_app.command("list")
def cron_list(
    all: bool = typer.Option(False, "--all", "-a", help="Include disabled jobs"),
):
    """List scheduled jobs."""
    from nanobot.config.loader import get_data_dir
    from nanobot.cron.service import CronService
    
    store_path = get_data_dir() / "cron" / "jobs.json"
    service = CronService(store_path)
    
    jobs = service.list_jobs(include_disabled=all)
    
    if not jobs:
        console.print("No scheduled jobs.")
        return
    
    table = Table(title="Scheduled Jobs")
    table.add_column("ID", style="cyan")
    table.add_column("Name")
    table.add_column("Schedule")
    table.add_column("Status")
    table.add_column("Next Run")
    
    import time
    for job in jobs:
        # Format schedule
        if job.schedule.kind == "every":
            sched = f"every {(job.schedule.every_ms or 0) // 1000}s"
        elif job.schedule.kind == "cron":
            sched = job.schedule.expr or ""
        else:
            sched = "one-time"
        
        # Format next run
        next_run = ""
        if job.state.next_run_at_ms:
            next_time = time.strftime("%Y-%m-%d %H:%M", time.localtime(job.state.next_run_at_ms / 1000))
            next_run = next_time
        
        status = "[green]enabled[/green]" if job.enabled else "[dim]disabled[/dim]"
        
        table.add_row(job.id, job.name, sched, status, next_run)
    
    console.print(table)


@cron_app.command("add")
def cron_add(
    name: str = typer.Option(..., "--name", "-n", help="Job name"),
    message: str = typer.Option(..., "--message", "-m", help="Message for agent"),
    every: int = typer.Option(None, "--every", "-e", help="Run every N seconds"),
    cron_expr: str = typer.Option(None, "--cron", "-c", help="Cron expression (e.g. '0 9 * * *')"),
    at: str = typer.Option(None, "--at", help="Run once at time (ISO format)"),
    deliver: bool = typer.Option(False, "--deliver", "-d", help="Deliver response to channel"),
    to: str = typer.Option(None, "--to", help="Recipient for delivery"),
    channel: str = typer.Option(None, "--channel", help="Channel for delivery (e.g. 'telegram', 'whatsapp')"),
):
    """Add a scheduled job."""
    from nanobot.config.loader import get_data_dir
    from nanobot.cron.service import CronService
    from nanobot.cron.types import CronSchedule
    
    # Determine schedule type
    if every:
        schedule = CronSchedule(kind="every", every_ms=every * 1000)
    elif cron_expr:
        schedule = CronSchedule(kind="cron", expr=cron_expr)
    elif at:
        import datetime
        dt = datetime.datetime.fromisoformat(at)
        schedule = CronSchedule(kind="at", at_ms=int(dt.timestamp() * 1000))
    else:
        console.print("[red]Error: Must specify --every, --cron, or --at[/red]")
        raise typer.Exit(1)
    
    store_path = get_data_dir() / "cron" / "jobs.json"
    service = CronService(store_path)
    
    job = service.add_job(
        name=name,
        schedule=schedule,
        message=message,
        deliver=deliver,
        to=to,
        channel=channel,
    )
    
    console.print(f"[green]✓[/green] Added job '{job.name}' ({job.id})")


@cron_app.command("remove")
def cron_remove(
    job_id: str = typer.Argument(..., help="Job ID to remove"),
):
    """Remove a scheduled job."""
    from nanobot.config.loader import get_data_dir
    from nanobot.cron.service import CronService
    
    store_path = get_data_dir() / "cron" / "jobs.json"
    service = CronService(store_path)
    
    if service.remove_job(job_id):
        console.print(f"[green]✓[/green] Removed job {job_id}")
    else:
        console.print(f"[red]Job {job_id} not found[/red]")


@cron_app.command("enable")
def cron_enable(
    job_id: str = typer.Argument(..., help="Job ID"),
    disable: bool = typer.Option(False, "--disable", help="Disable instead of enable"),
):
    """Enable or disable a job."""
    from nanobot.config.loader import get_data_dir
    from nanobot.cron.service import CronService
    
    store_path = get_data_dir() / "cron" / "jobs.json"
    service = CronService(store_path)
    
    job = service.enable_job(job_id, enabled=not disable)
    if job:
        status = "disabled" if disable else "enabled"
        console.print(f"[green]✓[/green] Job '{job.name}' {status}")
    else:
        console.print(f"[red]Job {job_id} not found[/red]")


@cron_app.command("run")
def cron_run(
    job_id: str = typer.Argument(..., help="Job ID to run"),
    force: bool = typer.Option(False, "--force", "-f", help="Run even if disabled"),
):
    """Manually run a job."""
    from nanobot.config.loader import get_data_dir
    from nanobot.cron.service import CronService
    
    store_path = get_data_dir() / "cron" / "jobs.json"
    service = CronService(store_path)
    
    async def run():
        return await service.run_job(job_id, force=force)
    
    if asyncio.run(run()):
        console.print(f"[green]✓[/green] Job executed")
    else:
        console.print(f"[red]Failed to run job {job_id}[/red]")


# ============================================================================
# Tamagotchi Command
# ============================================================================


def _get_unichan_mvp_root() -> Path:
    """Get UNICHAN-MVP repo root (parent of BRAIN folder)."""
    # commands.py is at BRAIN/nanobot/cli/commands.py
    # parent.parent.parent = BRAIN, parent.parent.parent.parent = UNICHAN-MVP
    return Path(__file__).resolve().parent.parent.parent.parent


@app.command()
def tamagotchi():
    """Start the Tamagotchi desktop app (from UNICHAN-MVP root)."""
    import subprocess
    import sys

    repo_root = _get_unichan_mvp_root()
    if not (repo_root / "package.json").exists():
        console.print("[red]Error: UNICHAN-MVP root not found.[/red]")
        console.print(f"Expected package.json at: {repo_root}")
        console.print("Run this from the BRAIN folder inside UNICHAN-MVP.")
        raise typer.Exit(1)

    console.print(f"{__logo__} Starting Tamagotchi...")
    console.print("[dim]Press Ctrl+C to exit.[/dim]\n")

    try:
        subprocess.run(["pnpm", "dev:tamagotchi"], cwd=repo_root, check=True)
    except FileNotFoundError:
        console.print("[red]Error: pnpm not found.[/red]")
        console.print("Install pnpm and run 'pnpm install' in the UNICHAN-MVP root.")
        raise typer.Exit(1)
    except KeyboardInterrupt:
        console.print("\n[yellow]Tamagotchi stopped.[/yellow]")
    except subprocess.CalledProcessError as e:
        console.print(f"\n[red]Error: {e}[/red]")
        raise typer.Exit(1)


@app.command(hidden=True)
def waifu():
    """Alias for tamagotchi (legacy)."""
    tamagotchi()


# ============================================================================
# Status Commands
# ============================================================================


@app.command()
def status():
    """Show nanobot status."""
    from nanobot.config.loader import load_config, get_config_path

    config_path = get_config_path()
    config = load_config()
    workspace = config.workspace_path

    console.print(f"{__logo__} nanobot Status\n")

    console.print(f"Config: {_redact_path(config_path)} {'[green]✓[/green]' if config_path.exists() else '[red]✗[/red]'}")
    console.print(f"Workspace: {_redact_path(workspace)} {'[green]✓[/green]' if workspace.exists() else '[red]✗[/red]'}")

    if config_path.exists():
        from nanobot.providers.registry import PROVIDERS

        console.print(f"Model: {config.agents.defaults.model}")
        
        # Check API keys from registry
        for spec in PROVIDERS:
            p = getattr(config.providers, spec.name, None)
            if p is None:
                continue
            if spec.is_local:
                # Local deployments show api_base instead of api_key
                if p.api_base:
                    console.print(f"{spec.label}: [green]✓ {p.api_base}[/green]")
                else:
                    console.print(f"{spec.label}: [dim]not set[/dim]")
            else:
                has_key = bool(p.api_key)
                console.print(f"{spec.label}: {'[green]✓[/green]' if has_key else '[dim]not set[/dim]'}")


if __name__ == "__main__":
    app()
