import { ethers } from "ethers";
import CDP_ABI from "../abi/CDP.json";
import NFT_ABI from "../abi/CreditScoreNFT.json";
import { getTransactionHistory } from "./connect";

const CDP_ADDRESS = import.meta.env.VITE_CDP_ADDRESS;
const NFT_ADDRESS = import.meta.env.VITE_NFT_ADDRESS;

// Minimal ERC-20 ABI for balance reads
const ETC_ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

// Cache the ETC token address so we only look it up once
let _cachedEtcAddress = null;

export async function getEtcTokenAddress(signer) {
  if (_cachedEtcAddress) return _cachedEtcAddress;
  try {
    const { cdp } = getContracts(signer);
    const addr = await cdp.etc();
    _cachedEtcAddress = addr;
    return addr;
  } catch {
    return null;
  }
}

export async function fetchEtcBalance(signer, address) {
  try {
    const etcAddr = await getEtcTokenAddress(signer);
    if (!etcAddr) return 0;
    const etc = new ethers.Contract(etcAddr, ETC_ERC20_ABI, signer.provider || signer);
    const raw = await etc.balanceOf(address);
    return parseFloat(ethers.formatUnits(raw, 18));
  } catch {
    return 0;
  }
}

export function getContracts(signer) {
  if (!signer) {
    throw new Error("Wallet signer is required.");
  }

  const cdp = new ethers.Contract(CDP_ADDRESS, CDP_ABI, signer);
  const nftRunner = signer.provider || signer;
  const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, nftRunner);
  return { cdp, nft };
}

export async function fetchPosition(signer, address) {
  try {
    const { cdp } = getContracts(signer);
    const pos = await cdp.positions(address);
    return {
      collateral: parseFloat(ethers.formatEther(pos.collateral)),
      debt: parseFloat(ethers.formatUnits(pos.debt, 18)),
    };
  } catch {
    return { collateral: 0, debt: 0 };
  }
}

export async function fetchCreditScore(signer, address) {
  try {
    const { nft } = getContracts(signer);
    const score = await nft.getScore(address);
    return Number(score);
  } catch {
    return 0;
  }
}

export async function fetchCollateralRatio(signer, address) {
  try {
    const { cdp } = getContracts(signer);
    const ratio = await cdp.getCollateralRatio(address);
    return Number(ratio);
  } catch {
    return 0;
  }
}

export async function depositAndMint(signer, ethAmount) {
  const { cdp } = getContracts(signer);

  // Parse safely — trim to 18 decimal max and remove any trailing garbage
  const clean = parseFloat(ethAmount).toFixed(18);
  const value = ethers.parseEther(clean);

  // Estimate gas first so we surface a meaningful revert reason
  try {
    await cdp.depositAndMint.estimateGas({ value });
  } catch (err) {
    // Pull the revert reason out of the error
    const reason =
      err?.revert?.args?.[0] ||
      err?.reason ||
      err?.shortMessage ||
      err?.message ||
      "Contract reverted";
    throw new Error(reason);
  }

  const tx = await cdp.depositAndMint({ value });
  return tx.wait();
}

export async function repayDebt(signer) {
  const { cdp } = getContracts(signer);
  const pos = await cdp.positions(await signer.getAddress());
  if (pos.debt === 0n) {
    throw new Error("No debt to repay.");
  }

  // Contract converts ETH → ETC at rate: repayEtc = (ethSent * 233492) / 100
  // So to repay `debt` ETC we need:       ethSent  = (debt * 100) / 233492
  const ETC_PER_ETH = 233492n;
  const RATE_SCALE  = 100n;
  const ethValue = (pos.debt * RATE_SCALE) / ETC_PER_ETH;

  const tx = await cdp.repay({ value: ethValue });
  return tx.wait();
}

