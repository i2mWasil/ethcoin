import { useEffect, useRef } from "react";

export default function LandingPage({ onConnect, loading }) {
  const canvasRef = useRef(null);

  // Animated star/particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw subtle grid
      ctx.strokeStyle = "rgba(30, 45, 69, 0.4)";
      ctx.lineWidth = 0.5;
      const gs = 80;
      for (let x = 0; x < canvas.width; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gs) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${p.alpha})`;
        ctx.fill();
      });

      // Draw connections
      ctx.strokeStyle = "rgba(124, 58, 237, 0.08)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.globalAlpha = (1 - dist / 120) * 0.3;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <div style={{
      position: "relative",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      background: "var(--bg-deep)",
    }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />

      {/* Radial glow */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px",
        height: "600px",
        background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 1,
      }} />

      <div style={{
        position: "relative",
        zIndex: 2,
        textAlign: "center",
        maxWidth: "560px",
        padding: "0 24px",
        animation: "fadeInUp 0.6s ease forwards",
      }}>
        {/* Logo mark */}
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "18px",
          background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 28px",
          boxShadow: "0 0 40px rgba(124,58,237,0.4)",
          fontSize: "28px",
        }}>
          ◈
        </div>

        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "3px",
          color: "#7c3aed",
          textTransform: "uppercase",
          marginBottom: "16px",
          opacity: 0.9,
        }}>
          EthCoin Protocol — Sepolia Testnet
        </div>

        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 8vw, 64px)",
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: "-2px",
          marginBottom: "20px",
          background: "linear-gradient(135deg, #fff 20%, #8b5cf6 80%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          AI-Driven<br />DeFi Credit
        </h1>

        <p style={{
          color: "var(--text-secondary)",
          fontSize: "15px",
          lineHeight: 1.7,
          marginBottom: "40px",
          fontFamily: "var(--font-body)",
        }}>
          Deposit ETH collateral. Mint EthCoin (ETC). Your on-chain credit score
          determines your collateral ratio — the better your history, the less you lock.
        </p>

        {/* Stats row */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "32px",
          marginBottom: "40px",
        }}>
          {[
            { label: "Min. Collateral", value: "100%" },
            { label: "Base APR",       value: "2.5%"  },
            { label: "Network",        value: "Sepolia" },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "20px",
                fontWeight: 500,
                color: "#fff",
                marginBottom: "4px",
              }}>{stat.value}</div>
              <div style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onConnect}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            background: loading
              ? "rgba(124,58,237,0.4)"
              : "linear-gradient(135deg, #7c3aed, #4f46e5)",
            color: "#fff",
            border: "none",
            borderRadius: "14px",
            padding: "16px 40px",
            fontSize: "15px",
            fontWeight: 600,
            fontFamily: "var(--font-display)",
            letterSpacing: "0.5px",
            cursor: loading ? "wait" : "pointer",
            boxShadow: loading ? "none" : "0 0 30px rgba(124,58,237,0.5), 0 4px 16px rgba(0,0,0,0.4)",
            transition: "all 0.2s ease",
            position: "relative",
            overflow: "hidden",
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
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
              Connecting...
            </>
          ) : (
            <>
              <span style={{ fontSize: "18px" }}>🦊</span>
              Connect MetaMask
            </>
          )}
        </button>

        <p style={{
          marginTop: "20px",
          fontSize: "12px",
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
        }}>
          Requires MetaMask · Sepolia Testnet
        </p>
      </div>
    </div>
  );
}
