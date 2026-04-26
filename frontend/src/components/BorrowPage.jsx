import { useState, useMemo } from "react";
import { ethers } from "ethers";
import { depositAndMint, getTier, getCollateralRatioFromTier } from "../utils/contracts";

export default function BorrowPage({ signer, ethBalance, ethPrice, creditScore, position, refresh }) {
  const [ethAmount, setEthAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  const tier = getTier(creditScore);
  const requiredRatio = getCollateralRatioFromTier(creditScore);
  const normalRatio = 150;

  const ethVal = parseFloat(ethAmount) || 0;
  const usxOut = ethVal > 0 ? (ethVal * ethPrice * (100 / requiredRatio)).toFixed(2) : "0.00";
  const liquidationPrice = ethVal > 0 ? (ethPrice * 0.86).toFixed(2) : "0.00";
  const borrowAPR = creditScore >= 800 ? 2.0 : creditScore >= 600 ? 2.2 : creditScore >= 400 ? 2.5 : 3.0;

  const setPercent = (pct) => {
    const max = parseFloat(ethBalance) || 0;
    setEthAmount((max * pct).toFixed(4));
  };

  const handleMint = async () => {
    if (!ethVal || ethVal <= 0) { setError("Enter a valid ETH amount."); return; }
    setError(null);
    setLoading(true);
    try {
      // Get fresh balance directly from the provider (not Etherscan cache)
      const provider = signer.provider;
      const address  = await signer.getAddress();
      const rawBal   = await provider.getBalance(address);
      const bal      = parseFloat(ethers.formatEther(rawBal));

      if (ethVal >= bal) {
        // Leave a small buffer for gas
        setError(`Insufficient ETH. Your current balance is ${bal.toFixed(4)} ETH — remember to leave some for gas.`);
        setLoading(false);
        return;
      }

      const receipt = await depositAndMint(signer, ethVal);
      setTxHash(receipt.hash || receipt.transactionHash);
      setEthAmount("");
      refresh();
    } catch (err) {
      // Show the actual revert reason, not a generic message
      const msg =
        err?.revert?.args?.[0] ||
        err?.reason ||
        err?.shortMessage ||
        err?.message ||
        "Transaction failed.";
      setError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
    } finally {
      setLoading(false);
    }
  };

  // Slider position for collateral ratio
  const sliderPct = useMemo(() => {
    const min = 80, max = 160;
    return ((requiredRatio - min) / (max - min)) * 100;
  }, [requiredRatio]);

  return (
    <div style={{ animation: "fadeInUp 0.35s ease forwards", maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{
          fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px",
        }}>Borrow / Mint</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "38px", fontWeight: 800,
          letterSpacing: "-1.5px", marginBottom: "8px",
        }}>Mint ETC</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "500px" }}>
          Deposit ETH collateral to mint EthCoin (ETC). Your required collateral ratio is determined
          by your on-chain credit score.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
        {/* Left — deposit form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Deposit input */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{
              fontSize: "10px", color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "1.5px",
              fontFamily: "var(--font-mono)", marginBottom: "12px",
              display: "flex", justifyContent: "space-between",
            }}>
              <span>Deposit Collateral</span>
              <span>Balance: {ethBalance} ETH</span>
            </div>
            <div style={{
              background: "var(--bg-deep)",
              border: "1px solid var(--bg-border)",
              borderRadius: "12px",
              padding: "14px 16px",
              display: "flex", alignItems: "center", gap: "12px",
            }}>
              <div style={{
                width: "32px", height: "32px",
                background: "linear-gradient(135deg, #3730a3, #6366f1)",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px", flexShrink: 0,
              }}>Ξ</div>
              <div style={{ fontSize: "14px", fontWeight: 600, flexShrink: 0, width: "36px" }}>ETH</div>
              <input
                type="number"
                placeholder="0.00"
                value={ethAmount}
                onChange={e => { setEthAmount(e.target.value); setError(null); setTxHash(null); }}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "22px",
                  textAlign: "right",
                  fontWeight: 500,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              {[0.25, 0.5, 1].map(p => (
                <button key={p} onClick={() => setPercent(p)} style={{
                  background: "var(--bg-deep)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: "6px",
                  padding: "5px 10px",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#7c3aed"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--bg-border)"}
                >
                  {p === 1 ? "MAX" : `${p * 100}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{
              width: "36px", height: "36px",
              background: "var(--bg-card)",
              border: "1px solid var(--bg-border)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px",
            }}>↓</div>
          </div>

          {/* ETC output */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{
              fontSize: "10px", color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "1.5px",
              fontFamily: "var(--font-mono)", marginBottom: "12px",
            }}>Mint ETC</div>
            <div style={{
              background: "var(--bg-deep)",
              border: "1px solid var(--bg-border)",
              borderRadius: "12px",
              padding: "14px 16px",
              display: "flex", alignItems: "center", gap: "12px",
            }}>
              <div style={{
                width: "32px", height: "32px",
                background: "linear-gradient(135deg, #5b21b6, #7c3aed)",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "14px", flexShrink: 0,
              }}>$</div>
              <div style={{ fontSize: "14px", fontWeight: 600, flexShrink: 0, width: "36px" }}>ETC</div>
              <div style={{
                flex: 1, textAlign: "right",
                fontFamily: "var(--font-mono)", fontSize: "22px", fontWeight: 500,
                color: parseFloat(usxOut) > 0 ? "var(--text-primary)" : "var(--text-muted)",
              }}>
                {parseFloat(usxOut) > 0 ? parseFloat(usxOut).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
            </div>
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{
              padding: "12px 16px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "10px",
              fontSize: "13px",
              color: "#ef4444",
              fontFamily: "var(--font-mono)",
            }}>{error}</div>
          )}

          {txHash && (
            <div style={{
              padding: "12px 16px",
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: "10px",
              fontSize: "12px",
              color: "#10b981",
              fontFamily: "var(--font-mono)",
            }}>
              ✓ Minted! Tx:{" "}
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#10b981", textDecoration: "underline" }}
              >
                {txHash.slice(0, 20)}...
              </a>
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleMint}
            disabled={loading || !ethAmount}
            style={{
              background: loading || !ethAmount
                ? "rgba(124,58,237,0.3)"
                : "linear-gradient(135deg, #7c3aed, #4f46e5)",
              border: "none",
              borderRadius: "14px",
              padding: "16px",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontSize: "16px",
              fontWeight: 700,
              cursor: loading || !ethAmount ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              boxShadow: loading || !ethAmount ? "none" : "0 4px 24px rgba(124,58,237,0.4)",
              transition: "all 0.2s ease",
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: "18px", height: "18px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTop: "2px solid #fff",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  display: "inline-block",
                }} />
                Minting...
              </>
            ) : "Confirm Mint"}
          </button>
        </div>

        {/* Right — credit advantage + tx overview */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Credit Advantage */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: "16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>✦</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700 }}>
                  Credit Advantage
                </span>
              </div>
              <div style={{
                padding: "4px 10px",
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.25)",
                borderRadius: "20px",
                fontSize: "11px",
                color: "#10b981",
                fontFamily: "var(--font-mono)",
                display: "flex", alignItems: "center", gap: "6px",
              }}>
                <span style={{ width: "6px", height: "6px", background: "#10b981", borderRadius: "50%", display: "inline-block" }} />
                {tier.label.toUpperCase()} (SCORE: {creditScore})
              </div>
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                Your Collateral Ratio
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "36px", fontWeight: 500 }}>
                  {requiredRatio}%
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  Normally {normalRatio}%
                </span>
              </div>
            </div>

            {/* Ratio slider */}
            <div style={{ position: "relative", marginTop: "16px" }}>
              <div style={{
                height: "6px",
                background: "var(--bg-deep)",
                borderRadius: "3px",
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute",
                  left: 0,
                  width: `${100 - sliderPct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #10b981, #7c3aed)",
                  borderRadius: "3px",
                }} />
              </div>
              {/* Thumb */}
              <div style={{
                position: "absolute",
                left: `${100 - sliderPct}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "14px", height: "14px",
                background: "#7c3aed",
                borderRadius: "50%",
                border: "2px solid #fff",
                boxShadow: "0 0 8px rgba(124,58,237,0.6)",
              }} />
              <div style={{
                display: "flex", justifyContent: "space-between",
                marginTop: "8px", fontSize: "10px",
                color: "var(--text-muted)", fontFamily: "var(--font-mono)",
              }}>
                {["150%", "120%", "100%", "80%"].map(l => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Transaction Overview */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{
              fontSize: "10px", color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "1.5px",
              fontFamily: "var(--font-mono)", marginBottom: "16px",
            }}>Transaction Overview</div>

            {[
              { label: "Oracle Price (ETH)",  value: `$${ethPrice.toLocaleString("en-US")}` },
              { label: "Liquidation Price",   value: `$${parseFloat(liquidationPrice).toLocaleString("en-US")}`, red: true },
              { label: "Borrow APR",          value: `${borrowAPR}%` },
              { label: "Network Fee",         value: "~0.002 ETH" },
            ].map(row => (
              <div key={row.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid rgba(30,45,69,0.5)",
              }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{row.label}</span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: "13px",
                  color: row.red ? "#f87171" : "var(--text-primary)",
                  fontWeight: 500,
                }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
