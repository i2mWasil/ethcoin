from __future__ import annotations

import logging
import pickle

from server.dataset.features import FEATURE_COLUMNS
from server.dataset.scoring import clamp_score, generate_score as generate_rule_score
from server.model.config import MODEL_PATH


log = logging.getLogger(__name__)

_MODEL = None
_MODEL_LOAD_FAILED = False


def _load_model():
    global _MODEL, _MODEL_LOAD_FAILED

    if _MODEL is not None or _MODEL_LOAD_FAILED:
        return _MODEL

    if not MODEL_PATH.exists():
        log.warning("Model file not found at %s. Falling back to rule-based scoring.", MODEL_PATH)
        _MODEL_LOAD_FAILED = True
        return None

    try:
        with MODEL_PATH.open("rb") as handle:
            _MODEL = pickle.load(handle)
        log.info("Loaded model artifact from %s", MODEL_PATH)
    except Exception as exc:
        log.warning("Failed to load model artifact %s: %s", MODEL_PATH, exc)
        _MODEL_LOAD_FAILED = True

    return _MODEL


def _predict_model(model, row: list[list[float]]) -> float:
    if model.__class__.__name__ == "Booster":
        import xgboost as xgb

        matrix = xgb.DMatrix(row, feature_names=FEATURE_COLUMNS)
        return float(model.predict(matrix)[0])

    return float(model.predict(row)[0])


def generate_score(features: dict) -> int:
    model = _load_model()
    if model is not None:
        try:
            row = [[features.get(column, 0) for column in FEATURE_COLUMNS]]
            return clamp_score(_predict_model(model, row))
        except Exception as exc:
            log.warning("Model inference failed (%s). Falling back to rule-based scoring.", exc)

    return generate_rule_score(features)
