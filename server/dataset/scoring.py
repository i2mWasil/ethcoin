from __future__ import annotations


def clamp_score(value: float | int) -> int:
    return int(max(0, min(100, round(float(value)))))


def generate_score(features: dict) -> int:
    if features.get("tx_count", 0) == 0:
        return 0

    score = 0

    tx_count = features.get("tx_count", 0)
    if tx_count >= 100:
        score += 30
    elif tx_count >= 50:
        score += 20
    elif tx_count >= 10:
        score += 10
    else:
        score += 5

    wallet_age_days = features.get("wallet_age_days", 0.0)
    if wallet_age_days >= 730:
        score += 25
    elif wallet_age_days >= 365:
        score += 18
    elif wallet_age_days >= 90:
        score += 10
    else:
        score += 3

    unique_interactions = features.get("unique_interactions", 0)
    if unique_interactions >= 100:
        score += 20
    elif unique_interactions >= 50:
        score += 14
    elif unique_interactions >= 10:
        score += 7

    avg_tx_value_eth = features.get("avg_tx_value_eth", 0.0)
    if avg_tx_value_eth >= 2.0:
        score += 15
    elif avg_tx_value_eth >= 0.5:
        score += 10
    elif avg_tx_value_eth >= 0.1:
        score += 5

    error_rate = features.get("error_rate", 0.0)
    if error_rate == 0.0:
        score += 10
    elif error_rate <= 0.02:
        score += 7
    elif error_rate <= 0.05:
        score += 3

    return clamp_score(score)
