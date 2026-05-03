import { useState, useEffect, useCallback, useRef } from "react";
import LandingPage from "./components/LandingPage";
import Layout from "./components/Layout";
import DashboardPage from "./components/DashboardPage";
import BorrowPage from "./components/BorrowPage";
import CreditProfilePage from "./components/CreditProfilePage";
import HistoryPage from "./components/HistoryPage";
import { connectWallet, getEthBalance, getEthPrice } from "./utils/connect";
import { fetchPosition, fetchCreditScore, fetchEtcBalance, getEtcTokenAddress } from "./utils/contracts";
import { requestScoreUpdate } from "./utils/scorer";

export default function App() {
  const [signer, setSigner]       = useState(null);
  const [address, setAddress]     = useState("");
  const [page, setPage]           = useState("dashboard");
  const [ethBalance, setEthBalance] = useState("0.0000");
  const [ethPrice, setEthPrice]   = useState(2500);
  const [position, setPosition]   = useState({ collateral: 0, debt: 0 });
  const [creditScore, setCreditScore] = useState(0);
  const [loading, setLoading]     = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [etcBalance, setEtcBalance] = useState(0);
  const [etcTokenAddress, setEtcTokenAddress] = useState(null);
  const watchAssetDone = useRef(false);

  const handleConnect = useCallback(async () => {
    setLoading(true);
    const res = await connectWallet();
    if (!res) { setLoading(false); return; }
    const addr = await res.signer.getAddress();
    setSigner(res.signer);
    setAddress(addr);
    setLoading(false);
  }, []);

  // Auto-connect if already connected
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then(async (accounts) => {
        if (accounts.length > 0) {
          const res = await connectWallet();
          if (res) {
            const addr = await res.signer.getAddress();
            setSigner(res.signer);
            setAddress(addr);
          }
        }
      });

      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
          setSigner(null);
          setAddress("");
        } else {
          handleConnect();
        }
      });
    }
  }, [handleConnect]);

  // Fetch on-chain data when connected
  useEffect(() => {
    if (!signer || !address) return;

    async function load() {
      const [bal, price, pos, score, etcBal, etcAddr] = await Promise.all([
        getEthBalance(address),
        getEthPrice(),
        fetchPosition(signer, address),
        fetchCreditScore(signer, address),
        fetchEtcBalance(signer, address),
        getEtcTokenAddress(signer),
      ]);
      setEthBalance(bal);
      setEthPrice(price);
      setPosition(pos);
      setCreditScore(score);
      setEtcBalance(etcBal);
      if (etcAddr) setEtcTokenAddress(etcAddr);
    }

    load();
  }, [signer, address, refreshKey]);

  // Prompt MetaMask to show the ETC token (once per session)
  useEffect(() => {
    if (!etcTokenAddress || watchAssetDone.current) return;
    watchAssetDone.current = true;
    try {
      window.ethereum?.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: etcTokenAddress,
            symbol: "ETC",
            decimals: 18,
          },
        },
      });
    } catch { /* user may reject — that's fine */ }
  }, [etcTokenAddress]);

  const refresh = () => setRefreshKey(k => k + 1);
  const syncCreditScore = useCallback(async (walletAddress) => {
    const target = walletAddress || address;
    if (!target) {
      throw new Error("Wallet address is unavailable.");
    }

    const result = await requestScoreUpdate(target);
    setRefreshKey((key) => key + 1);
    return result;
  }, [address]);

  if (!signer) {
    return <LandingPage onConnect={handleConnect} loading={loading} />;
  }

  const pageProps = {
    signer,
    address,
    ethBalance,
    ethPrice,
    position,
    creditScore,
    refreshKey,
    refresh,
    syncCreditScore,
    etcBalance,
    etcTokenAddress,
  };

  return (
    <Layout page={page} setPage={setPage} address={address} creditScore={creditScore} onConnect={handleConnect} etcBalance={etcBalance} ethPrice={ethPrice}>
      {page === "dashboard" && <DashboardPage {...pageProps} />}
      {page === "borrow"    && <BorrowPage {...pageProps} />}
      {page === "credit"    && <CreditProfilePage {...pageProps} />}
      {page === "history"   && <HistoryPage {...pageProps} />}
    </Layout>
  );
}
