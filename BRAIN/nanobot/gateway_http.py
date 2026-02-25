"""
HTTP API for the unichan gateway (OpenAI-compatible chat + health).

Used so the waifu/tamagotchi can use the same agent (LLM, tools, memory, personality)
by pointing its "OpenAI-compatible" chat provider at http://localhost:<gateway.port>/v1/
"""

import json
import uuid
from typing import Any

from aiohttp import web

# AgentLoop type hint (avoid circular import)
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from nanobot.agent.loop import AgentLoop

# CORS headers so the tamagotchi (different origin, e.g. localhost:5173 or Electron) can call the gateway.
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}


@web.middleware
async def cors_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        return web.Response(status=204, headers=CORS_HEADERS)
    response = await handler(request)
    response.headers.update(CORS_HEADERS)
    return response


def _messages_to_content(messages: list[dict[str, Any]]) -> str:
    """Extract the last user message from OpenAI-style messages.
    Skips client system messages (code block/LaTeX formatting) that dilute the agent's personality.
    The agent has its own system prompt from config; we only need the actual user input."""
    last_user = ""
    for m in reversed(messages):
        role = (m.get("role") or "user").strip().lower()
        if role != "user":
            continue
        content = m.get("content")
        if content is None:
            continue
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    content = block.get("text", "")
                    break
            else:
                content = ""
        if isinstance(content, str) and content.strip():
            last_user = content.strip()
            break
    return last_user or "Hello"


async def health(_request: web.Request) -> web.Response:
    """GET /health - for start_waifu and liveness checks."""
    return web.json_response({"status": "ok"})


async def v1_root(_request: web.Request) -> web.Response:
    """GET /v1/ - avoid 405 when clients hit the base URL with GET (e.g. health checks)."""
    return web.json_response({"ok": True, "message": "Unichan gateway; use POST /v1/chat/completions for chat."})


async def models_list(_request: web.Request) -> web.Response:
    """GET /v1/models - OpenAI-compatible model list (so waifu validation passes)."""
    return web.json_response({
        "object": "list",
        "data": [{"id": "unichan", "object": "model", "created": 0}],
    })


async def token_research(request: web.Request) -> web.Response:
    """POST /v1/token-research - temporary: look up chain + token info for a contract address."""
    try:
        body = await request.json()
    except json.JSONDecodeError as e:
        return web.json_response(
            {"error": {"message": str(e), "type": "invalid_request_error"}},
            status=400,
        )
    address = (body.get("address") or "").strip()
    if not address:
        return web.json_response(
            {"error": {"message": "address required", "type": "invalid_request_error"}},
            status=400,
        )
    chain_hint = (body.get("chain") or "").strip() or None
    config = request.app.get("config")
    if config is not None:
        birdeye_key = (getattr(getattr(config.tools, "token_research", None), "birdeye_api_key", None) or "").strip()
    else:
        try:
            from nanobot.config.loader import load_config
            c = load_config()
            birdeye_key = (getattr(getattr(c.tools, "token_research", None), "birdeye_api_key", None) or "").strip()
        except Exception:
            birdeye_key = ""
    from nanobot.token_research import research_token
    result = await research_token(address, chain_hint=chain_hint, api_key=birdeye_key or None)
    return web.json_response(result)


async def chat_completions(request: web.Request) -> web.Response:
    """POST /v1/chat/completions - OpenAI-compatible; runs request through the agent."""
    agent: "AgentLoop | None" = request.app.get("agent")
    if not agent:
        return web.json_response(
            {"error": {"message": "Gateway agent not available", "type": "internal_error"}},
            status=503,
        )

    try:
        body = await request.json()
    except json.JSONDecodeError as e:
        return web.json_response(
            {"error": {"message": str(e), "type": "invalid_request_error"}},
            status=400,
        )

    messages = body.get("messages")
    if not messages or not isinstance(messages, list):
        return web.json_response(
            {"error": {"message": "messages array required", "type": "invalid_request_error"}},
            status=400,
        )

    content = _messages_to_content(messages)
    stream = body.get("stream", False)

    try:
        response_text = await agent.process_direct(
            content,
            session_key="http:gateway",
            channel="http",
            chat_id="gateway",
        )
    except Exception as e:
        return web.json_response(
            {"error": {"message": str(e), "type": "internal_error"}},
            status=500,
        )

    response_text = response_text or ""
    model_id = body.get("model", "unichan")
    chunk_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"

    if stream:
        # Return OpenAI-style SSE so the tamagotchi (streamText) gets a valid stream and finishes typing.
        # One chunk with full content + finish_reason so the client resolves and shows the message.
        resp = web.StreamResponse(
            status=200,
            headers={
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )
        resp.headers.update(CORS_HEADERS)
        await resp.prepare(request)
        chunk = {
            "id": chunk_id,
            "object": "chat.completion.chunk",
            "model": model_id,
            "choices": [
                {
                    "index": 0,
                    "delta": {"content": response_text},
                    "finish_reason": "stop",
                }
            ],
        }
        await resp.write(f"data: {json.dumps(chunk)}\n\n".encode("utf-8"))
        await resp.write(b"data: [DONE]\n\n")
        await resp.write_eof()
        return resp

    # Non-streaming: OpenAI-style JSON response
    payload = {
        "id": chunk_id,
        "object": "chat.completion",
        "model": model_id,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": response_text},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        },
    }
    return web.json_response(payload)


def create_app(agent: "AgentLoop", config: Any = None) -> web.Application:
    """Create aiohttp app with /health, /v1/models, /v1/chat/completions, /v1/token-research."""
    app = web.Application(middlewares=[cors_middleware])
    app["agent"] = agent
    app["config"] = config
    app.router.add_get("/health", health)
    app.router.add_get("/v1/", v1_root)
    app.router.add_get("/v1/models", models_list)
    app.router.add_post("/v1/chat/completions", chat_completions)
    app.router.add_post("/v1/token-research", token_research)
    return app
