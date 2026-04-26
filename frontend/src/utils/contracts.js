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