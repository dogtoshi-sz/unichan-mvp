#!/usr/bin/env python3
"""
UNICHAN Start - Launch gateway + Tamagotchi for UNICHAN-MVP.
"""

import subprocess
import sys
import time
from pathlib import Path


def main():
    logo = "<3" if sys.platform == "win32" else "💖"
    print(f"{logo} Starting UNICHAN...")

    # UNICHAN-MVP root: BRAIN/nanobot/scripts/start_waifu.py -> parent^4
    repo_root = Path(__file__).resolve().parent.parent.parent.parent

    if not (repo_root / "package.json").exists():
        print("❌ UNICHAN-MVP root not found!")
        print(f"   Expected: {repo_root}")
        sys.exit(1)

    # Check if gateway is running
    print("\n🔍 Checking if gateway is running...")
    try:
        import httpx
        response = httpx.get("http://localhost:18790/health", timeout=2)
        if response.status_code == 200:
            print("✅ Gateway is already running!")
        else:
            print("⚠️  Gateway responded with unexpected status")
    except Exception:
        print("❌ Gateway not running. Start it first:")
        print("   cd BRAIN && unichan gateway")
        print("\n   Or run in another terminal and try again.")
        sys.exit(1)

    # Start Tamagotchi
    print("\n🌸 Starting Tamagotchi...")
    print("💡 In Settings → Unichan: port 18790, model unichan")
    print("💡 In Settings → Consciousness: select Unichan brain\n")

    try:
        subprocess.run(["pnpm", "dev:tamagotchi"], cwd=repo_root, check=True)
    except FileNotFoundError:
        print("❌ pnpm not found. Run 'pnpm install' in UNICHAN-MVP root first.")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down...")
    except subprocess.CalledProcessError:
        print("\n❌ Failed to start Tamagotchi")
        sys.exit(1)


if __name__ == "__main__":
    main()
