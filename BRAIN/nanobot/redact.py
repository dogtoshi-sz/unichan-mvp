"""
Universal path/username redaction for logs and stdout/stderr.

Call install_redact() at app startup so that any output (CLI, gateway, logs,
tracebacks) has the home path and username redacted.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_redact_installed = False


def _redact_string(s: str) -> str:
    """Replace home path with ~ and username with USER in a string."""
    if not s:
        return s
    try:
        home = Path.home()
        home_s = str(home)
        # Replace full home path with ~
        if home_s in s:
            s = s.replace(home_s, "~")
        # On Windows, also replace username when it appears as path segment (e.g. C:\Users\emilk)
        if os.name == "nt" and home_s.count(os.sep) >= 2:
            username = home_s.rstrip(os.sep).split(os.sep)[-1]
            if username and username != "USER" and username in s:
                s = s.replace(username, "USER")
    except Exception:
        pass
    return s


class _RedactingStream:
    """Wraps a text stream and redacts path/username on each write."""

    __slots__ = ("_stream",)

    def __init__(self, stream):
        self._stream = stream

    def write(self, s: str) -> int:
        return self._stream.write(_redact_string(s))

    def flush(self):
        return self._stream.flush()

    def __getattr__(self, name):
        return getattr(self._stream, name)


def install_redact() -> None:
    """Install universal redaction on sys.stdout and sys.stderr. Idempotent."""
    global _redact_installed
    if _redact_installed:
        return
    if hasattr(sys.stdout, "_stream") and hasattr(sys.stdout, "write"):
        # Already wrapped
        return
    sys.stdout = _RedactingStream(sys.stdout)  # type: ignore[assignment]
    sys.stderr = _RedactingStream(sys.stderr)  # type: ignore[assignment]
    _redact_installed = True
