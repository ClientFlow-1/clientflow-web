"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/lib/workspaceContext";

type StatusOverride = "vip" | "regular" | "inactive" | "new" | null;
type ClientRow = { id: string; email: string | null; prenom: string | null; nom: string | null; created_at: string | null; status_override?: StatusOverride; };
type SaleRow = { id: string; client_id: string | null; amount: number | null; created_at: string | null; };

function formatEUR(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v); } catch { return `${v.toFixed(2)} €`; }
}
function moneyToNumberAny(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/\s/g, "").replace(/€/g, "").replace(",", ".");
  const n = Number(s); return Number.isFinite(n) ? n : 0;
}
function pad2(n: number) { return String(n).padStart(2, "0"); }
function toFRDate(iso: string) { const [y, m, d] = iso.split("T")[0].split("-"); return `${d}/${m}/${y}`; }
function daysSince(isoDate: string) {
  const d = new Date(isoDate); if (isNaN(d.getTime())) return 9999;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
function downloadCSV(filename: string, rows: string[][]) {
  const content = rows.map(r => r.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

type Segment = "vip" | "regulier" | "inactif" | "nouveau" | "jamais";

const SEGMENTS: { key: Segment; label: string; emoji: string; color: string; bg: string; desc: string }[] = [
  { key: "vip",      label: "VIP",        emoji: "👑", color: "rgba(255,200,80,0.95)",  bg: "rgba(255,200,80,0.10)",  desc: "Top clients · CA élevé" },
  { key: "regulier", label: "Réguliers",  emoji: "⭐", color: "rgba(120,160,255,0.95)", bg: "rgba(120,160,255,0.10)", desc: "Achats récents et fréquents" },
  { key: "inactif",  label: "Inactifs",   emoji: "😴", color: "rgba(255,140,80,0.95)",  bg: "rgba(255,140,80,0.10)",  desc: "N'ont pas acheté depuis longtemps" },
  { key: "nouveau",  label: "Nouveaux",   emoji: "✨", color: "rgba(120,220,140,0.95)", bg: "rgba(120,220,140,0.10)", desc: "Inscrits récemment, peu d'achats" },
  { key: "jamais",   label: "Sans achat", emoji: "🔕", color: "rgba(180,180,200,0.70)", bg: "rgba(180,180,200,0.06)", desc: "Jamais effectué d'achat" },
];

const STATUS_OVERRIDE_TO_SEGMENT: Record<NonNullable<StatusOverride>, Segment> = {
  vip: "vip", regular: "regulier", inactive: "inactif", new: "nouveau",
};

export default function RelancesPage() {
  const { activeWorkspace } = useWorkspace();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeSegment, setActiveSegment] = useState<Segment | "all">("all");
  const [searchQ, setSearchQ] = useState("");
  const [mounted, setMounted] = useState(false);

  // Paramètres actifs
  const [inactifDays, setInactifDays] = useState(60);
  const [vipThreshold, setVipThreshold] = useState(500);
  const [nouveauDays, setNouveauDays] = useState(30);
  const [regulierMinVentes, setRegulierMinVentes] = useState(2);

  // Paramètres temporaires (formulaire)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tmpInactif, setTmpInactif] = useState(60);
  const [tmpVip, setTmpVip] = useState(500);
  const [tmpNouveau, setTmpNouveau] = useState(30);
  const [tmpRegulierMinVentes, setTmpRegulierMinVentes] = useState(2);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { fetchAll(); }, [activeWorkspace?.id]);

  async function fetchAll() {
    setLoading(true); setErrorMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { window.location.href = "/login"; return; }
      if (!activeWorkspace) { setClients([]); setSales([]); setLoading(false); return; }
      const [{ data: cData, error: cErr }, { data: sData, error: sErr }] = await Promise.all([
        supabase.from("clients").select("id,email,prenom,nom,created_at,status_override").eq("workspace_id", activeWorkspace.id).limit(2000),
        supabase.from("sales").select("id,client_id,amount,created_at").eq("workspace_id", activeWorkspace.id).order("created_at", { ascending: false }).limit(10000),
      ]);
      if (cErr) throw cErr; if (sErr) throw sErr;
      setClients((cData ?? []) as ClientRow[]);
      setSales((sData ?? []) as SaleRow[]);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur inconnue"); }
    finally { setLoading(false); }
  }

  const clientStats = useMemo(() => {
    const salesByClient = new Map<string, SaleRow[]>();
    for (const s of sales) {
      if (!s.client_id) continue;
      if (!salesByClient.has(s.client_id)) salesByClient.set(s.client_id, []);
      salesByClient.get(s.client_id)!.push(s);
    }
    return clients.map(c => {
      const cs = salesByClient.get(c.id) ?? [];
      const caTotal = cs.reduce((a, s) => a + moneyToNumberAny(s.amount), 0);
      const nbVentes = cs.length;
      const lastSale = cs.length > 0 ? cs.reduce((a, b) => (a.created_at ?? "") > (b.created_at ?? "") ? a : b) : null;
      const lastSaleDate = lastSale?.created_at ?? null;
      const daysSinceLast = lastSaleDate ? daysSince(lastSaleDate) : null;
      const clientAgeDays = c.created_at ? daysSince(c.created_at) : 999;

      let segment: Segment;
      if (c.status_override && STATUS_OVERRIDE_TO_SEGMENT[c.status_override]) {
        segment = STATUS_OVERRIDE_TO_SEGMENT[c.status_override];
      } else if (nbVentes === 0) {
        segment = "jamais";
      } else if (daysSinceLast !== null && daysSinceLast >= inactifDays) {
        segment = "inactif";
      } else if (caTotal >= vipThreshold) {
        segment = "vip";
      } else if (clientAgeDays <= nouveauDays && nbVentes <= 2) {
        segment = "nouveau";
      } else if (nbVentes >= regulierMinVentes && daysSinceLast !== null && daysSinceLast < inactifDays) {
        segment = "regulier";
      } else {
        segment = "regulier";
      }

      return { client: c, caTotal, nbVentes, lastSaleDate, daysSinceLast, segment };
    });
  }, [clients, sales, inactifDays, vipThreshold, nouveauDays, regulierMinVentes]);

  const globalStats = useMemo(() => {
    const inactifs = clientStats.filter(c => c.segment === "inactif");
    const caInactifs = inactifs.reduce((a, c) => a + c.caTotal, 0);
    const panierMoyenInactif = inactifs.length > 0 ? caInactifs / inactifs.length : 0;
    const caPotentiel = inactifs.length * panierMoyenInactif;
    const countBySegment = Object.fromEntries(SEGMENTS.map(s => [s.key, clientStats.filter(c => c.segment === s.key).length])) as Record<Segment, number>;
    return { caInactifs, caPotentiel, countBySegment };
  }, [clientStats]);

  const filtered = useMemo(() => {
    let list = activeSegment === "all" ? clientStats : clientStats.filter(c => c.segment === activeSegment);
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      list = list.filter(c => `${c.client.prenom ?? ""} ${c.client.nom ?? ""} ${c.client.email ?? ""}`.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.caTotal - a.caTotal);
  }, [clientStats, activeSegment, searchQ]);

  function clientName(c: ClientRow) { const n = `${c.prenom ?? ""} ${c.nom ?? ""}`.trim(); return n || c.email || "Client"; }

  function exportSegment() {
    const rows = filtered.map(cs => [
      cs.client.prenom ?? "", cs.client.nom ?? "", cs.client.email ?? "",
      SEGMENTS.find(s => s.key === cs.segment)?.label ?? cs.segment,
      cs.caTotal.toFixed(2).replace(".", ","), String(cs.nbVentes),
      cs.lastSaleDate ? toFRDate(cs.lastSaleDate) : "—",
      cs.daysSinceLast !== null ? String(cs.daysSinceLast) + " j" : "—",
    ]);
    const header = ["Prénom", "Nom", "Email", "Segment", "CA total (€)", "Nb ventes", "Dernière vente", "Inactivité"];
    const now = new Date();
    const dateStr = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
    downloadCSV(`relances_${activeSegment === "all" ? "tous" : activeSegment}_${dateStr}.csv`, [header, ...rows]);
  }

  if (!activeWorkspace) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Relances</div>
      <h1 className="ds-title">Relances</h1>
      <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Aucun workspace sélectionné</div>
      </div>
    </div>
  );

  const activeSegInfo = SEGMENTS.find(s => s.key === activeSegment);

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Relances</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Relances & Segments</h1>
          <p className="ds-subtitle">Identifie tes clients à relancer — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong></p>
          {errorMsg && <p style={{ marginTop: 8, color: "rgba(255,120,120,0.95)", fontWeight: 800 }}>Erreur : {errorMsg}</p>}
        </div>
        <div className="ds-right-tools">
          <button className="ds-btn ds-btn-ghost" type="button" onClick={fetchAll} disabled={loading}>
            {loading ? "Chargement..." : "Actualiser"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTmpInactif(inactifDays);
              setTmpVip(vipThreshold);
              setTmpNouveau(nouveauDays);
              setTmpRegulierMinVentes(regulierMinVentes);
              setSettingsOpen(true);
            }}
            style={{ height: 40, padding: "0 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.80)", fontWeight: 750, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            ⚙ Paramètres
          </button>
        </div>
      </div>

      <div className="ds-stats-grid">
        <div className="ds-stat-card"><div className="ds-stat-label">Total clients</div><div className="ds-stat-value">{clients.length}</div></div>
        <div className="ds-stat-card"><div className="ds-stat-label">Clients inactifs (+{inactifDays}j)</div><div className="ds-stat-value" style={{ color: "rgba(255,140,80,0.95)" }}>{globalStats.countBySegment.inactif}</div></div>
        <div className="ds-stat-card"><div className="ds-stat-label">CA généré par inactifs</div><div className="ds-stat-value" style={{ color: "rgba(255,140,80,0.85)" }}>{formatEUR(globalStats.caInactifs)}</div></div>
        <div className="ds-stat-card"><div className="ds-stat-label">CA potentiel si relance</div><div className="ds-stat-value" style={{ color: "rgba(120,220,140,0.95)" }}>{formatEUR(globalStats.caPotentiel)}</div><div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>Basé sur panier moyen</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        <div onClick={() => setActiveSegment("all")} style={{ borderRadius: 14, padding: "14px 16px", border: `1.5px solid ${activeSegment === "all" ? "rgba(120,160,255,0.45)" : "rgba(255,255,255,0.08)"}`, background: activeSegment === "all" ? "rgba(120,160,255,0.10)" : "rgba(255,255,255,0.02)", cursor: "pointer", transition: "all 120ms" }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>👥</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: "rgba(255,255,255,0.95)" }}>{clients.length}</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,0.70)", marginTop: 2 }}>Tous</div>
          <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>Tous les clients</div>
        </div>
        {SEGMENTS.map(seg => (
          <div key={seg.key} onClick={() => setActiveSegment(seg.key)}
            style={{ borderRadius: 14, padding: "14px 16px", border: `1.5px solid ${activeSegment === seg.key ? seg.color.replace("0.95", "0.45") : "rgba(255,255,255,0.08)"}`, background: activeSegment === seg.key ? seg.bg : "rgba(255,255,255,0.02)", cursor: "pointer", transition: "all 120ms" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{seg.emoji}</div>
            <div style={{ fontWeight: 900, fontSize: 22, color: seg.color }}>{globalStats.countBySegment[seg.key]}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,0.70)", marginTop: 2 }}>{seg.label}</div>
            <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>{seg.desc}</div>
          </div>
        ))}
      </div>

      <div className="ds-card">
        <div className="ds-card-head" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="ds-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {activeSegment !== "all" && activeSegInfo && <span style={{ fontSize: 18 }}>{activeSegInfo.emoji}</span>}
              {activeSegment === "all" ? "Tous les clients" : activeSegInfo?.label}
            </div>
            <div className="ds-card-sub">{filtered.length} client{filtered.length > 1 ? "s" : ""}{activeSegment !== "all" ? ` · ${activeSegInfo?.desc}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.35, fontSize: 14, pointerEvents: "none" }}>⌕</span>
              <input placeholder="Rechercher…" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                style={{ height: 36, borderRadius: 10, padding: "0 12px 0 32px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 13, width: 200 }} />
            </div>
            <button type="button" onClick={exportSegment}
              style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.80)", fontSize: 13, fontWeight: 750, cursor: "pointer", whiteSpace: "nowrap" }}>
              ↓ Exporter CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
            <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Aucun client dans ce segment</div>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr><th>Client</th><th>Segment</th><th className="ds-right">CA total</th><th className="ds-right">Ventes</th><th className="ds-right">Dernière vente</th><th className="ds-right">Inactivité</th></tr>
              </thead>
              <tbody>
                {filtered.map(({ client, caTotal, nbVentes, lastSaleDate, daysSinceLast, segment }) => {
                  const seg = SEGMENTS.find(s => s.key === segment)!;
                  const inactifAlert = segment === "inactif";
                  const hasOverride = !!client.status_override;
                  return (
                    <tr key={client.id}>
                      <td>
                        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                          {clientName(client)}
                          {hasOverride && <span title="Statut forcé manuellement" style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "rgba(99,120,255,0.12)", border: "1px solid rgba(99,120,255,0.25)", color: "rgba(120,160,255,0.8)" }}>Manuel</span>}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 1 }}>{client.email || "—"}</div>
                      </td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: seg.bg, border: `1px solid ${seg.color.replace("0.95", "0.25")}`, color: seg.color }}>
                          {seg.emoji} {seg.label}
                        </span>
                      </td>
                      <td className="ds-right" style={{ fontWeight: 800, color: "rgba(120,160,255,0.9)" }}>{formatEUR(caTotal)}</td>
                      <td className="ds-right" style={{ fontWeight: 700, opacity: 0.8 }}>{nbVentes}</td>
                      <td className="ds-right" style={{ fontSize: 13, opacity: 0.75 }}>{lastSaleDate ? toFRDate(lastSaleDate) : <span style={{ opacity: 0.4 }}>—</span>}</td>
                      <td className="ds-right">
                        {daysSinceLast !== null ? (
                          <span style={{ fontWeight: 700, fontSize: 13, color: inactifAlert ? "rgba(255,140,80,0.95)" : "rgba(255,255,255,0.60)" }}>
                            {daysSinceLast} j{inactifAlert && " ⚠"}
                          </span>
                        ) : <span style={{ opacity: 0.3 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Paramètres ── */}
      {settingsOpen && mounted && createPortal(
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(0,0,0,0.58)", backdropFilter: "blur(10px)", overflowY: "auto" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}
        >
          <div
            style={{ width: 480, maxWidth: "100%", borderRadius: 18, padding: 24, background: "linear-gradient(180deg, rgba(20,22,28,0.98), rgba(12,13,16,0.98))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", margin: "auto" }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.95)" }}>Paramètres de segmentation</div>
                <div style={{ fontSize: 13, opacity: 0.55, marginTop: 3 }}>Adapte les seuils à ton activité</div>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999, color: "rgba(255,255,255,0.7)", padding: "8px 14px", cursor: "pointer", fontWeight: 750 }}>Fermer</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* ── Inactivité ── */}
              <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,140,80,0.06)", border: "1px solid rgba(255,140,80,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div><div style={{ fontWeight: 800, fontSize: 14, color: "rgba(255,140,80,0.95)" }}>😴 Client inactif après</div><div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>Nombre de jours sans achat</div></div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: "rgba(255,140,80,0.95)" }}>{tmpInactif}j</div>
                </div>
                <input type="range" min={7} max={365} step={1} value={tmpInactif} onChange={e => setTmpInactif(Number(e.target.value))} style={{ width: "100%", accentColor: "rgba(255,140,80,0.9)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.4, marginTop: 4 }}><span>7 jours</span><span>365 jours</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {[30, 60, 90, 180].map(v => (
                    <button key={v} type="button" onClick={() => setTmpInactif(v)} style={{ height: 28, padding: "0 12px", borderRadius: 999, border: `1px solid ${tmpInactif === v ? "rgba(255,140,80,0.45)" : "rgba(255,255,255,0.10)"}`, background: tmpInactif === v ? "rgba(255,140,80,0.16)" : "rgba(255,255,255,0.03)", color: tmpInactif === v ? "rgba(255,140,80,0.95)" : "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{v}j</button>
                  ))}
                </div>
              </div>

              {/* ── VIP ── */}
              <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,200,80,0.06)", border: "1px solid rgba(255,200,80,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div><div style={{ fontWeight: 800, fontSize: 14, color: "rgba(255,200,80,0.95)" }}>👑 Client VIP à partir de</div><div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>CA total minimum</div></div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: "rgba(255,200,80,0.95)" }}>{tmpVip} €</div>
                </div>
                <input type="range" min={50} max={5000} step={50} value={tmpVip} onChange={e => setTmpVip(Number(e.target.value))} style={{ width: "100%", accentColor: "rgba(255,200,80,0.9)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.4, marginTop: 4 }}><span>50 €</span><span>5 000 €</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {[200, 500, 1000, 2000].map(v => (
                    <button key={v} type="button" onClick={() => setTmpVip(v)} style={{ height: 28, padding: "0 12px", borderRadius: 999, border: `1px solid ${tmpVip === v ? "rgba(255,200,80,0.45)" : "rgba(255,255,255,0.10)"}`, background: tmpVip === v ? "rgba(255,200,80,0.16)" : "rgba(255,255,255,0.03)", color: tmpVip === v ? "rgba(255,200,80,0.95)" : "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{v} €</button>
                  ))}
                </div>
              </div>

              {/* ── Régulier ── */}
              <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(120,160,255,0.05)", border: "1px solid rgba(120,160,255,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div><div style={{ fontWeight: 800, fontSize: 14, color: "rgba(120,160,255,0.95)" }}>⭐ Client régulier à partir de</div><div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>Nombre minimum de ventes</div></div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: "rgba(120,160,255,0.95)" }}>{tmpRegulierMinVentes} vente{tmpRegulierMinVentes > 1 ? "s" : ""}</div>
                </div>
                <input type="range" min={1} max={20} step={1} value={tmpRegulierMinVentes} onChange={e => setTmpRegulierMinVentes(Number(e.target.value))} style={{ width: "100%", accentColor: "rgba(120,160,255,0.9)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.4, marginTop: 4 }}><span>1 vente</span><span>20 ventes</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {[2, 3, 5, 10].map(v => (
                    <button key={v} type="button" onClick={() => setTmpRegulierMinVentes(v)} style={{ height: 28, padding: "0 12px", borderRadius: 999, border: `1px solid ${tmpRegulierMinVentes === v ? "rgba(120,160,255,0.45)" : "rgba(255,255,255,0.10)"}`, background: tmpRegulierMinVentes === v ? "rgba(120,160,255,0.16)" : "rgba(255,255,255,0.03)", color: tmpRegulierMinVentes === v ? "rgba(120,160,255,0.95)" : "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{v}</button>
                  ))}
                </div>
              </div>

              {/* ── Nouveau ── */}
              <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(120,220,140,0.05)", border: "1px solid rgba(120,220,140,0.12)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div><div style={{ fontWeight: 800, fontSize: 14, color: "rgba(120,220,140,0.95)" }}>✨ Nouveau client pendant</div><div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>Jours depuis l'inscription</div></div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: "rgba(120,220,140,0.95)" }}>{tmpNouveau}j</div>
                </div>
                <input type="range" min={7} max={90} step={1} value={tmpNouveau} onChange={e => setTmpNouveau(Number(e.target.value))} style={{ width: "100%", accentColor: "rgba(120,220,140,0.9)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.4, marginTop: 4 }}><span>7 jours</span><span>90 jours</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {[14, 30, 45, 60].map(v => (
                    <button key={v} type="button" onClick={() => setTmpNouveau(v)} style={{ height: 28, padding: "0 12px", borderRadius: 999, border: `1px solid ${tmpNouveau === v ? "rgba(120,220,140,0.45)" : "rgba(255,255,255,0.10)"}`, background: tmpNouveau === v ? "rgba(120,220,140,0.16)" : "rgba(255,255,255,0.03)", color: tmpNouveau === v ? "rgba(120,220,140,0.95)" : "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{v}j</button>
                  ))}
                </div>
              </div>

            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button type="button" onClick={() => setSettingsOpen(false)} style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", fontWeight: 750, cursor: "pointer" }}>Annuler</button>
              <button type="button" onClick={() => {
                setInactifDays(tmpInactif);
                setVipThreshold(tmpVip);
                setNouveauDays(tmpNouveau);
                setRegulierMinVentes(tmpRegulierMinVentes);
                setSettingsOpen(false);
              }} style={{ height: 40, padding: "0 22px", borderRadius: 999, border: "1px solid rgba(120,160,255,0.40)", background: "rgba(120,160,255,0.16)", color: "rgba(255,255,255,0.95)", fontWeight: 800, cursor: "pointer" }}>Appliquer</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}