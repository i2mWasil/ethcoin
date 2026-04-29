from __future__ import annotations

import logging
import time

import requests

from dataset.config import CHAIN_ID, ETHERSCAN_API_KEY, ETHERSCAN_BASE_URL


log = logging.getLogger(__name__)


def get_transactions(address: str) -> list[dict]:
    if not ETHERSCAN_API_KEY:
        raise RuntimeError("Missing ETHERSCAN_API_KEY for transaction fetching.")

    params = {
        "chainid": CHAIN_ID,
        "module": "account",
        "action": "txlist",
        "address": address,
        "startblock": 0,
        "endblock": 99_999_999,
        "sort": "asc",
        "apikey": ETHERSCAN_API_KEY,
    }

    response = requests.get(ETHERSCAN_BASE_URL, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()

    result = data.get("result") or []
    if data.get("status") != "1":
        message = (data.get("message") or "").lower()
        if result or "no transactions" in message:
            return []
        raise RuntimeError(
            f"Explorer request failed for {address}: {data.get('message', 'unknown error')}"
        )

    time.sleep(0.25)
    return result
