"use client";
import { useState, useMemo } from "react";

/* ── Types ── */
type Segment = "VIP" | "Régulier" | "À relancer" | "Inactif" | "Nouveau";

interface Purchase {
  date: string;
  product: string;
  amount: number;
}

interface Client {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  tel: string;
  segment: Segment;
  total: number;
  visits: number;
  lastVisit: string;
  purchases: Purchase[];
}

interface Product {
  name: string;
  stock: number;
  maxStock: number;
  price: number;
  category: string;
}

/* ── Data ── */
const CLIENTS: Client[] = [
  {
    id: 1, prenom: "Sophie", nom: "Martin", email: "sophie.martin@email.fr", tel: "06 12 34 56 78",
    segment: "VIP", total: 1240, visits: 14, lastVisit: "15/03/2026",
    purchases: [
      { date: "15/03/2026", product: "Sac en cuir Milano", amount: 129 },
      { date: "02/03/2026", product: "Écharpe cachemire", amount: 89 },
      { date: "18/02/2026", product: "Perfume Rose Noire", amount: 74 },
      { date: "05/01/2026", product: "Ceinture tressée", amount: 55 },
    ],
  },
  {
    id: 2, prenom: "Chloé", nom: "Petit", email: "chloe.petit@email.fr", tel: "06 98 76 54 32",
    segment: "VIP", total: 2100, visits: 22, lastVisit: "17/03/2026",
    purchases: [
      { date: "17/03/2026", product: "Chapeau de paille", amount: 42 },
      { date: "10/03/2026", product: "Sac en cuir Milano", amount: 129 },
      { date: "20/02/2026", product: "Perfume Rose Noire", amount: 74 },
      { date: "01/02/2026", product: "Écharpe cachemire", amount: 89 },
    ],
  },
  {
    id: 3, prenom: "Thomas", nom: "Leroy", email: "thomas.leroy@email.fr", tel: "07 11 22 33 44",
    segment: "Régulier", total: 480, visits: 6, lastVisit: "28/02/2026",
    purchases: [
      { date: "28/02/2026", product: "Carnet moleskine", amount: 18 },
      { date: "10/02/2026", product: "Ceinture tressée", amount: 55 },
      { date: "15/01/2026", product: "Écharpe cachemire", amount: 89 },
      { date: "20/12/2025", product: "Chapeau de paille", amount: 42 },
    ],
  },
  {
    id: 4, prenom: "Julien", nom: "Laurent", email: "julien.laurent@email.fr", tel: "06 55 44 33 22",
    segment: "Régulier", total: 390, visits: 5, lastVisit: "20/02/2026",
    purchases: [
      { date: "20/02/2026", product: "Ceinture tressée", amount: 55 },
      { date: "05/02/2026", product: "Carnet moleskine", amount: 18 },
      { date: "10/01/2026", product: "Écharpe cachemire", amount: 89 },
      { date: "01/12/2025", product: "Chapeau de paille", amount: 42 },
    ],
  },
  {
    id: 5, prenom: "Emma", nom: "Dubois", email: "emma.dubois@email.fr", tel: "07 66 77 88 99",
    segment: "À relancer", total: 220, visits: 3, lastVisit: "05/01/2026",
    purchases: [
      { date: "05/01/2026", product: "Parfum Rose Noire", amount: 74 },
      { date: "10/11/2025", product: "Carnet moleskine", amount: 18 },
      { date: "20/09/2025", product: "Écharpe cachemire", amount: 89 },
    ],
  },
  {
    id: 6, prenom: "Léa", nom: "Simon", email: "lea.simon@email.fr", tel: "06 44 55 66 77",
    segment: "À relancer", total: 310, visits: 4, lastVisit: "12/12/2025",
    purchases: [
      { date: "12/12/2025", product: "Sac en cuir Milano", amount: 129 },
      { date: "01/10/2025", product: "Ceinture tressée", amount: 55 },
      { date: "15/07/2025", product: "Chapeau de paille", amount: 42 },
      { date: "20/04/2025", product: "Carnet moleskine", amount: 18 },
    ],
  },
  {
    id: 7, prenom: "Lucas", nom: "Bernard", email: "lucas.bernard@email.fr", tel: "07 33 22 11 00",
    segment: "Inactif", total: 95, visits: 2, lastVisit: "10/08/2025",
    purchases: [
      { date: "10/08/2025", product: "Carnet moleskine", amount: 18 },
      { date: "20/03/2025", product: "Ceinture tressée", amount: 55 },
    ],
  },
  {
    id: 8, prenom: "Nicolas", nom: "Moreau", email: "nicolas.moreau@email.fr", tel: "06 77 88 99 00",
    segment: "Nouveau", total: 0, visits: 0, lastVisit: "—",
    purchases: [],
  },
];

