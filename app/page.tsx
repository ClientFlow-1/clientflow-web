"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const ACCENT = "#6378ff";
const ACCENT_MID = "#4f63e8";
const BG = "#0a0a0f";

/* ─────────── Keyframes ─────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: 'DM Sans', system-ui, sans-serif; background: ${BG}; color: rgba(238,238,245,0.92); overflow-x: hidden; }
  a { text-decoration: none; color: inherit; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes floatA {
    0%, 100% { transform: translateY(0px) scale(1); }
    50%       { transform: translateY(-24px) scale(1.04); }
  }
  @keyframes floatB {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(16px) rotate(4deg); }
  }
  @keyframes floatC {
    0%, 100% { transform: translateY(0px) scale(1); }
    33%       { transform: translateY(-14px) scale(0.97); }
    66%       { transform: translateY(10px) scale(1.02); }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 40px rgba(99,120,255,0.25), 0 0 80px rgba(99,120,255,0.10); }
    50%       { box-shadow: 0 0 60px rgba(99,120,255,0.40), 0 0 120px rgba(99,120,255,0.18); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes gridPan {
    from { transform: translateY(0); }
    to   { transform: translateY(40px); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  @keyframes countUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .lp-hero-fadeup  { animation: fadeUp 0.75s ease both; }
  .lp-hero-fade    { animation: fadeIn 1.2s ease both; }
  .lp-delay-1 { animation-delay: 0.10s; }
  .lp-delay-2 { animation-delay: 0.22s; }
  .lp-delay-3 { animation-delay: 0.36s; }
  .lp-delay-4 { animation-delay: 0.52s; }

  .lp-feature-card {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
    padding: 28px;
    transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
    cursor: default;
  }
  .lp-feature-card:hover {
    border-color: rgba(99,120,255,0.35);
    background: rgba(99,120,255,0.06);
    transform: translateY(-4px);
    box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 30px rgba(99,120,255,0.08);
  }

  .lp-pricing-card {
    animation: pulse-glow 4s ease-in-out infinite;
  }

  .lp-btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    height: 52px; padding: 0 28px; border-radius: 14px;
    background: linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_MID} 100%);
    color: #fff; font-size: 15px; font-weight: 800; border: none; cursor: pointer;
    transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 8px 32px rgba(99,120,255,0.35);
    text-decoration: none;
    font-family: inherit;
  }
  .lp-btn-primary:hover {
    opacity: 0.88;
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(99,120,255,0.50);
  }
  .lp-btn-primary:active { transform: translateY(0); }

  .lp-btn-ghost {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    height: 52px; padding: 0 26px; border-radius: 14px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.14);
    color: rgba(255,255,255,0.85); font-size: 15px; font-weight: 700; cursor: pointer;
    transition: background 0.2s, border-color 0.2s, transform 0.2s;
    text-decoration: none;
    font-family: inherit;
  }
  .lp-btn-ghost:hover {
    background: rgba(255,255,255,0.07);
    border-color: rgba(255,255,255,0.22);
    transform: translateY(-2px);
  }

  .lp-nav-btn-connect {
    display: inline-flex; align-items: center;
    height: 38px; padding: 0 18px; border-radius: 10px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.80); font-size: 14px; font-weight: 700; cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    text-decoration: none;
    font-family: inherit;
  }
  .lp-nav-btn-connect:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.22); }

  .lp-nav-btn-start {
    display: inline-flex; align-items: center;
    height: 38px; padding: 0 18px; border-radius: 10px;
    background: linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_MID} 100%);
    color: #fff; font-size: 14px; font-weight: 800; border: none; cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
    box-shadow: 0 4px 18px rgba(99,120,255,0.35);
    text-decoration: none;
    font-family: inherit;
  }
  .lp-nav-btn-start:hover { opacity: 0.88; transform: translateY(-1px); }

  .lp-testimonial {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
    padding: 28px;
    transition: border-color 0.25s, box-shadow 0.25s;
  }
  .lp-testimonial:hover {
    border-color: rgba(99,120,255,0.22);
    box-shadow: 0 16px 50px rgba(0,0,0,0.35);
  }

  .lp-gradient-text {
    background: linear-gradient(135deg, #a0b4ff 0%, ${ACCENT} 40%, #c084fc 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    background-size: 200% auto;
    animation: shimmer 6s linear infinite;
  }

  .lp-tag {
    display: inline-flex; align-items: center; gap: 6px;
    height: 28px; padding: 0 12px; border-radius: 999px;
    background: rgba(99,120,255,0.12); border: 1px solid rgba(99,120,255,0.28);
    color: rgba(160,180,255,0.95); font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
    font-family: 'DM Mono', monospace;
  }

  .lp-orb {
    position: absolute; border-radius: 50%; pointer-events: none; filter: blur(80px);
  }

  .lp-grid-bg {
    position: absolute; inset: 0; pointer-events: none; overflow: hidden;
    background-image:
      linear-gradient(rgba(99,120,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,120,255,0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent);
    animation: gridPan 8s linear infinite alternate;
  }

  .lp-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(99,120,255,0.20), transparent);
    margin: 0 auto;
    max-width: 800px;
  }

  .lp-check { color: rgba(99,255,180,0.9); font-size: 16px; flex-shrink: 0; margin-top: 1px; }

  .lp-section { padding: 100px 24px; max-width: 1140px; margin: 0 auto; }

  /* ── Hero layout ── */
  .lp-hero-section { position: relative; min-height: 100vh; display: flex; align-items: center; overflow: hidden; padding-top: 64px; }
  .lp-hero-pad { max-width: 1140px; margin: 0 auto; padding: 80px 24px 100px; width: 100%; }
  .lp-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }

  /* ── Mockup badges ── */
  .lp-badge-r { position: absolute; top: 20px; right: -20px; z-index: 10; animation: floatB 5s ease-in-out infinite; }
  .lp-badge-l { position: absolute; bottom: 24px; left: -16px; z-index: 10; animation: floatC 6s ease-in-out infinite; }

  /* ── Sections ── */
  .lp-section-features { padding: 100px 24px; }
  .lp-section-pricing  { padding: 100px 24px; }
  .lp-section-testi    { padding: 100px 24px; }
  .lp-section-cta      { padding: 0 24px 100px; }

  /* ── Pricing card inner ── */
  .lp-pricing-inner { width: 100%; max-width: 520px; border-radius: 24px; padding: 44px 40px; position: relative; overflow: hidden; }

  /* ── CTA band inner ── */
  .lp-cta-inner { border-radius: 24px; padding: 60px 48px; text-align: center; position: relative; overflow: hidden; }

  /* ── Footer grid ── */
  .lp-footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; margin-bottom: 48px; }

  /* ════ MOBILE ════ */
  @media (max-width: 768px) {

    /* Navbar */
    .lp-nav-links { display: none !important; }
    .lp-nav-btn-connect { height: 32px !important; padding: 0 11px !important; font-size: 12px !important; }
    .lp-nav-btn-start   { height: 32px !important; padding: 0 11px !important; font-size: 12px !important; }

    /* Hero */
    .lp-hero-section { min-height: auto; align-items: flex-start; }
    .lp-hero-pad     { padding: 40px 20px 60px; }
    .lp-hero-grid    { grid-template-columns: 1fr; gap: 44px; }
    .lp-hero-title   { font-size: clamp(30px, 8.5vw, 48px) !important; letter-spacing: -1px !important; }

    /* Mockup badges — rentrent dans les bords */
    .lp-badge-r { right: 4px !important; top: -8px !important; }
    .lp-badge-l { left: 4px !important; bottom: -8px !important; }

    /* Features */
    .lp-features-grid  { grid-template-columns: 1fr !important; }
    .lp-section-features { padding: 64px 20px; }

    /* Hero CTAs */
    .lp-hero-ctas { flex-direction: column; align-items: stretch !important; }
    .lp-hero-ctas a { width: 100% !important; justify-content: center; }

    /* Pricing */
    .lp-section-pricing  { padding: 64px 20px; }
    .lp-pricing-inner    { padding: 28px 22px !important; border-radius: 18px !important; }

    /* Testimonials */
    .lp-testimonials-grid { grid-template-columns: 1fr !important; }
    .lp-section-testi     { padding: 64px 20px; }

    /* CTA band */
    .lp-section-cta  { padding: 0 20px 64px; }
    .lp-cta-inner    { padding: 36px 24px !important; border-radius: 18px !important; }

    /* Footer */
    .lp-footer-grid { grid-template-columns: 1fr 1fr; gap: 28px; }
    .lp-footer-brand { grid-column: 1 / -1; }
  }

  @media (max-width: 480px) {
    .lp-footer-grid { grid-template-columns: 1fr; }
    .lp-footer-brand { grid-column: auto; }
  }
