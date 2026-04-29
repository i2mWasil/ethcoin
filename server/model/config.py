from __future__ import annotations

import os
from pathlib import Path

from env import load_env_file


ROOT_DIR = Path(__file__).resolve().parents[2]
SERVER_DIR = ROOT_DIR / "server"
MODEL_DIR = SERVER_DIR / "model"

load_env_file(SERVER_DIR / ".env")

RPC_URL = os.getenv("RPC_URL", "")
SCORER_PRIVATE_KEY = os.getenv("SCORER_PRIVATE_KEY", "")
NFT_ADDRESS = os.getenv("NFT_ADDRESS", "")
CHAIN_ID = int(os.getenv("CHAIN_ID", "11155111"))

ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "")
ETHERSCAN_BASE_URL = os.getenv(
    "ETHERSCAN_BASE_URL",
    "https://api-sepolia.etherscan.io/api",
)

MODEL_PATH = Path(
    os.getenv("MODEL_PATH", str(MODEL_DIR / "weights.pkl"))
).expanduser()
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))
