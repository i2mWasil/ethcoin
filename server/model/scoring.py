from __future__ import annotations

import logging
import pickle

from server.dataset.features import FEATURE_COLUMNS
from server.dataset.scoring import clamp_score, generate_score as generate_rule_score
from server.model.config import MODEL_PATH


log = logging.getLogger(__name__)

_MODEL = None
_MODEL_LOAD_FAILED = False
_MODEL_FEATURE_COLUMNS = FEATURE_COLUMNS


def _unpack_artifact(artifact):
    if isinstance(artifact, dict) and artifact.get("model") is not None:
        model = artifact["model"]
        feature_columns = list(artifact.get("feature_columns") or FEATURE_COLUMNS)
        metadata = {key: value for key, value in artifact.items() if key != "model"}
        return model, feature_columns, metadata

    return artifact, FEATURE_COLUMNS, {}


def _load_model():
    global _MODEL, _MODEL_FEATURE_COLUMNS, _MODEL_LOAD_FAILED

    if _MODEL is not None or _MODEL_LOAD_FAILED:
        return _MODEL

    if not MODEL_PATH.exists():
        log.warning("Model file not found at %s. Falling back to rule-based scoring.", MODEL_PATH)
        _MODEL_LOAD_FAILED = True
        return None

    try:
        with MODEL_PATH.open("rb") as handle:
            artifact = pickle.load(handle)
        model, feature_columns, metadata = _unpack_artifact(artifact)
        if model.__class__.__name__ == "Booster":
            log.warning(
                "Legacy XGBoost artifact detected at %s. Retrain with `python -m server.model.train` "
                "to produce the new KNN model. Falling back to rule-based scoring.",
                MODEL_PATH,
            )
            _MODEL_LOAD_FAILED = True
            return None

        _MODEL = model
        _MODEL_FEATURE_COLUMNS = feature_columns
        model_type = metadata.get("model_type") or _MODEL.__class__.__name__
        log.info("Loaded %s artifact from %s", model_type, MODEL_PATH)
    except Exception as exc:
        log.warning("Failed to load model artifact %s: %s", MODEL_PATH, exc)
        _MODEL_LOAD_FAILED = True

    return _MODEL


def _predict_model(model, row: list[list[float]]) -> float:
    return float(model.predict(row)[0])


def generate_score(features: dict) -> int:
    model = _load_model()
    if model is not None:
        try:
            row = [[features.get(column, 0) for column in _MODEL_FEATURE_COLUMNS]]
            return clamp_score(_predict_model(model, row))
        except Exception as exc:
            log.warning("Model inference failed (%s). Falling back to rule-based scoring.", exc)

    return generate_rule_score(features)