const PRODUCTS: Product[] = [
  { name: "Sac en cuir Milano", stock: 2, maxStock: 30, price: 129, category: "Maroquinerie" },
  { name: "Écharpe cachemire", stock: 12, maxStock: 40, price: 89, category: "Accessoires" },
  { name: "Perfume Rose Noire", stock: 4, maxStock: 25, price: 74, category: "Beauté" },
  { name: "Ceinture tressée", stock: 8, maxStock: 35, price: 55, category: "Accessoires" },
  { name: "Chapeau de paille", stock: 1, maxStock: 20, price: 42, category: "Mode" },
  { name: "Carnet moleskine", stock: 24, maxStock: 50, price: 18, category: "Papeterie" },
];

const RELANCE_SEGMENTS = [
  { label: "VIP", count: 2, desc: "Clients premium — dernière visite < 30 jours", color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" },
  { label: "Fidèles", count: 2, desc: "Clients réguliers — 2 à 5 achats enregistrés", color: "#6378ff", bg: "rgba(99,120,255,0.10)", border: "rgba(99,120,255,0.25)" },
  { label: "À relancer", count: 2, desc: "Sans achat depuis 30 à 90 jours", color: "#f97316", bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.25)" },
  { label: "Inactifs", count: 1, desc: "Sans achat depuis plus de 6 mois", color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)" },
  { label: "Sans achat", count: 1, desc: "Clients inscrits mais jamais achetés", color: "rgba(255,255,255,0.38)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)" },
];

/* ── Segment badge ── */
const SEG_COLORS: Record<Segment, { color: string; bg: string; border: string }> = {
  VIP:         { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.30)" },
  Régulier:    { color: "#6378ff", bg: "rgba(99,120,255,0.12)", border: "rgba(99,120,255,0.30)" },
  "À relancer":{ color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.30)" },
  Inactif:     { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.30)" },
  Nouveau:     { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.30)" },
};

function SegBadge({ seg }: { seg: Segment }) {
  const c = SEG_COLORS[seg];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: c.color, background: c.bg, border: `1px solid ${c.border}`, whiteSpace: "nowrap", fontFamily: "DM Mono, monospace" }}>
      {seg}
    </span>
  );
}

/* ── Tab button ── */
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
        fontSize: 12.5, fontWeight: active ? 700 : 500,
        color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.40)",
        background: active ? "rgba(99,120,255,0.18)" : "transparent",
        transition: "all 150ms", fontFamily: "inherit",
        boxShadow: active ? "inset 0 0 0 1px rgba(99,120,255,0.35)" : "none",
      }}
    >
      {label}
    </button>
  );
}

