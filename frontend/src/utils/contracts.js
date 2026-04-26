import { ethers } from "ethers";
import CDP_ABI from "../abi/CDP.json";
import NFT_ABI from "../abi/CreditScoreNFT.json";

const CDP_ADDRESS = import.meta.env.VITE_CDP_ADDRESS;
const NFT_ADDRESS = import.meta.env.VITE_NFT_ADDRESS;

export function getContracts(signer) {
  const cdp = new ethers.Contract(CDP_ADDRESS, CDP_ABI, signer);
  const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
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
  const tx = await cdp.repay();
  return tx.wait();
}

// Credit tier helpers
export function getTier(score) {
  if (score >= 800) return { label: "Diamond", level: 4 };
  if (score >= 600) return { label: "Gold",    level: 3 };
  if (score >= 400) return { label: "Silver",  level: 2 };
  if (score >= 200) return { label: "Bronze",  level: 1 };
  return { label: "Unranked", level: 0 };
}

export function getCollateralRatioFromTier(score) {
  if (score >= 800) return 100;
  if (score >= 600) return 110;
  if (score >= 400) return 120;
  if (score >= 200) return 130;
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
    // depositAndMint() selector
    if (sig === "0x85f2aef2" || tx.value !== "0") return "Deposit & Mint";
    // repay() selector
    if (sig === "0x371fd8e6") return "Repay";
  }
  return "Transaction";
}