"""
UNICHAN - A Local AI Agent Framework
"""
import sys

__version__ = "0.2.0"
# Use ASCII on Windows to avoid cp1252 UnicodeEncodeError with Rich/console
__logo__ = "<3" if sys.platform == "win32" else "💖"

# ASCII art banner (UNICHAN logo) — printed on onboard and gateway
# Spacing tuned so U N I C H A N each read clearly (extra space in CHAN)
__ascii_banner__ = r"""
  _    _  _  _   _ _____   _____  _   _           _
 | |  | | \ | |_   _/ ____| |  | |   /\   | \ | |       /_ |
 | |  | |  \| | | || |    | |__| |  /  \  |  \| |  __   _| |
 | |  | | . ` | | || |    |  __  | / /\ \ | . ` |  \ \ / / |
 | |__| | |\  |_| || |____| |  | |/ ____ \| |\  |   \ V /| |
  \____/|_| \_|_____\_____|_|  |_/_/    \_\_| \_|    \_/ |_|
"""
