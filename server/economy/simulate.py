from __future__ import annotations

import argparse
import json
import logging
import math
import random
import time
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from eth_account import Account
from web3 import Web3

from economy.chain import (
    ProtocolContracts,
    build_fee_params,
    build_web3,
    fee_ceiling_wei,
    get_collateral_ratio,
    get_etc_balance,
    get_position,
    load_protocol_contracts,
    send_contract_call,
    send_native_transfer,
)
from economy.config import (
    DEFAULT_WALLETS_FILE,
    RUNS_DIR,
    default_cdp_address,
    default_chain_id,
    default_mnemonic,
    default_rpc_url,
    default_wallet_manifest,
    load_wallet_addresses,
    next_run_output_path,
)


logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger(__name__)

WEI_PER_ETH = 10**18


@dataclass(frozen=True)
class WalletAccount:
    address: str
    private_key: str
    label: str
    derivation_index: int | None = None


@dataclass
class WalletState:
    account: WalletAccount
    native_balance_wei: int
    reserve_wei: int
    starting_native_balance_wei: int
    etc_balance_wei: int = 0
    debt_wei: int = 0
    collateral_wei: int = 0
    sent_count: int = 0
    received_count: int = 0
    protocol_count: int = 0
    total_sent_wei: int = 0
    total_received_wei: int = 0

    @property
    def total_activity(self) -> int:
        return self.sent_count + self.received_count

    def spendable_native_wei(self, fee_headroom_wei: int) -> int:
        return max(self.native_balance_wei - self.reserve_wei - fee_headroom_wei, 0)


@dataclass
class PlannedAction:
    kind: str
    sender: WalletState
    receiver: WalletState | None
    value_wei: int
    weight: float
    metadata: dict[str, Any] = field(default_factory=dict)


def _parse_eth_amount(raw_value: str) -> int:
    try:
        amount = Decimal(raw_value)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid ETH amount: {raw_value}") from exc

    if amount < 0:
        raise ValueError(f"ETH amount cannot be negative: {raw_value}")

    return int(amount * WEI_PER_ETH)


def _eth_from_wei(value_wei: int) -> float:
    return round(value_wei / WEI_PER_ETH, 8)


def _checksum_addresses(addresses: list[str]) -> list[str]:
    return [Web3.to_checksum_address(address) for address in addresses]


def _load_manifest_accounts(manifest_path: Path) -> list[WalletAccount]:
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = payload.get("wallets") if isinstance(payload, dict) else payload

    if not isinstance(entries, list) or not entries:
        raise RuntimeError(
            f"Wallet manifest {manifest_path} must contain a non-empty JSON array of wallets."
        )

    accounts: list[WalletAccount] = []
    seen: set[str] = set()
    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            raise RuntimeError(f"Wallet manifest entry #{index} must be a JSON object.")

        private_key = str(entry.get("private_key") or entry.get("privateKey") or "").strip()
        if not private_key:
            raise RuntimeError(
                f"Wallet manifest entry #{index} is missing `private_key` / `privateKey`."
            )

        account = Account.from_key(private_key)
        expected_address = str(entry.get("address") or "").strip()
        if expected_address and account.address.lower() != expected_address.lower():
            raise RuntimeError(
                f"Wallet manifest entry #{index} address does not match the private key."
            )

        key = account.address.lower()
        if key in seen:
            raise RuntimeError(f"Wallet manifest contains a duplicate wallet: {account.address}")
        seen.add(key)

        label = str(entry.get("label") or entry.get("name") or f"Wallet {index}")
        accounts.append(
            WalletAccount(
                address=account.address,
                private_key=private_key,
                label=label,
                derivation_index=entry.get("derivation_index"),
            )
        )

    return accounts


