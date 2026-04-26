import { useState } from "react";
import { ethers } from "ethers";
import { getContracts } from "../utils/contracts";

export default function Deposit({ signer }) {
  const [amount, setAmount] = useState("");

  async function handleDeposit() {
    if (!signer) return;

    const { cdp } = getContracts(signer);

    const tx = await cdp.depositAndMint({
      value: ethers.parseEther(amount),
    });

    await tx.wait();
    alert("Deposit successful!");
  }

  return (
    <div>
      <input
        placeholder="ETH amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button onClick={handleDeposit}>Deposit & Mint</button>
    </div>
  );
}