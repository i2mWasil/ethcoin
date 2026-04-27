from __future__ import annotations

import argparse
import logging

logging.basicConfig(level="INFO", format="%(levelname)s | %(message)s")
log = logging.getLogger("manual_update")


def main():
    parser = argparse.ArgumentParser(description="Manually set an on-chain credit score.")
    parser.add_argument("--wallet", required=True, help="Target wallet address")
    parser.add_argument("--score",  required=True, type=int,
                        help="Score to write (0-100)")
    parser.add_argument("--read-after", action="store_true",
                        help="Read the on-chain score after submitting")
    args = parser.parse_args()

    if not (0 <= args.score <= 100):
        parser.error("Score must be in range [0, 100]")

    from server.model.chain import read_score, submit_score

    log.info("Submitting score %d for wallet %s ...", args.score, args.wallet)
    tx_hash = submit_score(args.wallet, args.score)
    print("\nSuccess!")
    print(f"  Wallet : {args.wallet}")
    print(f"  Score  : {args.score}")
    print(f"  Tx hash: {tx_hash}")
    print(f"  Explorer: https://sepolia.etherscan.io/tx/{tx_hash}")

    if args.read_after:
        on_chain = read_score(args.wallet)
        print(f"\nVerification — on-chain score is now: {on_chain}")


if __name__ == "__main__":
    main()
