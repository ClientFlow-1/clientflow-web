"use client";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/lib/workspaceContext";
import { useRole } from "@/lib/useRole";

type StatusOverride = "vip" | "regular" | "inactive" | "new" | null;
type ClientRow = { id: string; email: string | null; prenom: string | null; nom: string | null; created_at?: string | null; birthdate?: string | null; notes?: string | null; status_override?: StatusOverride; };
type SaleRow = { id: string; user_id: string; client_id: string | null; amount: number | null; created_at: string | null; product_id: string | null; product_name: string | null; };
type Product = { id: string; name: string; category: string | null; price: number; };
type SaleProduct = { product_id: string; product_name: string; price: number; quantity: number; };

function formatEUR(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v); } catch { return `${v.toFixed(2)} €`; }
}
function moneyToNumberAny(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s/g, "").replace(/€/g, "").replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(","); const lastDot = s.lastIndexOf(".");
  const hasComma = lastComma !== -1; const hasDot = lastDot !== -1;
  if (hasComma && hasDot) {
    const decimalIsComma = lastComma > lastDot;
    const decimalSep = decimalIsComma ? "," : "."; const thousandSep = decimalIsComma ? "." : ",";
    s = s.replace(new RegExp("\\" + thousandSep, "g"), "").replace(decimalSep, ".");
    const n = Number(s); return Number.isFinite(n) ? n : 0;
  }
  const sep = hasComma ? "," : hasDot ? "." : "";
  if (!sep) { const n = Number(s); return Number.isFinite(n) ? n : 0; }
  const digitsAfter = s.length - s.lastIndexOf(sep) - 1;
  if (digitsAfter >= 1 && digitsAfter <= 2) { s = s.replace(sep, "."); const n = Number(s); return Number.isFinite(n) ? n : 0; }
  s = s.replace(new RegExp("\\" + sep, "g"), ""); const n = Number(s); return Number.isFinite(n) ? n : 0;
}
function pad2(n: number) { return String(n).padStart(2, "0"); }
function toISODateInput(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function toFRDateDisplay(isoYmd: string) { const [y, m, d] = isoYmd.split("-"); return `${d}/${m}/${y}`; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, delta: number) { return new Date(d.getFullYear(), d.getMonth() + delta, 1); }
function daysInMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function clampToToday(isoYmd: string) { const today = toISODateInput(new Date()); return isoYmd > today ? today : isoYmd; }

type SortKey = "nom_az" | "nom_za" | "total_asc" | "total_desc" | "date_asc" | "date_desc";
const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: "nom_az",     label: "Nom A → Z",            icon: "↑" },
  { key: "nom_za",     label: "Nom Z → A",            icon: "↓" },
  { key: "total_desc", label: "Total décroissant",    icon: "↓" },
  { key: "total_asc",  label: "Total croissant",      icon: "↑" },
  { key: "date_desc",  label: "Plus récents d'abord", icon: "↓" },
  { key: "date_asc",   label: "Plus anciens d'abord", icon: "↑" },
];

const STATUS_OPTIONS: { value: StatusOverride; label: string; emoji: string; color: string; bg: string; border: string; }[] = [
  { value: null,       label: "Auto",     emoji: "🔄", color: "rgba(238,238,245,0.5)",  bg: "rgba(255,255,255,0.04)",  border: "rgba(255,255,255,0.08)" },
  { value: "vip",      label: "VIP",      emoji: "👑", color: "#f5c842",                bg: "rgba(245,200,66,0.1)",    border: "rgba(245,200,66,0.3)" },
  { value: "regular",  label: "Régulier", emoji: "⭐", color: "#6378ff",                bg: "rgba(99,120,255,0.1)",    border: "rgba(99,120,255,0.3)" },
  { value: "inactive", label: "Inactif",  emoji: "😴", color: "rgba(238,238,245,0.45)", bg: "rgba(255,255,255,0.04)",  border: "rgba(255,255,255,0.1)" },
  { value: "new",      label: "Nouveau",  emoji: "✨", color: "#4ecdc4",                bg: "rgba(78,205,196,0.1)",    border: "rgba(78,205,196,0.3)" },
];

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: accent ? "rgba(120,160,255,0.95)" : "rgba(255,255,255,0.88)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function MobileClientCard({ c, total, checked, onToggle, onEdit, onDelete, loading, canEdit, canDelete }: {
  c: ClientRow; total: number; checked: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void; loading: boolean; canEdit: boolean; canDelete: boolean;
}) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", gap: 10, background: checked ? "rgba(120,160,255,0.06)" : "transparent", transition: "background 120ms" }}>
      <div onClick={onToggle}
        style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${checked ? "rgba(120,160,255,0.9)" : "rgba(255,255,255,0.20)"}`, background: checked ? "rgba(120,160,255,0.9)" : "rgba(255,255,255,0.03)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 120ms" }}>
        {checked && <span style={{ fontSize: 12, color: "#fff", fontWeight: 900 }}>✓</span>}
      </div>
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(99,120,255,0.15)", border: "1px solid rgba(99,120,255,0.25)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "rgba(120,160,255,0.9)" }}>
        {(c.prenom?.[0] ?? c.email?.[0] ?? "?").toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "rgba(255,255,255,0.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {`${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || c.email || "—"}
        </div>
        <div style={{ fontSize: 12, color: "rgba(120,160,255,0.85)", fontWeight: 700, marginTop: 2 }}>{formatEUR(total)}</div>
      </div>
      <button type="button" onClick={() => setPopupOpen(true)}
        style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>···</button>

      {popupOpen && mounted && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setPopupOpen(false); }}>
          <div style={{ width: "100%", maxWidth: 480, borderRadius: "20px 20px 0 0", background: "linear-gradient(180deg, rgba(22,24,34,0.99), rgba(12,13,18,0.99))", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none", padding: "20px 20px 36px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(99,120,255,0.15)", border: "1px solid rgba(99,120,255,0.30)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "rgba(120,160,255,0.9)", flexShrink: 0 }}>
                {(c.prenom?.[0] ?? c.email?.[0] ?? "?").toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17, color: "rgba(255,255,255,0.95)" }}>{`${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || "—"}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>{c.email || "Pas d'email"}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              <InfoRow label="CA total" value={formatEUR(total)} accent />
              {c.email && <InfoRow label="Email" value={c.email} />}
              {c.birthdate && <InfoRow label="Date de naissance" value={toFRDateDisplay(c.birthdate)} />}
              {c.notes && <InfoRow label="Notes" value={c.notes} />}
              {c.status_override && <InfoRow label="Statut forcé" value={STATUS_OPTIONS.find(s => s.value === c.status_override)?.label ?? c.status_override} />}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {canEdit && (
                <button type="button" onClick={() => { setPopupOpen(false); onEdit(); }}
                  style={{ flex: 1, height: 46, borderRadius: 12, border: "1px solid rgba(99,120,255,0.30)", background: "rgba(99,120,255,0.12)", color: "rgba(120,160,255,0.95)", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>✏️ Modifier</button>
              )}
              {canDelete && (
                <button type="button" onClick={() => { setPopupOpen(false); onDelete(); }} disabled={loading}
                  style={{ flex: 1, height: 46, borderRadius: 12, border: "1px solid rgba(255,80,80,0.25)", background: "rgba(255,80,80,0.08)", color: "rgba(255,120,120,0.95)", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>🗑 Supprimer</button>
              )}
            </div>
            <button type="button" onClick={() => setPopupOpen(false)}
              style={{ width: "100%", marginTop: 10, height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 14, cursor: "pointer" }}>Fermer</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function MultiProductPicker({ products, selected, onChange }: {
  products: Product[]; selected: SaleProduct[]; onChange: (items: SaleProduct[]) => void;
}) {
  const [search, setSearch] = useState("");
  const categories = useMemo(() => { const cats = new Set(products.map(p => p.category ?? "Sans catégorie")); return Array.from(cats).sort(); }, [products]);
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); if (!q) return products; return products.filter(p => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q)); }, [products, search]);
  function isSelected(id: string) { return selected.some(s => s.product_id === id); }
  function getQty(id: string) { return selected.find(s => s.product_id === id)?.quantity ?? 1; }
  function toggle(p: Product) {
    if (isSelected(p.id)) onChange(selected.filter(s => s.product_id !== p.id));
    else onChange([...selected, { product_id: p.id, product_name: p.name, price: p.price, quantity: 1 }]);
  }
  function setQty(id: string, qty: number) { if (qty < 1) return; onChange(selected.map(s => s.product_id === id ? { ...s, quantity: qty } : s)); }
  const total = selected.reduce((acc, s) => acc + s.price * s.quantity, 0);
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.35, fontSize: 14, pointerEvents: "none" }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit…"
            style={{ width: "100%", height: 36, borderRadius: 9, padding: "0 12px 0 32px", background: "rgba(10,11,14,0.8)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.08)", outline: "none", fontSize: 13 }} />
        </div>
      </div>
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {products.length === 0 ? (
          <div style={{ padding: "20px 16px", textAlign: "center", opacity: 0.5, fontSize: 13 }}>Aucun produit — crée-en depuis la page <strong>Produits</strong>.</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "16px", opacity: 0.5, fontSize: 13 }}>Aucun résultat.</div>
        ) : categories.map(cat => {
          const catProducts = filtered.filter(p => (p.category ?? "Sans catégorie") === cat);
          if (catProducts.length === 0) return null;
          return (
            <div key={cat}>
              <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 800, letterSpacing: 1.1, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", background: "rgba(255,255,255,0.01)" }}>{cat}</div>
              {catProducts.map(p => {
                const checked = isSelected(p.id); const qty = getQty(p.id);
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: checked ? "rgba(99,120,255,0.07)" : "transparent", transition: "background 100ms" }}>
                    <div onClick={() => toggle(p)} style={{ cursor: "pointer", width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${checked ? "rgba(120,160,255,0.9)" : "rgba(255,255,255,0.20)"}`, background: checked ? "rgba(120,160,255,0.9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms" }}>
                      {checked && <span style={{ fontSize: 11, color: "#fff", fontWeight: 900 }}>✓</span>}
                    </div>
                    <div onClick={() => toggle(p)} style={{ flex: 1, cursor: "pointer", minWidth: 0 }}>
                      <div style={{ fontWeight: checked ? 800 : 500, fontSize: 13, color: "rgba(255,255,255,0.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(120,160,255,0.8)", fontWeight: 700, marginTop: 1 }}>{formatEUR(p.price)}</div>
                    </div>
                    {checked && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <button type="button" onClick={() => setQty(p.id, qty - 1)} disabled={qty <= 1} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", fontSize: 14, cursor: qty <= 1 ? "not-allowed" : "pointer", opacity: qty <= 1 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <span style={{ width: 24, textAlign: "center", fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>{qty}</span>
                        <button type="button" onClick={() => setQty(p.id, qty + 1)} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>＋</button>
                        <span style={{ marginLeft: 4, fontSize: 12, fontWeight: 700, color: "rgba(120,160,255,0.7)", minWidth: 50, textAlign: "right" }}>{formatEUR(p.price * qty)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(99,120,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{selected.length} produit{selected.length > 1 ? "s" : ""} · {selected.reduce((a, s) => a + s.quantity, 0)} article{selected.reduce((a, s) => a + s.quantity, 0) > 1 ? "s" : ""}</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "rgba(120,160,255,0.95)" }}>Total : {formatEUR(total)}</div>
        </div>
      )}
    </div>
  );
}

