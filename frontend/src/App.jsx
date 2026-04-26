import { useState } from "react";
import Wallet from "./components/Wallet";
import Dashboard from "./components/Dashboard";
import Deposit from "./components/Deposit";

function App() {
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState("");

  return (
    <div style={{ padding: "20px" }}>
      <h1>Hybrid CDP Protocol</h1>

      <Wallet setSigner={setSigner} setAddress={setAddress} />

      {signer && (
        <>
          <Dashboard signer={signer} address={address} />
          <Deposit signer={signer} />
        </>
      )}
    </div>
  );
}

export default App;