import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getTransactionHistory } from "../utils/connect";
import { repayDebt } from "../utils/contracts";

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(parseInt(ts) * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function shortHash(hash) {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

function getDeterministicScoreImpact(tx) {
  const seed = tx.hash || `${tx.timeStamp || ""}${tx.value || ""}`;
  let total = 0;
  for (let index = 0; index < seed.length; index += 1) {
    total += seed.charCodeAt(index);
  }
  return 5 + (total % 20);
}

export default function HistoryPage({ signer, address, position, creditScore, ethPrice, refresh, syncCreditScore }) {
  const [historyState, setHistoryState] = useState({ address: "", txs: [] });
  const [repaying, setRepaying] = useState(false);
  const [repayHash, setRepayHash] = useState(null);
  const [repayError, setRepayError] = useState(null);
  const [scoreSyncing, setScoreSyncing] = useState(false);
  const [scoreSyncError, setScoreSyncError] = useState(null);
  const [scoreSyncTxHash, setScoreSyncTxHash] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 5;
  const txs = historyState.address === address ? historyState.txs : [];
  const loadingTxs = Boolean(address) && historyState.address !== address;

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    getTransactionHistory(address).then(data => {
      if (!cancelled) {
        setHistoryState({ address, txs: data });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const totalRepaid = txs
    .filter(tx => tx.value && tx.value !== "0" && tx.isError === "0")
    .reduce((acc, tx) => acc + parseFloat(ethers.formatEther(tx.value || "0")), 0);

  const activeObligations = position.debt || 0;
  const netScoreImpact = Math.min(txs.filter(tx => tx.isError === "0").length * 3, 42);

  const displayedTxs = txs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(txs.length / PAGE_SIZE);

  const handleRepay = async () => {
    setRepayError(null);
    setRepaying(true);
    try {
      const receipt = await repayDebt(signer);
      setRepayHash(receipt.hash || receipt.transactionHash);
      setScoreSyncError(null);
      setScoreSyncTxHash(null);
      refresh();

      if (syncCreditScore && address) {
        setScoreSyncing(true);
        try {
          const result = await syncCreditScore(address);
          setScoreSyncTxHash(result.tx_hash || null);
        } catch (syncErr) {
          setScoreSyncError(syncErr?.message || "Repay succeeded, but score sync failed.");
        } finally {
          setScoreSyncing(false);
        }
      }
    } catch (err) {
      setRepayError(err.reason || err.message || "Repay failed.");
    } finally {
      setRepaying(false);
    }
  };

  return (
    <div style={{ animation: "fadeInUp 0.35s ease forwards", maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{
          fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px",
        }}>Ledger</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "38px", fontWeight: 800,
          letterSpacing: "-1.5px", marginBottom: "8px",
        }}>History & Repay</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "520px" }}>
          Manage your active credit lines, review past settlements, and track how your
          borrowing behavior impacts your ETC Credit Score.
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        {[
          {
            icon: "◎",
            label: "Active Obligations",
            value: `${activeObligations.toLocaleString("en-US", { minimumFractionDigits: 2 })} ETC`,
            sub: `Across ${position.collateral > 0 ? "1" : "0"} open position${position.collateral > 0 ? "" : "s"}`,
          },
          {
            icon: "✓",
            label: "Total Repaid",
            value: `${(totalRepaid * ethPrice).toLocaleString("en-US", { maximumFractionDigits: 2 })} ETC`,
            sub: "Lifetime settlement volume",
          },
          {
            icon: "↑",
            label: "Net Score Impact",
            value: `+${netScoreImpact} Points`,
            sub: "Cumulative behavioral bonus",
            accent: "#10b981",
          },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "20px" }}>
            <div style={{
              fontSize: "10px", color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "1.5px",
              fontFamily: "var(--font-mono)", marginBottom: "10px",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <span>{s.icon}</span> {s.label}
            </div>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: "22px", fontWeight: 500,
              color: s.accent || "var(--text-primary)",
              letterSpacing: "-0.5px", marginBottom: "4px",
            }}>{s.value}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Repay button if active debt */}
      {position.debt > 0 && (
        <div className="card" style={{ padding: "20px", marginBottom: "20px", borderColor: "rgba(124,58,237,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
                Active Debt: {position.debt.toFixed(2)} ETC
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Repay your debt to improve your credit score.
              </div>
            </div>
            <button
              onClick={handleRepay}
              disabled={repaying}
              style={{
                background: repaying ? "rgba(124,58,237,0.3)" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                border: "none",
                borderRadius: "10px",
                padding: "10px 24px",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                cursor: repaying ? "wait" : "pointer",
                display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              {repaying ? (
                <>
                  <span style={{
                    width: "14px", height: "14px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTop: "2px solid #fff",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    display: "inline-block",
                  }} />
                  Repaying...
                </>
              ) : "Repay All"}
            </button>
          </div>
          {repayError && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#ef4444", fontFamily: "var(--font-mono)" }}>
              {repayError}
            </div>
          )}
          {repayHash && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#10b981", fontFamily: "var(--font-mono)" }}>
              ✓ Repaid!{" "}
              <a
                href={`https://sepolia.etherscan.io/tx/${repayHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#10b981" }}
              >
                {shortHash(repayHash)}
              </a>
            </div>
          )}
          {scoreSyncing && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#60a5fa", fontFamily: "var(--font-mono)" }}>
              Syncing your refreshed credit score on-chain...
            </div>
          )}
          {scoreSyncError && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#f59e0b", fontFamily: "var(--font-mono)" }}>
              {scoreSyncError}
            </div>
          )}
          {scoreSyncTxHash && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#10b981", fontFamily: "var(--font-mono)" }}>
              Score updated:{" "}
              <a
                href={`https://sepolia.etherscan.io/tx/${scoreSyncTxHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#10b981" }}
              >
                {shortHash(scoreSyncTxHash)}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Transaction Ledger */}
      <div className="card" style={{ padding: "24px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>⊞</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700 }}>
              Transaction Ledger
            </span>
          </div>
          <div style={{
            width: "32px", height: "32px",
            background: "var(--bg-deep)",
            border: "1px solid var(--bg-border)",
            borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            fontSize: "14px",
          }}>⊟</div>
        </div>

        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.5fr 1fr 1.5fr 1fr",
          padding: "10px 16px",
          borderBottom: "1px solid var(--bg-border)",
        }}>
          {["Date & ID", "Amount", "Status", "Score Impact", "Action"].map(h => (
            <div key={h} style={{
              fontSize: "10px", color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "1px",
              fontFamily: "var(--font-mono)",
            }}>{h}</div>
          ))}
        </div>

        {loadingTxs ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ padding: "16px", borderBottom: "1px solid rgba(30,45,69,0.5)" }}>
              <div className="skeleton" style={{ height: "20px", width: "60%" }} />
            </div>
          ))
        ) : displayedTxs.length === 0 ? (
          <div style={{
            padding: "48px", textAlign: "center",
            color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "13px",
          }}>
            No transactions found on Sepolia for this address.
          </div>
        ) : (
          displayedTxs.map((tx, i) => {
            const isActive = i < 2 && tx.isError === "0";
            const isRepaid = !isActive && tx.isError === "0";
            const isError  = tx.isError === "1";
            const ethVal = parseFloat(ethers.formatEther(tx.value || "0")).toFixed(4);
            const usdVal = (parseFloat(ethVal) * ethPrice).toFixed(2);
            const scoreImpact = isRepaid ? getDeterministicScoreImpact(tx) : isError ? -5 : 0;

            return (
              <div key={tx.hash || i} style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.5fr 1fr 1.5fr 1fr",
                padding: "16px",
                borderBottom: "1px solid rgba(30,45,69,0.5)",
                alignItems: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(124,58,237,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Date & ID */}
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 500 }}>{formatDate(tx.timeStamp)}</div>
                  <div style={{
                    fontSize: "11px", color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)", marginTop: "2px",
                  }}>
                    {tx.hash ? `L-${tx.hash.slice(2, 8).toUpperCase()}` : `L-${i}`}
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 500 }}>
                    {parseFloat(usdVal).toLocaleString("en-US", { minimumFractionDigits: 2 })} ETC
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {ethVal} ETH
                  </div>
                </div>

                {/* Status */}
                <div>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    background: isError
                      ? "rgba(239,68,68,0.1)"
                      : isActive
                      ? "rgba(59,130,246,0.15)"
                      : "rgba(16,185,129,0.1)",
                    color: isError ? "#ef4444" : isActive ? "#60a5fa" : "#10b981",
                    border: `1px solid ${isError ? "rgba(239,68,68,0.2)" : isActive ? "rgba(59,130,246,0.2)" : "rgba(16,185,129,0.2)"}`,
                  }}>
                    {isError ? "⊗ Failed" : isActive ? "● Active" : "● Repaid"}
                  </span>
                </div>

                {/* Score Impact */}
                <div>
                  {isActive ? (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      ⊞ Pending
                    </span>
                  ) : (
                    <div>
                      <div style={{
                        fontFamily: "var(--font-mono)", fontSize: "13px",
                        color: scoreImpact > 0 ? "#10b981" : "#ef4444",
                        fontWeight: 600,
                      }}>
                        {scoreImpact > 0 ? `↑ +${scoreImpact} Points` : `↓ ${scoreImpact} Points`}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {scoreImpact > 0 ? "Timely Settlement" : "Late Settlement"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div>
                  {isActive ? (
                    <button
                      onClick={handleRepay}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--bg-border)",
                        borderRadius: "8px",
                        padding: "6px 14px",
                        color: "var(--text-primary)",
                        fontSize: "12px",
                        fontFamily: "var(--font-body)",
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "#7c3aed"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--bg-border)"}
                    >
                      Repay
                    </button>
                  ) : (
                    <a
                      href={tx.hash ? `https://sepolia.etherscan.io/tx/${tx.hash}` : "#"}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "12px",
                        textDecoration: "none",
                        fontFamily: "var(--font-body)",
                        display: "flex", alignItems: "center", gap: "4px",
                      }}
                    >
                      Receipt ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Pagination */}
        {txs.length > 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 16px 0",
            fontSize: "13px", color: "var(--text-muted)",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, txs.length)} of {txs.length} records
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  width: "32px", height: "32px",
                  background: "var(--bg-deep)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: "8px",
                  color: page === 0 ? "var(--text-muted)" : "var(--text-primary)",
                  cursor: page === 0 ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >‹</button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={{
                  width: "32px", height: "32px",
                  background: "var(--bg-deep)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: "8px",
                  color: page >= totalPages - 1 ? "var(--text-muted)" : "var(--text-primary)",
                  cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