export async function fetchDebtActivity(signer, address) {
  if (!signer || !address) {
    return [];
  }

  try {
    const { cdp } = getContracts(signer);
    const provider = signer.provider;
    const historyTxs = await getTransactionHistory(address);

    if (historyTxs.length === 0) {
      return fetchDebtActivityFromLogs({ address, cdp, provider });
    }

    const normalizedActivity = await Promise.all(
      historyTxs.map(async (tx) => {
        const receiptEvent = await getDebtActivityEvent({
          address,
          contractInterface: cdp.interface,
          provider,
          txHash: tx.hash,
        });

        return normalizeDebtActivity(tx, receiptEvent, provider);
      })
    );

    return normalizedActivity.sort((a, b) => {
      if (b.timeStamp !== a.timeStamp) {
        return b.timeStamp - a.timeStamp;
      }
      return b.blockNumber - a.blockNumber;
    });
  } catch {
    return [];
  }
}

async function fetchDebtActivityFromLogs({ address, cdp, provider }) {
  if (!provider) {
    return [];
  }

  try {
    const currentBlock = await provider.getBlockNumber();
    const [borrowEvents, repayEvents] = await Promise.all([
      cdp.queryFilter(cdp.filters.LoanTaken(address), 0, currentBlock),
      cdp.queryFilter(cdp.filters.LoanRepaid(address), 0, currentBlock),
    ]);

    const blockCache = new Map();
    const normalizedBorrows = await Promise.all(
      borrowEvents.map((event) =>
        normalizeLogActivity({
          event,
          kind: "borrow",
          getBlockTimestamp: () => getBlockTimestamp(provider, blockCache, event.blockNumber),
          provider,
        })
      )
    );
    const normalizedRepayments = await Promise.all(
      repayEvents.map((event) =>
        normalizeLogActivity({
          event,
          kind: "repay",
          getBlockTimestamp: () => getBlockTimestamp(provider, blockCache, event.blockNumber),
          provider,
        })
      )
    );

    return [...normalizedBorrows, ...normalizedRepayments].sort((a, b) => {
      if (b.timeStamp !== a.timeStamp) {
        return b.timeStamp - a.timeStamp;
      }
      return b.blockNumber - a.blockNumber;
    });
  } catch {
    return [];
  }
}

async function getDebtActivityEvent({ address, contractInterface, provider, txHash }) {
  if (!provider || !txHash) {
    return null;
  }

  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return null;
    }

    const lowerAddress = address.toLowerCase();
    for (const log of receipt.logs) {
      try {
        const parsed = contractInterface.parseLog(log);
        if (!parsed || (parsed.name !== "LoanTaken" && parsed.name !== "LoanRepaid")) {
          continue;
        }

        if ((parsed.args?.user || "").toLowerCase() === lowerAddress) {
          return parsed;
        }
      } catch {
        // Ignore unrelated logs from the same receipt.
      }
    }

    return null;
  } catch {
    return null;
  }
}

function getBlockTimestamp(provider, cache, blockNumber) {
  if (!cache.has(blockNumber)) {
    cache.set(
      blockNumber,
      provider.getBlock(blockNumber).then((block) => Number(block?.timestamp || 0))
    );
  }

  return cache.get(blockNumber);
}

async function normalizeLogActivity({ event, kind, getBlockTimestamp, provider }) {
  const timeStamp = await getBlockTimestamp();
  const idSuffix = kind === "borrow" ? "borrow" : "repay";

  // Fetch receipt for gas data
  let gasCostEth = null;
  try {
    if (provider && event.transactionHash) {
      const receipt = await provider.getTransactionReceipt(event.transactionHash);
      if (receipt) {
        gasCostEth = parseFloat(ethers.formatEther(receipt.gasUsed * receipt.gasPrice));
      }
    }
  } catch { /* ignore */ }

  const base = {
    id: `${event.transactionHash}-${event.index ?? event.logIndex ?? 0}-${idSuffix}`,
    hash: event.transactionHash,
    blockNumber: Number(event.blockNumber || 0),
    timeStamp,
    status: "confirmed",
    gasCostEth,
    confirmations: null,
  };

  if (kind === "borrow") {
    return {
      ...base,
      type: "borrow",
      collateral: parseFloat(ethers.formatEther(event.args?.collateral ?? 0n)),
      amount: parseFloat(ethers.formatUnits(event.args?.debt ?? 0n, 18)),
    };
  }

  return {
    ...base,
    type: "repay",
    collateral: 0,
    amount: parseFloat(ethers.formatUnits(event.args?.amount ?? 0n, 18)),
  };
}