def _derive_accounts_from_mnemonic(
    mnemonic: str,
    account_count: int,
    account_offset: int,
) -> list[WalletAccount]:
    if account_count <= 0:
        raise RuntimeError("Mnemonic mode requires a positive account count.")

    Account.enable_unaudited_hdwallet_features()

    accounts: list[WalletAccount] = []
    for offset in range(account_count):
        derivation_index = account_offset + offset
        derivation_path = f"m/44'/60'/0'/0/{derivation_index}"
        account = Account.from_mnemonic(mnemonic, account_path=derivation_path)
        accounts.append(
            WalletAccount(
                address=account.address,
                private_key=Web3.to_hex(account.key),
                label=f"Account {derivation_index + 1}",
                derivation_index=derivation_index,
            )
        )

    return accounts


def _align_accounts_to_addresses(
    accounts: list[WalletAccount],
    expected_addresses: list[str],
) -> list[WalletAccount]:
    by_address = {account.address.lower(): account for account in accounts}
    missing = [address for address in expected_addresses if address.lower() not in by_address]
    if missing:
        missing_sample = ", ".join(missing[:3])
        raise RuntimeError(
            "Signer material does not cover every wallet in the wallets file. "
            f"Missing addresses include: {missing_sample}"
        )

    return [by_address[address.lower()] for address in expected_addresses]


def resolve_accounts(
    wallet_manifest: Path | None,
    mnemonic: str,
    wallet_addresses: list[str],
    account_count: int,
    account_offset: int,
) -> list[WalletAccount]:
    if wallet_manifest:
        accounts = _load_manifest_accounts(wallet_manifest)
    elif mnemonic:
        count = len(wallet_addresses) if wallet_addresses else account_count
        accounts = _derive_accounts_from_mnemonic(mnemonic, count, account_offset)
    else:
        raise RuntimeError(
            "No signer material provided. Set ECONOMY_MNEMONIC or pass --wallet-manifest."
        )

    if wallet_addresses:
        return _align_accounts_to_addresses(accounts, wallet_addresses)

    return accounts


