"use client";
import { useState, useMemo, useRef, useEffect } from "react";

/* ── Types ── */
type Segment = "VIP" | "Régulier" | "À relancer" | "Inactif" | "Nouveau";
type View = "clients" | "fiche" | "relances" | "inventaire" | "produits" | "analytiques" | "parametres";

interface Purchase { date: string; product: string; amount: number; }
interface Client {
  id: number; prenom: string; nom: string; email: string; tel: string;
  segment: Segment; total: number; visits: number; lastVisit: string;
  purchases: Purchase[];
}
interface Product { name: string; stock: number; maxStock: number; price: number; category: string; }

/* ── Data ── */
const CLIENTS: Client[] = [
  { id: 1, prenom: "Sophie", nom: "Martin", email: "sophie.martin@email.fr", tel: "06 12 34 56 78",
    segment: "VIP", total: 1240, visits: 14, lastVisit: "15/03/2026",
    purchases: [
      { date: "15/03/2026", product: "Sac en cuir Milano", amount: 129 },
      { date: "02/03/2026", product: "Écharpe cachemire", amount: 89 },
      { date: "18/02/2026", product: "Perfume Rose Noire", amount: 74 },
      { date: "05/01/2026", product: "Ceinture tressée", amount: 55 },
    ] },
  { id: 2, prenom: "Chloé", nom: "Petit", email: "chloe.petit@email.fr", tel: "06 98 76 54 32",
    segment: "VIP", total: 2100, visits: 22, lastVisit: "17/03/2026",
    purchases: [
      { date: "17/03/2026", product: "Chapeau de paille", amount: 42 },
      { date: "10/03/2026", product: "Sac en cuir Milano", amount: 129 },
      { date: "20/02/2026", product: "Perfume Rose Noire", amount: 74 },
      { date: "01/02/2026", product: "Écharpe cachemire", amount: 89 },
    ] },
  { id: 3, prenom: "Thomas", nom: "Leroy", email: "thomas.leroy@email.fr", tel: "07 11 22 33 44",
    segment: "Régulier", total: 480, visits: 6, lastVisit: "28/02/2026",
    purchases: [
      { date: "28/02/2026", product: "Carnet moleskine", amount: 18 },
      { date: "10/02/2026", product: "Ceinture tressée", amount: 55 },
      { date: "15/01/2026", product: "Écharpe cachemire", amount: 89 },
      { date: "20/12/2025", product: "Chapeau de paille", amount: 42 },
    ] },
  { id: 4, prenom: "Julien", nom: "Laurent", email: "julien.laurent@email.fr", tel: "06 55 44 33 22",
    segment: "Régulier", total: 390, visits: 5, lastVisit: "20/02/2026",
    purchases: [
      { date: "20/02/2026", product: "Ceinture tressée", amount: 55 },
      { date: "05/02/2026", product: "Carnet moleskine", amount: 18 },
      { date: "10/01/2026", product: "Écharpe cachemire", amount: 89 },
      { date: "01/12/2025", product: "Chapeau de paille", amount: 42 },
    ] },
  { id: 5, prenom: "Emma", nom: "Dubois", email: "emma.dubois@email.fr", tel: "07 66 77 88 99",
    segment: "À relancer", total: 220, visits: 3, lastVisit: "05/01/2026",
    purchases: [
      { date: "05/01/2026", product: "Parfum Rose Noire", amount: 74 },
      { date: "10/11/2025", product: "Carnet moleskine", amount: 18 },
      { date: "20/09/2025", product: "Écharpe cachemire", amount: 89 },
    ] },
  { id: 6, prenom: "Léa", nom: "Simon", email: "lea.simon@email.fr", tel: "06 44 55 66 77",
    segment: "À relancer", total: 310, visits: 4, lastVisit: "12/12/2025",
    purchases: [
      { date: "12/12/2025", product: "Sac en cuir Milano", amount: 129 },
      { date: "01/10/2025", product: "Ceinture tressée", amount: 55 },
      { date: "15/07/2025", product: "Chapeau de paille", amount: 42 },
      { date: "20/04/2025", product: "Carnet moleskine", amount: 18 },
    ] },
  { id: 7, prenom: "Lucas", nom: "Bernard", email: "lucas.bernard@email.fr", tel: "07 33 22 11 00",
    segment: "Inactif", total: 95, visits: 2, lastVisit: "10/08/2025",
    purchases: [
      { date: "10/08/2025", product: "Carnet moleskine", amount: 18 },
      { date: "20/03/2025", product: "Ceinture tressée", amount: 55 },
    ] },
  { id: 8, prenom: "Nicolas", nom: "Moreau", email: "nicolas.moreau@email.fr", tel: "06 77 88 99 00",
    segment: "Nouveau", total: 0, visits: 0, lastVisit: "—", purchases: [] },
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

const SEG_COLORS: Record<Segment, { color: string; bg: string; border: string }> = {
  VIP:          { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.30)" },
  Régulier:     { color: "#6378ff", bg: "rgba(99,120,255,0.12)", border: "rgba(99,120,255,0.30)" },
  "À relancer": { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.30)" },
  Inactif:      { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.30)" },
  Nouveau:      { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.30)" },
};

/* ── SVG Icons ── */
const IcoClients = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IcoProduits = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const IcoInventaire = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
    <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
  </svg>
);
const IcoRelances = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l19-9-9 19-2-8-8-2z"/>
  </svg>
);
const IcoAnalytiques = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/>
    <line x1="6" x2="6" y1="20" y2="16"/><line x1="2" x2="22" y1="20" y2="20"/>
  </svg>
);
const IcoParametres = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IcoBell = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

