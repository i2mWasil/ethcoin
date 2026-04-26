import { useState } from "react";
import { connectWallet } from "../utils/connect";

export default function Wallet({ setSigner, setAddress }) {
  const [connected, setConnected] = useState(false);

  async function handleConnect() {
    const res = await connectWallet();
    if (!res) return;

    const addr = await res.signer.getAddress();

    setSigner(res.signer);
    setAddress(addr);
    setConnected(true);
  }

  return (
    <div>
      <button onClick={handleConnect}>
        {connected ? "Connected" : "Connect Wallet"}
      </button>
    </div>
  );
}