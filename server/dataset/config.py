from __future__ import annotations

import os
from pathlib import Path

from env import load_env_file


DATASET_DIR = Path(__file__).resolve().parent
SERVER_DIR = DATASET_DIR.parent
WALLETS_FILE = DATASET_DIR / "wallets.txt"
DATASET_FILE = DATASET_DIR / "wallet_data.csv"

load_env_file(SERVER_DIR / ".env")
load_env_file(DATASET_DIR / ".env")

ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "")
ETHERSCAN_BASE_URL = os.getenv(
    "ETHERSCAN_BASE_URL",
    "https://api-sepolia.etherscan.io/api",
)
CHAIN_ID = int(os.getenv("CHAIN_ID", "11155111"))