/* ── Sidebar nav config ── */
interface NavItem { label: string; view: View | null; icon: React.ReactNode; }
const NAV_ITEMS: NavItem[] = [
  { label: "Clients",     view: "clients",     icon: <IcoClients /> },
  { label: "Produits",    view: "produits",    icon: <IcoProduits /> },
  { label: "Inventaire",  view: "inventaire",  icon: <IcoInventaire /> },
  { label: "Relances",    view: "relances",    icon: <IcoRelances /> },
  { label: "Analytiques", view: "analytiques", icon: <IcoAnalytiques /> },
  { label: "Paramètres",  view: "parametres",  icon: <IcoParametres /> },
];

const PAGE_TITLES: Record<View, string> = {
  clients:    "Clients",
  fiche:      "Fiche client",
  produits:   "Produits",
  relances:   "Relances",
  inventaire: "Inventaire",
  analytiques:"Analytiques",
  parametres: "Paramètres",
};

/* ── Demo notifications ── */
const DEMO_NOTIFS = [
  { id: 1, icon: "📦", title: "Stock faible : Robe florale", message: "Plus que 3 unités en stock.", time: "il y a 2h" },
  { id: 2, icon: "👥", title: "8 clients inactifs à relancer", message: "Sans achat depuis +90 jours.", time: "il y a 5h" },
  { id: 3, icon: "✨", title: "Suggestion IA", message: "Lancer une campagne VIP ce weekend.", time: "il y a 8h" },
  { id: 4, icon: "💤", title: "Emma Dubois inactive", message: "N'a pas acheté depuis 4 mois.", time: "il y a 1j" },
];

/* ── Helper components ── */
function SegBadge({ seg }: { seg: Segment }) {
  const c = SEG_COLORS[seg];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: c.color, background: c.bg, border: `1px solid ${c.border}`, whiteSpace: "nowrap", fontFamily: "DM Mono, monospace" }}>
      {seg}
    </span>
  );
}

