from __future__ import annotations

import argparse
import csv
import logging
from pathlib import Path

from server.dataset.config import DATASET_FILE, WALLETS_FILE
from server.dataset.features import FEATURE_COLUMNS, extract_features
from server.dataset.fetch import get_transactions
from server.dataset.scoring import generate_score


logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger(__name__)


def load_wallets(file_path: Path = WALLETS_FILE) -> list[str]:
    with file_path.open("r", encoding="utf-8") as handle:
        return [line.strip() for line in handle if line.strip()]


def build_dataset(
    wallets_file: Path = WALLETS_FILE,
    output_file: Path = DATASET_FILE,
) -> Path:
    wallets = load_wallets(wallets_file)
    rows: list[dict] = []

    for index, wallet in enumerate(wallets, start=1):
        log.info("Processing wallet %d/%d: %s", index, len(wallets), wallet)
        transactions = get_transactions(wallet)
        features = extract_features(transactions, wallet=wallet)
        rows.append(
            {
                "wallet": wallet,
                **features,
                "score": generate_score(features),
            }
        )

    output_file.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["wallet", *FEATURE_COLUMNS, "score"]
    with output_file.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    log.info("Dataset written to %s", output_file)
    return output_file


def main() -> None:
    parser = argparse.ArgumentParser(description="Build wallet feature dataset for EthCoin.")
    parser.add_argument("--wallets-file", type=Path, default=WALLETS_FILE)
    parser.add_argument("--output", type=Path, default=DATASET_FILE)
    args = parser.parse_args()
    build_dataset(wallets_file=args.wallets_file, output_file=args.output)


if __name__ == "__main__":
    main()