class EconomySimulator:
    def __init__(
        self,
        web3: Web3,
        chain_id: int,
        accounts: list[WalletAccount],
        min_reserve_wei: int,
        reserve_fraction: float,
        rng: random.Random,
        receipt_timeout: int,
        delay_seconds: float,
        include_protocol_actions: bool,
        protocol: ProtocolContracts | None,
    ) -> None:
        self.web3 = web3
        self.chain_id = chain_id
        self.accounts = accounts
        self.min_reserve_wei = min_reserve_wei
        self.reserve_fraction = reserve_fraction
        self.rng = rng
        self.receipt_timeout = receipt_timeout
        self.delay_seconds = delay_seconds
        self.include_protocol_actions = include_protocol_actions
        self.protocol = protocol
        self.min_transfer_wei = _parse_eth_amount("0.00005")
        self.min_protocol_value_wei = _parse_eth_amount("0.0001")
        self.collateral_ratio_cache: dict[str, int] = {}

    def load_states(self) -> list[WalletState]:
        states: list[WalletState] = []

        for account in self.accounts:
            native_balance_wei = int(self.web3.eth.get_balance(account.address))
            reserve_wei = min(
                native_balance_wei,
                max(self.min_reserve_wei, int(native_balance_wei * self.reserve_fraction)),
            )

            etc_balance_wei = 0
            debt_wei = 0
            collateral_wei = 0
            if self.include_protocol_actions and self.protocol:
                collateral_wei, debt_wei = get_position(self.protocol, account.address)
                etc_balance_wei = get_etc_balance(self.protocol, account.address)

            states.append(
                WalletState(
                    account=account,
                    native_balance_wei=native_balance_wei,
                    reserve_wei=reserve_wei,
                    starting_native_balance_wei=native_balance_wei,
                    etc_balance_wei=etc_balance_wei,
                    debt_wei=debt_wei,
                    collateral_wei=collateral_wei,
                )
            )

        return states

    def estimate_feasible_transactions(self, states: list[WalletState], native_fee_wei: int) -> int:
        if native_fee_wei <= 0:
            return 0

        budget_wei = sum(max(state.native_balance_wei - state.reserve_wei, 0) for state in states)
        return int(budget_wei // native_fee_wei)

    def run(
        self,
        transaction_target: int,
        output_path: Path,
        dry_run: bool,
        duplicates_ignored: list[str],
        seed: int,
    ) -> Path:
        states = self.load_states()
        fee_params = build_fee_params(self.web3)
        native_fee_headroom_wei = fee_ceiling_wei(fee_params, 21_000)
        feasible = self.estimate_feasible_transactions(states, native_fee_headroom_wei)

        if feasible and feasible < transaction_target:
            log.warning(
                "Requested %d transactions, but current free-balance budget suggests about %d are safe. "
                "Proceeding with %d.",
                transaction_target,
                feasible,
                feasible,
            )
            transaction_target = feasible

        if transaction_target <= 0:
            raise RuntimeError("No transactions can be simulated with the current wallet balances.")

        records: list[dict[str, Any]] = []

        while len(records) < transaction_target:
            fee_params = build_fee_params(self.web3)
            native_fee_headroom_wei = fee_ceiling_wei(fee_params, 21_000)
            contract_fee_headroom_wei = fee_ceiling_wei(fee_params, 250_000)
            candidates = self._build_candidates(
                states=states,
                native_fee_headroom_wei=native_fee_headroom_wei,
                contract_fee_headroom_wei=contract_fee_headroom_wei,
            )
            if not candidates:
                log.warning("No more viable transactions could be planned after %d submissions.", len(records))
                break

            action = self.rng.choices(
                candidates,
                weights=[candidate.weight for candidate in candidates],
                k=1,
            )[0]

            record = self._execute_action(
                action=action,
                sequence=len(records) + 1,
                dry_run=dry_run,
            )
            records.append(record)

            if self.delay_seconds > 0 and not dry_run:
                time.sleep(self.delay_seconds)

        self._write_summary(
            output_path=output_path,
            transaction_target=transaction_target,
            records=records,
            states=states,
            dry_run=dry_run,
            duplicates_ignored=duplicates_ignored,
            seed=seed,
        )

        return output_path

    def _build_candidates(
        self,
        states: list[WalletState],
        native_fee_headroom_wei: int,
        contract_fee_headroom_wei: int,
    ) -> list[PlannedAction]:
        candidates: list[PlannedAction] = []

        for state in states:
            sender_weight = self._sender_weight(state, native_fee_headroom_wei)
            if sender_weight <= 0:
                continue

            native_action = self._plan_native_transfer(
                state,
                states,
                native_fee_headroom_wei=native_fee_headroom_wei,
                sender_weight=sender_weight,
            )
            if native_action:
                candidates.append(native_action)

            if self.include_protocol_actions and self.protocol:
                deposit_action = self._plan_deposit(
                    state,
                    contract_fee_headroom_wei=contract_fee_headroom_wei,
                    sender_weight=sender_weight,
                )
                if deposit_action:
                    candidates.append(deposit_action)

                repay_action = self._plan_repay(
                    state,
                    contract_fee_headroom_wei=contract_fee_headroom_wei,
                    sender_weight=sender_weight,
                )
                if repay_action:
                    candidates.append(repay_action)

        return candidates

    def _sender_weight(self, state: WalletState, fee_headroom_wei: int) -> float:
        spendable = state.spendable_native_wei(fee_headroom_wei)
        if spendable <= self.min_transfer_wei:
            return 0.0

        weight = max(math.sqrt(spendable / 10**15), 1.0)
        if state.total_activity == 0:
            weight *= 2.4
        elif state.sent_count == 0:
            weight *= 1.45

        if state.native_balance_wei <= state.reserve_wei * 2:
            weight *= 0.6

        return weight

    def _choose_receiver(self, sender: WalletState, states: list[WalletState]) -> WalletState | None:
        candidates = [state for state in states if state.account.address != sender.account.address]
        if not candidates:
            return None

        sorted_balances = sorted(state.native_balance_wei for state in candidates)
        median_balance = sorted_balances[len(sorted_balances) // 2]

        weights: list[float] = []
        for candidate in candidates:
            weight = 1.0
            if candidate.total_activity == 0:
                weight *= 3.0
            elif candidate.received_count == 0:
                weight *= 1.5

            if candidate.native_balance_wei < median_balance:
                weight *= 1.2

            if candidate.native_balance_wei <= candidate.reserve_wei:
                weight *= 1.4

            weights.append(weight)

        return self.rng.choices(candidates, weights=weights, k=1)[0]

    def _plan_native_transfer(
        self,
        sender: WalletState,
        states: list[WalletState],
        native_fee_headroom_wei: int,
        sender_weight: float,
    ) -> PlannedAction | None:
        spendable = sender.spendable_native_wei(native_fee_headroom_wei)
        if spendable <= self.min_transfer_wei:
            return None

        receiver = self._choose_receiver(sender, states)
        if receiver is None:
            return None

        share = 0.03 + (self.rng.random() ** 1.8) * 0.27
        value_wei = min(spendable, max(self.min_transfer_wei, int(spendable * share)))
        if value_wei <= 0:
            return None

        weight = sender_weight * 0.78
        if receiver.total_activity == 0:
            weight *= 1.15

        return PlannedAction(
            kind="native_transfer",
            sender=sender,
            receiver=receiver,
            value_wei=value_wei,
            weight=weight,
            metadata={
                "gas_limit": 21_000,
                "estimated_fee_wei": native_fee_headroom_wei,
            },
        )

    def _plan_deposit(
        self,
        sender: WalletState,
        contract_fee_headroom_wei: int,
        sender_weight: float,
    ) -> PlannedAction | None:
        spendable = sender.spendable_native_wei(contract_fee_headroom_wei)
        if spendable <= self.min_protocol_value_wei:
            return None

        share = 0.02 + self.rng.random() * 0.05
        value_wei = min(spendable, max(self.min_protocol_value_wei, int(spendable * share)))
        if value_wei <= 0:
            return None

        ratio = self._get_collateral_ratio(sender.account.address)
        minted_wei = int((value_wei * 100) // max(ratio, 1))
        if minted_wei <= 0:
            return None

        weight = sender_weight * 0.14
        if sender.protocol_count == 0:
            weight *= 1.2

        return PlannedAction(
            kind="deposit_and_mint",
            sender=sender,
            receiver=None,
            value_wei=value_wei,
            weight=weight,
            metadata={
                "gas_limit": 250_000,
                "estimated_fee_wei": contract_fee_headroom_wei,
                "minted_wei": minted_wei,
                "collateral_ratio": ratio,
            },
        )

    def _plan_repay(
        self,
        sender: WalletState,
        contract_fee_headroom_wei: int,
        sender_weight: float,
    ) -> PlannedAction | None:
        if sender.debt_wei <= 0 or sender.etc_balance_wei <= 0:
            return None

        repayable_wei = min(
            sender.debt_wei,
            sender.etc_balance_wei,
            sender.spendable_native_wei(contract_fee_headroom_wei),
        )
        if repayable_wei <= self.min_protocol_value_wei:
            return None

        share = 0.18 + self.rng.random() * 0.34
        value_wei = min(repayable_wei, max(self.min_protocol_value_wei, int(repayable_wei * share)))
        if value_wei <= 0:
            return None

        weight = sender_weight * 0.08 * (2.0 if sender.debt_wei > 0 else 1.0)
        return PlannedAction(
            kind="repay",
            sender=sender,
            receiver=None,
            value_wei=value_wei,
            weight=weight,
            metadata={
                "gas_limit": 250_000,
                "estimated_fee_wei": contract_fee_headroom_wei,
            },
        )

    def _get_collateral_ratio(self, address: str) -> int:
        if address not in self.collateral_ratio_cache:
            if not self.protocol:
                raise RuntimeError("Protocol contracts are unavailable.")
            self.collateral_ratio_cache[address] = get_collateral_ratio(self.protocol, address)
        return self.collateral_ratio_cache[address]

    def _execute_action(
        self,
        action: PlannedAction,
        sequence: int,
        dry_run: bool,
    ) -> dict[str, Any]:
        if action.kind == "native_transfer":
            return self._execute_native_transfer(action, sequence, dry_run)
        if action.kind == "deposit_and_mint":
            return self._execute_deposit(action, sequence, dry_run)
        if action.kind == "repay":
            return self._execute_repay(action, sequence, dry_run)
        raise RuntimeError(f"Unsupported action kind: {action.kind}")

    def _execute_native_transfer(
        self,
        action: PlannedAction,
        sequence: int,
        dry_run: bool,
    ) -> dict[str, Any]:
        receiver = action.receiver
        if receiver is None:
            raise RuntimeError("Native transfer action requires a receiver.")

        tx_hash, gas_fee_wei = self._submit_or_stub(
            action=action,
            dry_run=dry_run,
            submitter=lambda: send_native_transfer(
                self.web3,
                private_key=action.sender.account.private_key,
                chain_id=self.chain_id,
                to_address=receiver.account.address,
                value_wei=action.value_wei,
                timeout=self.receipt_timeout,
            ),
        )

        action.sender.native_balance_wei -= action.value_wei + gas_fee_wei
        receiver.native_balance_wei += action.value_wei
        action.sender.sent_count += 1
        receiver.received_count += 1
        action.sender.total_sent_wei += action.value_wei
        receiver.total_received_wei += action.value_wei

        return {
            "index": sequence,
            "kind": action.kind,
            "tx_hash": tx_hash,
            "from": action.sender.account.address,
            "to": receiver.account.address,
            "value_wei": str(action.value_wei),
            "value_eth": _eth_from_wei(action.value_wei),
            "gas_fee_wei": str(gas_fee_wei),
            "gas_fee_eth": _eth_from_wei(gas_fee_wei),
        }

    def _execute_deposit(
        self,
        action: PlannedAction,
        sequence: int,
        dry_run: bool,
    ) -> dict[str, Any]:
        if not self.protocol:
            raise RuntimeError("Protocol actions require a configured CDP contract.")

        tx_hash, gas_fee_wei = self._submit_or_stub(
            action=action,
            dry_run=dry_run,
            submitter=lambda: send_contract_call(
                self.web3,
                private_key=action.sender.account.private_key,
                chain_id=self.chain_id,
                function_call=self.protocol.cdp.functions.depositAndMint(),
                value_wei=action.value_wei,
                timeout=self.receipt_timeout,
            ),
        )

        minted_wei = int(action.metadata["minted_wei"])
        action.sender.native_balance_wei -= action.value_wei + gas_fee_wei
        action.sender.collateral_wei += action.value_wei
        action.sender.debt_wei += minted_wei
        action.sender.etc_balance_wei += minted_wei
        action.sender.sent_count += 1
        action.sender.protocol_count += 1

        return {
            "index": sequence,
            "kind": action.kind,
            "tx_hash": tx_hash,
            "from": action.sender.account.address,
            "to": self.protocol.cdp_address,
            "value_wei": str(action.value_wei),
            "value_eth": _eth_from_wei(action.value_wei),
            "gas_fee_wei": str(gas_fee_wei),
            "gas_fee_eth": _eth_from_wei(gas_fee_wei),
            "minted_wei": str(minted_wei),
            "minted_eth": _eth_from_wei(minted_wei),
            "collateral_ratio": int(action.metadata["collateral_ratio"]),
        }

    def _execute_repay(
        self,
        action: PlannedAction,
        sequence: int,
        dry_run: bool,
    ) -> dict[str, Any]:
        if not self.protocol:
            raise RuntimeError("Protocol actions require a configured CDP contract.")

        tx_hash, gas_fee_wei = self._submit_or_stub(
            action=action,
            dry_run=dry_run,
            submitter=lambda: send_contract_call(
                self.web3,
                private_key=action.sender.account.private_key,
                chain_id=self.chain_id,
                function_call=self.protocol.cdp.functions.repay(),
                value_wei=action.value_wei,
                timeout=self.receipt_timeout,
            ),
        )

        action.sender.native_balance_wei -= action.value_wei + gas_fee_wei
        action.sender.debt_wei = max(action.sender.debt_wei - action.value_wei, 0)
        action.sender.etc_balance_wei = max(action.sender.etc_balance_wei - action.value_wei, 0)
        action.sender.sent_count += 1
        action.sender.protocol_count += 1

        return {
            "index": sequence,
            "kind": action.kind,
            "tx_hash": tx_hash,
            "from": action.sender.account.address,
            "to": self.protocol.cdp_address,
            "value_wei": str(action.value_wei),
            "value_eth": _eth_from_wei(action.value_wei),
            "gas_fee_wei": str(gas_fee_wei),
            "gas_fee_eth": _eth_from_wei(gas_fee_wei),
        }

    def _submit_or_stub(
        self,
        action: PlannedAction,
        dry_run: bool,
        submitter: Any,
    ) -> tuple[str, int]:
        if dry_run:
            return f"dry-run-{action.kind}-{self.rng.randrange(10**8, 10**9)}", int(
                action.metadata["estimated_fee_wei"]
            )

        tx_hash, receipt = submitter()
        gas_used = int(receipt["gasUsed"])
        effective_gas_price = int(
            receipt.get("effectiveGasPrice")
            or receipt.get("gasPrice")
            or self.web3.eth.gas_price
        )
        gas_fee_wei = gas_used * effective_gas_price
        return tx_hash, gas_fee_wei

    def _write_summary(
        self,
        output_path: Path,
        transaction_target: int,
        records: list[dict[str, Any]],
        states: list[WalletState],
        dry_run: bool,
        duplicates_ignored: list[str],
        seed: int,
    ) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "seed": seed,
            "chain_id": self.chain_id,
            "dry_run": dry_run,
            "include_protocol_actions": self.include_protocol_actions,
            "requested_transactions": transaction_target,
            "completed_transactions": len(records),
            "duplicates_ignored": duplicates_ignored,
            "wallets": [
                {
                    "label": state.account.label,
                    "address": state.account.address,
                    "derivation_index": state.account.derivation_index,
                    "starting_native_balance_eth": _eth_from_wei(state.starting_native_balance_wei),
                    "ending_native_balance_eth": _eth_from_wei(state.native_balance_wei),
                    "reserve_eth": _eth_from_wei(state.reserve_wei),
                    "sent_count": state.sent_count,
                    "received_count": state.received_count,
                    "protocol_count": state.protocol_count,
                    "total_sent_eth": _eth_from_wei(state.total_sent_wei),
                    "total_received_eth": _eth_from_wei(state.total_received_wei),
                    "etc_balance_eth": _eth_from_wei(state.etc_balance_wei),
                    "debt_eth": _eth_from_wei(state.debt_wei),
                    "collateral_eth": _eth_from_wei(state.collateral_wei),
                }
                for state in states
            ],
            "transactions": records,
        }
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Broadcast a randomized wallet-to-wallet economy for dataset generation."
    )
    parser.add_argument("--wallets-file", type=Path, default=DEFAULT_WALLETS_FILE)
    parser.add_argument("--wallet-manifest", type=Path, default=default_wallet_manifest())
    parser.add_argument("--mnemonic", default=default_mnemonic())
    parser.add_argument("--account-count", type=int, default=0)
    parser.add_argument("--account-offset", type=int, default=0)
    parser.add_argument("--rpc-url", default=default_rpc_url())
    parser.add_argument("--chain-id", type=int, default=default_chain_id())
    parser.add_argument("--cdp-address", default=default_cdp_address())
    parser.add_argument("--count", type=int)
    parser.add_argument("--min-count", type=int, default=480)
    parser.add_argument("--max-count", type=int, default=520)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--min-native-reserve-eth", default="0.003")
    parser.add_argument("--reserve-fraction", type=float, default=0.12)
    parser.add_argument("--delay-seconds", type=float, default=0.15)
    parser.add_argument("--receipt-timeout", type=int, default=180)
    parser.add_argument("--include-protocol-actions", action="store_true")
    parser.add_argument("--allow-mainnet", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--output", type=Path, default=next_run_output_path())
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.min_count <= 0 or args.max_count <= 0:
        raise SystemExit("Transaction count bounds must be positive integers.")
    if args.min_count > args.max_count:
        raise SystemExit("--min-count cannot be greater than --max-count.")
    if args.count is not None and args.count <= 0:
        raise SystemExit("--count must be a positive integer.")
    if args.reserve_fraction < 0 or args.reserve_fraction >= 1:
        raise SystemExit("--reserve-fraction must be between 0 and 1.")
    if args.chain_id == 1 and not args.allow_mainnet:
        raise SystemExit("Mainnet broadcasting is blocked by default. Use --allow-mainnet to override.")

    wallet_addresses, duplicates_ignored = load_wallet_addresses(args.wallets_file)
    wallet_addresses = _checksum_addresses(wallet_addresses)
    if duplicates_ignored:
        log.warning(
            "Ignored %d duplicate wallet entries from %s.",
            len(duplicates_ignored),
            args.wallets_file,
        )

    accounts = resolve_accounts(
        wallet_manifest=args.wallet_manifest,
        mnemonic=args.mnemonic,
        wallet_addresses=wallet_addresses,
        account_count=args.account_count,
        account_offset=args.account_offset,
    )
    if not accounts:
        raise SystemExit("No wallets were resolved for the economy simulation.")

    seed = args.seed if args.seed is not None else random.SystemRandom().randrange(1, 2**31)
    rng = random.Random(seed)
    transaction_target = args.count if args.count is not None else rng.randint(args.min_count, args.max_count)
    min_reserve_wei = _parse_eth_amount(str(args.min_native_reserve_eth))

    web3 = build_web3(args.rpc_url, args.chain_id)

    protocol = None
    if args.include_protocol_actions:
        if not args.cdp_address:
            raise SystemExit(
                "--include-protocol-actions requires a CDP address via --cdp-address or frontend/.env."
            )
        protocol = load_protocol_contracts(web3, args.cdp_address)

    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = args.output.expanduser()

    log.info("Resolved %d wallets for the simulation.", len(accounts))
    log.info("Using RNG seed %d for this run.", seed)
    log.info("Targeting %d transactions on chain %d.", transaction_target, args.chain_id)
    if args.dry_run:
        log.info("Dry-run mode enabled: transactions will be planned but not broadcast.")

    simulator = EconomySimulator(
        web3=web3,
        chain_id=args.chain_id,
        accounts=accounts,
        min_reserve_wei=min_reserve_wei,
        reserve_fraction=args.reserve_fraction,
        rng=rng,
        receipt_timeout=args.receipt_timeout,
        delay_seconds=args.delay_seconds,
        include_protocol_actions=args.include_protocol_actions,
        protocol=protocol,
    )

    result_path = simulator.run(
        transaction_target=transaction_target,
        output_path=output_path,
        dry_run=args.dry_run,
        duplicates_ignored=duplicates_ignored,
        seed=seed,
    )
    print(result_path)


if __name__ == "__main__":
    main()
