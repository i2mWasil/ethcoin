import { ethers } from "ethers";

export async function connectWallet() {
  if (!window.ethereum) {
    alert("Please install MetaMask to use EthCoin Protocol.");
    return null;
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);

    // Request switch to Sepolia
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // Sepolia
      });
    } catch (switchErr) {
      // If chain not added, add it
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xaa36a7",
            chainName: "Sepolia Testnet",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [import.meta.env.VITE_QUICKNODE_RPC || "https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
      }
    }

    const signer = await provider.getSigner();
    return { provider, signer };
  } catch (err) {
    console.error("Wallet connection failed:", err);
    return null;
  }
}

export async function getEthBalance(address) {
  try {
    const apiKey = import.meta.env.VITE_ETHERSCAN_API_KEY;
    const res = await fetch(
      `https://api-sepolia.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`
    );
    const data = await res.json();
    if (data.status === "1") {
      return parseFloat(ethers.formatEther(data.result)).toFixed(4);
    }
    return "0.0000";
  } catch {
    return "0.0000";
  }
}

export async function getTransactionHistory(address) {
  try {
    const apiKey = import.meta.env.VITE_ETHERSCAN_API_KEY;
    const cdpAddress = import.meta.env.VITE_CDP_ADDRESS;
    const res = await fetch(
      `https://api-sepolia.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`
    );
    const data = await res.json();
    if (data.status === "1") {
      // Filter txs related to CDP contract if available
      const txs = data.result || [];
      return cdpAddress
        ? txs.filter(tx => tx.to?.toLowerCase() === cdpAddress.toLowerCase())
        : txs.slice(0, 20);
    }
    return [];
  } catch {
    return [];
  }
}

export async function getEthPrice() {
  try {
    const apiKey = import.meta.env.VITE_ETHERSCAN_API_KEY;
    const res = await fetch(
      `https://api-sepolia.etherscan.io/api?module=stats&action=ethprice&apikey=${apiKey}`
    );
    const data = await res.json();
    if (data.status === "1") {
      return parseFloat(data.result.ethusd);
    }
    return 2500;
  } catch {
    return 2500;
  }
}