/* ── Clients tab ── */
function TabClients({ onSelect }: { onSelect: (c: Client) => void }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() =>
    CLIENTS.filter(c => `${c.prenom} ${c.nom}`.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  const counts = useMemo(() => ({
    VIP: CLIENTS.filter(c => c.segment === "VIP").length,
    "À relancer": CLIENTS.filter(c => c.segment === "À relancer").length,
    Inactif: CLIENTS.filter(c => c.segment === "Inactif").length,
    Nouveau: CLIENTS.filter(c => c.segment === "Nouveau").length,
  }), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Segment counters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(counts).map(([seg, n]) => {
          const c = SEG_COLORS[seg as Segment];
          return (
            <div key={seg} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, background: c.bg, border: `1px solid ${c.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: c.color }}>{n}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", fontWeight: 500 }}>{seg}</span>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.35 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un client..."
          style={{
            width: "100%", padding: "8px 12px 8px 32px", borderRadius: 9,
            border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "inherit",
            outline: "none",
          }}
        />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Client", "Segment", "CA total", "Dernière visite"].map(h => (
                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "DM Mono, monospace" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr
                key={c.id}
                onClick={() => onSelect(c)}
                style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "pointer", transition: "background 120ms" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(99,120,255,0.05)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>{c.prenom} {c.nom}</div>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.32)", marginTop: 1 }}>{c.email}</div>
                </td>
                <td style={{ padding: "10px 14px" }}><SegBadge seg={c.segment} /></td>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: "rgba(255,255,255,0.80)", fontFamily: "DM Mono, monospace" }}>
                  {c.total > 0 ? `${c.total.toLocaleString("fr-FR")} €` : "—"}
                </td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.40)", fontFamily: "DM Mono, monospace" }}>{c.lastVisit}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>Aucun client trouvé</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Fiche Client tab ── */
function TabFiche({ client, onBack }: { client: Client | null; onBack: () => void }) {
  if (!client) {
    return (
      <div style={{ textAlign: "center", padding: "48px 16px", color: "rgba(255,255,255,0.28)" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>👆</div>
        <div style={{ fontSize: 14 }}>Cliquez sur un client dans l&apos;onglet Clients pour voir sa fiche</div>
      </div>
    );
  }

  const c = SEG_COLORS[client.segment];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Back */}
      <button type="button" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "rgba(99,120,255,0.80)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        Retour aux clients
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${c.color}33, ${c.color}22)`, border: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: c.color, flexShrink: 0, fontFamily: "DM Mono, monospace" }}>
          {client.prenom[0]}{client.nom[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>{client.prenom} {client.nom}</span>
            <SegBadge seg={client.segment} />
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.38)" }}>{client.email} · {client.tel}</div>
        </div>
        <button type="button" style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(99,120,255,0.35)", background: "rgba(99,120,255,0.12)", color: "rgba(165,180,255,0.90)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          ✉ Envoyer une relance
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "CA total", value: client.total > 0 ? `${client.total.toLocaleString("fr-FR")} €` : "—" },
          { label: "Visites", value: client.visits > 0 ? `${client.visits}` : "—" },
          { label: "Dernière visite", value: client.lastVisit },
        ].map(s => (
          <div key={s.label} style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.88)", fontFamily: "DM Mono, monospace" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Purchases */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, fontFamily: "DM Mono, monospace" }}>Historique des achats</div>
        {client.purchases.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13, borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>Aucun achat enregistré</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {client.purchases.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.82)" }}>{p.product}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", fontFamily: "DM Mono, monospace", marginTop: 2 }}>{p.date}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.70)", fontFamily: "DM Mono, monospace" }}>{p.amount} €</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Relances tab ── */
function TabRelances() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", marginBottom: 4 }}>5 segments détectés automatiquement par ClientFlow</div>
      {RELANCE_SEGMENTS.map(seg => (
        <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderRadius: 11, background: seg.bg, border: `1px solid ${seg.border}` }}>
          <div style={{ minWidth: 36, height: 36, borderRadius: 10, background: `${seg.color}22`, border: `1px solid ${seg.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: seg.color, fontFamily: "DM Mono, monospace" }}>{seg.count}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{seg.label}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{seg.desc}</div>
          </div>
          <button type="button" style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${seg.border}`, background: seg.bg, color: seg.color, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            Créer une campagne
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Inventaire tab ── */
function TabInventaire() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {PRODUCTS.map(p => {
        const isLow = p.stock <= 5;
        const pct = Math.round((p.stock / p.maxStock) * 100);
        const barColor = isLow ? (p.stock <= 2 ? "#ef4444" : "#f97316") : "#6378ff";
        return (
          <div key={p.name} style={{ padding: "12px 16px", borderRadius: 11, background: isLow ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.03)", border: `1px solid ${isLow ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.07)"}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>{p.name}</span>
                  {isLow && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.30)", color: "#ef4444" }}>
                      Stock faible
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.30)", marginTop: 2 }}>{p.category}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: isLow ? "#ef4444" : "rgba(255,255,255,0.75)", fontFamily: "DM Mono, monospace" }}>{p.stock} / {p.maxStock}</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", fontFamily: "DM Mono, monospace" }}>{p.price} €</div>
              </div>
            </div>
            <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: barColor, transition: "width 0.6s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main component ── */
const TABS = ["Clients", "Fiche Client", "Relances", "Inventaire"] as const;
type TabName = typeof TABS[number];

export function DemoInteractive() {
  const [activeTab, setActiveTab] = useState<TabName>("Clients");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [visible, setVisible] = useState(false);

  function handleSelectClient(c: Client) {
    setSelectedClient(c);
    setActiveTab("Fiche Client");
  }

  function handleTabChange(tab: TabName) {
    setVisible(false);
    setTimeout(() => {
      setActiveTab(tab);
      setVisible(true);
    }, 120);
  }

  // init visible
  if (!visible && activeTab === "Clients") {
    setTimeout(() => setVisible(true), 50);
  }

  return (
    <section style={{ padding: "80px 24px", background: "transparent" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 999, background: "rgba(99,120,255,0.10)", border: "1px solid rgba(99,120,255,0.22)", fontSize: 12, fontWeight: 700, color: "rgba(165,180,255,0.85)", fontFamily: "DM Mono, monospace", letterSpacing: 0.5, marginBottom: 20 }}>
            ✦ Démo interactive
          </span>
          <h2 style={{ fontSize: "clamp(26px,4vw,44px)", fontWeight: 900, letterSpacing: "-1px", color: "rgba(255,255,255,0.95)", lineHeight: 1.1, marginBottom: 14 }}>
            Voyez ClientFlow{" "}
            <span style={{ background: "linear-gradient(135deg,#6378ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>en action</span>
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.42)", maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>
            Explorez les fonctionnalités sans créer de compte
          </p>
        </div>

        {/* Browser mockup */}
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 40px 100px rgba(0,0,0,0.60), 0 0 0 1px rgba(99,120,255,0.08)", background: "#0c0c14" }}>
          {/* Browser bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "rgba(10,10,20,0.90)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f57" }} />
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#febc2e" }} />
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28c840" }} />
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 16px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.30)", fontFamily: "DM Mono, monospace" }}>app.clientflow.fr</span>
              </div>
            </div>
          </div>

          {/* App shell */}
          <div style={{ display: "flex", minHeight: 480 }}>
            {/* Sidebar */}
            <div style={{ width: 52, background: "rgba(8,8,16,0.80)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#6378ff,#4f63e8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#fff", fontFamily: "DM Mono, monospace", marginBottom: 8 }}>CF</div>
              {["👤","🛍️","📦","🔔","📊","⚙️"].map((icon, i) => (
                <div key={i} style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: i === 0 ? "rgba(99,120,255,0.15)" : "transparent", border: i === 0 ? "1px solid rgba(99,120,255,0.30)" : "1px solid transparent" }}>
                  {icon}
                </div>
              ))}
            </div>

            {/* Main */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Topbar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,10,20,0.60)" }}>
                <div style={{ flex: 1 }}>
                  {/* Tabs */}
                  <div style={{ display: "flex", gap: 4 }}>
                    {TABS.map(tab => (
                      <Tab key={tab} label={tab} active={activeTab === tab} onClick={() => handleTabChange(tab)} />
                    ))}
                  </div>
                </div>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#6378ff,#4f63e8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: "DM Mono, monospace" }}>JD</div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, padding: "16px", overflowY: "auto", opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}>
                {activeTab === "Clients" && <TabClients onSelect={handleSelectClient} />}
                {activeTab === "Fiche Client" && <TabFiche client={selectedClient} onBack={() => handleTabChange("Clients")} />}
                {activeTab === "Relances" && <TabRelances />}
                {activeTab === "Inventaire" && <TabInventaire />}
              </div>
            </div>
          </div>
        </div>

        {/* Caption */}
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12.5, color: "rgba(255,255,255,0.22)", fontFamily: "DM Mono, monospace" }}>
          Données fictives — interface identique à la version réelle
        </p>
      </div>
    </section>
  );
}
