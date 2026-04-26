import requests
from config import ETHERSCAN_API_KEY, BASE_URL, CHAIN_ID
import time
import logging

def get_transactions(address):
    url = (
        f"{BASE_URL}"
        f"?chainid={CHAIN_ID}"
        f"&module=account"
        f"&action=txlist"
        f"&address={address}"
        f"&startblock=0"
        f"&endblock=99999999"
        f"&sort=asc"
        f"&apikey={ETHERSCAN_API_KEY}"
    )

    response = requests.get(url)
    data = response.json()

    # Debug logging
    if data["status"] != "1":
        logging.warning(f"⚠️ No tx found for {address}")
        logging.warning(data)
        return []

    time.sleep(0.25)  # rate limit safety

    return data["result"]