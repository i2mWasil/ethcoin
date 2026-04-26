import { ethers } from "ethers";

export async function connectWallet() {
  if (!window.ethereum) {
    alert("Install MetaMask");
    return null;
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();

  return { provider, signer };
}