"use client";

export default function SubscriptionExpiredPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      padding: "24px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .se-card {
          background: linear-gradient(145deg, rgba(18,18,28,0.98), rgba(10,10,15,0.99));
          border: 1px solid rgba(99,120,255,0.22);
          border-radius: 24px;
          padding: 56px 48px;
          max-width: 480px;
          width: 100%;
          text-align: center;
          position: relative;
          overflow: hidden;
          box-shadow: 0 0 80px rgba(99,120,255,0.06);
        }
        .se-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(99,120,255,0.45), transparent);
        }
        .se-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.30);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 28px;
        }
        .se-title {
          font-size: 26px;
          font-weight: 900;
          color: rgba(255,255,255,0.95);
          letter-spacing: -0.5px;
          margin-bottom: 12px;
        }
        .se-desc {
          font-size: 15px;
          color: rgba(255,255,255,0.42);
          line-height: 1.65;
          margin-bottom: 40px;
        }
        .se-btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 52px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6378ff, #4f63e8);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: opacity 0.18s ease, transform 0.18s ease;
          margin-bottom: 12px;
          box-shadow: 0 4px 24px rgba(99,120,255,0.30);
        }
        .se-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .se-btn-ghost {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 52px;
          border-radius: 12px;
          background: transparent;
          color: rgba(255,255,255,0.55);
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.12);
          cursor: pointer;
          transition: border-color 0.18s ease, color 0.18s ease;
        }
        .se-btn-ghost:hover { border-color: rgba(255,255,255,0.28); color: rgba(255,255,255,0.80); }
        .se-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 32px 0;
        }
        .se-footer {
          font-size: 12px;
          color: rgba(255,255,255,0.20);
          font-family: 'DM Mono', monospace;
        }
        @media (max-width: 520px) {
          .se-card { padding: 40px 24px; }
          .se-title { font-size: 22px; }
        }
      `}</style>

      <div style={{ position: "fixed", top: -120, left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,120,255,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div className="se-card">
        <div style={{ position: "absolute", top: -80, right: -80, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(239,68,68,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div className="se-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.90)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 12px", borderRadius: 999, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", color: "rgba(255,130,130,0.90)", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 20, fontFamily: "'DM Mono', monospace" }}>
          ABONNEMENT EXPIRÉ
        </div>

        <h1 className="se-title">Votre abonnement a expiré</h1>
        <p className="se-desc">
          L'accès à votre espace ClientFlow a été suspendu. Renouvelez votre abonnement pour retrouver l'accès à vos clients, ventes et analytiques.
        </p>

        <a href="https://clientflow-web-3.vercel.app/#pricing" className="se-btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
          Renouveler mon abonnement →
        </a>

        <a href="mailto:client.flow@outlook.com" className="se-btn-ghost">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          Contacter le support
        </a>

        <div className="se-divider" />

        <p className="se-footer">ClientFlow · client.flow@outlook.com</p>
      </div>
    </div>
  );
}
