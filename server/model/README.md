# Scorer Service

This service computes a credit score off-chain, submits `updateScore(user, score)` on-chain with the scorer wallet, and leaves the frontend in read-only mode for score retrieval.

## What it does

- Fetches wallet transactions from an Etherscan-compatible API
- Extracts a shared feature vector from `server/dataset/features.py`
- Scores the wallet in the integer range `0-100`
- Sends `updateScore(wallet, score)` from the authorized scorer signer
- Exposes both a CLI and a FastAPI service

## Environment

Create a local env file from [`server/.env.example`](/Users/ImWasil/Documents/GitHub/ethcoin/server/.env.example) or export the variables directly:

```bash
cp server/.env.example server/.env.local
```

Required variables:

- `RPC_URL`
- `SCORER_PRIVATE_KEY`
- `NFT_ADDRESS`
- `CHAIN_ID`
- `ETHERSCAN_API_KEY`

Optional variables:

- `ETHERSCAN_BASE_URL`
- `MODEL_PATH`
- `LOG_LEVEL`
- `SERVER_HOST`
- `SERVER_PORT`

## Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
```

## Train the XGBoost artifact

```bash
python -m server.model.train --output server/model/weights.pkl
```

Notes:

- The trainer reads `server/dataset/wallet_data.csv` when present.
- If the dataset is sparse, it augments training with synthetic examples labeled by the deterministic fallback scorer so a usable `weights.pkl` can still be produced.

## Run the API server

```bash
uvicorn server.model.scorer:app --host 0.0.0.0 --port 8000
```

Endpoints:

- `GET /health`
- `GET /score/{wallet}`: reads the score currently stored on-chain
- `POST /score`: computes and submits a score
- `POST /score/{wallet}`: computes and submits a score for the path wallet

Example request:

```bash
curl -X POST http://127.0.0.1:8000/score \
  -H 'Content-Type: application/json' \
  -d '{"wallet":"0x0000000000000000000000000000000000000000"}'
```

## Run from the CLI

Preview only:

```bash
python -m server.model.scorer 0x0000000000000000000000000000000000000000 --dry-run
```

Compute and submit:

```bash
python -m server.model.scorer 0x0000000000000000000000000000000000000000
```

Manual override:

```bash
python -m server.model.manual_update --wallet 0x0000000000000000000000000000000000000000 --score 72
```

## Access control

`CreditScoreNFT` uses `AccessControl` with `SCORER_ROLE`.

- The deployer receives `DEFAULT_ADMIN_ROLE`
- The scorer wallet must be granted `SCORER_ROLE`
- The frontend never sends a score to the contract

The deploy script accepts an optional `SCORER_ADDRESS` environment variable and grants `SCORER_ROLE` during deployment when provided.