type ExportField = "prenom" | "nom" | "email" | "ca_total" | "nb_ventes" | "date_vente" | "montant_vente" | "client_vente" | "produit_vente";
type ExportPeriod = "all" | "7d" | "30d" | "90d" | "12m" | "custom";
const EXPORT_OPTIONS: { key: ExportField; label: string; group: "clients" | "ventes" }[] = [
  { key: "prenom", label: "Prénom", group: "clients" }, { key: "nom", label: "Nom", group: "clients" },
  { key: "email", label: "Email", group: "clients" }, { key: "ca_total", label: "CA total (€)", group: "clients" },
  { key: "nb_ventes", label: "Nb de ventes", group: "clients" }, { key: "date_vente", label: "Date de vente", group: "ventes" },
  { key: "montant_vente", label: "Montant (€)", group: "ventes" }, { key: "client_vente", label: "Client associé", group: "ventes" },
  { key: "produit_vente", label: "Produits", group: "ventes" },
];
function downloadCSV(filename: string, rows: string[][]) {
  const content = rows.map(r => r.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function getExportPeriodDates(period: ExportPeriod, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  if (period === "all") return { from: null, to: null };
  const to = new Date(); to.setHours(23, 59, 59, 999);
  if (period === "custom") return { from: new Date(customFrom + "T00:00:00"), to: new Date(customTo + "T23:59:59") };
  const from = new Date();
  if (period === "7d") from.setDate(from.getDate() - 6);
  else if (period === "30d") from.setDate(from.getDate() - 29);
  else if (period === "90d") from.setDate(from.getDate() - 89);
  else if (period === "12m") from.setMonth(from.getMonth() - 11);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}
function ExportMenu({ clients, sales, clientById, perClientTotals, saleProductsMap }: {
  clients: ClientRow[]; sales: SaleRow[]; clientById: Map<string, ClientRow>; perClientTotals: Map<string, number>; saleProductsMap: Map<string, SaleProduct[]>;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Record<ExportField, boolean>>({ prenom: true, nom: true, email: true, ca_total: true, nb_ventes: false, date_vente: true, montant_vente: true, client_vente: false, produit_vente: true });
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("all");
  const [customFrom, setCustomFrom] = useState(toISODateInput(new Date(Date.now() - 29 * 86400000)));
  const [customTo, setCustomTo] = useState(toISODateInput(new Date()));
  const ref = useRef<HTMLDivElement>(null); const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 }); const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const dropH = 620; const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow < dropH ? Math.max(10, r.top - Math.min(dropH, r.top - 10) - 6) : r.bottom + 6;
    const right = window.innerWidth - r.right;
    setPos({ top, right });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { const t = e.target as Node; if (btnRef.current?.contains(t) || ref.current?.contains(t)) return; setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [open]);
  function toggle(key: ExportField) { setFields(prev => ({ ...prev, [key]: !prev[key] })); }
  const clientFields = EXPORT_OPTIONS.filter(o => o.group === "clients");
  const venteFields = EXPORT_OPTIONS.filter(o => o.group === "ventes");
  const hasAnyField = Object.values(fields).some(Boolean);
  const periods: { key: ExportPeriod; label: string }[] = [{ key: "all", label: "Tout" }, { key: "7d", label: "7j" }, { key: "30d", label: "30j" }, { key: "90d", label: "90j" }, { key: "12m", label: "12m" }, { key: "custom", label: "Perso" }];
  function doExport() {
    if (!hasAnyField) return;
    const now = new Date(); const dateStr = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
    const { from, to } = getExportPeriodDates(exportPeriod, customFrom, customTo);
    const filteredSales = from && to ? sales.filter(s => { if (!s.created_at) return false; const d = new Date(s.created_at); return d >= from && d <= to; }) : sales;
    const activeClientFields = clientFields.filter(o => fields[o.key]);
    const activeVenteFields = venteFields.filter(o => fields[o.key]);
    const header = [...activeClientFields.map(o => o.label), ...activeVenteFields.map(o => o.label)];
    const nbVentesMap = new Map<string, number>();
    for (const s of filteredSales) { if (s.client_id) nbVentesMap.set(s.client_id, (nbVentesMap.get(s.client_id) ?? 0) + 1); }
    const filteredClientTotals = new Map<string, number>();
    for (const s of filteredSales) { if (s.client_id) filteredClientTotals.set(s.client_id, (filteredClientTotals.get(s.client_id) ?? 0) + moneyToNumberAny(s.amount)); }
    let rows: string[][] = [];
    if (activeVenteFields.length > 0) {
      rows = filteredSales.map(s => {
        const c = s.client_id ? clientById.get(s.client_id) ?? null : null;
        const sp = saleProductsMap.get(s.id) ?? [];
        const clientCells = activeClientFields.map(o => {
          if (!c) return "";
          if (o.key === "prenom") return c.prenom ?? ""; if (o.key === "nom") return c.nom ?? "";
          if (o.key === "email") return c.email ?? "";
          if (o.key === "ca_total") return (filteredClientTotals.get(c.id) ?? 0).toFixed(2).replace(".", ",");
          if (o.key === "nb_ventes") return String(nbVentesMap.get(c.id) ?? 0); return "";
        });
        const venteCells = activeVenteFields.map(o => {
          if (o.key === "date_vente") { if (!s.created_at) return ""; const d = new Date(s.created_at); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`; }
          if (o.key === "montant_vente") return moneyToNumberAny(s.amount).toFixed(2).replace(".", ",");
          if (o.key === "produit_vente") { if (sp.length > 0) return sp.map(p => p.quantity > 1 ? `${p.product_name} x${p.quantity}` : p.product_name).join(", "); return s.product_name ?? ""; }
          if (o.key === "client_vente") { if (!s.client_id) return "Vente anonyme"; const cl = clientById.get(s.client_id); if (!cl) return "Client supprimé"; return `${cl.prenom ?? ""} ${cl.nom ?? ""}`.trim() || cl.email || "Client"; }
          return "";
        });
        return [...clientCells, ...venteCells];
      });
    } else {
      rows = clients.map(c => activeClientFields.map(o => {
        if (o.key === "prenom") return c.prenom ?? ""; if (o.key === "nom") return c.nom ?? "";
        if (o.key === "email") return c.email ?? "";
        if (o.key === "ca_total") return (filteredClientTotals.get(c.id) ?? 0).toFixed(2).replace(".", ",");
        if (o.key === "nb_ventes") return String(nbVentesMap.get(c.id) ?? 0); return "";
      }));
    }
    downloadCSV(`export_${dateStr}.csv`, [header, ...rows]); setOpen(false);
  }
  return (
    <>
      <button ref={btnRef} type="button" className="cl-action-btn" onClick={() => setOpen(v => !v)}>↓ Exporter CSV</button>
      {open && mounted && createPortal(
        <div ref={ref} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999, width: 290, borderRadius: 14, padding: 14, background: "linear-gradient(180deg, rgba(18,20,28,0.99), rgba(10,11,16,0.99))", border: "1px solid rgba(99,120,255,0.18)", boxShadow: "0 20px 60px rgba(0,0,0,0.7)", backdropFilter: "blur(20px)", maxHeight: "90vh", overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, opacity: 0.4, marginBottom: 8, textTransform: "uppercase" }}>Période</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
            {periods.map(p => <button key={p.key} type="button" onClick={() => setExportPeriod(p.key)} style={{ height: 28, padding: "0 10px", borderRadius: 999, border: `1px solid ${exportPeriod === p.key ? "rgba(120,160,255,0.45)" : "rgba(255,255,255,0.10)"}`, background: exportPeriod === p.key ? "rgba(120,160,255,0.16)" : "rgba(255,255,255,0.03)", color: exportPeriod === p.key ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.70)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{p.label}</button>)}
          </div>
          {exportPeriod === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, opacity: 0.6 }}>Du</span>
              <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)} style={{ flex: 1, height: 32, borderRadius: 8, padding: "0 8px", background: "rgba(10,11,14,0.8)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(120,160,255,0.30)", fontSize: 12, outline: "none", minWidth: 0 }} />
              <span style={{ fontSize: 12, opacity: 0.6 }}>au</span>
              <input type="date" value={customTo} min={customFrom} max={toISODateInput(new Date())} onChange={e => setCustomTo(e.target.value)} style={{ flex: 1, height: 32, borderRadius: 8, padding: "0 8px", background: "rgba(10,11,14,0.8)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(120,160,255,0.30)", fontSize: 12, outline: "none", minWidth: 0 }} />
            </div>
          )}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0 10px" }} />
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, opacity: 0.4, marginBottom: 8, textTransform: "uppercase" }}>Colonnes clients</div>
          {clientFields.map(o => (
            <label key={o.key} onClick={() => toggle(o.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 9, cursor: "pointer", background: fields[o.key] ? "rgba(99,120,255,0.10)" : "transparent", marginBottom: 2 }}>
              <div style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${fields[o.key] ? "rgba(120,160,255,0.9)" : "rgba(255,255,255,0.25)"}`, background: fields[o.key] ? "rgba(120,160,255,0.9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {fields[o.key] && <span style={{ fontSize: 10, color: "#fff", fontWeight: 900 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", fontWeight: fields[o.key] ? 700 : 500 }}>{o.label}</span>
            </label>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "10px 0" }} />
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, opacity: 0.4, marginBottom: 8, textTransform: "uppercase" }}>Colonnes ventes</div>
          {venteFields.map(o => (
            <label key={o.key} onClick={() => toggle(o.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 9, cursor: "pointer", background: fields[o.key] ? "rgba(99,120,255,0.10)" : "transparent", marginBottom: 2 }}>
              <div style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${fields[o.key] ? "rgba(120,160,255,0.9)" : "rgba(255,255,255,0.25)"}`, background: fields[o.key] ? "rgba(120,160,255,0.9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {fields[o.key] && <span style={{ fontSize: 10, color: "#fff", fontWeight: 900 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", fontWeight: fields[o.key] ? 700 : 500 }}>{o.label}</span>
            </label>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "10px 0" }} />
          <button type="button" onClick={doExport} disabled={!hasAnyField} style={{ width: "100%", height: 38, borderRadius: 10, border: "none", background: !hasAnyField ? "rgba(255,255,255,0.05)" : "rgba(99,120,255,0.22)", color: !hasAnyField ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.95)", fontSize: 13, fontWeight: 800, cursor: !hasAnyField ? "not-allowed" : "pointer" }}>Télécharger CSV</button>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 6 }}>export_date.csv — 1 fichier unique</div>
        </div>,
        document.body
      )}
    </>
  );
}function ClientPicker({ clients, valueClientId, onChange, disabled, placeholder }: { clients: ClientRow[]; valueClientId: string; onChange: (id: string) => void; disabled?: boolean; placeholder?: string; }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(""); const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null); const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom; const dropH = 320;
    setDropPos({ top: spaceBelow < dropH && rect.top > dropH ? rect.top - dropH - 4 : rect.bottom + 4, left: rect.left, width: rect.width });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return; setOpen(false); setQ(""); };
    document.addEventListener("mousedown", onDown); return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const selected = useMemo(() => clients.find(c => c.id === valueClientId) ?? null, [clients, valueClientId]);
  const label = useMemo(() => { if (!selected) return ""; const name = `${selected.prenom ?? ""} ${selected.nom ?? ""}`.trim(); return name || selected.email || "Client"; }, [selected]);
  const filtered = useMemo(() => { const s = q.trim().toLowerCase(); if (!s) return clients; return clients.filter(c => `${c.email ?? ""} ${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase().includes(s)); }, [clients, q]);
  return (
    <>
      <button ref={btnRef} type="button" className="cf-input" disabled={!!disabled} onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ opacity: label ? 1 : 0.55, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label || placeholder || "Choisir un client"}</span>
        <span style={{ opacity: 0.5 }}>▾</span>
      </button>
      {open && !disabled && mounted && createPortal(
        <div ref={dropRef} style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999, padding: 12, borderRadius: 14, background: "linear-gradient(180deg, rgba(22,24,30,0.99), rgba(12,13,16,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 22px 70px rgba(0,0,0,0.7)", backdropFilter: "blur(10px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 10, alignItems: "center" }}>
            <input className="cf-input" placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
            <button type="button" className="cf-btn cf-btnGhost" onClick={() => { setOpen(false); setQ(""); }}>Fermer</button>
          </div>
          <div style={{ maxHeight: 240, overflow: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
            {filtered.length === 0 ? <div style={{ padding: 14, opacity: 0.6 }}>Aucun résultat.</div>
              : filtered.map(c => { const name = `${c.prenom ?? ""} ${c.nom ?? ""}`.trim(); return (
                <button key={c.id} type="button" className={`cf-row ${c.id === valueClientId ? "isActive" : ""}`} onClick={() => { onChange(c.id); setOpen(false); setQ(""); }}>
                  <div className="cf-rowTitle">{name || c.email || "Client"}</div>
                  <div className="cf-rowSub">{c.email || "—"}</div>
                </button>
              ); })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function CalendarOverlay({ open, valueIso, onPick, onClose }: { open: boolean; valueIso: string; onPick: (iso: string) => void; onClose: () => void; }) {
  const todayIso = toISODateInput(new Date());
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date())); const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (open) setViewMonth(startOfMonth(new Date())); }, [open]);
  const monthLabel = useMemo(() => { const m = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]; return `${m[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`; }, [viewMonth]);
  const grid = useMemo(() => {
    const first = startOfMonth(viewMonth); const jsDay = first.getDay(); const mondayIndex = (jsDay + 6) % 7; const dim = daysInMonth(viewMonth);
    const cells: Array<{ iso: string; day: number; disabled: boolean; inMonth: boolean }> = [];
    const prev = addMonths(viewMonth, -1); const prevDim = daysInMonth(prev);
    for (let i = 0; i < mondayIndex; i++) { const day = prevDim - (mondayIndex - 1 - i); cells.push({ iso: toISODateInput(new Date(prev.getFullYear(), prev.getMonth(), day)), day, disabled: true, inMonth: false }); }
    for (let day = 1; day <= dim; day++) { const iso = toISODateInput(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day)); cells.push({ iso, day, disabled: iso > todayIso, inMonth: true }); }
    const next = addMonths(viewMonth, 1); let dayN = 1;
    while (cells.length < 42) { cells.push({ iso: toISODateInput(new Date(next.getFullYear(), next.getMonth(), dayN)), day: dayN, disabled: true, inMonth: false }); dayN++; }
    return cells;
  }, [viewMonth, todayIso]);
  if (!open || !mounted) return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 340, borderRadius: 18, padding: 16, background: "linear-gradient(180deg, rgba(22,24,30,0.99), rgba(12,13,16,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 30px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, -1))} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.8)", width: 32, height: 32, cursor: "pointer", fontSize: 14 }}>←</button>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{monthLabel}</span>
          <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 1))} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.8)", width: 32, height: 32, cursor: "pointer", fontSize: 14 }}>→</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
          {["L","M","M","J","V","S","D"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, opacity: 0.4, padding: "2px 0" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {grid.map(c => { const active = c.iso === valueIso; const isToday = c.iso === todayIso; return (
            <button key={c.iso} type="button" disabled={c.disabled} onClick={() => { onPick(clampToToday(c.iso)); onClose(); }}
              style={{ height: 34, borderRadius: 8, border: "none", background: active ? "rgba(120,160,255,0.25)" : isToday ? "rgba(255,255,255,0.06)" : "transparent", color: !c.inMonth ? "transparent" : c.disabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.88)", fontWeight: active ? 900 : 500, fontSize: 12, cursor: c.disabled || !c.inMonth ? "default" : "pointer", outline: isToday && !active ? "1px solid rgba(120,160,255,0.3)" : "none" }}>
              {c.inMonth ? c.day : ""}
            </button>
          ); })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <button type="button" onClick={onClose} style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", background: "none", border: "none", cursor: "pointer" }}>Fermer</button>
          <button type="button" onClick={() => { onPick(todayIso); onClose(); }} style={{ fontSize: 12, color: "rgba(120,160,255,0.9)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Aujourd'hui</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ClientEditDrawer({ client, onClose, onSaved }: { client: ClientRow | null; onClose: () => void; onSaved: (updated: ClientRow) => void; }) {
  const [prenom, setPrenom] = useState(""); const [nom, setNom] = useState(""); const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState(""); const [notes, setNotes] = useState("");
  const [statusOverride, setStatusOverride] = useState<StatusOverride>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false); const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (client) {
      setPrenom(client.prenom || ""); setNom(client.nom || ""); setEmail(client.email || "");
      setBirthdate(client.birthdate || ""); setNotes(client.notes || "");
      setStatusOverride(client.status_override ?? null); setError(null);
      requestAnimationFrame(() => setVisible(true));
    } else { setVisible(false); }
  }, [client]);
  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) handleClose(); };
    if (client) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [client]);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);
  const handleClose = () => { setVisible(false); setTimeout(onClose, 280); };
  const handleSave = async () => {
    if (!client) return;
    if (!prenom.trim() || !nom.trim()) { setError("Le prénom et le nom sont obligatoires."); return; }
    setSaving(true); setError(null);
    const updates = { prenom: prenom.trim(), nom: nom.trim(), email: email.trim(), birthdate: birthdate || null, notes: notes.trim() || null, status_override: statusOverride };
    const { error: supaErr } = await supabase.from("clients").update(updates).eq("id", client.id);
    setSaving(false);
    if (supaErr) { setError("Erreur : " + supaErr.message); return; }
    onSaved({ ...client, ...updates }); handleClose();
  };
  if (!client || !mounted) return null;
  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 999, opacity: visible ? 1 : 0, transition: "opacity 0.28s ease" }} />
      <div ref={drawerRef} style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "linear-gradient(180deg, #16162a 0%, #13131f 100%)", borderLeft: "1px solid rgba(255,255,255,0.08)", zIndex: 1000, display: "flex", flexDirection: "column", transform: visible ? "translateX(0)" : "translateX(100%)", transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)", boxShadow: "-24px 0 80px rgba(0,0,0,0.5)", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ padding: "28px 28px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 12, color: "rgba(238,238,245,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Modifier le client</p>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#eeeef5", margin: 0 }}>{client.prenom} {client.nom}</h2>
          </div>
          <button onClick={handleClose} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(238,238,245,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(238,238,245,0.3)", marginBottom: 14 }}>Identité</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <DrawerField label="Prénom" value={prenom} onChange={setPrenom} placeholder="Jean" />
                <DrawerField label="Nom" value={nom} onChange={setNom} placeholder="Dupont" />
              </div>
              <DrawerField label="Email" value={email} onChange={setEmail} placeholder="jean@example.com" type="email" />
              <DrawerField label="Date de naissance" value={birthdate} onChange={setBirthdate} type="date" />
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(238,238,245,0.3)", marginBottom: 14 }}>Statut client</p>
            <p style={{ fontSize: 13, color: "rgba(238,238,245,0.4)", marginBottom: 14, lineHeight: 1.5 }}>Par défaut, le statut est calculé automatiquement. Vous pouvez le forcer manuellement.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {STATUS_OPTIONS.map(opt => {
                const active = statusOverride === opt.value;
                return (
                  <button key={String(opt.value)} onClick={() => setStatusOverride(opt.value)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, border: `1px solid ${active ? opt.border : "rgba(255,255,255,0.08)"}`, background: active ? opt.bg : "rgba(255,255,255,0.03)", color: active ? opt.color : "rgba(238,238,245,0.5)", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", transform: active ? "scale(1.02)" : "scale(1)" }}>
                    <span>{opt.emoji}</span><span>{opt.label}</span>
                    {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: opt.color, display: "inline-block", marginLeft: 2 }} />}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(238,238,245,0.3)", marginBottom: 14 }}>Notes internes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergie aux produits X, préfère les RDV le matin..." rows={4}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", color: "#eeeef5", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box" }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(99,120,255,0.4)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
          </div>
          {error && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.25)", color: "#ff8080", fontSize: 13 }}>{error}</div>}
        </div>
        <div style={{ padding: "20px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12, flexShrink: 0 }}>
          <button onClick={handleClose} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(238,238,245,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: "12px", borderRadius: 12, border: "1px solid rgba(99,120,255,0.35)", background: saving ? "rgba(99,120,255,0.15)" : "linear-gradient(135deg, rgba(99,120,255,0.25) 0%, rgba(140,99,255,0.25) 100%)", color: saving ? "rgba(99,120,255,0.5)" : "#8899ff", cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(99,120,255,0.3)", borderTopColor: "#6378ff", borderRadius: "50%", display: "inline-block", animation: "cfSpin 0.7s linear infinite" }} />Sauvegarde...</> : "Sauvegarder les modifications"}
          </button>
        </div>
      </div>
      <style>{`@keyframes cfSpin { to { transform: rotate(360deg); } }`}</style>
    </>,
    document.body
  );
}

function DrawerField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "rgba(238,238,245,0.45)", fontWeight: 500 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", color: "#eeeef5", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%", boxSizing: "border-box", colorScheme: "dark" }}
        onFocus={e => { e.currentTarget.style.borderColor = "rgba(99,120,255,0.4)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
    </div>
  );
}export default function ClientsPage() {
  const { activeWorkspace } = useWorkspace();
  const { can } = useRole();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saleProductsMap, setSaleProductsMap] = useState<Map<string, SaleProduct[]>>(new Map());
  const [query, setQuery] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterPos, setFilterPos] = useState({ top: 0, right: 0 });
  const [filterMounted, setFilterMounted] = useState(false);
  useEffect(() => { setFilterMounted(true); }, []);
  useEffect(() => {
    if (!filterOpen || !filterBtnRef.current) return;
    const r = filterBtnRef.current.getBoundingClientRect();
    const dropH = 340; const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow < dropH ? r.top - dropH - 6 : r.bottom + 6;
    const right = window.innerWidth - r.right;
    setFilterPos({ top, right });
  }, [filterOpen]);
  useEffect(() => {
    if (!filterOpen) return;
    const h = (e: MouseEvent) => { const t = e.target as Node; if (filterBtnRef.current?.contains(t) || filterRef.current?.contains(t)) return; setFilterOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [filterOpen]);

  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleMode, setSaleMode] = useState<"client" | "anonymous" | "create">("client");
  const [saleClientId, setSaleClientId] = useState<string>("");
  const [saleAmount, setSaleAmount] = useState<string>("");
  const [saleDateIso, setSaleDateIso] = useState<string>(toISODateInput(new Date()));
  const [saleSelectedProducts, setSaleSelectedProducts] = useState<SaleProduct[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaleId, setEditSaleId] = useState<string>("");
  const [editMode, setEditMode] = useState<"client" | "anonymous">("client");
  const [editClientId, setEditClientId] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editDateIso, setEditDateIso] = useState<string>(toISODateInput(new Date()));
  const [editSelectedProducts, setEditSelectedProducts] = useState<SaleProduct[]>([]);
  const [editCalendarOpen, setEditCalendarOpen] = useState(false);
  const [newPrenom, setNewPrenom] = useState("");
  const [newNom, setNewNom] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBirthIso, setNewBirthIso] = useState("");

  useEffect(() => { fetchAll(); }, [activeWorkspace?.id]);
  useEffect(() => { if (saleSelectedProducts.length > 0) setSaleAmount(saleSelectedProducts.reduce((acc, p) => acc + p.price * p.quantity, 0).toFixed(2)); }, [saleSelectedProducts]);
  useEffect(() => { if (editSelectedProducts.length > 0) setEditAmount(editSelectedProducts.reduce((acc, p) => acc + p.price * p.quantity, 0).toFixed(2)); }, [editSelectedProducts]);

  const perClientTotals = useMemo(() => { const m = new Map<string, number>(); for (const s of sales) { if (!s.client_id) continue; m.set(s.client_id, (m.get(s.client_id) ?? 0) + moneyToNumberAny(s.amount)); } return m; }, [sales]);
  const clientById = useMemo(() => { const m = new Map<string, ClientRow>(); for (const c of clients) m.set(c.id, c); return m; }, [clients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? clients.filter(c => `${c.email ?? ""} ${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase().includes(q)) : [...clients];
    switch (sortKey) {
      case "nom_az":    list.sort((a, b) => `${a.prenom ?? ""} ${a.nom ?? ""}`.localeCompare(`${b.prenom ?? ""} ${b.nom ?? ""}`, "fr")); break;
      case "nom_za":    list.sort((a, b) => `${b.prenom ?? ""} ${b.nom ?? ""}`.localeCompare(`${a.prenom ?? ""} ${a.nom ?? ""}`, "fr")); break;
      case "total_asc": list.sort((a, b) => (perClientTotals.get(a.id) ?? 0) - (perClientTotals.get(b.id) ?? 0)); break;
      case "total_desc":list.sort((a, b) => (perClientTotals.get(b.id) ?? 0) - (perClientTotals.get(a.id) ?? 0)); break;
      case "date_asc":  list.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")); break;
      case "date_desc": list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")); break;
    }
    return list;
  }, [clients, query, sortKey, perClientTotals]);

  const filteredSales = useMemo(() => {
    if (!historyQuery.trim()) return sales;
    const q = historyQuery.trim().toLowerCase();
    return sales.filter(s => {
      const c = s.client_id ? clientById.get(s.client_id) : null;
      const text = c ? `${c.prenom ?? ""} ${c.nom ?? ""} ${c.email ?? ""}`.toLowerCase() : "vente anonyme";
      const sp = saleProductsMap.get(s.id) ?? [];
      const prodText = sp.map(p => p.product_name).join(" ").toLowerCase();
      return text.includes(q) || prodText.includes(q) || (s.product_name ?? "").toLowerCase().includes(q);
    });
  }, [sales, historyQuery, clientById, saleProductsMap]);

  const stats = useMemo(() => {
    const countClients = clients.length;
    const caTotal = sales.reduce((acc, s) => acc + moneyToNumberAny(s.amount), 0);
    const caClients = sales.reduce((acc, s) => acc + (s.client_id ? moneyToNumberAny(s.amount) : 0), 0);
    return { countClients, caTotal, caClients, panierClients: countClients > 0 ? caClients / countClients : 0 };
  }, [clients.length, sales]);

  const selectedIds = useMemo(() => Object.keys(selected).filter(id => selected[id]), [selected]);
  const selectedCount = selectedIds.length;
  function toggleOne(id: string) { setSelected(prev => ({ ...prev, [id]: !prev[id] })); }
  function selectAllFiltered() { setSelected(prev => { const next = { ...prev }; for (const c of filtered) next[c.id] = true; return next; }); }
  function clearSelection() { setSelected({}); }
  function clientLabel(clientId: string | null) { if (!clientId) return "Vente anonyme"; const c = clientById.get(clientId); if (!c) return "Client supprimé"; const name = `${c.prenom ?? ""} ${c.nom ?? ""}`.trim(); return name || c.email || "Client"; }
  function saleDateToIso(s: SaleRow) { if (!s.created_at) return toISODateInput(new Date()); const d = new Date(s.created_at); if (Number.isNaN(d.getTime())) return toISODateInput(new Date()); return toISODateInput(d); }

  async function fetchAll() {
    setLoading(true); setErrorMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { window.location.href = "/login"; return; }
      if (!activeWorkspace) { setClients([]); setSales([]); setProducts([]); setSaleProductsMap(new Map()); setLoading(false); return; }
      const [{ data: cData, error: cErr }, { data: sData, error: sErr }, { data: pData, error: pErr }, { data: spData, error: spErr }] = await Promise.all([
        supabase.from("clients").select("id,email,prenom,nom,created_at,birthdate,notes,status_override").eq("workspace_id", activeWorkspace.id).order("created_at", { ascending: false }).limit(1000),
        supabase.from("sales").select("id,user_id,client_id,amount,created_at,product_id,product_name").eq("workspace_id", activeWorkspace.id).order("created_at", { ascending: false }).limit(5000),
        supabase.from("products").select("id,name,category,price").eq("workspace_id", activeWorkspace.id).order("name", { ascending: true }),
        supabase.from("sale_products").select("sale_id,product_id,product_name,price,quantity").order("created_at", { ascending: true }),
      ]);
      if (cErr) throw cErr; if (sErr) throw sErr; if (pErr) throw pErr; if (spErr) throw spErr;
      const cs = (cData ?? []) as ClientRow[];
      setClients(cs); setSales((sData ?? []) as SaleRow[]); setProducts((pData ?? []) as Product[]);
      const spMap = new Map<string, SaleProduct[]>();
      for (const sp of (spData ?? []) as any[]) { if (!spMap.has(sp.sale_id)) spMap.set(sp.sale_id, []); spMap.get(sp.sale_id)!.push({ product_id: sp.product_id, product_name: sp.product_name, price: sp.price, quantity: sp.quantity }); }
      setSaleProductsMap(spMap); setSelected({});
      if (!saleClientId && cs.length > 0) setSaleClientId(cs[0].id);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur inconnue"); }
    finally { setLoading(false); }
  }

  async function deleteOne(id: string) {
    if (!confirm("Supprimer ce client ?")) return;
    try { setLoading(true); const { error } = await supabase.from("clients").delete().eq("id", id); if (error) throw error; setClients(prev => prev.filter(c => c.id !== id)); setSelected(prev => { const copy = { ...prev }; delete copy[id]; return copy; }); }
    catch (e: any) { setErrorMsg(e?.message ?? "Erreur suppression"); } finally { setLoading(false); }
  }
  async function deleteSelected() {
    if (selectedCount === 0 || !confirm(`Supprimer ${selectedCount} client(s) ?`)) return;
    try { setLoading(true); const { error } = await supabase.from("clients").delete().in("id", selectedIds); if (error) throw error; const toDelete = new Set(selectedIds); setClients(prev => prev.filter(c => !toDelete.has(c.id))); setSelected({}); }
    catch (e: any) { setErrorMsg(e?.message ?? "Erreur suppression"); } finally { setLoading(false); }
  }
  function normalizeEmail(s: string) { return s.trim().toLowerCase(); }
  function isValidEmail(s: string) { const v = normalizeEmail(s); if (!v) return true; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  async function insertClientWithFallback(payload: any) {
    const try1 = await supabase.from("clients").insert(payload).select("id,email,prenom,nom,created_at,birthdate,notes,status_override").single();
    if (!try1.error) return try1;
    const msg = String(try1.error?.message ?? "");
    if (!(msg.includes("birthdate") || msg.includes("date_naissance") || msg.includes("dob") || msg.includes("column") || msg.includes("does not exist"))) return try1;
    const { birthdate, date_naissance, dob, ...rest } = payload;
    return supabase.from("clients").insert(rest).select("id,email,prenom,nom,created_at,birthdate,notes,status_override").single();
  }
  function resetNewClientFields() { setNewPrenom(""); setNewNom(""); setNewEmail(""); setNewBirthIso(""); }
  function openSaleModal() { setSaleOpen(true); setSaleMode("client"); setSaleAmount(""); setSaleDateIso(toISODateInput(new Date())); setSaleSelectedProducts([]); setCalendarOpen(false); resetNewClientFields(); if (!saleClientId && clients.length > 0) setSaleClientId(clients[0].id); }
  function openEditSaleModal(s: SaleRow) { const dateIso = clampToToday(saleDateToIso(s)); setEditSaleId(s.id); setEditMode(s.client_id ? "client" : "anonymous"); setEditClientId(s.client_id ?? (clients[0]?.id ?? "")); setEditAmount(String(moneyToNumberAny(s.amount))); setEditDateIso(dateIso); setEditSelectedProducts(saleProductsMap.get(s.id) ?? []); setEditCalendarOpen(false); setEditOpen(true); }
  async function deleteSale(id: string) {
    if (!confirm("Supprimer cette vente ?")) return;
    try { setLoading(true); const { error } = await supabase.from("sales").delete().eq("id", id); if (error) throw error; setSales(prev => prev.filter(x => x.id !== id)); setSaleProductsMap(prev => { const next = new Map(prev); next.delete(id); return next; }); }
    catch (e: any) { setErrorMsg(e?.message ?? "Erreur suppression vente"); } finally { setLoading(false); }
  }
  async function saveSaleProducts(saleId: string, items: SaleProduct[]) {
    await supabase.from("sale_products").delete().eq("sale_id", saleId);
    if (items.length > 0) await supabase.from("sale_products").insert(items.map(p => ({ sale_id: saleId, product_id: p.product_id, product_name: p.product_name, price: p.price, quantity: p.quantity })));
    setSaleProductsMap(prev => { const next = new Map(prev); next.set(saleId, items); return next; });
  }
  async function saveEditedSale() {
    try {
      setLoading(true); setErrorMsg("");
      const amount = moneyToNumberAny(editAmount); if (!(amount > 0)) { setErrorMsg("Montant invalide."); return; }
      const dateIso = clampToToday(editDateIso);
      const client_id = editMode === "anonymous" ? null : editClientId || null;
      if (editMode === "client" && !client_id) { setErrorMsg("Choisis un client."); return; }
      const firstProduct = editSelectedProducts[0];
      const { data, error } = await supabase.from("sales").update({ amount, client_id, created_at: new Date(`${dateIso}T12:00:00`).toISOString(), product_id: firstProduct?.product_id ?? null, product_name: editSelectedProducts.length > 0 ? editSelectedProducts.map(p => p.quantity > 1 ? `${p.product_name} x${p.quantity}` : p.product_name).join(", ") : null }).eq("id", editSaleId).select("id,user_id,client_id,amount,created_at,product_id,product_name").single();
      if (error) throw error;
      setSales(prev => prev.map(s => s.id === (data as SaleRow).id ? data as SaleRow : s));
      await saveSaleProducts(editSaleId, editSelectedProducts);
      setEditOpen(false); setEditCalendarOpen(false);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur modification vente"); } finally { setLoading(false); }
  }
  async function saveClientOnly() {
    try {
      setLoading(true); setErrorMsg("");
      const { data: auth } = await supabase.auth.getUser(); const user = auth?.user; if (!user) { window.location.href = "/login"; return; }
      const p = newPrenom.trim(); const n = newNom.trim(); const e = normalizeEmail(newEmail); const b = (newBirthIso || "").trim();
      if (!p || !n) { setErrorMsg("Prénom et nom requis."); return; }
      if (!isValidEmail(e)) { setErrorMsg("Email invalide."); return; }
      const clientPayload: any = { user_id: user.id, prenom: p, nom: n, email: e || null, workspace_id: activeWorkspace?.id ?? null };
      if (b) { clientPayload.birthdate = b; clientPayload.date_naissance = b; clientPayload.dob = b; }
      const res = await insertClientWithFallback(clientPayload);
      if (res.error) throw res.error;
      setClients(prev => [res.data as ClientRow, ...prev]); setSaleClientId((res.data as ClientRow).id); setClientOpen(false);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur création client"); } finally { setLoading(false); }
  }
  async function saveSale() {
    try {
      setLoading(true); setErrorMsg("");
      const { data: auth } = await supabase.auth.getUser(); const user = auth?.user; if (!user) { window.location.href = "/login"; return; }
      const amount = moneyToNumberAny(saleAmount); if (!(amount > 0)) { setErrorMsg("Montant invalide."); return; }
      const dateIso = clampToToday(saleDateIso);
      let clientIdToUse: string | null = null;
      if (saleMode === "client") { clientIdToUse = saleClientId || null; if (!clientIdToUse) { setErrorMsg("Choisis un client."); return; } }
      if (saleMode === "create") {
        const p = newPrenom.trim(); const n = newNom.trim(); const e = normalizeEmail(newEmail); const b = (newBirthIso || "").trim();
        if (!p || !n) { setErrorMsg("Prénom et nom requis."); return; }
        if (!isValidEmail(e)) { setErrorMsg("Email invalide."); return; }
        const clientPayload: any = { user_id: user.id, prenom: p, nom: n, email: e || null, workspace_id: activeWorkspace?.id ?? null };
        if (b) { clientPayload.birthdate = b; clientPayload.date_naissance = b; clientPayload.dob = b; }
        const res = await insertClientWithFallback(clientPayload);
        if (res.error) throw res.error;
        const createdClient = res.data as ClientRow; clientIdToUse = createdClient.id; setClients(prev => [createdClient, ...prev]); setSaleClientId(createdClient.id);
      }
      const firstProduct = saleSelectedProducts[0];
      const { data, error } = await supabase.from("sales").insert({ user_id: user.id, amount, created_at: new Date(`${dateIso}T12:00:00`).toISOString(), client_id: saleMode === "anonymous" ? null : clientIdToUse, workspace_id: activeWorkspace?.id ?? null, product_id: firstProduct?.product_id ?? null, product_name: saleSelectedProducts.length > 0 ? saleSelectedProducts.map(p => p.quantity > 1 ? `${p.product_name} x${p.quantity}` : p.product_name).join(", ") : null }).select("id,user_id,client_id,amount,created_at,product_id,product_name").single();
      if (error) throw error;
      const newSale = data as SaleRow; setSales(prev => [newSale, ...prev]);
      await saveSaleProducts(newSale.id, saleSelectedProducts);
      setSaleOpen(false); setCalendarOpen(false);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur enregistrement vente"); } finally { setLoading(false); }
  }

  const handleClientSaved = (updated: ClientRow) => {
    setClients(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
  };

  const currentSortLabel = SORT_OPTIONS.find(o => o.key === sortKey)?.label ?? "";
  const isDefaultSort = sortKey === "date_desc";

  if (!activeWorkspace) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Clients</div>
      <h1 className="ds-title">Clients</h1>
      <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Aucun workspace sélectionné</div>
      </div>
    </div>
  );

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Clients</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Clients</h1>
          <p className="ds-subtitle">Recherche, stats et gestion — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong></p>
          {errorMsg && <p className="cf-error">Erreur : {errorMsg}</p>}
        </div>
        <div className="ds-right-tools">
          <div className="cl-pill"><span className="cl-pill-dot" />{filtered.length} / {clients.length} clients</div>
          <button className="ds-btn ds-btn-ghost" type="button" onClick={fetchAll} disabled={loading}>{loading ? "Chargement..." : "Actualiser"}</button>
        </div>
      </div>

      <div className="cl-search-wrap">
        <span className="cl-search-icon">⌕</span>
        <input className="cl-search-input" placeholder="Rechercher un client…" value={query} onChange={e => setQuery(e.target.value)} disabled={loading} />
        {query && <button className="cl-search-clear" type="button" onClick={() => setQuery("")}>✕</button>}
        <button ref={filterBtnRef} type="button" onClick={() => setFilterOpen(v => !v)}
          style={{ position: "absolute", right: 8, height: 34, padding: "0 14px", borderRadius: 10, border: `1px solid ${!isDefaultSort ? "rgba(120,160,255,0.45)" : "rgba(255,255,255,0.12)"}`, background: !isDefaultSort ? "rgba(120,160,255,0.14)" : "rgba(255,255,255,0.04)", color: !isDefaultSort ? "rgba(120,160,255,0.95)" : "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 750, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 12 }}>⊟</span>Filtres
          {!isDefaultSort && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(120,160,255,0.9)", flexShrink: 0 }} />}
        </button>
      </div>

      {!isDefaultSort && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>Tri actif :</span>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(120,160,255,0.10)", border: "1px solid rgba(120,160,255,0.25)", color: "rgba(120,160,255,0.9)" }}>{currentSortLabel}</span>
          <button type="button" onClick={() => setSortKey("date_desc")} style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Réinitialiser</button>
        </div>
      )}

      {filterOpen && filterMounted && createPortal(
        <div ref={filterRef} style={{ position: "fixed", top: filterPos.top, right: filterPos.right, zIndex: 9999, width: 260, borderRadius: 14, padding: 10, background: "linear-gradient(180deg, rgba(18,20,28,0.99), rgba(10,11,16,0.99))", border: "1px solid rgba(99,120,255,0.18)", boxShadow: "0 20px 60px rgba(0,0,0,0.7)", backdropFilter: "blur(20px)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, opacity: 0.4, padding: "4px 8px 10px", textTransform: "uppercase" }}>Trier les clients</div>
          {SORT_OPTIONS.map(opt => (
            <button key={opt.key} type="button" onClick={() => { setSortKey(opt.key); setFilterOpen(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "none", background: sortKey === opt.key ? "rgba(120,160,255,0.14)" : "transparent", color: sortKey === opt.key ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: sortKey === opt.key ? 800 : 500, cursor: "pointer", textAlign: "left", transition: "background 100ms", marginBottom: 2 }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, border: `1.5px solid ${sortKey === opt.key ? "rgba(120,160,255,0.8)" : "rgba(255,255,255,0.15)"}`, background: sortKey === opt.key ? "rgba(120,160,255,0.15)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: sortKey === opt.key ? "rgba(120,160,255,0.9)" : "rgba(255,255,255,0.4)" }}>{opt.icon}</span>
              {opt.label}
              {sortKey === opt.key && <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(120,160,255,0.9)" }}>✓</span>}
            </button>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
          <button type="button" onClick={() => { setSortKey("date_desc"); setFilterOpen(false); }} style={{ width: "100%", padding: "8px 12px", borderRadius: 9, border: "none", background: "transparent", color: "rgba(255,255,255,0.40)", fontSize: 12, cursor: "pointer", textAlign: "left" }}>↺ Réinitialiser le tri</button>
        </div>,
        document.body
      )}

      <div className="ds-stats-grid">
        <div className="ds-stat-card"><div className="ds-stat-label">Clients</div><div className="ds-stat-value">{stats.countClients}</div></div>
        {can.viewCA && <div className="ds-stat-card"><div className="ds-stat-label">CA total</div><div className="ds-stat-value">{formatEUR(stats.caTotal)}</div></div>}
        {can.viewCA && <div className="ds-stat-card"><div className="ds-stat-label">CA clients</div><div className="ds-stat-value">{formatEUR(stats.caClients)}</div></div>}
        {can.viewCA && <div className="ds-stat-card"><div className="ds-stat-label">Panier moyen</div><div className="ds-stat-value">{formatEUR(stats.panierClients)}</div></div>}
      </div>

      <div className="ds-card">
        <div className="ds-card-head" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="ds-card-title">Liste clients</div>
            <div className="ds-card-sub">Affichage : {filtered.length} / {clients.length} · Sélection : {selectedCount}</div>
          </div>
          <div className="cl-actions-row">
            <button className="cl-action-btn" type="button" onClick={() => { setClientOpen(true); setErrorMsg(""); resetNewClientFields(); }} disabled={loading}>✦ Créer un client</button>
            <button className="cl-action-btn" type="button" onClick={openSaleModal} disabled={loading}>＋ Ajouter une vente</button>
            <button className="cl-action-btn" type="button" onClick={() => { setHistoryOpen(true); setHistoryQuery(""); }} disabled={loading || sales.length === 0}>📋 Historique</button>
            <ExportMenu clients={clients} sales={sales} clientById={clientById} perClientTotals={perClientTotals} saleProductsMap={saleProductsMap} />
            <div className="cl-sep" />
            <button className="cl-action-btn cl-ghost" type="button" onClick={selectAllFiltered} disabled={loading || filtered.length === 0}>Tout sélectionner</button>
            <button className="cl-action-btn cl-ghost" type="button" onClick={clearSelection} disabled={loading || selectedCount === 0}>Désélectionner</button>
            {selectedCount > 0 && can.deleteClients && <button className="cl-action-btn cl-danger" type="button" onClick={deleteSelected} disabled={loading}>Supprimer ({selectedCount})</button>}
          </div>
        </div>

        {loading ? (
          <div className="cl-empty"><div className="cl-empty-icon">⟳</div><div className="cl-empty-title">Chargement…</div></div>
        ) : filtered.length === 0 ? (
          <div className="cl-empty"><div className="cl-empty-icon">∅</div><div className="cl-empty-title">Aucun client trouvé</div><div className="cl-empty-sub">Importe un CSV ou crée un client manuellement.</div></div>
        ) : (
          <>
            <div className="cl-desktop-table">
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead><tr><th style={{ width: 40 }}></th><th>Email</th><th>Prénom</th><th>Nom</th><th className="ds-right">Total</th><th className="ds-right">Actions</th></tr></thead>
                  <tbody>
                    {filtered.map(c => {
                      const checked = !!selected[c.id]; const total = perClientTotals.get(c.id) ?? 0;
                      return (
                        <tr key={c.id} className={checked ? "cl-row-selected" : ""}>
                          <td><label className="cl-checkbox"><input type="checkbox" checked={checked} onChange={() => toggleOne(c.id)} /><span className="cl-checkbox-ui" /></label></td>
                          <td className="ds-mono" style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>{c.email || "—"}</td>
                          <td style={{ fontWeight: 700 }}>{c.prenom || "—"}</td>
                          <td style={{ fontWeight: 700 }}>{c.nom || "—"}</td>
                          <td className="ds-right" style={{ fontWeight: 800, color: "rgba(120,160,255,0.9)" }}>{formatEUR(total)}</td>
                          <td className="ds-right">
                            <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                              <button type="button" onClick={e => { e.stopPropagation(); setEditingClient(c); }}
                                style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(238,238,245,0.5)", cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,120,255,0.12)"; e.currentTarget.style.color = "#8899ff"; e.currentTarget.style.borderColor = "rgba(99,120,255,0.25)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(238,238,245,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                              >✏️ Modifier</button>
                              {can.deleteClients && <button className="cl-delete-btn" type="button" onClick={() => deleteOne(c.id)} disabled={loading}>Suppr.</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="cl-mobile-list">
              {selectedCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(120,160,255,0.06)" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(120,160,255,0.9)" }}>{selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={clearSelection}
                      style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Désélectionner</button>
                    {can.deleteClients && (
                      <button type="button" onClick={deleteSelected} disabled={loading}
                        style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.25)", background: "rgba(255,80,80,0.08)", color: "rgba(255,120,120,0.9)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗑 Supprimer</button>
                    )}
                  </div>
                </div>
              )}
              {filtered.map(c => (
                <MobileClientCard
                  key={c.id}
                  c={c}
                  total={perClientTotals.get(c.id) ?? 0}
                  checked={!!selected[c.id]}
                  onToggle={() => toggleOne(c.id)}
                  onEdit={() => setEditingClient(c)}
                  onDelete={() => deleteOne(c.id)}
                  loading={loading}
                  canEdit={true}
                  canDelete={can.deleteClients}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {historyOpen && (
        <div className="cf-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setHistoryOpen(false); }}>
          <div className="cf-modal" style={{ width: 1060 }}>
            <div className="cf-modalTop">
              <div><div className="cf-modalTitle">Historique des ventes</div><div className="cf-modalSub">Modifier ou supprimer une vente.</div></div>
              <button type="button" className="cf-btn cf-btnGhost" onClick={() => setHistoryOpen(false)}>Fermer</button>
            </div>
            <div style={{ position: "relative", margin: "14px 0 4px", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: 14, fontSize: 16, opacity: 0.4, pointerEvents: "none" }}>⌕</span>
              <input placeholder="Rechercher par nom, prénom, email, produit…" value={historyQuery} onChange={e => setHistoryQuery(e.target.value)}
                style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 44px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 14 }} />
              {historyQuery && <button type="button" onClick={() => setHistoryQuery("")} style={{ position: "absolute", right: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 11, padding: "3px 8px", cursor: "pointer" }}>✕</button>}
            </div>
            <div style={{ marginTop: 12 }}>
              {filteredSales.length === 0 ? <div className="cl-empty"><div className="cl-empty-title">Aucune vente</div></div> : (
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead><tr><th>Date</th><th>Client</th><th>Produits</th><th className="ds-right">Montant</th><th className="ds-right">Action</th></tr></thead>
                    <tbody>
                      {filteredSales.map(s => {
                        const iso = saleDateToIso(s);
                        const sp = saleProductsMap.get(s.id) ?? [];
                        const prodLabel = sp.length > 0 ? sp.map(p => p.quantity > 1 ? `${p.product_name} ×${p.quantity}` : p.product_name).join(", ") : (s.product_name ?? null);
                        return (
                          <tr key={s.id}>
                            <td className="ds-mono">{toFRDateDisplay(iso)}</td>
                            <td>{clientLabel(s.client_id)}</td>
                            <td>{prodLabel ? <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(120,160,255,0.10)", border: "1px solid rgba(120,160,255,0.20)", color: "rgba(120,160,255,0.9)" }}>{prodLabel}</span> : <span style={{ opacity: 0.3 }}>—</span>}</td>
                            <td className="ds-right" style={{ fontWeight: 800, color: "rgba(120,160,255,0.9)" }}>{formatEUR(moneyToNumberAny(s.amount))}</td>
                            <td className="ds-right">
                              <div style={{ display: "inline-flex", gap: 8 }}>
                                {can.editSales && <button type="button" className="cl-action-btn cl-ghost" onClick={() => { openEditSaleModal(s); setHistoryOpen(false); }} disabled={loading}>Modifier</button>}
                                {can.deleteSales && <button type="button" className="cl-action-btn cl-danger" onClick={() => deleteSale(s.id)} disabled={loading}>Supprimer</button>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="cf-overlay" onMouseDown={e => { if (e.target === e.currentTarget) { setEditOpen(false); setEditCalendarOpen(false); } }}>
          <div className="cf-modal" style={{ width: 900 }}>
            <div className="cf-modalTop">
              <div><div className="cf-modalTitle">Modifier une vente</div><div className="cf-modalSub">Corrige le client, les produits, le montant ou la date.</div></div>
              <button type="button" className="cf-btn cf-btnGhost" onClick={() => { setEditOpen(false); setEditCalendarOpen(false); }}>Fermer</button>
            </div>
            <div className="cf-chips">
              <button type="button" className={`cf-chip ${editMode === "client" ? "isOn" : ""}`} onClick={() => setEditMode("client")}>Vente client</button>
              <button type="button" className={`cf-chip ${editMode === "anonymous" ? "isOn" : ""}`} onClick={() => setEditMode("anonymous")}>Vente anonyme</button>
            </div>
            <div className="cf-grid">
              <div>
                <div className="cf-label">Client</div>
                {editMode === "client" ? <ClientPicker clients={clients} valueClientId={editClientId} onChange={setEditClientId} placeholder="Choisir un client" /> : <div className="cf-ghostField"><div className="cf-ghostTitle">Vente anonyme</div><div className="cf-ghostSub">Aucun client associé</div></div>}
              </div>
              <div>
                <div className="cf-label">Montant <span style={{ opacity: 0.5, fontSize: 12 }}>(auto si produits sélectionnés)</span></div>
                <input className="cf-input" placeholder="ex: 49,90" value={editAmount} onChange={e => setEditAmount(e.target.value)} inputMode="decimal" />
              </div>
              <div className="cf-full">
                <div className="cf-label">Produits <span style={{ opacity: 0.5 }}>(optionnel)</span></div>
                <MultiProductPicker products={products} selected={editSelectedProducts} onChange={items => setEditSelectedProducts(items)} />
              </div>
              <div className="cf-full">
                <div className="cf-label">Date</div>
                <div className="cf-dateRow">
                  <input className="cf-input" value={toFRDateDisplay(editDateIso)} readOnly onClick={() => setEditCalendarOpen(true)} style={{ cursor: "pointer" }} />
                  <button type="button" className="cf-btn cf-btnIcon" onClick={() => setEditCalendarOpen(true)}>📅</button>
                </div>
              </div>
            </div>
            <div className="cf-actions">
              <button type="button" className="cf-btn cf-btnGhost" onClick={() => { setEditOpen(false); setEditCalendarOpen(false); }}>Annuler</button>
              <button type="button" className="cf-btn cf-btnPrimary" onClick={saveEditedSale} disabled={loading}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {clientOpen && (
        <div className="cf-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setClientOpen(false); }}>
          <div className="cf-modal" style={{ width: 760 }}>
            <div className="cf-modalTop">
              <div><div className="cf-modalTitle">Créer un client</div><div className="cf-modalSub">Ajoute un client sans vente associée.</div></div>
              <button type="button" className="cf-btn cf-btnGhost" onClick={() => setClientOpen(false)}>Fermer</button>
            </div>
            <div className="cf-grid" style={{ marginTop: 16 }}>
              <div><div className="cf-label">Prénom</div><input className="cf-input" placeholder="Emma" value={newPrenom} onChange={e => setNewPrenom(e.target.value)} /></div>
              <div><div className="cf-label">Nom</div><input className="cf-input" placeholder="Dupont" value={newNom} onChange={e => setNewNom(e.target.value)} /></div>
              <div className="cf-full"><div className="cf-label">Email</div><input className="cf-input" placeholder="emma.dupont@email.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} inputMode="email" autoCapitalize="none" /></div>
              <div className="cf-full"><div className="cf-label">Date de naissance <span style={{ opacity: 0.5 }}>(optionnel)</span></div><input className="cf-input" type="date" value={newBirthIso} onChange={e => setNewBirthIso(e.target.value)} max={toISODateInput(new Date())} /></div>
            </div>
            <div className="cf-actions">
              <button type="button" className="cf-btn cf-btnGhost" onClick={() => setClientOpen(false)}>Annuler</button>
              <button type="button" className="cf-btn cf-btnPrimary" onClick={saveClientOnly} disabled={loading}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {saleOpen && (
        <div className="cf-overlay" onMouseDown={e => { if (e.target === e.currentTarget) { setSaleOpen(false); setCalendarOpen(false); } }}>
          <div className="cf-modal" style={{ width: 900 }}>
            <div className="cf-modalTop">
              <div><div className="cf-modalTitle">Ajouter une vente</div><div className="cf-modalSub">Sélectionne un ou plusieurs produits — le montant se calcule automatiquement.</div></div>
              <button type="button" className="cf-btn cf-btnGhost" onClick={() => { setSaleOpen(false); setCalendarOpen(false); }}>Fermer</button>
            </div>
            <div className="cf-chips">
              <button type="button" className={`cf-chip ${saleMode === "client" ? "isOn" : ""}`} onClick={() => setSaleMode("client")}>Vente client</button>
              <button type="button" className={`cf-chip ${saleMode === "anonymous" ? "isOn" : ""}`} onClick={() => setSaleMode("anonymous")}>Vente anonyme</button>
              <button type="button" className={`cf-chip ${saleMode === "create" ? "isOn" : ""}`} onClick={() => setSaleMode("create")}>Créer un client</button>
            </div>
            <div className="cf-grid">
              <div>
                <div className="cf-label">Client</div>
                {saleMode === "client"
                  ? <ClientPicker clients={clients} valueClientId={saleClientId} onChange={setSaleClientId} placeholder="Choisir un client" />
                  : saleMode === "anonymous"
                  ? <div className="cf-ghostField"><div className="cf-ghostTitle">Vente anonyme</div><div className="cf-ghostSub">Aucun client associé</div></div>
                  : <div className="cf-ghostField"><div className="cf-ghostTitle">Nouveau client</div><div className="cf-ghostSub">Sera créé + vente enregistrée</div></div>}
              </div>
              <div>
                <div className="cf-label">Montant <span style={{ opacity: 0.5, fontSize: 12 }}>(auto si produits sélectionnés)</span></div>
                <input className="cf-input" placeholder="ex: 49,90" value={saleAmount} onChange={e => setSaleAmount(e.target.value)} inputMode="decimal" />
              </div>
              <div className="cf-full">
                <div className="cf-label">Produits <span style={{ opacity: 0.5 }}>(optionnel)</span></div>
                <MultiProductPicker products={products} selected={saleSelectedProducts} onChange={items => setSaleSelectedProducts(items)} />
              </div>
              {saleMode === "create" && (
                <>
                  <div><div className="cf-label">Prénom</div><input className="cf-input" placeholder="Emma" value={newPrenom} onChange={e => setNewPrenom(e.target.value)} /></div>
                  <div><div className="cf-label">Nom</div><input className="cf-input" placeholder="Dupont" value={newNom} onChange={e => setNewNom(e.target.value)} /></div>
                  <div className="cf-full"><div className="cf-label">Email</div><input className="cf-input" placeholder="emma@email.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} inputMode="email" autoCapitalize="none" /></div>
                  <div className="cf-full"><div className="cf-label">Date de naissance <span style={{ opacity: 0.5 }}>(optionnel)</span></div><input className="cf-input" type="date" value={newBirthIso} onChange={e => setNewBirthIso(e.target.value)} max={toISODateInput(new Date())} /></div>
                </>
              )}
              <div className="cf-full">
                <div className="cf-label">Date</div>
                <div className="cf-dateRow">
                  <input className="cf-input" value={toFRDateDisplay(saleDateIso)} readOnly onClick={() => setCalendarOpen(true)} style={{ cursor: "pointer" }} />
                  <button type="button" className="cf-btn cf-btnIcon" onClick={() => setCalendarOpen(true)}>📅</button>
                </div>
              </div>
            </div>
            <div className="cf-actions">
              <button type="button" className="cf-btn cf-btnGhost" onClick={() => { setSaleOpen(false); setCalendarOpen(false); }}>Annuler</button>
              <button type="button" className="cf-btn cf-btnPrimary" onClick={saveSale} disabled={loading}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      <CalendarOverlay open={calendarOpen} valueIso={saleDateIso} onPick={iso => setSaleDateIso(clampToToday(iso))} onClose={() => setCalendarOpen(false)} />
      <CalendarOverlay open={editCalendarOpen} valueIso={editDateIso} onPick={iso => setEditDateIso(clampToToday(iso))} onClose={() => setEditCalendarOpen(false)} />
      <ClientEditDrawer client={editingClient} onClose={() => setEditingClient(null)} onSaved={handleClientSaved} />

      <style jsx global>{`
        .cf-error { margin-top: 8px; color: rgba(255,120,120,0.95); font-weight: 800; }
        .cl-pill { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.75); }
        .cl-pill-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(120,220,120,0.85); flex-shrink: 0; }
        .cl-search-wrap { position: relative; margin-top: 16px; margin-bottom: 20px; display: flex; align-items: center; }
        .cl-search-icon { position: absolute; left: 14px; font-size: 18px; opacity: 0.4; pointer-events: none; }
        .cl-search-input { width: 100%; height: 48px; border-radius: 14px; padding: 0 120px 0 44px; background: rgba(10,11,14,0.65); color: rgba(255,255,255,0.92); border: 1px solid rgba(255,255,255,0.10); outline: none; font-size: 14px; transition: border-color 140ms, box-shadow 140ms; }
        .cl-search-input::placeholder { color: rgba(255,255,255,0.35); }
        .cl-search-input:focus { border-color: rgba(120,160,255,0.45); box-shadow: 0 0 0 3px rgba(120,160,255,0.12); }
        .cl-search-clear { position: absolute; right: 118px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; color: rgba(255,255,255,0.6); font-size: 11px; padding: 3px 8px; cursor: pointer; }
        .cl-actions-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .cl-action-btn { height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.88); font-size: 13px; font-weight: 750; cursor: pointer; white-space: nowrap; transition: background 120ms; }
        .cl-action-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.20); }
        .cl-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .cl-action-btn.cl-ghost { background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.08); color: rgba(255,255,255,0.65); }
        .cl-action-btn.cl-danger { background: rgba(255,80,80,0.08); border-color: rgba(255,80,80,0.25); color: rgba(255,120,120,0.95); }
        .cl-sep { width: 1px; height: 24px; background: rgba(255,255,255,0.10); margin: 0 2px; }
        .cl-row-selected td { background: rgba(120,160,255,0.06); }
        .cl-checkbox { display: inline-flex; align-items: center; cursor: pointer; }
        .cl-checkbox input { display: none; }
        .cl-checkbox-ui { width: 18px; height: 18px; border-radius: 6px; border: 1.5px solid rgba(255,255,255,0.20); background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; }
        .cl-checkbox input:checked + .cl-checkbox-ui { background: rgba(120,160,255,0.25); border-color: rgba(120,160,255,0.60); }
        .cl-checkbox input:checked + .cl-checkbox-ui::after { content: "✓"; font-size: 11px; color: rgba(255,255,255,0.95); font-weight: 900; }
        .cl-delete-btn { height: 30px; padding: 0 12px; border-radius: 8px; border: 1px solid rgba(255,80,80,0.20); background: rgba(255,80,80,0.06); color: rgba(255,120,120,0.85); font-size: 12px; font-weight: 750; cursor: pointer; }
        .cl-delete-btn:hover:not(:disabled) { background: rgba(255,80,80,0.12); }
        .cl-delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .cl-empty { padding: 40px 0; text-align: center; }
        .cl-empty-icon { font-size: 28px; opacity: 0.3; margin-bottom: 10px; }
        .cl-empty-title { font-size: 16px; font-weight: 800; color: rgba(255,255,255,0.70); }
        .cl-empty-sub { font-size: 13px; opacity: 0.45; margin-top: 4px; }
        .cf-overlay { position: fixed; inset: 0; z-index: 70; display: flex; align-items: flex-start; justify-content: center; padding: 18px; overflow-y: auto; background: radial-gradient(1200px 700px at 50% 30%, rgba(120,160,255,0.12), rgba(0,0,0,0) 55%), rgba(0,0,0,0.58); backdrop-filter: blur(10px); }
        .cf-modal { width: 820px; max-width: 100%; border-radius: 18px; padding: 18px; background: linear-gradient(180deg, rgba(20,22,28,0.96), rgba(12,13,16,0.96)); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 30px 80px rgba(0,0,0,0.55); }
        .cf-modalTop { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .cf-modalTitle { font-size: 20px; font-weight: 900; color: rgba(255,255,255,0.95); }
        .cf-modalSub { opacity: 0.6; margin-top: 2px; font-size: 13px; }
        .cf-btn { border-radius: 999px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.92); padding: 10px 14px; font-weight: 750; cursor: pointer; }
        .cf-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cf-btnGhost { background: rgba(255,255,255,0.02); }
        .cf-btnPrimary { background: rgba(120,160,255,0.16); border-color: rgba(120,160,255,0.35); }
        .cf-btnPrimary:hover { background: rgba(120,160,255,0.22); }
        .cf-btnIcon { width: 44px; height: 44px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; }
        .cf-chips { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
        .cf-chip { border-radius: 999px; padding: 10px 14px; font-weight: 800; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.90); cursor: pointer; }
        .cf-chip.isOn { background: rgba(120,160,255,0.16); border-color: rgba(120,160,255,0.40); }
        .cf-grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 14px; margin-top: 14px; }
        .cf-full { grid-column: 1 / -1; }
        .cf-label { font-size: 13px; font-weight: 800; opacity: 0.75; margin-bottom: 8px; color: rgba(255,255,255,0.92); }
        .cf-input { width: 100%; height: 44px; border-radius: 12px; padding: 0 12px; background: rgba(10,11,14,0.65); color: rgba(255,255,255,0.92); border: 1px solid rgba(255,255,255,0.10); outline: none; display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 14px; }
        .cf-input::placeholder { color: rgba(255,255,255,0.35); }
        .cf-input:focus { border-color: rgba(120,160,255,0.55); box-shadow: 0 0 0 3px rgba(120,160,255,0.12); }
        .cf-dateRow { display: grid; grid-template-columns: 1fr 44px; gap: 10px; align-items: center; }
        .cf-ghostField { height: 44px; border-radius: 12px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.14); }
        .cf-ghostTitle { font-weight: 800; color: rgba(255,255,255,0.80); font-size: 14px; }
        .cf-ghostSub { opacity: 0.55; font-size: 12px; }
        .cf-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
        .cf-row { width: 100%; text-align: left; padding: 12px 14px; border: none; background: transparent; color: rgba(255,255,255,0.92); cursor: pointer; transition: background 100ms; }
        .cf-row:hover { background: rgba(255,255,255,0.04); }
        .cf-row.isActive { background: rgba(120,160,255,0.12); }
        .cf-rowTitle { font-weight: 800; }
        .cf-rowSub { opacity: 0.55; font-size: 12px; margin-top: 2px; }
        .cl-desktop-table { display: block; }
        .cl-mobile-list { display: none; }
        @media (max-width: 768px) {
          .cl-desktop-table { display: none; }
          .cl-mobile-list { display: block; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
        }
      `}</style>
    </div>
  );
}