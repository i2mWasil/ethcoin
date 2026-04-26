import { useEffect, useState } from "react";
import { getContracts } from "../utils/contracts";

export default function Dashboard({ signer, address }) {
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!signer) return;

    async function loadData() {
      const { nft } = getContracts(signer);
      const s = await nft.getScore(address);
      setScore(Number(s));
    }

    loadData();
  }, [signer, address]);

  return (
    <div>
      <h3>Wallet: {address}</h3>
      <h2>Credit Score: {score}</h2>
    </div>
  );
}