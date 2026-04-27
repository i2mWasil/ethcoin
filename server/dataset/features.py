from __future__ import annotations


WEI_PER_ETH = 1_000_000_000_000_000_000


def extract_features(transactions: list[dict], wallet: str = "") -> dict:
    if not transactions:
        return {
            "tx_count": 0,
            "wallet_age_days": 0.0,
            "avg_tx_value_eth": 0.0,
            "unique_interactions": 0,
            "outgoing_ratio": 0.0,
            "error_rate": 0.0,
        }

    wallet_lc = wallet.lower()
    tx_count = len(transactions)

    timestamps = [int(tx["timeStamp"]) for tx in transactions if tx.get("timeStamp")]
    if len(timestamps) >= 2:
        wallet_age_days = (max(timestamps) - min(timestamps)) / 86_400
    else:
        wallet_age_days = 0.0

    values = [int(tx.get("value", 0)) for tx in transactions]
    avg_tx_value_eth = (sum(values) / tx_count) / WEI_PER_ETH if tx_count else 0.0

    counterparties: set[str] = set()
    for tx in transactions:
        frm = (tx.get("from") or "").lower()
        to = (tx.get("to") or "").lower()
        if frm and frm != wallet_lc:
            counterparties.add(frm)
        if to and to != wallet_lc:
            counterparties.add(to)
    unique_interactions = len(counterparties)

    if wallet_lc:
        outgoing = sum(
            1 for tx in transactions if (tx.get("from") or "").lower() == wallet_lc
        )
        outgoing_ratio = outgoing / tx_count
    else:
        outgoing_ratio = 0.0

    errors = sum(1 for tx in transactions if tx.get("isError") == "1")
    error_rate = errors / tx_count

    return {
        "tx_count": tx_count,
        "wallet_age_days": round(wallet_age_days, 4),
        "avg_tx_value_eth": round(avg_tx_value_eth, 8),
        "unique_interactions": unique_interactions,
        "outgoing_ratio": round(outgoing_ratio, 4),
        "error_rate": round(error_rate, 4),
    }


FEATURE_COLUMNS = [
    "tx_count",
    "wallet_age_days",
    "avg_tx_value_eth",
    "unique_interactions",
    "outgoing_ratio",
    "error_rate",
]
