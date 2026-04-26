import { useMemo } from "react";
import { getTier, getHealthColor, getCollateralRatioFromTier } from "../utils/contracts";

function StatCard({ label, value, sub, icon, accent, loading }) {
  return (
    <div className="card" style={{ padding: "24px", position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: "12px", right: "16px",
        fontSize: "20px", opacity: 0.25,
      }}>{icon}</div>
      <div style={{
        fontSize: "11px", color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "1.5px",
        fontFamily: "var(--font-mono)", marginBottom: "10px",
      }}>{label}</div>
      {loading ? (
        <div className="skeleton" style={{ height: "40px", width: "70%", marginBottom: "8px" }} />
      ) : (
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "32px",
          fontWeight: 500,
          color: accent || "var(--text-primary)",
          letterSpacing: "-1px",
          marginBottom: "4px",
          lineHeight: 1.1,
        }}>{value}</div>
      )}
      {sub && (
        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage({ address, ethBalance, ethPrice, position, creditScore, signer }) {
  const tier = getTier(creditScore);
  const loading = !signer;

  const usxBalance = position.debt || 0;
  const collateralUsd = (position.collateral * ethPrice).toFixed(2);
  const healthFactor = position.debt > 0
    ? ((position.collateral * ethPrice) / (position.debt * getCollateralRatioFromTier(creditScore) / 100)).toFixed(2)
    : "∞";
  const hfColor = healthFactor === "∞" ? "#10b981" : getHealthColor(parseFloat(healthFactor));

  const tierColors = {
    Diamond: "linear-gradient(135deg, #1e40af, #7c3aed)",
    Gold:    "linear-gradient(135deg, #92400e, #f59e0b)",
    Silver:  "linear-gradient(135deg, #374151, #9ca3af)",
    Bronze:  "linear-gradient(135deg, #78350f, #d97706)",
    Unranked:"linear-gradient(135deg, #1f2937, #374151)",
  };

  // Score arc
  const pct = Math.min(creditScore / 1000, 1);
  const circumference = 2 * Math.PI * 36;
  const dash = pct * circumference;

  return (
    <div style={{ animation: "fadeInUp 0.35s ease forwards", maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{
          fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px",
        }}>Overview</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "38px", fontWeight: 800,
          letterSpacing: "-1.5px", color: "var(--text-primary)", marginBottom: "6px",
        }}>Overview</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Manage your portfolio and active credit positions.
        </p>
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        <StatCard
          label="ETC Balance"
          value={usxBalance > 0 ? `${usxBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}.00` : "0.00"}
          sub={usxBalance > 0 ? "+2.4% this week" : "No active debt"}
          icon="◎"
          loading={loading}
        />
        <StatCard
          label="Total Collateral"
          value={`${position.collateral.toFixed(2)} ETH`}
          sub={`≈ $${parseFloat(collateralUsd).toLocaleString("en-US")} USD`}
          icon="🔒"
          loading={loading}
        />
        <div className="card" style={{ padding: "24px", position: "relative", overflow: "hidden" }}>
          <div style={{
            fontSize: "11px", color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "1.5px",
            fontFamily: "var(--font-mono)", marginBottom: "10px",
          }}>AI Credit Score</div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {loading ? (
              <div className="skeleton" style={{ width: "80px", height: "80px", borderRadius: "50%" }} />
            ) : (
              <div className="score-ring">
                <svg viewBox="0 0 80 80" width="80" height="80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="var(--bg-border)" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="36"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="6"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 1s ease" }}
                  />
                </svg>
                <div className="value" style={{ fontSize: "17px", fontWeight: 600, color: "#f59e0b" }}>
                  {creditScore}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "36px", fontWeight: 500, color: "#f59e0b", letterSpacing: "-1px" }}>
                {creditScore || "—"}
              </div>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "20px",
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.25)",
                marginTop: "6px",
              }}>
                <span style={{ width: "6px", height: "6px", background: "#10b981", borderRadius: "50%", display: "inline-block" }} />
                <span style={{ fontSize: "11px", color: "#10b981", fontFamily: "var(--font-mono)" }}>
                  {tier.label} Tier
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Profile banner */}
      <div className="card" style={{
        padding: "32px",
        marginBottom: "20px",
        background: "linear-gradient(135deg, rgba(17,24,39,0.8) 0%, rgba(30,17,60,0.6) 100%)",
        display: "flex",
        alignItems: "center",
        gap: "32px",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Glow orb */}
        <div style={{
          position: "absolute", right: "-60px", top: "-60px",
          width: "200px", height: "200px",
          background: "radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* NFT card */}
        <div style={{
          flexShrink: 0,
          width: "90px", height: "110px",
          background: "var(--bg-deep)",
          border: "1px solid var(--bg-border)",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <div style={{ fontSize: "32px" }}>◈</div>
          <div style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", textAlign: "center", lineHeight: 1.4 }}>
            SOULBOUND<br />
            <span style={{ color: "var(--text-secondary)" }}>
              {address ? `${address.slice(0, 6)}...${address.slice(-2)}` : "—"}
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "10px",
          }}>
            <span style={{
              padding: "4px 10px",
              borderRadius: "20px",
              background: tierColors[tier.label] || tierColors.Unranked,
              fontSize: "11px",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
            }}>{tier.label} Tier</span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Active on Sepolia
            </span>
          </div>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px", fontWeight: 700,
            letterSpacing: "-0.5px", marginBottom: "8px",
          }}>
            Institutional Credit Profile
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.6, maxWidth: "480px" }}>
            Your on-chain financial history secures your identity. Maintaining your{" "}
            {tier.label} Tier status unlocks sub-prime borrowing rates at 2.4% APY and
            provides a 1.5x multiplier on governance voting power.
          </p>
        </div>
      </div>

      {/* Active CDPs */}
      <div className="card" style={{ padding: "24px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>⊞</span>
            <span style={{
              fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 600,
            }}>Active CDPs</span>
          </div>
          <button style={{
            background: "transparent", border: "none",
            color: "#7c3aed", fontSize: "13px", cursor: "pointer",
            fontFamily: "var(--font-body)", fontWeight: 500,
          }}>
            Manage All →
          </button>
        </div>

        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1.5fr 1.5fr 1fr",
          padding: "10px 16px",
          borderBottom: "1px solid var(--bg-border)",
        }}>
          {["Collateral Asset", "Debt (ETC)", "Liq. Price", "Health Factor"].map(h => (
            <div key={h} style={{
              fontSize: "11px", color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "1px",
              fontFamily: "var(--font-mono)",
            }}>{h}</div>
          ))}
        </div>

        {position.collateral > 0 ? (
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 1.5fr 1.5fr 1fr",
            padding: "16px",
            alignItems: "center",
            borderBottom: "1px solid rgba(30,45,69,0.5)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "36px", height: "36px",
                background: "linear-gradient(135deg, #3730a3, #6366f1)",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px",
              }}>Ξ</div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 500 }}>Ethereum (ETH)</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {position.collateral.toFixed(2)} Locked
                </div>
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "15px" }}>
              {position.debt.toLocaleString("en-US", { minimumFractionDigits: 2 })}.00
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "#f59e0b" }}>
              ${(ethPrice * 0.74).toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: hfColor, fontWeight: 600 }}>
                {healthFactor}
              </span>
              <span style={{ width: "8px", height: "8px", background: hfColor, borderRadius: "50%", display: "inline-block" }} />
            </div>
          </div>
        ) : (
          <div style={{
            padding: "40px", textAlign: "center",
            color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "13px",
          }}>
            No active positions. Deposit ETC to mint ETC.
          </div>
        )}
      </div>
    </div>
  );
}