function normalizeDebtActivity(tx, receiptEvent, provider) {
  const fallbackType = decodeTxType(tx);
  const blockNumber = Number(tx.blockNumber || 0);
  const timeStamp = Number(tx.timeStamp || 0);
  const txValue = parseFloat(ethers.formatEther(tx.value || "0"));
  const status = tx.isError === "1" ? "failed" : "confirmed";

  // Gas cost from Etherscan tx data (gasUsed * gasPrice in ETH)
  const gasUsed = BigInt(tx.gasUsed || 0);
  const gasPrice = BigInt(tx.gasPrice || 0);
  const gasCostEth = gasUsed > 0n && gasPrice > 0n
    ? parseFloat(ethers.formatEther(gasUsed * gasPrice))
    : null;
  const confirmations = tx.confirmations ? Number(tx.confirmations) : null;

  const base = { blockNumber, timeStamp, status, gasCostEth, confirmations };

  if (receiptEvent?.name === "LoanTaken") {
    return {
      ...base,
      id: `${tx.hash || `${blockNumber}-${timeStamp}`}-borrow`,
      hash: tx.hash,
      type: "borrow",
      collateral: parseFloat(ethers.formatEther(receiptEvent.args?.collateral ?? 0n)),
      amount: parseFloat(ethers.formatUnits(receiptEvent.args?.debt ?? 0n, 18)),
    };
  }

  if (receiptEvent?.name === "LoanRepaid") {
    return {
      ...base,
      id: `${tx.hash || `${blockNumber}-${timeStamp}`}-repay`,
      hash: tx.hash,
      type: "repay",
      collateral: 0,
      amount: parseFloat(ethers.formatUnits(receiptEvent.args?.amount ?? 0n, 18)),
    };
  }

  return {
    ...base,
    id: `${tx.hash || `${blockNumber}-${timeStamp}`}-fallback`,
    hash: tx.hash,
    type: fallbackType === "Repay" ? "repay" : fallbackType === "Deposit & Mint" ? "borrow" : "transaction",
    collateral: fallbackType === "Deposit & Mint" ? txValue : 0,
    amount: fallbackType === "Repay" ? txValue : null,
  };
}

// Credit tier helpers
// Score range 0-100 — mirrors CDP.sol getCollateralRatio() breakpoints
export function getTier(score) {
  if (score >  85) return { label: "Diamond", level: 4 };
  if (score >  60) return { label: "Gold",    level: 3 };
  if (score >  30) return { label: "Silver",  level: 2 };
  if (score >   0) return { label: "Bronze",  level: 1 };
  return { label: "Unranked", level: 0 };
}

export function getCollateralRatioFromTier(score) {
  if (score >  85) return 80;
  if (score >  60) return 100;
  if (score >  30) return 120;
  return 150;
}

export function getHealthColor(hf) {
  if (hf >= 1.5) return "#10b981";
  if (hf >= 1.2) return "#f59e0b";
  return "#ef4444";
}

// Decode tx input to determine CDP action type
export function decodeTxType(tx) {
  const input = tx.input || tx.data || "";
  if (input.startsWith("0x")) {
    const sig = input.slice(0, 10);
    // repay() selector
    if (sig === "0x371fd8e6") return "Repay";
    // depositAndMint() selector
    if (sig === "0x85f2aef2" || tx.value !== "0") return "Deposit & Mint";
  }
  return "Transaction";
}
