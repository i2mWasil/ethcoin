from __future__ import annotations

import argparse
import logging

from model.config import LOG_LEVEL
from model.chain import read_score, submit_score
from model.scoring import generate_score
from dataset.features import extract_features
from dataset.fetch import get_transactions

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
log = logging.getLogger("scorer")

def score_and_submit(wallet: str) -> dict:
    log.info("Scoring wallet: %s", wallet)
    transactions = get_transactions(wallet)
    features = extract_features(transactions, wallet=wallet)
    score = generate_score(features)
    log.info("Computed score=%d  features=%s", score, features)
    tx_hash = submit_score(wallet, score)
    return {
        "wallet": wallet,
        "score": score,
        "tx_hash": tx_hash,
        "features": features,
    }


def score_only(wallet: str) -> dict:
    transactions = get_transactions(wallet)
    features = extract_features(transactions, wallet=wallet)
    score = generate_score(features)
    return {"wallet": wallet, "score": score, "features": features}


try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    app = FastAPI(
        title="EthCoin Scorer Service",
        description="Computes AI credit scores and submits them on-chain.",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class ScoreRequest(BaseModel):
        wallet: str
        dry_run: bool = False

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/score")
    def post_score(request: ScoreRequest):
        try:
            if request.dry_run:
                return score_only(request.wallet)
            return score_and_submit(request.wallet)
        except Exception as exc:
            log.exception("Failed to score wallet %s", request.wallet)
            raise HTTPException(status_code=500, detail=str(exc))

    @app.get("/score/{wallet}")
    def get_score(wallet: str):
        try:
            return {"wallet": wallet, "on_chain_score": read_score(wallet)}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

    @app.post("/score/{wallet}")
    def post_score_for_wallet(wallet: str):
        try:
            return score_and_submit(wallet)
        except Exception as exc:
            log.exception("Failed to score wallet %s", wallet)
            raise HTTPException(status_code=500, detail=str(exc))

except ImportError:
    app = None  # type: ignore

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="scorer",
        description="Compute and submit on-chain credit scores.",
    )
    parser.add_argument("wallet", help="Wallet address to score")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute score but do NOT submit an on-chain transaction",
    )
    parser.add_argument(
        "--read-only",
        action="store_true",
        help="Only read the current on-chain score, do not compute",
    )
    args = parser.parse_args()

    if args.read_only:
        current = read_score(args.wallet)
        print(f"On-chain score for {args.wallet}: {current}")
        return

    if args.dry_run:
        result = score_only(args.wallet)
        print(f"Dry-run score for {result['wallet']}: {result['score']}")
        print(f"Features: {result['features']}")
    else:
        result = score_and_submit(args.wallet)
        print(f"Score submitted for {result['wallet']}")
        print(f"  Score:    {result['score']}")
        print(f"  Tx hash:  {result['tx_hash']}")
        print(f"  Features: {result['features']}")


if __name__ == "__main__":
    main()