`;

/* ─────────── Dashboard Mockup ─────────── */
function DashboardMockup() {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 540, margin: "0 auto" }}>
      {/* Glow rings */}
      <div style={{ position: "absolute", inset: -40, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,120,255,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Main card */}
      <div style={{
        borderRadius: 20, overflow: "hidden",
        background: "linear-gradient(180deg, rgba(18,18,30,0.95), rgba(10,10,18,0.98))",
        border: "1px solid rgba(99,120,255,0.22)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,120,255,0.08)",
        animation: "floatA 7s ease-in-out infinite",
      }}>
        {/* Topbar */}
        <div style={{ height: 44, background: "rgba(12,12,22,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,80,80,0.7)" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,180,50,0.7)" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(80,210,100,0.7)" }} />
          <div style={{ flex: 1 }} />
          <div style={{ height: 24, width: 120, borderRadius: 6, background: "rgba(99,120,255,0.12)", border: "1px solid rgba(99,120,255,0.20)" }} />
        </div>

        {/* Content */}
        <div style={{ display: "flex", minHeight: 300 }}>
          {/* Sidebar */}
          <div style={{ width: 52, background: "rgba(8,8,18,0.6)", borderRight: "1px solid rgba(255,255,255,0.05)", padding: "14px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
            {["👤","🛍️","📦","🔔","📊","⚙️"].map((icon, i) => (
              <div key={i} style={{ width: 36, height: 36, borderRadius: 9, background: i === 0 ? "rgba(99,120,255,0.18)" : "transparent", border: i === 0 ? "1px solid rgba(99,120,255,0.30)" : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</div>
            ))}
          </div>

          {/* Main */}
          <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Clients", val: "1 284", color: "rgba(99,120,255,0.9)" },
                { label: "CA ce mois", val: "8 420 €", color: "rgba(80,210,140,0.9)" },
                { label: "Relances", val: "34 env.", color: "rgba(255,180,60,0.9)" },
              ].map((s, i) => (
                <div key={i} style={{ borderRadius: 10, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 4, fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Table rows */}
            <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
              {["Marie Dupont","Lucas Martin","Sophie Girard","Thomas Bernard","Emma Leroy"].map((name, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: `hsl(${220 + i * 30},60%,55%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{name[0]}</div>
                  <div style={{ flex: 1, fontSize: 11, fontWeight: 600, opacity: 0.85 }}>{name}</div>
                  <div style={{ fontSize: 9, padding: "2px 7px", borderRadius: 999, background: i === 0 ? "rgba(255,200,50,0.12)" : i === 2 ? "rgba(99,120,255,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${i === 0 ? "rgba(255,200,50,0.25)" : i === 2 ? "rgba(99,120,255,0.25)" : "rgba(255,255,255,0.08)"}`, color: i === 0 ? "rgba(255,210,60,0.95)" : i === 2 ? "rgba(99,120,255,0.9)" : "rgba(255,255,255,0.5)", fontWeight: 700 }}>
                    {i === 0 ? "VIP" : i === 2 ? "Nouveau" : "Régulier"}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(80,210,140,0.85)", fontFamily: "'DM Mono', monospace" }}>{[340,180,90,520,75][i]}€</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge 1 */}
      <div className="lp-badge-r">
        <div style={{ background: "linear-gradient(135deg, rgba(80,210,140,0.15), rgba(60,200,120,0.08))", border: "1px solid rgba(80,210,140,0.25)", borderRadius: 12, padding: "10px 16px", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          <div style={{ fontSize: 10, color: "rgba(80,210,140,0.9)", fontWeight: 800, fontFamily: "'DM Mono', monospace" }}>📧 Relance envoyée</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>34 clients inactifs</div>
        </div>
      </div>

      {/* Floating badge 2 */}
      <div className="lp-badge-l">
        <div style={{ background: "linear-gradient(135deg, rgba(99,120,255,0.15), rgba(79,99,232,0.08))", border: "1px solid rgba(99,120,255,0.28)", borderRadius: 12, padding: "10px 16px", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          <div style={{ fontSize: 10, color: "rgba(160,180,255,0.95)", fontWeight: 800, fontFamily: "'DM Mono', monospace" }}>📊 +18% ce mois</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>Chiffre d'affaires</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── FEATURES ─────────── */
const FEATURES = [
  {
    icon: "👥",
    title: "Gestion clients",
    desc: "Fiches complètes, historique des achats, tags automatiques VIP / régulier / inactif / nouveau. Filtres et recherche instantanée.",
    color: "rgba(99,120,255,0.9)",
    bg: "rgba(99,120,255,0.10)",
  },
  {
    icon: "📧",
    title: "Relances email ciblées",
    desc: "Campagnes par segment (VIP, inactifs, sans achat…) avec templates HTML personnalisables. Envoi via Resend en un clic.",
    color: "rgba(80,210,200,0.9)",
    bg: "rgba(80,210,200,0.10)",
  },
  {
    icon: "📦",
    title: "Inventaire & stock",
    desc: "Suivi des stocks en temps réel, alertes de rupture, mouvements d'entrée/sortie liés aux ventes. Jamais en rupture surprise.",
    color: "rgba(255,180,60,0.9)",
    bg: "rgba(255,180,60,0.10)",
  },
  {
    icon: "📊",
    title: "Analytiques avancées",
    desc: "Dashboard revenus, performances par vendeur, tendances mensuelles. Réservé au propriétaire pour une vision 360° de votre boutique.",
    color: "rgba(160,120,255,0.9)",
    bg: "rgba(160,120,255,0.10)",
  },
  {
    icon: "🏪",
    title: "Multi-boutiques",
    desc: "Gérez plusieurs points de vente depuis une seule interface. Données 100% isolées par boutique, basculement en un clic.",
    color: "rgba(255,120,120,0.9)",
    bg: "rgba(255,120,120,0.10)",
  },
  {
    icon: "🔐",
    title: "Système de rôles",
    desc: "Trois niveaux d'accès : Owner, Admin, Vendeur. Permissions granulaires, fermeture de boutique à distance, invitations par email.",
    color: "rgba(80,210,140,0.9)",
    bg: "rgba(80,210,140,0.10)",
  },
];

/* ─────────── TESTIMONIALS ─────────── */
const TESTIMONIALS = [
  {
    name: "Camille Renard",
    role: "Gérante — Boutique Lumière, Lyon",
    avatar: "CR",
    avatarColor: "#6378ff",
    text: "ClientFlow a transformé la gestion de ma boutique. Avant, je perdais des heures à chercher les infos clients dans des fichiers Excel. Maintenant, tout est là, structuré, et mes relances email font revenir les inactifs chaque mois.",
    stars: 5,
  },
  {
    name: "Thomas Vasseur",
    role: "Propriétaire — Galerie Essence, Bordeaux",
    avatar: "TV",
    avatarColor: "#4ecdc4",
    text: "Le système multi-boutiques est exactement ce dont j'avais besoin pour mes deux points de vente. Les analytiques m'ont permis de réaliser que 80% de mon CA venait de 20% de mes clients. Game changer.",
    stars: 5,
  },
  {
    name: "Nadia Ouali",
    role: "Co-gérante — Studio Naia, Paris",
    avatar: "NO",
    avatarColor: "#c084fc",
    text: "L'outil est beau, rapide, et vraiment pensé pour les commerçants physiques. Le système de rôles nous permet de déléguer à nos vendeuses sans stress. Support très réactif.",
    stars: 5,
  },
];

/* ─────────── MAIN ─────────── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: BG, minHeight: "100vh", overflowX: "hidden" }}>
      <style>{CSS}</style>

      {/* ══════════ NAVBAR ══════════ */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        height: 64,
        background: scrolled ? "rgba(10,10,15,0.88)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(99,120,255,0.10)" : "1px solid transparent",
        transition: "background 0.3s, backdrop-filter 0.3s, border-color 0.3s",
      }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", height: "100%", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_MID})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace", boxShadow: "0 0 16px rgba(99,120,255,0.40)" }}>CF</div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 13, letterSpacing: 2, color: "rgba(255,255,255,0.92)" }}>CLIENTFLOW</span>
          </div>

          {/* Nav links (desktop) */}
          <nav className="lp-nav-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {[["Fonctionnalités", "#features"], ["Tarif", "#pricing"], ["Témoignages", "#testimonials"]].map(([label, href]) => (
              <a key={href} href={href} style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.60)", transition: "color 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.95)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.60)"; }}>
                {label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/login" className="lp-nav-btn-connect">Se connecter</Link>
            <a href="#stripe-placeholder" className="lp-nav-btn-start">Commencer →</a>
          </div>
        </div>
      </header>

      {/* ══════════ HERO ══════════ */}
      <section className="lp-hero-section">
        {/* Background orbs */}
        <div className="lp-orb" style={{ width: 700, height: 700, top: -200, left: -200, background: "radial-gradient(circle, rgba(99,120,255,0.18) 0%, transparent 70%)", animation: "floatA 12s ease-in-out infinite" }} />
        <div className="lp-orb" style={{ width: 500, height: 500, top: 100, right: -100, background: "radial-gradient(circle, rgba(192,132,252,0.12) 0%, transparent 70%)", animation: "floatB 10s ease-in-out infinite" }} />
        <div className="lp-orb" style={{ width: 400, height: 400, bottom: 0, left: "30%", background: "radial-gradient(circle, rgba(99,120,255,0.10) 0%, transparent 70%)", animation: "floatC 14s ease-in-out infinite" }} />
        <div className="lp-grid-bg" />

        <div className="lp-hero-pad">
          <div className="lp-hero-grid">
          {/* Left */}
          <div>
            <div className="lp-hero-fadeup lp-delay-1" style={{ marginBottom: 20 }}>
              <span className="lp-tag">✦ CRM pour commerçants physiques</span>
            </div>

            <h1 className="lp-hero-fadeup lp-delay-2 lp-hero-title" style={{ fontSize: "clamp(38px, 5vw, 62px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-1.5px", color: "rgba(255,255,255,0.97)", marginBottom: 22 }}>
              Gérez votre boutique.{" "}
              <span className="lp-gradient-text">Fidélisez vos clients.</span>
            </h1>

            <p className="lp-hero-fadeup lp-delay-3" style={{ fontSize: 17, color: "rgba(255,255,255,0.52)", lineHeight: 1.72, marginBottom: 38, maxWidth: 500, fontWeight: 400 }}>
              ClientFlow est le CRM tout-en-un pensé pour les boutiques physiques — gestion clients, relances email automatiques, suivi des stocks et analytiques en temps réel.
            </p>

            <div className="lp-hero-fadeup lp-delay-4 lp-hero-ctas" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <a href="#stripe-placeholder" className="lp-btn-primary">
                Commencer maintenant →
              </a>
              <a href="#features" className="lp-btn-ghost">
                ▶ Voir les fonctionnalités
              </a>
            </div>

            <div className="lp-hero-fadeup lp-delay-4" style={{ marginTop: 40, display: "flex", gap: 32, flexWrap: "wrap" }}>
              {[["1 200+", "Clients gérés"], ["98%", "Satisfaction"], ["< 2 min", "Prise en main"]].map(([val, label]) => (
                <div key={label}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.95)", fontFamily: "'DM Mono', monospace" }}>{val}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2, fontWeight: 600, letterSpacing: 0.3 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Mockup */}
          <div className="lp-hero-fade lp-delay-2" style={{ position: "relative" }}>
            <DashboardMockup />
          </div>
          </div>{/* /lp-hero-grid */}
        </div>{/* /lp-hero-pad */}

        {/* Scroll indicator */}
        <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.3, animation: "floatA 2.5s ease-in-out infinite" }}>
          <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>SCROLL</div>
          <div style={{ width: 1, height: 32, background: "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)" }} />
        </div>
      </section>

      {/* ══════════ FEATURES ══════════ */}
      <section id="features" className="lp-section-features">
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <span className="lp-tag" style={{ marginBottom: 20, display: "inline-flex" }}>✦ Fonctionnalités</span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, letterSpacing: "-1px", color: "rgba(255,255,255,0.95)", marginTop: 16, marginBottom: 16 }}>
              Tout ce dont votre boutique a besoin
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
              Un seul outil pour remplacer vos fichiers Excel, vos SMS manuels et vos tableurs de stock.
            </p>
          </div>

          <div className="lp-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-feature-card">
                <div style={{ width: 46, height: 46, borderRadius: 13, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 18, flexShrink: 0 }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "rgba(255,255,255,0.95)", marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.68, fontWeight: 400 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ══════════ PRICING ══════════ */}
      <section id="pricing" className="lp-section-pricing">
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span className="lp-tag" style={{ marginBottom: 20, display: "inline-flex" }}>✦ Tarif</span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, letterSpacing: "-1px", color: "rgba(255,255,255,0.95)", marginTop: 16, marginBottom: 16 }}>
              Simple et transparent
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 460, margin: "0 auto", lineHeight: 1.7 }}>
              Une seule offre — tout inclus. Pas de surprises, pas de niveaux à déchiffrer.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="lp-pricing-card lp-pricing-inner" style={{
              background: "linear-gradient(145deg, rgba(18,20,36,0.95), rgba(10,11,20,0.98))",
              border: "1px solid rgba(99,120,255,0.30)",
            }}>
              {/* Background shimmer */}
              <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,120,255,0.14) 0%, transparent 70%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(192,132,252,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

              {/* Badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 12px", borderRadius: 999, background: "rgba(99,120,255,0.14)", border: "1px solid rgba(99,120,255,0.30)", color: "rgba(160,180,255,0.95)", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 28, fontFamily: "'DM Mono', monospace" }}>
                ⚡ OFFRE UNIQUE
              </div>

              {/* Price */}
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 58, fontWeight: 900, color: "rgba(255,255,255,0.97)", letterSpacing: "-2px", fontFamily: "'DM Mono', monospace" }}>450€</span>
                <span style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", marginLeft: 8, fontWeight: 500 }}>une fois</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: "rgba(99,120,255,0.95)", fontFamily: "'DM Mono', monospace" }}>+ 20€</span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", fontWeight: 500 }}>/mois ensuite</span>
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", marginBottom: 36, lineHeight: 1.6 }}>
                Setup complet + accès permanent à la plateforme. L'abonnement mensuel couvre l'hébergement, les mises à jour et le support.
              </p>

              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 28 }} />

              {/* Inclus */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 36 }}>
                {[
                  "Clients & ventes illimités",
                  "Boutiques multiples illimitées",
                  "Relances email HTML (Resend)",
                  "Gestion des stocks & alertes",
                  "Analytiques & rapports",
                  "Système de rôles & équipe",
                  "Support prioritaire",
                  "Mises à jour incluses",
                ].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span className="lp-check">✓</span>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", fontWeight: 500, lineHeight: 1.4 }}>{item}</span>
                  </div>
                ))}
              </div>

              <a href="#stripe-placeholder" className="lp-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                Commencer maintenant →
              </a>
              <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.28)", marginTop: 14 }}>Paiement sécurisé via Stripe · Sans engagement</p>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ══════════ TESTIMONIALS ══════════ */}
      <section id="testimonials" className="lp-section-testi">
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span className="lp-tag" style={{ marginBottom: 20, display: "inline-flex" }}>✦ Témoignages</span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, letterSpacing: "-1px", color: "rgba(255,255,255,0.95)", marginTop: 16 }}>
              Ils ont adopté ClientFlow
            </h2>
          </div>

          <div className="lp-testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="lp-testimonial">
                {/* Stars */}
                <div style={{ display: "flex", gap: 3, marginBottom: 18 }}>
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <span key={i} style={{ color: "rgba(255,200,60,0.9)", fontSize: 14 }}>★</span>
                  ))}
                </div>

                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.58)", lineHeight: 1.72, marginBottom: 24, fontStyle: "italic", fontWeight: 400 }}>"{t.text}"</p>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${t.avatarColor}, ${t.avatarColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.90)" }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.36)", marginTop: 2 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA BAND ══════════ */}
      <section className="lp-section-cta">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="lp-cta-inner" style={{
            background: "linear-gradient(135deg, rgba(99,120,255,0.12) 0%, rgba(192,132,252,0.08) 100%)",
            border: "1px solid rgba(99,120,255,0.22)",
          }}>
            <div style={{ position: "absolute", top: -60, right: -60, width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,120,255,0.20) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -50, left: -50, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(192,132,252,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />

            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 900, letterSpacing: "-0.8px", color: "rgba(255,255,255,0.97)", marginBottom: 14 }}>
              Prêt à moderniser votre boutique ?
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", marginBottom: 36, maxWidth: 440, margin: "0 auto 36px", lineHeight: 1.65 }}>
              Rejoignez les commerçants qui ont déjà optimisé leur relation client avec ClientFlow.
            </p>

            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="#stripe-placeholder" className="lp-btn-primary">Commencer maintenant →</a>
              <Link href="/login" className="lp-btn-ghost">Se connecter</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "48px 24px 36px" }}>
        <div className="lp-footer-grid" style={{ maxWidth: 1140, margin: "0 auto" }}>
          {/* Brand */}
          <div className="lp-footer-brand">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_MID})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace" }}>CF</div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 12, letterSpacing: 2, color: "rgba(255,255,255,0.85)" }}>CLIENTFLOW</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, maxWidth: 260, fontWeight: 400 }}>
              Le CRM pensé pour les commerçants physiques. Gérez votre clientèle, automatisez vos relances, développez votre boutique.
            </p>
          </div>

          {/* Produit */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 16 }}>Produit</div>
            {[["Fonctionnalités", "#features"], ["Tarif", "#pricing"], ["Connexion", "/login"]].map(([label, href]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <Link href={href} style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", fontWeight: 500, transition: "color 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.50)"; }}>
                  {label}
                </Link>
              </div>
            ))}
          </div>

          {/* Légal */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 16 }}>Légal</div>
            {["Mentions légales", "CGU", "Politique de confidentialité"].map(label => (
              <div key={label} style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", fontWeight: 500, cursor: "pointer" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 16 }}>Contact</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", fontWeight: 500, marginBottom: 10 }}>contact@clientflow.fr</div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {/* Social placeholders */}
              {["𝕏", "in", "ig"].map(s => (
                <div key={s} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "rgba(255,255,255,0.40)", cursor: "pointer" }}>{s}</div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 28 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace" }}>© {new Date().getFullYear()} ClientFlow · Tous droits réservés</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", fontFamily: "'DM Mono', monospace" }}>v1.0 · BETA</span>
        </div>
      </footer>
    </div>
  );
}
