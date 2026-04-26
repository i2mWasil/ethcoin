import os
from dotenv import load_dotenv

load_dotenv()

ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY")
NETWORK = os.getenv("NETWORK", "mainnet")

# Chain IDs
CHAIN_IDS = {
    "mainnet": "1",
    "sepolia": "11155111"
}

CHAIN_ID = CHAIN_IDS.get(NETWORK, "1")

BASE_URL = "https://api.etherscan.io/v2/api"

if not ETHERSCAN_API_KEY:
    raise ValueError("Missing API key")