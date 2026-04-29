from __future__ import annotations

import argparse
import csv
import logging
import pickle
import random
from pathlib import Path

from dataset.config import DATASET_FILE
from dataset.features import FEATURE_COLUMNS, WEI_PER_ETH
from dataset.scoring import generate_score as generate_rule_score
from model.config import MODEL_PATH


logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger(__name__)

try:
    from sklearn.neighbors import KNeighborsRegressor
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
except ImportError as exc:  # pragma: no cover - surfaced via CLI
    raise SystemExit(
        "scikit-learn is not installed. Run `pip install -r server/requirements.txt` first."
    ) from exc


DEFAULT_NEIGHBORS = 7


def _as_float(value: str | float | int | None, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    return float(value)


def _normalize_row(row: dict) -> tuple[list[float], int]:
    avg_tx_value_eth = _as_float(row.get("avg_tx_value_eth"))
    if avg_tx_value_eth == 0.0 and row.get("avg_tx_value"):
        raw_avg = _as_float(row.get("avg_tx_value"))
        avg_tx_value_eth = raw_avg / WEI_PER_ETH if raw_avg > 1_000 else raw_avg

    features = {
        "tx_count": int(_as_float(row.get("tx_count"), 0.0)),
        "wallet_age_days": _as_float(row.get("wallet_age_days"), 0.0),
        "avg_tx_value_eth": avg_tx_value_eth,
        "unique_interactions": int(_as_float(row.get("unique_interactions"), 0.0)),
        "outgoing_ratio": _as_float(row.get("outgoing_ratio"), 0.0),
        "error_rate": _as_float(row.get("error_rate"), 0.0),
    }
    label = int(_as_float(row.get("score"), generate_rule_score(features)))
    return [float(features[column]) for column in FEATURE_COLUMNS], label


def load_dataset_rows(dataset_path: Path) -> list[tuple[list[float], int]]:
    if not dataset_path.exists():
        return []

    with dataset_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return [_normalize_row(row) for row in reader]


def generate_synthetic_rows(count: int, seed: int) -> list[tuple[list[float], int]]:
    generator = random.Random(seed)
    rows: list[tuple[list[float], int]] = []

    for _ in range(count):
        tx_count = generator.randint(0, 180)
        unique_interactions = generator.randint(0, max(tx_count, 1))
        wallet_age_days = 0.0 if tx_count == 0 else round(generator.uniform(1, 1_800), 4)
        outgoing_ratio = 0.0 if tx_count == 0 else round(generator.uniform(0.05, 0.95), 4)
        error_rate = 0.0 if tx_count == 0 else round(generator.uniform(0.0, 0.08), 4)
        avg_tx_value_eth = 0.0 if tx_count == 0 else round(generator.uniform(0.01, 4.0), 8)

        features = {
            "tx_count": tx_count,
            "wallet_age_days": wallet_age_days,
            "avg_tx_value_eth": avg_tx_value_eth,
            "unique_interactions": unique_interactions,
            "outgoing_ratio": outgoing_ratio,
            "error_rate": error_rate,
        }
        label = generate_rule_score(features)
        rows.append(([float(features[column]) for column in FEATURE_COLUMNS], label))

    return rows


def _build_knn_model(neighbors: int) -> Pipeline:
    return Pipeline(
        steps=[
            ("scale", StandardScaler()),
            ("knn", KNeighborsRegressor(n_neighbors=neighbors, weights="distance")),
        ]
    )


def train_model(
    dataset_path: Path = DATASET_FILE,
    output_path: Path = MODEL_PATH,
    synthetic_samples: int = 256,
    seed: int = 42,
    neighbors: int = DEFAULT_NEIGHBORS,
) -> Path:
    if neighbors <= 0:
        raise ValueError("neighbors must be a positive integer.")

    rows = load_dataset_rows(dataset_path)
    rows.extend(generate_synthetic_rows(synthetic_samples, seed))

    if not rows:
        raise RuntimeError("No training rows available.")

    features = [row[0] for row in rows]
    labels = [row[1] for row in rows]
    effective_neighbors = min(neighbors, len(rows))
    model = _build_knn_model(effective_neighbors)
    model.fit(features, labels)

    artifact = {
        "model": model,
        "feature_columns": FEATURE_COLUMNS,
        "model_type": "knn_regressor",
        "neighbors": effective_neighbors,
        "seed": seed,
        "synthetic_samples": synthetic_samples,
        "training_rows": len(rows),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as handle:
        pickle.dump(artifact, handle)

    log.info(
        "Saved KNN model artifact to %s (neighbors=%d, training_rows=%d)",
        output_path,
        effective_neighbors,
        len(rows),
    )
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the EthCoin KNN scorer.")
    parser.add_argument("--dataset", type=Path, default=DATASET_FILE)
    parser.add_argument("--output", type=Path, default=MODEL_PATH)
    parser.add_argument("--synthetic-samples", type=int, default=256)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--neighbors", type=int, default=DEFAULT_NEIGHBORS)
    args = parser.parse_args()
    train_model(
        dataset_path=args.dataset,
        output_path=args.output,
        synthetic_samples=args.synthetic_samples,
        seed=args.seed,
        neighbors=args.neighbors,
    )


if __name__ == "__main__":
    main()
