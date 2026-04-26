import { getTier } from "../utils/contracts";

const TIERS = [
  { label: "Bronze",  min: 0,   max: 199,  level: 1 },
  { label: "Silver",  min: 200, max: 399,  level: 2 },
  { label: "Gold",    min: 400, max: 599,  level: 3 },
  { label: "Diamond", min: 600, max: 799,  level: 4 },
  { label: "Master",  min: 800, max: 1000, level: 5 },
];

function ScoreFactor({ icon, label, value, points, color, pct }) {
  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>{icon}</span>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>{value}</div>
          </div>
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "13px",
          color: points > 0 ? "#10b981" : "#ef4444",
          fontWeight: 600,
          padding: "2px 8px",
          background: points > 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          borderRadius: "6px",
        }}>
          {points > 0 ? `+${points}` : points} pts
        </span>
      </div>
      <div style={{ height: "4px", background: "var(--bg-deep)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${Math.min(pct, 100)}%`,
          background: color,
          borderRadius: "2px",
          transition: "width 1s ease",
        }} />
      </div>
    </div>
  );
}

export default function CreditProfilePage({ address, creditScore }) {
  const tier = getTier(creditScore);

  // Compute factors from credit score (approximate breakdown)
  const walletAgePts   = Math.floor(creditScore * 0.15);
  const repayPts       = Math.floor(creditScore * 0.4);
  const defiPts        = Math.floor(creditScore * 0.1);
  const govPts         = creditScore >= 400 ? Math.floor(creditScore * 0.05) : 0;

  const tierColors = {
    Bronze:  { bg: "linear-gradient(135deg, #92400e, #b45309)", text: "#f59e0b" },
    Silver:  { bg: "linear-gradient(135deg, #4b5563, #9ca3af)", text: "#d1d5db" },
    Gold:    { bg: "linear-gradient(135deg, #92400e, #f59e0b)", text: "#fcd34d" },
    Diamond: { bg: "linear-gradient(135deg, #1e40af, #7c3aed)", text: "#a78bfa" },
    Master:  { bg: "linear-gradient(135deg, #7c3aed, #ec4899)", text: "#f9a8d4" },
    Unranked:{ bg: "linear-gradient(135deg, #1f2937, #374151)", text: "#9ca3af" },
  };

  const tc = tierColors[tier.label] || tierColors.Unranked;

  return (
    <div style={{ animation: "fadeInUp 0.35s ease forwards", maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{
          fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px",
        }}>Identity</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "38px", fontWeight: 800,
          letterSpacing: "-1.5px", marginBottom: "8px",
        }}>Credit Profile</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "500px" }}>
          Your decentralized identity and AI-validated creditworthiness on the EthCoin Protocol.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Main score card */}
          <div className="card" style={{ padding: "28px", position: "relative", overflow: "hidden" }}>
            {/* Background glow */}
            <div style={{
              position: "absolute", right: "-40px", bottom: "-40px",
              width: "200px", height: "200px",
              background: `radial-gradient(circle, ${tc.text}22 0%, transparent 70%)`,
              pointerEvents: "none",
            }} />

            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              marginBottom: "20px",
            }}>
              <span style={{
                padding: "3px 10px",
                borderRadius: "20px",
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.3)",
                fontSize: "10px", fontFamily: "var(--font-mono)", color: "#10b981",
              }}>⬤ AI Validated</span>
            </div>

            <div style={{
              fontSize: "10px", color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "2px",
              fontFamily: "var(--font-mono)", marginBottom: "8px",
            }}>Global Credit Score</div>

            <div style={{
              fontFamily: "var(--font-mono)", fontSize: "72px", fontWeight: 500,
              letterSpacing: "-4px", lineHeight: 1,
              color: tc.text,
              marginBottom: "16px",
            }}>
              {creditScore || "—"}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Current Tier</span>
              <span style={{
                padding: "4px 12px",
                background: tc.bg,
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                letterSpacing: "1px",
              }}>{tier.label.toUpperCase()}</span>
            </div>
          </div>

          {/* NFT Soulbound */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <div style={{
                width: "90px", height: "110px",
                background: "var(--bg-deep)",
                border: "1px solid var(--bg-border)",
                borderRadius: "12px",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: "8px", flexShrink: 0,
              }}>
                <div style={{ fontSize: "36px" }}>◈</div>
                <div style={{
                  fontSize: "8px", color: "var(--text-muted)", fontFamily: "var(--font-mono)",
                  textAlign: "center", lineHeight: 1.4,
                }}>
                  SOULBOUND<br />
                  <span style={{ color: "#7c3aed" }}>
                    ID: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—"}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                  Soulbound NFT
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Your credit identity is minted as a non-transferable token on Sepolia testnet.
                </div>
                <a
                  href={address ? `https://sepolia.etherscan.io/address/${address}` : "#"}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-block",
                    marginTop: "10px",
                    fontSize: "11px",
                    color: "#7c3aed",
                    textDecoration: "none",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  View on Etherscan →
                </a>
              </div>
            </div>
          </div>

          {/* Tier Progression */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 700,
              marginBottom: "20px",
            }}>Tier Progression</div>
            <div style={{ position: "relative" }}>
              {/* Line */}
              <div style={{
                position: "absolute",
                top: "20px",
                left: "20px", right: "20px",
                height: "2px",
                background: "var(--bg-border)",
                zIndex: 0,
              }} />
              {/* Progress line */}
              <div style={{
                position: "absolute",
                top: "20px",
                left: "20px",
                width: `${(Math.min(tier.level, 4) / 4) * (100 - 10)}%`,
                height: "2px",
                background: "linear-gradient(90deg, #10b981, #7c3aed)",
                zIndex: 1,
                transition: "width 1s ease",
              }} />

              <div style={{
                display: "flex", justifyContent: "space-between",
                position: "relative", zIndex: 2,
              }}>
                {TIERS.map((t, i) => {
                  const active = tier.level >= t.level;
                  const current = tier.label === t.label;
                  return (
                    <div key={t.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <div style={{
                        width: "40px", height: "40px",
                        borderRadius: "50%",
                        background: current
                          ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                          : active
                          ? "var(--bg-card)"
                          : "var(--bg-deep)",
                        border: active ? "2px solid #7c3aed" : "2px solid var(--bg-border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: current ? "14px" : "12px",
                        fontFamily: "var(--font-mono)",
                        color: active ? "#fff" : "var(--text-muted)",
                        boxShadow: current ? "0 0 16px rgba(124,58,237,0.5)" : "none",
                        transition: "all 0.3s ease",
                      }}>
                        {current ? "★" : t.level}
                      </div>
                      <span style={{
                        fontSize: "10px",
                        color: current ? "#fff" : "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        fontWeight: current ? 700 : 400,
                      }}>{t.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right — Score Factors */}
        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700,
            marginBottom: "16px",
          }}>Score Factors</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <ScoreFactor
              icon="🕐"
              label="Wallet Age"
              value={creditScore > 0 ? "Active for 3.4 Years" : "No history yet"}
              points={walletAgePts}
              color="linear-gradient(90deg, #10b981, #059669)"
              pct={75}
            />
            <ScoreFactor
              icon="✓"
              label="Repayment History"
              value={creditScore > 0 ? "0 Liquidations / 14 Loans" : "No loans yet"}
              points={repayPts}
              color="linear-gradient(90deg, #10b981, #0d9488)"
              pct={100}
            />
            <ScoreFactor
              icon="↔"
              label="DeFi Activity"
              value={creditScore > 0 ? "$45.2K Total Volume" : "No activity yet"}
              points={defiPts}
              color="linear-gradient(90deg, #f59e0b, #d97706)"
              pct={45}
            />
            <div className="card" style={{ padding: "16px 20px", opacity: creditScore >= 400 ? 1 : 0.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>🔒</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>Governance</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                      {creditScore >= 400 ? "Active governance participant" : "Stake ETC to unlock voting power modifiers."}
                    </div>
                  </div>
                </div>
                {creditScore < 400 ? (
                  <span style={{
                    padding: "3px 10px",
                    background: "var(--bg-deep)",
                    border: "1px solid var(--bg-border)",
                    borderRadius: "6px",
                    fontSize: "10px", fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    letterSpacing: "1px",
                  }}>LOCKED</span>
                ) : (
                  <span style={{
                    padding: "3px 10px",
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.3)",
                    borderRadius: "6px",
                    fontSize: "10px", fontFamily: "var(--font-mono)",
                    color: "#10b981",
                  }}>+{govPts} pts</span>
                )}
              </div>
            </div>
          </div>

          {/* Tier benefits */}
          <div className="card" style={{ padding: "20px", marginTop: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", fontFamily: "var(--font-display)" }}>
              {tier.label} Tier Benefits
            </div>
            {[
              { label: "Collateral Ratio", value: tier.level >= 4 ? "100%" : tier.level >= 3 ? "110%" : tier.level >= 2 ? "120%" : "150%" },
              { label: "Borrow APR",       value: tier.level >= 4 ? "2.0%" : tier.level >= 3 ? "2.2%" : "2.5%" },
              { label: "Voting Multiplier", value: tier.level >= 4 ? "1.5×" : "1.0×" },
            ].map(b => (
              <div key={b.label} style={{
                display: "flex", justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid rgba(30,45,69,0.5)",
                fontSize: "13px",
              }}>
                <span style={{ color: "var(--text-secondary)" }}>{b.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{b.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
