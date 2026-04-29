from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from env import load_env_file


ROOT_DIR = Path(__file__).resolve().parents[2]
SERVER_DIR = ROOT_DIR / "server"
FRONTEND_DIR = ROOT_DIR / "frontend"
ECONOMY_DIR = SERVER_DIR / "economy"
RUNS_DIR = ECONOMY_DIR / "runs"
DEFAULT_WALLETS_FILE = SERVER_DIR / "dataset" / "wallets.txt"

load_env_file(SERVER_DIR / ".env")
load_env_file(FRONTEND_DIR / ".env")


def default_rpc_url() -> str:
    return os.getenv("RPC_URL") or os.getenv("VITE_QUICKNODE_RPC", "")


def default_chain_id() -> int:
    return int(os.getenv("CHAIN_ID", "11155111"))


def default_cdp_address() -> str:
    return os.getenv("CDP_ADDRESS") or os.getenv("VITE_CDP_ADDRESS", "")


def default_mnemonic() -> str:
    return os.getenv("ECONOMY_MNEMONIC", "").strip()


def default_wallet_manifest() -> Path | None:
    raw_path = os.getenv("ECONOMY_WALLET_MANIFEST", "").strip()
    if not raw_path:
        return None
    return Path(raw_path).expanduser()


def load_wallet_addresses(file_path: Path = DEFAULT_WALLETS_FILE) -> tuple[list[str], list[str]]:
    if not file_path.exists():
        raise FileNotFoundError(f"Wallets file does not exist: {file_path}")

    addresses: list[str] = []
    duplicates: list[str] = []
    seen: set[str] = set()

    with file_path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line:
                continue

            key = line.lower()
            if key in seen:
                duplicates.append(line)
                continue

            seen.add(key)
            addresses.append(line)

    if not addresses:
        raise RuntimeError(f"No wallet addresses found in {file_path}")

    return addresses, duplicates


def next_run_output_path() -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return RUNS_DIR / f"economy-run-{timestamp}.json"
