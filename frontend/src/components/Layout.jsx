import { useState } from "react";
import { getTier } from "../utils/contracts";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "borrow",    label: "Borrow",    icon: "◈" },
  { id: "credit",    label: "Credit Score", icon: "◉" },
  { id: "history",   label: "History",   icon: "⊞" },
];

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Layout({ children, page, setPage, address, creditScore, onConnect }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const tier = getTier(creditScore);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top navbar */}
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(8, 11, 20, 0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--bg-border)",
        padding: "0 24px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "24px",
      }}>
        {/* Logo */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "16px",
          cursor: "pointer",
          userSelect: "none",
          flexShrink: 0,
        }} onClick={() => setPage("dashboard")}>
          <div style={{
            width: "32px", height: "32px",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
            boxShadow: "0 0 16px rgba(124,58,237,0.4)",
          }}>◈</div>
          <span style={{ color: "var(--text-primary)" }}>EthCoin Protocol</span>
        </div>

        {/* Center nav */}
        <div style={{
          display: "flex",
          gap: "4px",
          background: "var(--bg-card)",
          border: "1px solid var(--bg-border)",
          borderRadius: "12px",
          padding: "4px",
        }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                background: page === item.id
                  ? "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.3))"
                  : "transparent",
                border: page === item.id ? "1px solid rgba(124,58,237,0.4)" : "1px solid transparent",
                color: page === item.id ? "#fff" : "var(--text-secondary)",
                borderRadius: "8px",
                padding: "6px 16px",
                fontSize: "13px",
                fontWeight: page === item.id ? 600 : 400,
                fontFamily: "var(--font-body)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                letterSpacing: "0.2px",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          {/* Network badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: "20px",
            padding: "4px 12px",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
          }}>
            <span style={{
              width: "6px", height: "6px",
              background: "#10b981",
              borderRadius: "50%",
              display: "inline-block",
              animation: "pulse-ring 2s infinite",
            }} />
            <span style={{ color: "#10b981" }}>Sepolia</span>
          </div>

          {/* Wallet */}
          <button
            style={{
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              border: "none",
              borderRadius: "10px",
              color: "#fff",
              padding: "7px 14px",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
              letterSpacing: "0.5px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>🦊</span>
            {shortAddr(address)}
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div style={{
        display: "flex",
        flex: 1,
        minHeight: 0,
      }}>
        {/* Sidebar */}
        <aside style={{
          width: "220px",
          flexShrink: 0,
          borderRight: "1px solid var(--bg-border)",
          background: "rgba(13,17,33,0.6)",
          display: "flex",
          flexDirection: "column",
          padding: "24px 12px",
          gap: "4px",
          position: "sticky",
          top: "60px",
          height: "calc(100vh - 60px)",
          overflowY: "auto",
        }}>
          {/* Network info */}
          <div style={{
            padding: "10px 12px",
            marginBottom: "16px",
            background: "var(--bg-card)",
            borderRadius: "12px",
            border: "1px solid var(--bg-border)",
          }}>
            <div style={{
              fontSize: "10px",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "4px",
            }}>ETC Mainnet</div>
            <div style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-body)",
            }}>AI-Driven DeFi</div>
          </div>

          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                background: page === item.id
                  ? "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.1))"
                  : "transparent",
                border: page === item.id ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent",
                borderRadius: "10px",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: page === item.id ? "#fff" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: page === item.id ? 600 : 400,
                fontFamily: "var(--font-body)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
                width: "100%",
              }}
            >
              <span style={{ fontSize: "15px", opacity: 0.8 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Mint ETC CTA */}
          <button
            onClick={() => setPage("borrow")}
            style={{
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              border: "none",
              borderRadius: "12px",
              padding: "12px",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: "var(--font-display)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            + Mint ETC
          </button>

          {/* Footer links */}
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "2px" }}>
            {["Settings", "Support"].map(item => (
              <button key={item} style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "12px",
                padding: "6px 14px",
                cursor: "pointer",
                textAlign: "left",
                borderRadius: "8px",
                fontFamily: "var(--font-body)",
                transition: "color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text-secondary)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
              >
                {item}
              </button>
            ))}
          </div>
        </aside>

        {/* Page content */}
        <main style={{
          flex: 1,
          overflow: "auto",
          padding: "32px",
          minHeight: "calc(100vh - 60px)",
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
