from __future__ import annotations

import json
import logging
import time

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from server.model.config import CHAIN_ID, NFT_ADDRESS, RPC_URL, SCORER_PRIVATE_KEY


log = logging.getLogger(__name__)

_NFT_ABI = json.loads(
    """
    [
      {
        "type": "function",
        "name": "updateScore",
        "inputs": [
          {"name": "user", "type": "address"},
          {"name": "score", "type": "uint256"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "getScore",
        "inputs": [{"name": "user", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view"
      }
    ]
    """
)


def _build_web3() -> Web3:
    if not RPC_URL:
        raise RuntimeError("Missing RPC_URL for scorer transaction submission.")
    if not SCORER_PRIVATE_KEY:
        raise RuntimeError("Missing SCORER_PRIVATE_KEY for scorer transaction submission.")
    if not NFT_ADDRESS:
        raise RuntimeError("Missing NFT_ADDRESS for scorer transaction submission.")

    web3 = Web3(Web3.HTTPProvider(RPC_URL))
    web3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    if not web3.is_connected():
        raise RuntimeError(f"Unable to connect to RPC endpoint: {RPC_URL}")
    if web3.eth.chain_id != CHAIN_ID:
        raise RuntimeError(
            f"RPC chain id {web3.eth.chain_id} does not match configured CHAIN_ID {CHAIN_ID}"
        )
    return web3


def _build_fee_params(web3: Web3) -> dict:
    latest_block = web3.eth.get_block("latest")
    base_fee = latest_block.get("baseFeePerGas")
    if base_fee is None:
        return {"gasPrice": web3.eth.gas_price}

    priority_fee = web3.eth.max_priority_fee
    return {
        "maxPriorityFeePerGas": priority_fee,
        "maxFeePerGas": (base_fee * 2) + priority_fee,
    }


def submit_score(wallet: str, score: int, retries: int = 3) -> str:
    if not 0 <= score <= 100:
        raise ValueError(f"Score {score} is outside the supported range [0, 100].")

    web3 = _build_web3()
    account = web3.eth.account.from_key(SCORER_PRIVATE_KEY)
    nft = web3.eth.contract(
        address=Web3.to_checksum_address(NFT_ADDRESS),
        abi=_NFT_ABI,
    )
    wallet_address = Web3.to_checksum_address(wallet)

    for attempt in range(1, retries + 1):
        try:
            transaction = nft.functions.updateScore(wallet_address, score).build_transaction(
                {
                    "chainId": CHAIN_ID,
                    "from": account.address,
                    "nonce": web3.eth.get_transaction_count(account.address, "pending"),
                    **_build_fee_params(web3),
                }
            )
            transaction["gas"] = web3.eth.estimate_gas(transaction)

            signed = account.sign_transaction(transaction)
            tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if receipt["status"] != 1:
                raise RuntimeError("Credit score update transaction reverted.")

            return tx_hash.hex()
        except Exception as exc:
            log.warning("Score submission attempt %d/%d failed: %s", attempt, retries, exc)
            if attempt == retries:
                raise RuntimeError("Failed to submit updateScore transaction.") from exc
            time.sleep(2**attempt)

    raise RuntimeError("Failed to submit updateScore transaction.")


def read_score(wallet: str) -> int:
    web3 = _build_web3()
    nft = web3.eth.contract(
        address=Web3.to_checksum_address(NFT_ADDRESS),
        abi=_NFT_ABI,
    )
    return int(nft.functions.getScore(Web3.to_checksum_address(wallet)).call())
