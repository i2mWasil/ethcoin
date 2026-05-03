import { useEffect, useMemo, useState } from "react";
import { fetchDebtActivity, getCollateralRatioFromTier, getTier, repayDebt } from "../utils/contracts";
import { formatEtcUsd, etcPegLabel, etcUsdLabel, ethToEtc } from "../utils/etcPrice"; 

const EMPTY_ACTIVITY = [];

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function shortHash(hash) {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

function formatAmount(value, digits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatTimeAgo(unixTs) {
  if (!unixTs) return "—";
  const seconds = Math.floor(Date.now() / 1000) - Number(unixTs);
  if (seconds < 60)    return `${seconds}s ago`;
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 2592000)}mo ago`;
}

function statusStyles(kind) {
  if (kind === "healthy") {
    return {
      background: "rgba(16,185,129,0.12)",
      border: "1px solid rgba(16,185,129,0.22)",
      color: "#10b981",
    };
  }

  if (kind === "watch") {
    return {
      background: "rgba(245,158,11,0.12)",
      border: "1px solid rgba(245,158,11,0.24)",
      color: "#f59e0b",
    };
  }

  return {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.24)",
    color: "#ef4444",
  };
}

function getDebtHealth(currentRatio, requiredRatio) {
  if (!currentRatio || !requiredRatio) {
    return { label: "No Active Debt", tone: "healthy" };
  }

  if (currentRatio >= requiredRatio + 20) {
    return { label: "Well Secured", tone: "healthy" };
  }

  if (currentRatio >= requiredRatio) {
    return { label: "Near Threshold", tone: "watch" };
  }

  return { label: "Below Requirement", tone: "risk" };
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card" style={{ padding: "20px" }}>
      <div style={{
        fontSize: "10px",
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "1.4px",
        fontFamily: "var(--font-mono)",
        marginBottom: "10px",
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: "24px",
        fontWeight: 500,
        color: accent || "var(--text-primary)",
        letterSpacing: "-0.8px",
        marginBottom: "4px",
      }}>
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        {sub}
      </div>
    </div>
  );
}

export default function HistoryPage({
  signer,
  address,
  position,
  creditScore,
  refreshKey,
  refresh,
  syncCreditScore,
  ethPrice,
}) {
  const [historyState, setHistoryState] = useState({ address: "", cacheKey: "", txs: EMPTY_ACTIVITY });
  const [repaying, setRepaying] = useState(false);
  const [repayHash, setRepayHash] = useState(null);
  const [repayError, setRepayError] = useState(null);
  const [scoreSyncing, setScoreSyncing] = useState(false);
  const [scoreSyncError, setScoreSyncError] = useState(null);
  const [scoreSyncTxHash, setScoreSyncTxHash] = useState(null);
  const activityKey = signer && address ? `${address}:${refreshKey}` : "";
  const txs = historyState.address === address ? historyState.txs : EMPTY_ACTIVITY;
  const loadingTxs = Boolean(activityKey) && historyState.cacheKey !== activityKey;
  const tier = getTier(creditScore);
  const requiredRatio = getCollateralRatioFromTier(creditScore);
  const collateralInEtc = ethToEtc(position.collateral);
  const currentRatio = position.debt > 0 ? (collateralInEtc / position.debt) * 100 : 0;
  const safetyBuffer = position.debt > 0 ? currentRatio - requiredRatio : 0;
  const debtHealth = getDebtHealth(currentRatio, requiredRatio);

  useEffect(() => {
    if (!activityKey) {
      return;
    }

    let cancelled = false;

    fetchDebtActivity(signer, address).then((data) => {
      if (!cancelled) {
        setHistoryState({ address, cacheKey: activityKey, txs: data });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activityKey, address, signer]);

  const { totalBorrowed, totalRepaid, borrowCount, repayCount, settlementRate } = useMemo(() => {
    const borrowed = txs
      .filter((tx) => tx.type === "borrow" && typeof tx.amount === "number")
      .reduce((acc, tx) => acc + tx.amount, 0);
    const repaid = txs
      .filter((tx) => tx.type === "repay" && typeof tx.amount === "number")
      .reduce((acc, tx) => acc + tx.amount, 0);

    return {
      totalBorrowed: borrowed,
      totalRepaid: repaid,
      borrowCount: txs.filter((tx) => tx.type === "borrow").length,
      repayCount: txs.filter((tx) => tx.type === "repay").length,
      settlementRate: borrowed > 0 ? Math.min((repaid / borrowed) * 100, 100) : 0,
    };
  }, [txs]);

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
      <div style={{ marginBottom: "32px" }}>
        <div style={{
          fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px",
        }}>Ledger</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "38px", fontWeight: 800,
          letterSpacing: "-1.5px", marginBottom: "8px",
        }}>History & Debt Center</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "520px" }}>
          Review every borrow and repayment event, track your open ETC obligations,
          and settle the live balance from one place.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "16px",
        marginBottom: "24px",
      }}>
        <StatCard
          label="Outstanding Debt"
          value={`${formatAmount(position.debt)} ETC`}
          sub={position.debt > 0 ? `≈ ${formatEtcUsd(position.debt, ethPrice)} USD` : "No balance due"}
          accent={position.debt > 0 ? "#f59e0b" : "#10b981"}
        />
        <StatCard
          label="Collateral Locked"
          value={`${formatAmount(position.collateral)} ETH`}
          sub={position.collateral > 0 ? `${tier.label} tier position` : "No active collateral"}
        />
        <StatCard
          label="Lifetime Borrowed"
          value={`${formatAmount(totalBorrowed)} ETC`}
          sub={totalBorrowed > 0 ? `≈ ${formatEtcUsd(totalBorrowed, ethPrice)}` : `${borrowCount} events`}
        />
        <StatCard
          label="Lifetime Repaid"
          value={`${formatAmount(totalRepaid)} ETC`}
          sub={totalRepaid > 0 ? `≈ ${formatEtcUsd(totalRepaid, ethPrice)}` : `${repayCount} events`}
          accent="#10b981"
        />
      </div>

      <div className="card" style={{
        padding: "24px",
        marginBottom: "24px",
        borderColor: position.debt > 0 ? "rgba(124,58,237,0.35)" : "var(--bg-border)",
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{
              fontSize: "10px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              fontFamily: "var(--font-mono)",
              marginBottom: "8px",
            }}>
              Active Debt
            </div>
            <div style={{ fontSize: "22px", fontWeight: 700, marginBottom: "6px" }}>
              {position.debt > 0 ? `${formatAmount(position.debt)} ETC due` : "All obligations settled"}
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", maxWidth: "540px", lineHeight: 1.6 }}>
              {position.debt > 0
                ? "This section reflects your live CDP position. Repaying clears the outstanding ETC debt and keeps your collateral ratio in a safer range."
                : "You do not have any ETC debt to repay right now. New borrow activity will appear here as soon as a position is opened."}
            </p>
          </div>

          <div style={{
            ...statusStyles(debtHealth.tone),
            padding: "7px 12px",
            borderRadius: "999px",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            whiteSpace: "nowrap",
          }}>
            {debtHealth.label}
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: position.debt > 0 ? "20px" : "0",
        }}>
          {[
            {
              label: "Current Ratio",
              value: position.debt > 0 ? `${formatAmount(currentRatio)}%` : "—",
              sub: "Collateral divided by outstanding debt",
            },
            {
              label: "Required Ratio",
              value: `${requiredRatio}%`,
              sub: "Derived from your on-chain credit tier",
            },
            {
              label: "Safety Buffer",
              value: position.debt > 0 ? `${safetyBuffer >= 0 ? "+" : ""}${formatAmount(safetyBuffer)} pts` : "—",
              sub: "Difference between current and required ratio",
            },
            {
              label: "Settlement Rate",
              value: `${formatAmount(settlementRate)}%`,
              sub: "Share of lifetime borrowed ETC already repaid",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "var(--bg-deep)",
                border: "1px solid var(--bg-border)",
                borderRadius: "14px",
                padding: "16px",
              }}
            >
              <div style={{
                fontSize: "10px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "1.4px",
                fontFamily: "var(--font-mono)",
                marginBottom: "8px",
              }}>
                {item.label}
              </div>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "20px",
                fontWeight: 500,
                marginBottom: "4px",
              }}>
                {item.value}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {item.sub}
              </div>
            </div>
          ))}
        </div>

        {position.debt > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Required for your {tier.label} tier: {requiredRatio}% collateral ratio
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
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {repaying ? (
                <>
                  <span style={{
                    width: "14px",
                    height: "14px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTop: "2px solid #fff",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    display: "inline-block",
                  }} />
                  Repaying...
                </>
              ) : "Repay Outstanding Debt"}
            </button>
          </div>
        )}

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

      <div className="card" style={{ padding: "24px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "20px",
          gap: "16px",
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>⊞</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700 }}>
              Full Transaction Ledger
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {loadingTxs ? "Loading activity..." : `${txs.length} event${txs.length === 1 ? "" : "s"} found`}
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 0.9fr 1.3fr 1fr 0.9fr 0.9fr 0.7fr",
          padding: "10px 16px",
          borderBottom: "1px solid var(--bg-border)",
        }}>
          {["Date", "Type", "Amount", "Collateral", "Gas Cost", "Exec Time", "Tx"].map((h) => (
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
        ) : txs.length === 0 ? (
          <div style={{
            padding: "48px", textAlign: "center",
            color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "13px",
          }}>
            No borrow or repayment events found for this wallet yet.
          </div>
        ) : (
          txs.map((tx) => {
            const isBorrow = tx.type === "borrow";
            const isRepay = tx.type === "repay";
            const isFailed = tx.status === "failed";
            const amountLabel = typeof tx.amount === "number"
              ? `${isBorrow ? "+" : isRepay ? "-" : ""}${formatAmount(tx.amount, 4)} ETC`
              : "—";
            const amountSubLabel = isFailed
              ? "Transaction reverted"
              : typeof tx.amount === "number"
                ? "Confirmed on-chain"
                : "Amount unavailable";
            const typeLabel = isFailed
              ? isBorrow
                ? "Borrow Failed"
                : isRepay
                  ? "Repay Failed"
                  : "Failed"
              : isBorrow
                ? "Borrowed"
                : isRepay
                  ? "Repaid"
                  : "Interaction";
            const typeStyles = isFailed
              ? {
                  background: "rgba(239,68,68,0.12)",
                  color: "#ef4444",
                  border: "1px solid rgba(239,68,68,0.24)",
                }
              : isBorrow
                ? {
                    background: "rgba(59,130,246,0.15)",
                    color: "#60a5fa",
                    border: "1px solid rgba(59,130,246,0.22)",
                  }
                : isRepay
                  ? {
                      background: "rgba(16,185,129,0.12)",
                      color: "#10b981",
                      border: "1px solid rgba(16,185,129,0.22)",
                    }
                  : {
                      background: "rgba(148,163,184,0.12)",
                      color: "var(--text-secondary)",
                      border: "1px solid rgba(148,163,184,0.2)",
                    };

            return (
              <div key={tx.id} style={{
                display: "grid",
                gridTemplateColumns: "1.3fr 0.9fr 1.3fr 1fr 0.9fr 0.9fr 0.7fr",
                padding: "16px",
                borderBottom: "1px solid rgba(30,45,69,0.5)",
                alignItems: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(124,58,237,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 500 }}>{formatDate(tx.timeStamp)}</div>
                  <div style={{
                    fontSize: "11px", color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)", marginTop: "2px",
                  }}>
                    {shortHash(tx.hash)}
                  </div>
                </div>

                <div>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    ...typeStyles,
                  }}>
                    {typeLabel}
                  </span>
                </div>

                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 500 }}>
                    {amountLabel}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {typeof tx.amount === "number" && ethPrice ? `≈ ${formatEtcUsd(tx.amount, ethPrice)}` : amountSubLabel}
                  </div>
                </div>

                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 500 }}>
                    {tx.collateral > 0 ? `${formatAmount(tx.collateral, 4)} ETH` : "—"}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {isBorrow ? "Collateral posted" : isRepay ? "Debt reduced" : "Contract interaction"}
                  </div>
                </div>

                {/* Gas Cost */}
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 500, color: "#f59e0b" }}>
                    {tx.gasCostEth != null ? `${tx.gasCostEth.toFixed(6)}` : "—"}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {tx.gasCostEth != null ? `≈ $${(tx.gasCostEth * ethPrice).toFixed(4)}` : "ETH"}
                  </div>
                </div>

                {/* Execution Time */}
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 500 }}>
                    {tx.timeStamp ? formatTimeAgo(tx.timeStamp) : "—"}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {tx.confirmations != null ? `${tx.confirmations.toLocaleString()} blocks` : "confirmed"}
                  </div>
                </div>

                <div>
                  <a
                    href={tx.hash ? `https://sepolia.etherscan.io/tx/${tx.hash}` : "#"}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "12px",
                      textDecoration: "none",
                      fontFamily: "var(--font-body)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    View ↗
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
