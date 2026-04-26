def generate_score(features):
    score = 0

    # Activity score
    if features["tx_count"] > 200:
        score += 30
    elif features["tx_count"] > 50:
        score += 20
    else:
        score += 10

    # Age score
    if features["wallet_age_days"] > 365:
        score += 30
    elif features["wallet_age_days"] > 90:
        score += 20
    else:
        score += 10

    # Interaction diversity
    if features["unique_interactions"] > 50:
        score += 20
    elif features["unique_interactions"] > 10:
        score += 10

    # Value behavior
    if features["avg_tx_value"] > 1e18:  # >1 ETH avg
        score += 20

    return min(score, 100)