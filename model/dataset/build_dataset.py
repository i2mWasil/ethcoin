import pandas as pd
from fetch import get_transactions
from features import extract_features
from scoring import generate_score
from tqdm import tqdm
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

def load_wallets(file_path="wallets.txt"):
    with open(file_path, "r") as f:
        return [line.strip() for line in f if line.strip()]

def build_dataset():
    wallets = load_wallets()
    rows = []

    for wallet in tqdm(wallets):
        txs = get_transactions(wallet)
        features = extract_features(txs)
        score = generate_score(features)

        row = {
            "wallet": wallet,
            **features,
            "score": score
        }


        rows.append(row)

    df = pd.DataFrame(rows)
    df.to_csv("wallet_data.csv", index=False)

    logging.info("🎉 Dataset saved as wallet_data.csv")


if __name__ == "__main__":
    build_dataset()