/* ── Notification Bell ── */
function NotifBell() {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const unread = read ? 0 : DEMO_NOTIFS.length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ position: "relative", width: 30, height: 30, borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.65)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
      >
        <IcoBell />
        {unread > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 999, background: "rgba(235,60,60,0.92)", border: "1.5px solid #0c0c14", color: "#fff", fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", fontFamily: "DM Mono, monospace" }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 300, borderRadius: 14, background: "linear-gradient(180deg,rgba(18,20,28,0.99),rgba(10,11,16,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 20px 60px rgba(0,0,0,0.75)", backdropFilter: "blur(20px)", zIndex: 999, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 13 }}>🔔</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>Notifications</span>
              {unread > 0 && (
                <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: "rgba(255,60,60,0.14)", border: "1px solid rgba(255,60,60,0.28)", color: "rgba(255,130,110,0.95)" }}>
                  {unread} non lue{unread > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* List */}
          <div>
            {DEMO_NOTIFS.map(n => (
              <div key={n.id} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: read ? "transparent" : "rgba(99,120,255,0.03)" }}>
                <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{n.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: read ? 600 : 800, color: read ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.92)", marginBottom: 2, lineHeight: 1.3 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 4, fontFamily: "DM Mono, monospace" }}>{n.time}</div>
                </div>
                {!read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(99,120,255,0.9)", flexShrink: 0, marginTop: 4 }} />}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <button
              type="button"
              onClick={() => setRead(true)}
              style={{ width: "100%", padding: "7px", borderRadius: 8, border: "1px solid rgba(99,120,255,0.25)", background: "rgba(99,120,255,0.08)", color: "rgba(165,180,255,0.85)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              Tout marquer comme lu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── useIsMobile hook ── */
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

/* ── Tab content components ── */
function TabClients({ onSelect, isMobile }: { onSelect: (c: Client) => void; isMobile: boolean }) {
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
      <div style={{ position: "relative" }}>
        <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.35 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un client..."
          style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
        />
      </div>
      {isMobile ? (
        /* Cards on mobile */
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(c => (
            <div key={c.id} onClick={() => onSelect(c)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(99,120,255,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${SEG_COLORS[c.segment].color}22`, border: `1px solid ${SEG_COLORS[c.segment].border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: SEG_COLORS[c.segment].color, flexShrink: 0, fontFamily: "DM Mono, monospace" }}>
                {c.prenom[0]}{c.nom[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.88)", fontSize: 13 }}>{c.prenom} {c.nom}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>
              </div>
              <SegBadge seg={c.segment} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>Aucun client trouvé</div>
          )}
        </div>
      ) : (
        /* Table on desktop */
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
                <tr key={c.id} onClick={() => onSelect(c)}
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
      )}
    </div>
  );
}

function TabFiche({ client, onBack, isMobile }: { client: Client | null; onBack: () => void; isMobile: boolean }) {
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
      <button type="button" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "rgba(99,120,255,0.80)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        Retour aux clients
      </button>
      <div style={{ padding: "14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Avatar + info row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg, ${c.color}33, ${c.color}22)`, border: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: c.color, flexShrink: 0, fontFamily: "DM Mono, monospace" }}>
            {client.prenom[0]}{client.nom[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>{client.prenom} {client.nom}</span>
              <SegBadge seg={client.segment} />
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.38)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.email} · {client.tel}</div>
          </div>
        </div>
        {/* Button — full width on mobile, inline on desktop */}
        <button type="button" style={{ width: isMobile ? "100%" : "auto", padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(99,120,255,0.35)", background: "rgba(99,120,255,0.12)", color: "rgba(165,180,255,0.90)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          ✉ Envoyer une relance
        </button>
      </div>
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
                  {isLow && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.30)", color: "#ef4444" }}>Stock faible</span>}
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

/* ── Produits tab ── */
const DEMO_PRODUCTS = [
  { name: "Robe florale été",        category: "Mode",         price: 89,  stock: 18, active: true },
  { name: "Sac bandoulière cuir",    category: "Maroquinerie", price: 145, stock: 5,  active: true },
  { name: "Escarpins daim noir",     category: "Chaussures",   price: 119, stock: 8,  active: true },
  { name: "Collier perles dorées",   category: "Bijoux",       price: 59,  stock: 22, active: true },
  { name: "Veste en jean vintage",   category: "Mode",         price: 98,  stock: 3,  active: true },
  { name: "Pochette velours bordeaux", category: "Maroquinerie", price: 49, stock: 0, active: false },
];

function TabProduits({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.40)" }}>6 produits dans votre catalogue</div>
        <button type="button" style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(99,120,255,0.35)", background: "rgba(99,120,255,0.12)", color: "rgba(165,180,255,0.90)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          + Ajouter un produit
        </button>
      </div>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
        <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Produit", "Catégorie", "Prix", "Stock", "Statut"].map(h => (
                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "DM Mono, monospace", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEMO_PRODUCTS.map((p, i) => (
              <tr key={p.name} style={{ borderBottom: i < DEMO_PRODUCTS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>{p.name}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.40)", whiteSpace: "nowrap" }}>{p.category}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: "rgba(255,255,255,0.75)", fontFamily: "DM Mono, monospace", whiteSpace: "nowrap" }}>{p.price} €</td>
                <td style={{ padding: "10px 14px", fontFamily: "DM Mono, monospace", fontSize: 12, color: p.stock === 0 ? "#ef4444" : p.stock <= 5 ? "#f97316" : "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>{p.stock}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: p.active ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${p.active ? "rgba(16,185,129,0.30)" : "rgba(255,255,255,0.10)"}`, color: p.active ? "#10b981" : "rgba(255,255,255,0.30)" }}>
                    {p.active ? "Actif" : "Inactif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isMobile && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.22)", fontFamily: "DM Mono, monospace" }}>
          <span>←</span>
          <span>Glissez pour voir plus</span>
          <span>→</span>
        </div>
      )}
    </div>
  );
}

/* ── Analytiques tab ── */
interface MonthData {
  month: string;
  value: number;
  ca: string;
  clients: string;
  retour: string;
  panier: string;
  deltaCA: string; caUp: boolean;
  deltaClients: string; clientsUp: boolean;
  deltaRetour: string; retourUp: boolean;
  deltaPanier: string; panierUp: boolean;
  top3: { name: string; total: string; badge: string }[];
}
const CHART_DATA: MonthData[] = [
  { month: "Oct", value: 3200, ca: "3 200 €", clients: "2", retour: "65%", panier: "118 €",
    deltaCA: "+14%", caUp: true, deltaClients: "+1", clientsUp: true, deltaRetour: "+3%", retourUp: true, deltaPanier: "+5%", panierUp: true,
    top3: [{ name: "Chloé Petit", total: "284 €", badge: "🥇" }, { name: "Sophie Martin", total: "196 €", badge: "🥈" }, { name: "Marie Dubois", total: "68 €", badge: "🥉" }] },
  { month: "Nov", value: 3800, ca: "3 800 €", clients: "3", retour: "67%", panier: "122 €",
    deltaCA: "+19%", caUp: true, deltaClients: "+1", clientsUp: true, deltaRetour: "+2%", retourUp: true, deltaPanier: "+3%", panierUp: true,
    top3: [{ name: "Chloé Petit", total: "312 €", badge: "🥇" }, { name: "Sophie Martin", total: "205 €", badge: "🥈" }, { name: "Thomas Leroy", total: "88 €", badge: "🥉" }] },
  { month: "Déc", value: 5200, ca: "5 200 €", clients: "5", retour: "72%", panier: "134 €",
    deltaCA: "+37%", caUp: true, deltaClients: "+2", clientsUp: true, deltaRetour: "+5%", retourUp: true, deltaPanier: "+10%", panierUp: true,
    top3: [{ name: "Chloé Petit", total: "428 €", badge: "🥇" }, { name: "Sophie Martin", total: "310 €", badge: "🥈" }, { name: "Amina Traoré", total: "124 €", badge: "🥉" }] },
  { month: "Jan", value: 3600, ca: "3 600 €", clients: "2", retour: "64%", panier: "115 €",
    deltaCA: "-31%", caUp: false, deltaClients: "-3", clientsUp: false, deltaRetour: "-8%", retourUp: false, deltaPanier: "-14%", panierUp: false,
    top3: [{ name: "Sophie Martin", total: "298 €", badge: "🥇" }, { name: "Chloé Petit", total: "201 €", badge: "🥈" }, { name: "Thomas Leroy", total: "75 €", badge: "🥉" }] },
  { month: "Fév", value: 4100, ca: "4 100 €", clients: "3", retour: "66%", panier: "120 €",
    deltaCA: "+14%", caUp: true, deltaClients: "+1", clientsUp: true, deltaRetour: "+2%", retourUp: true, deltaPanier: "+4%", panierUp: true,
    top3: [{ name: "Chloé Petit", total: "336 €", badge: "🥇" }, { name: "Sophie Martin", total: "218 €", badge: "🥈" }, { name: "Amina Traoré", total: "92 €", badge: "🥉" }] },
  { month: "Mar", value: 4820, ca: "4 820 €", clients: "3", retour: "68%", panier: "127 €",
    deltaCA: "+18%", caUp: true, deltaClients: "0", clientsUp: true, deltaRetour: "+2%", retourUp: true, deltaPanier: "+6%", panierUp: true,
    top3: [{ name: "Chloé Petit", total: "354 €", badge: "🥇" }, { name: "Sophie Martin", total: "218 €", badge: "🥈" }, { name: "Thomas Leroy", total: "73 €", badge: "🥉" }] },
];
const CHART_MAX = 6000;

function TabAnalytiques({ isMobile }: { isMobile: boolean }) {
  const [selectedIdx, setSelectedIdx] = useState(CHART_DATA.length - 1);
  const d = CHART_DATA[selectedIdx];
  const kpis = [
    { label: "CA du mois",       value: d.ca,      delta: d.deltaCA,      up: d.caUp },
    { label: "Nvx clients",      value: d.clients,  delta: d.deltaClients, up: d.clientsUp },
    { label: "Taux retour",      value: d.retour,   delta: d.deltaRetour,  up: d.retourUp },
    { label: "Panier moyen",     value: d.panier,   delta: d.deltaPanier,  up: d.panierUp },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI cards — 2×2 grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ padding: isMobile ? "8px 10px" : "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", minWidth: 0 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.label}</div>
            <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 900, color: "rgba(255,255,255,0.92)", fontFamily: "DM Mono, monospace", letterSpacing: -0.5, whiteSpace: "nowrap", lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: k.up ? "#10b981" : "#ef4444" }}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.50)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "DM Mono, monospace" }}>CA mensuel — 6 derniers mois</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 110 }}>
          {CHART_DATA.map((bar, i) => {
            const h = Math.round((bar.value / CHART_MAX) * 100);
            const isActive = i === selectedIdx;
            return (
              <div
                key={bar.month}
                onClick={() => setSelectedIdx(i)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", cursor: "pointer" }}
              >
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                  <div style={{ width: "100%", height: `${h}%`, borderRadius: "5px 5px 0 0", background: isActive ? "linear-gradient(180deg,#6378ff,#4f63e8)" : "rgba(99,120,255,0.25)", boxShadow: isActive ? "0 0 14px rgba(99,120,255,0.45)" : "none", transition: "background 0.2s, box-shadow 0.2s" }} />
                </div>
                <div style={{ fontSize: 10, color: isActive ? "rgba(165,180,255,0.90)" : "rgba(255,255,255,0.28)", fontFamily: "DM Mono, monospace", fontWeight: isActive ? 700 : 400, transition: "color 0.2s" }}>{bar.month}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 3 clients */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, fontFamily: "DM Mono, monospace" }}>Top 3 clients — {d.month}</div>
        <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
          {d.top3.map((c, i) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span style={{ fontSize: 16 }}>{c.badge}</span>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.82)" }}>{c.name}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.65)", fontFamily: "DM Mono, monospace" }}>{c.total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Paramètres tab ── */
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{ width: 36, height: 20, borderRadius: 999, border: "none", cursor: "pointer", background: on ? "#6378ff" : "rgba(255,255,255,0.12)", position: "relative", flexShrink: 0, transition: "background 200ms" }}>
      <div style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 200ms", boxShadow: "0 1px 3px rgba(0,0,0,0.30)" }} />
    </button>
  );
}

function TabParametres() {
  const [alerteStock, setAlerteStock] = useState(true);
  const [relancesAuto, setRelancesAuto] = useState(true);
  const [suggestionsIA, setSuggestionsIA] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Informations boutique */}
      <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>Informations boutique</div>
        </div>
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Nom de la boutique", value: "Boutique démo" },
            { label: "Adresse",            value: "12 rue de la Paix, 75001 Paris" },
            { label: "Téléphone",          value: "01 23 45 67 89" },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: "DM Mono, monospace" }}>{f.label}</div>
              <input disabled value={f.value} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.45)", fontSize: 13, fontFamily: "inherit", cursor: "not-allowed" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>Notifications</div>
        </div>
        <div style={{ padding: "4px 0" }}>
          {[
            { label: "Alertes stock faible", desc: "Notif quand un produit passe sous le seuil", on: alerteStock, toggle: () => setAlerteStock(v => !v) },
            { label: "Relances automatiques", desc: "Analyse quotidienne des clients inactifs", on: relancesAuto, toggle: () => setRelancesAuto(v => !v) },
            { label: "Suggestions IA",        desc: "Conseils stratégiques générés par Claude", on: suggestionsIA, toggle: () => setSuggestionsIA(v => !v) },
          ].map((t, i, arr) => (
            <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>{t.label}</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>{t.desc}</div>
              </div>
              <Toggle on={t.on} onToggle={t.toggle} />
            </div>
          ))}
        </div>
      </div>

      {/* Clé API Resend */}
      <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>Clé API Resend</div>
        </div>
        <div style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>Utilisée pour l&apos;envoi des emails de relance</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input disabled value="re_••••••••••••••••••••••••" style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "DM Mono, monospace", cursor: "not-allowed", letterSpacing: 1 }} />
            <button type="button" style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.60)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              Modifier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ── */
export function DemoInteractive() {
  const isMobile = useIsMobile();
  const [view, setView] = useState<View>("clients");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [visible, setVisible] = useState(true);

  function handleNav(v: View) {
    if (v === view) return;
    setVisible(false);
    setTimeout(() => { setView(v); setVisible(true); }, 130);
  }

  function handleSelectClient(c: Client) {
    setSelectedClient(c);
    setVisible(false);
    setTimeout(() => { setView("fiche"); setVisible(true); }, 130);
  }

  function handleBackToClients() {
    setVisible(false);
    setTimeout(() => { setView("clients"); setVisible(true); }, 130);
  }

  // active sidebar item: "fiche" highlights "clients"
  const activeSidebarView: View = view === "fiche" ? "clients" : view;

  /* Short labels for mobile tab bar */
  const MOBILE_LABELS: Record<string, string> = {
    clients: "Clients", produits: "Produits", inventaire: "Stocks",
    relances: "Relances", analytiques: "Stats", parametres: "Config",
  };

  return (
    <section style={{ padding: isMobile ? "48px 12px" : "80px 24px", background: "transparent" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: isMobile ? 28 : 48 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 999, background: "rgba(99,120,255,0.10)", border: "1px solid rgba(99,120,255,0.22)", fontSize: 12, fontWeight: 700, color: "rgba(165,180,255,0.85)", fontFamily: "DM Mono, monospace", letterSpacing: 0.5, marginBottom: 16 }}>
            ✦ Démo interactive
          </span>
          <h2 style={{ fontSize: "clamp(22px,4vw,44px)", fontWeight: 900, letterSpacing: "-1px", color: "rgba(255,255,255,0.95)", lineHeight: 1.1, marginBottom: 12 }}>
            Voyez ClientFlow{" "}
            <span style={{ background: "linear-gradient(135deg,#6378ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>en action</span>
          </h2>
          <p style={{ fontSize: isMobile ? 14 : 16, color: "rgba(255,255,255,0.42)", maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>
            Explorez les fonctionnalités sans créer de compte
          </p>
        </div>

        {/* Browser mockup */}
        <div style={{ borderRadius: isMobile ? 12 : 16, border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(99,120,255,0.08)", background: "#0c0c14", overflow: "hidden", height: 520, display: "flex", flexDirection: "column" }}>

          {/* Browser bar */}
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, padding: isMobile ? "8px 12px" : "11px 16px", background: "rgba(8,8,18,0.95)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", gap: isMobile ? 4 : 6 }}>
              <div style={{ width: isMobile ? 8 : 11, height: isMobile ? 8 : 11, borderRadius: "50%", background: "#ff5f57" }} />
              <div style={{ width: isMobile ? 8 : 11, height: isMobile ? 8 : 11, borderRadius: "50%", background: "#febc2e" }} />
              <div style={{ width: isMobile ? 8 : 11, height: isMobile ? 8 : 11, borderRadius: "50%", background: "#28c840" }} />
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "3px 10px" : "4px 18px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span style={{ fontSize: isMobile ? 9.5 : 11.5, color: "rgba(255,255,255,0.30)", fontFamily: "DM Mono, monospace" }}>app.clientflow.fr</span>
              </div>
            </div>
          </div>

          {/* App shell — row on desktop, column on mobile */}
          <div style={{ display: "flex", flexDirection: "row", flex: 1, overflow: "hidden" }}>

            {/* Sidebar — desktop only */}
            {!isMobile && (
              <div style={{ width: 180, background: "rgba(8,8,16,0.85)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                {/* Brand */}
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "16px 14px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#6378ff,#4f63e8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#fff", fontFamily: "DM Mono, monospace", flexShrink: 0 }}>CF</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: "rgba(255,255,255,0.85)", fontFamily: "DM Mono, monospace" }}>CLIENTFLOW</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>Multi-boutiques</div>
                  </div>
                </div>
                {/* Nav */}
                <nav style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                  {NAV_ITEMS.map(item => {
                    const isActive = item.view === activeSidebarView;
                    return (
                      <button key={item.label} type="button" onClick={() => item.view && handleNav(item.view)}
                        style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 8, border: "none", background: isActive ? "rgba(99,120,255,0.14)" : "transparent", color: isActive ? "rgba(165,180,255,0.95)" : "rgba(255,255,255,0.50)", fontSize: 13, fontWeight: isActive ? 600 : 400, cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit", outline: isActive ? "1px solid rgba(99,120,255,0.28)" : "none", transition: "all 150ms" }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(99,120,255,0.06)"; }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <span style={{ opacity: isActive ? 1 : 0.7, display: "flex" }}>{item.icon}</span>
                        {item.label}
                        {isActive && <span style={{ marginLeft: "auto", width: 3, height: 16, borderRadius: 2, background: "#6378ff", boxShadow: "0 0 8px rgba(99,120,255,0.7)" }} />}
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* Main area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

              {/* Topbar */}
              <div style={{ display: "flex", alignItems: "center", padding: isMobile ? "8px 12px" : "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,10,20,0.60)", gap: 8 }}>
                {isMobile && (
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg,#6378ff,#4f63e8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "#fff", fontFamily: "DM Mono, monospace", flexShrink: 0 }}>CF</div>
                )}
                <div style={{ flex: 1, fontSize: isMobile ? 11 : 13, fontWeight: 700, color: "rgba(255,255,255,0.50)", fontFamily: "DM Mono, monospace", letterSpacing: 0.5 }}>
                  {PAGE_TITLES[view]}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <NotifBell />
                  <div style={{ width: isMobile ? 24 : 28, height: isMobile ? 24 : 28, borderRadius: "50%", background: "linear-gradient(135deg,#6378ff,#4f63e8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 8 : 10, fontWeight: 700, color: "#fff", fontFamily: "DM Mono, monospace", flexShrink: 0 }}>JD</div>
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, padding: isMobile ? "12px" : "16px", overflowY: "auto", opacity: visible ? 1 : 0, transition: "opacity 180ms ease", paddingBottom: isMobile ? "8px" : "16px" }}>
                {view === "clients"    && <TabClients onSelect={handleSelectClient} isMobile={isMobile} />}
                {view === "fiche"      && <TabFiche client={selectedClient} onBack={handleBackToClients} isMobile={isMobile} />}
                {view === "produits"   && <TabProduits isMobile={isMobile} />}
                {view === "relances"   && <TabRelances />}
                {view === "inventaire" && <TabInventaire />}
                {view === "analytiques"&& <TabAnalytiques isMobile={isMobile} />}
                {view === "parametres" && <TabParametres />}
              </div>

              {/* Mobile bottom tab bar */}
              {isMobile && (
                <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(8,8,16,0.95)" }}>
                  {NAV_ITEMS.map(item => {
                    const isActive = item.view === activeSidebarView;
                    return (
                      <button key={item.label} type="button" onClick={() => item.view && handleNav(item.view)}
                        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "8px 2px", border: "none", background: "transparent", color: isActive ? "rgba(165,180,255,0.95)" : "rgba(255,255,255,0.30)", cursor: "pointer", fontFamily: "inherit", transition: "color 150ms", position: "relative" }}
                      >
                        {isActive && <span style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 20, height: 2, borderRadius: 1, background: "#6378ff" }} />}
                        <span style={{ display: "flex", fontSize: 14, opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
                        <span style={{ fontSize: 8.5, fontWeight: isActive ? 700 : 400, letterSpacing: 0.2, lineHeight: 1 }}>{MOBILE_LABELS[item.view ?? ""] ?? item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12.5, color: "rgba(255,255,255,0.22)", fontFamily: "DM Mono, monospace" }}>
          Données fictives — interface identique à la version réelle
        </p>
      </div>
    </section>
  );
}
