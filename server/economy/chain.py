from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware


CDP_ABI = [
    {
        "type": "function",
        "stateMutability": "payable",
        "name": "depositAndMint",
        "inputs": [],
        "outputs": [],
    },
    {
        "type": "function",
        "stateMutability": "payable",
        "name": "repay",
        "inputs": [],
        "outputs": [],
    },
    {
        "type": "function",
        "stateMutability": "view",
        "name": "positions",
        "inputs": [{"name": "", "type": "address"}],
        "outputs": [
            {"name": "collateral", "type": "uint256"},
            {"name": "debt", "type": "uint256"},
        ],
    },
    {
        "type": "function",
        "stateMutability": "view",
        "name": "getCollateralRatio",
        "inputs": [{"name": "user", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "type": "function",
        "stateMutability": "view",
        "name": "etc",
        "inputs": [],
        "outputs": [{"name": "", "type": "address"}],
    },
]

ETC_ABI = [
    {
        "type": "function",
        "stateMutability": "view",
        "name": "balanceOf",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    }
]


@dataclass(frozen=True)
class ProtocolContracts:
    cdp: Any
    etc: Any
    cdp_address: str
    etc_address: str


def build_web3(rpc_url: str, chain_id: int) -> Web3:
    if not rpc_url:
        raise RuntimeError("Missing RPC_URL or VITE_QUICKNODE_RPC for economy simulation.")

    web3 = Web3(Web3.HTTPProvider(rpc_url))
    web3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

    if not web3.is_connected():
        raise RuntimeError("Unable to connect to the configured RPC endpoint.")

    if web3.eth.chain_id != chain_id:
        raise RuntimeError(
            f"RPC chain id {web3.eth.chain_id} does not match configured CHAIN_ID {chain_id}"
        )

    return web3


def build_fee_params(web3: Web3) -> dict[str, int]:
    latest_block = web3.eth.get_block("latest")
    base_fee = latest_block.get("baseFeePerGas")
    if base_fee is None:
        return {"gasPrice": int(web3.eth.gas_price)}

    priority_fee = int(web3.eth.max_priority_fee)
    return {
        "maxPriorityFeePerGas": priority_fee,
        "maxFeePerGas": int((base_fee * 2) + priority_fee),
    }


def fee_ceiling_wei(fee_params: dict[str, int], gas_limit: int) -> int:
    unit_price = int(fee_params.get("maxFeePerGas") or fee_params.get("gasPrice") or 0)
    return unit_price * gas_limit


def load_protocol_contracts(web3: Web3, cdp_address: str) -> ProtocolContracts:
    checksum_cdp = Web3.to_checksum_address(cdp_address)
    cdp = web3.eth.contract(address=checksum_cdp, abi=CDP_ABI)
    checksum_etc = Web3.to_checksum_address(cdp.functions.etc().call())
    etc = web3.eth.contract(address=checksum_etc, abi=ETC_ABI)
    return ProtocolContracts(
        cdp=cdp,
        etc=etc,
        cdp_address=checksum_cdp,
        etc_address=checksum_etc,
    )


def get_position(protocol: ProtocolContracts, wallet: str) -> tuple[int, int]:
    collateral, debt = protocol.cdp.functions.positions(Web3.to_checksum_address(wallet)).call()
    return int(collateral), int(debt)


def get_collateral_ratio(protocol: ProtocolContracts, wallet: str) -> int:
    return int(protocol.cdp.functions.getCollateralRatio(Web3.to_checksum_address(wallet)).call())


def get_etc_balance(protocol: ProtocolContracts, wallet: str) -> int:
    return int(protocol.etc.functions.balanceOf(Web3.to_checksum_address(wallet)).call())


def _sign_and_send(web3: Web3, account: Any, transaction: dict, timeout: int) -> tuple[str, Any]:
    signed = account.sign_transaction(transaction)
    tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)

    if receipt["status"] != 1:
        raise RuntimeError(f"Transaction reverted: {tx_hash.hex()}")

    return tx_hash.hex(), receipt


def send_native_transfer(
    web3: Web3,
    private_key: str,
    chain_id: int,
    to_address: str,
    value_wei: int,
    timeout: int = 180,
) -> tuple[str, Any]:
    account = web3.eth.account.from_key(private_key)
    transaction = {
        "chainId": chain_id,
        "from": account.address,
        "to": Web3.to_checksum_address(to_address),
        "value": int(value_wei),
        "gas": 21_000,
        "nonce": web3.eth.get_transaction_count(account.address, "pending"),
        **build_fee_params(web3),
    }
    return _sign_and_send(web3, account, transaction, timeout=timeout)


def send_contract_call(
    web3: Web3,
    private_key: str,
    chain_id: int,
    function_call: Any,
    value_wei: int = 0,
    timeout: int = 180,
) -> tuple[str, Any]:
    account = web3.eth.account.from_key(private_key)
    transaction = function_call.build_transaction(
        {
            "chainId": chain_id,
            "from": account.address,
            "value": int(value_wei),
            "nonce": web3.eth.get_transaction_count(account.address, "pending"),
            **build_fee_params(web3),
        }
    )
    transaction["gas"] = web3.eth.estimate_gas(transaction)
    return _sign_and_send(web3, account, transaction, timeout=timeout)
