import time

def extract_features(transactions):
    if not transactions:
        return {
            "tx_count": 0,
            "wallet_age_days": 0,
            "avg_tx_value": 0,
            "unique_interactions": 0
        }

    tx_count = len(transactions)

    # Wallet age
    first_tx_time = int(transactions[0]["timeStamp"])
    last_tx_time = int(transactions[-1]["timeStamp"])
    wallet_age_days = (last_tx_time - first_tx_time) / (60 * 60 * 24)

    # Avg tx value
    total_value = sum(int(tx["value"]) for tx in transactions)
    avg_tx_value = total_value / tx_count if tx_count else 0

    # Unique contracts interacted
    unique_addresses = set(tx["to"] for tx in transactions if tx["to"])
    unique_interactions = len(unique_addresses)

    return {
        "tx_count": tx_count,
        "wallet_age_days": wallet_age_days,
        "avg_tx_value": avg_tx_value,
        "unique_interactions": unique_interactions
    }