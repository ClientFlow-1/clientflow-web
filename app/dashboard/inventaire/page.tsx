"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/lib/workspaceContext";

type Product = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  stock: number | null;
  stock_alert: number | null;
};

type StockMovement = {
  id: string;
  product_id: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  note: string | null;
  created_at: string;
  product_name?: string;
};

type MovementType = "in" | "out" | "adjustment";

const TYPE_LABELS: Record<MovementType, { label: string; color: string; bg: string; border: string; sign: string }> = {
  in:         { label: "Entrée",      color: "rgba(80,210,140,0.95)",  bg: "rgba(80,210,140,0.10)",  border: "rgba(80,210,140,0.25)",  sign: "+" },
  out:        { label: "Sortie",      color: "rgba(255,110,110,0.95)", bg: "rgba(255,110,110,0.10)", border: "rgba(255,110,110,0.25)", sign: "−" },
  adjustment: { label: "Ajustement", color: "rgba(140,160,255,0.95)", bg: "rgba(140,160,255,0.10)", border: "rgba(140,160,255,0.25)", sign: "≈" },
};

function StockBar({ stock, stockAlert }: { stock: number | null; stockAlert: number | null }) {
  if (stock === null) return <span style={{ opacity: 0.3, fontSize: 13 }}>Non suivi</span>;
  const isEmpty = stock === 0;
  const isAlert = stockAlert !== null && stock <= stockAlert;
  const color = isEmpty ? "rgba(255,80,80,0.9)" : isAlert ? "rgba(255,160,50,0.9)" : "rgba(80,210,140,0.9)";
  const bg    = isEmpty ? "rgba(255,80,80,0.10)" : isAlert ? "rgba(255,160,50,0.10)" : "rgba(80,210,140,0.10)";
  const border= isEmpty ? "rgba(255,80,80,0.25)" : isAlert ? "rgba(255,160,50,0.25)" : "rgba(80,210,140,0.25)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 800, padding: "3px 12px", borderRadius: 999, background: bg, border: `1px solid ${border}`, color }}>
        {isEmpty ? "⛔ Rupture" : isAlert ? `⚠️ ${stock}` : `✓ ${stock}`}
      </span>
      {stockAlert !== null && <span style={{ fontSize: 11, opacity: 0.4 }}>seuil : {stockAlert}</span>}
    </div>
  );
}

function MovementTypeBadge({ type }: { type: MovementType }) {
  const t = TYPE_LABELS[type];
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 9px", borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, whiteSpace: "nowrap" }}>
      {t.sign} {t.label}
    </span>
  );
}

export default function InventairePage() {
  const { activeWorkspace } = useWorkspace();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [mounted, setMounted] = useState(false);

  // Tabs
  const [tab, setTab] = useState<"overview" | "history">("overview");

  // Filtre overview
  const [filterStock, setFilterStock] = useState<"all" | "alert" | "empty" | "untracked">("all");
  const [searchProduct, setSearchProduct] = useState("");

  // Modal mouvement
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [movType, setMovType] = useState<MovementType>("in");
  const [movQty, setMovQty] = useState("");
  const [movNote, setMovNote] = useState("");
  const [movSaving, setMovSaving] = useState(false);
  const [movError, setMovError] = useState("");
  const [initMode, setInitMode] = useState(false);

  // Filtre historique
  const [histFilter, setHistFilter] = useState<"all" | MovementType>("all");
  const [histSearch, setHistSearch] = useState("");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { fetchAll(); }, [activeWorkspace?.id]);

  async function fetchAll() {
    if (!activeWorkspace) { setProducts([]); setMovements([]); setLoading(false); return; }
    setLoading(true); setErrorMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { window.location.href = "/login"; return; }

      const [{ data: prods, error: e1 }, { data: movs, error: e2 }] = await Promise.all([
        supabase.from("products")
          .select("id,name,category,price,stock,stock_alert")
          .eq("workspace_id", activeWorkspace.id)
          .order("name", { ascending: true }),
        supabase.from("stock_movements")
          .select("id,product_id,type,quantity,note,created_at")
          .eq("workspace_id", activeWorkspace.id)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const prodMap = Object.fromEntries((prods ?? []).map(p => [p.id, p.name]));
      setProducts((prods ?? []) as Product[]);
      setMovements(((movs ?? []) as StockMovement[]).map(m => ({ ...m, product_name: prodMap[m.product_id] ?? "—" })));
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur inconnue"); }
    finally { setLoading(false); }
  }

  // Stats
  const stats = useMemo(() => {
    const tracked = products.filter(p => p.stock !== null);
    const alerts  = tracked.filter(p => p.stock_alert !== null && p.stock! <= p.stock_alert);
    const empty   = tracked.filter(p => p.stock === 0);
    return { total: products.length, tracked: tracked.length, alerts: alerts.length, empty: empty.length };
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let list = products;
    if (filterStock === "alert")     list = list.filter(p => p.stock !== null && p.stock_alert !== null && p.stock <= p.stock_alert);
    if (filterStock === "empty")     list = list.filter(p => p.stock === 0);
    if (filterStock === "untracked") list = list.filter(p => p.stock === null);
    if (searchProduct.trim()) {
      const q = searchProduct.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [products, filterStock, searchProduct]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    let list = movements;
    if (histFilter !== "all") list = list.filter(m => m.type === histFilter);
    if (histSearch.trim()) {
      const q = histSearch.trim().toLowerCase();
      list = list.filter(m => (m.product_name ?? "").toLowerCase().includes(q) || (m.note ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [movements, histFilter, histSearch]);

  function openMovementModal(product: Product, type: MovementType = "in") {
    setModalProduct(product);
    setMovType(type);
    setMovQty("");
    setMovNote("");
    setMovError("");
    setInitMode(false);
    setModalOpen(true);
  }

  function openInitModal(product: Product) {
    setModalProduct(product);
    setMovType("adjustment");
    setMovQty("");
    setMovNote("");
    setMovError("");
    setInitMode(true);
    setModalOpen(true);
  }

  async function saveMovement() {
    if (!modalProduct || !activeWorkspace) return;
    const qty = parseInt(movQty, 10);
    if (isNaN(qty) || qty < 0) { setMovError("Quantité invalide."); return; }
    if (!initMode && qty <= 0) { setMovError("Quantité invalide (doit être > 0)."); return; }

    // Vérif stock négatif pour sortie
    if (movType === "out" && modalProduct.stock !== null && modalProduct.stock < qty) {
      setMovError(`Stock insuffisant (disponible : ${modalProduct.stock}).`); return;
    }

    setMovSaving(true); setMovError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) { window.location.href = "/login"; return; }

      // Calcul nouveau stock
      let newStock: number;
      if (initMode || modalProduct.stock === null) {
        newStock = qty; // initialisation = valeur absolue
      } else if (movType === "in")         { newStock = modalProduct.stock + qty; }
      else if (movType === "out")          { newStock = modalProduct.stock - qty; }
      else                                 { newStock = qty; } // adjustment = set absolu

      // Insérer mouvement
      const { error: e1 } = await supabase.from("stock_movements").insert({
        product_id: modalProduct.id,
        workspace_id: activeWorkspace.id,
        type: initMode ? "adjustment" : movType,
        quantity: qty,
        note: movNote.trim() || null,
        created_by: user.id,
      });
      if (e1) throw e1;

      // Toujours mettre à jour le stock produit (init ou mouvement)
      const { error: e2 } = await supabase.from("products").update({ stock: newStock }).eq("id", modalProduct.id);
      if (e2) throw e2;

      // Maj local
      setProducts(prev => prev.map(p => p.id === modalProduct.id ? { ...p, stock: newStock } : p));
      setMovements(prev => [{
        id: crypto.randomUUID(),
        product_id: modalProduct.id,
        type: movType,
        quantity: qty,
        note: movNote.trim() || null,
        created_at: new Date().toISOString(),
        product_name: modalProduct.name,
      }, ...prev]);
      setModalOpen(false);
    } catch (e: any) { setMovError(e?.message ?? "Erreur sauvegarde"); }
    finally { setMovSaving(false); }
  }

  function formatDate(iso: string) {
    try {
      return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch { return iso; }
  }

  if (!activeWorkspace) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Inventaire</div>
      <h1 className="ds-title">Inventaire</h1>
      <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Aucun workspace sélectionné</div>
      </div>
    </div>
  );

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Inventaire</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Inventaire</h1>
          <p className="ds-subtitle">
            Suivi des stocks — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong>
            {stats.alerts > 0 && (
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 800, padding: "2px 10px", borderRadius: 999, background: "rgba(255,160,50,0.12)", border: "1px solid rgba(255,160,50,0.30)", color: "rgba(255,180,60,0.95)" }}>
                ⚠️ {stats.alerts} alerte{stats.alerts > 1 ? "s" : ""}
              </span>
            )}
          </p>
          {errorMsg && <p style={{ marginTop: 8, color: "rgba(255,120,120,0.95)", fontWeight: 800 }}>Erreur : {errorMsg}</p>}
        </div>
        <div className="ds-right-tools">
          <button className="ds-btn ds-btn-ghost" type="button" onClick={fetchAll} disabled={loading}>{loading ? "Chargement..." : "Actualiser"}</button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="ds-stats-grid">
        <div className="ds-stat-card">
          <div className="ds-stat-label">Produits total</div>
          <div className="ds-stat-value">{stats.total}</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-label">Suivis en stock</div>
          <div className="ds-stat-value">{stats.tracked}</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-label">Alertes stock bas</div>
          <div className="ds-stat-value" style={{ color: stats.alerts > 0 ? "rgba(255,180,60,0.95)" : "inherit" }}>{stats.alerts}</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-label">En rupture</div>
          <div className="ds-stat-value" style={{ color: stats.empty > 0 ? "rgba(255,110,110,0.95)" : "inherit" }}>{stats.empty}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "4px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
        {(["overview", "history"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            style={{ height: 34, padding: "0 18px", borderRadius: 9, border: "none", background: tab === t ? "rgba(99,120,255,0.18)" : "transparent", color: tab === t ? "rgba(165,180,255,0.95)" : "rgba(255,255,255,0.50)", fontWeight: tab === t ? 800 : 500, fontSize: 13, cursor: "pointer", transition: "all 150ms" }}>
            {t === "overview" ? "📦 Vue d'ensemble" : "📋 Historique"}
          </button>
        ))}
      </div>

      {/* ── TAB OVERVIEW ── */}
      {tab === "overview" && (
        <>
          {/* Filtres */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4, pointerEvents: "none" }}>⌕</span>
              <input placeholder="Rechercher un produit…" value={searchProduct} onChange={e => setSearchProduct(e.target.value)}
                style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px 0 40px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 14 }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                { key: "all",       label: "Tous" },
                { key: "alert",     label: "⚠️ Alertes" },
                { key: "empty",     label: "⛔ Ruptures" },
                { key: "untracked", label: "Non suivis" },
              ] as { key: typeof filterStock; label: string }[]).map(f => (
                <button key={f.key} type="button" onClick={() => setFilterStock(f.key)}
                  style={{ height: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${filterStock === f.key ? "rgba(120,160,255,0.45)" : "rgba(255,255,255,0.10)"}`, background: filterStock === f.key ? "rgba(120,160,255,0.16)" : "rgba(255,255,255,0.03)", color: filterStock === f.key ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table produits */}
          <div className="ds-card">
            <div className="ds-card-head">
              <div>
                <div className="ds-card-title">Stocks par produit</div>
                <div className="ds-card-sub">{filteredProducts.length} / {products.length} produits</div>
              </div>
            </div>
            {loading ? (
              <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>Chargement…</div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📦</div>
                <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Aucun produit</div>
                <div style={{ fontSize: 13, marginTop: 6, opacity: 0.5 }}>Crée des produits depuis la page Produits.</div>
              </div>
            ) : (
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Catégorie</th>
                      <th>Stock</th>
                      <th className="ds-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>{p.name}</td>
                        <td>
                          {p.category
                            ? <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(120,160,255,0.10)", border: "1px solid rgba(120,160,255,0.20)", color: "rgba(120,160,255,0.9)" }}>{p.category}</span>
                            : <span style={{ opacity: 0.35 }}>—</span>}
                        </td>
                        <td><StockBar stock={p.stock} stockAlert={p.stock_alert} /></td>
                        <td className="ds-right">
                          {p.stock !== null ? (
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              <button type="button" onClick={() => openMovementModal(p, "in")}
                                style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(80,210,140,0.25)", background: "rgba(80,210,140,0.08)", color: "rgba(80,210,140,0.90)", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>＋ Entrée</button>
                              <button type="button" onClick={() => openMovementModal(p, "out")}
                                style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,110,110,0.20)", background: "rgba(255,110,110,0.06)", color: "rgba(255,110,110,0.85)", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>− Sortie</button>
                              <button type="button" onClick={() => openMovementModal(p, "adjustment")}
                                style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(140,160,255,0.20)", background: "rgba(140,160,255,0.06)", color: "rgba(140,160,255,0.85)", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>≈ Ajuster</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => openInitModal(p)}
                              style={{ height: 30, padding: "0 14px", borderRadius: 8, border: "1px solid rgba(99,120,255,0.25)", background: "rgba(99,120,255,0.08)", color: "rgba(140,160,255,0.85)", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                              ＋ Initialiser le stock
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB HISTORIQUE ── */}
      {tab === "history" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4, pointerEvents: "none" }}>⌕</span>
              <input placeholder="Rechercher produit ou note…" value={histSearch} onChange={e => setHistSearch(e.target.value)}
                style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px 0 40px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 14 }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                { key: "all",        label: "Tous" },
                { key: "in",         label: "+ Entrées" },
                { key: "out",        label: "− Sorties" },
                { key: "adjustment", label: "≈ Ajustements" },
              ] as { key: typeof histFilter; label: string }[]).map(f => (
                <button key={f.key} type="button" onClick={() => setHistFilter(f.key)}
                  style={{ height: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${histFilter === f.key ? "rgba(120,160,255,0.45)" : "rgba(255,255,255,0.10)"}`, background: histFilter === f.key ? "rgba(120,160,255,0.16)" : "rgba(255,255,255,0.03)", color: histFilter === f.key ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ds-card">
            <div className="ds-card-head">
              <div>
                <div className="ds-card-title">Historique des mouvements</div>
                <div className="ds-card-sub">{filteredMovements.length} mouvement{filteredMovements.length > 1 ? "s" : ""}</div>
              </div>
            </div>
            {loading ? (
              <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>Chargement…</div>
            ) : filteredMovements.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Aucun mouvement</div>
                <div style={{ fontSize: 13, marginTop: 6, opacity: 0.5 }}>Les ajustements manuels et les ventes apparaîtront ici.</div>
              </div>
            ) : (
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Produit</th>
                      <th>Type</th>
                      <th className="ds-right">Qté</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.map(m => {
                      const t = TYPE_LABELS[m.type];
                      return (
                        <tr key={m.id}>
                          <td style={{ fontSize: 12, opacity: 0.65, whiteSpace: "nowrap" }}>{formatDate(m.created_at)}</td>
                          <td style={{ fontWeight: 700 }}>{m.product_name}</td>
                          <td><MovementTypeBadge type={m.type} /></td>
                          <td className="ds-right" style={{ fontWeight: 800, color: t.color }}>{t.sign}{m.quantity}</td>
                          <td style={{ fontSize: 12, opacity: 0.6, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {m.note || <span style={{ opacity: 0.3 }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal mouvement ── */}
      {modalOpen && mounted && modalProduct && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(0,0,0,0.60)", backdropFilter: "blur(10px)" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={{ width: 460, maxWidth: "100%", borderRadius: 18, padding: 24, background: "linear-gradient(180deg, rgba(20,22,28,0.99), rgba(12,13,16,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
            onMouseDown={e => e.stopPropagation()}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.95)" }}>
                  {initMode ? "Initialiser le stock" : "Mouvement de stock"}
                </div>
                <div style={{ fontSize: 13, opacity: 0.55, marginTop: 2 }}>
                  {modalProduct.name}
                  {!initMode && modalProduct.stock !== null && (
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: "rgba(120,160,255,0.8)" }}>stock actuel : {modalProduct.stock}</span>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setModalOpen(false)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999, color: "rgba(255,255,255,0.7)", padding: "8px 14px", cursor: "pointer", fontWeight: 750 }}>Fermer</button>
            </div>

            {movError && <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.20)", color: "rgba(255,120,120,0.95)", fontWeight: 700, fontSize: 13 }}>{movError}</div>}

            {/* Type selector — masqué en mode init */}
            {!initMode && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
                {(["in", "out", "adjustment"] as MovementType[]).map(t => {
                  const info = TYPE_LABELS[t];
                  const active = movType === t;
                  return (
                    <button key={t} type="button" onClick={() => setMovType(t)}
                      style={{ height: 44, borderRadius: 12, border: `1px solid ${active ? info.border : "rgba(255,255,255,0.08)"}`, background: active ? info.bg : "rgba(255,255,255,0.02)", color: active ? info.color : "rgba(255,255,255,0.50)", fontWeight: active ? 800 : 500, fontSize: 13, cursor: "pointer", transition: "all 150ms" }}>
                      {info.sign} {info.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Description */}
            <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, opacity: 0.55 }}>
              {initMode                            && "Définit le stock de départ pour ce produit. Vous pourrez ensuite faire des entrées et sorties."}
              {!initMode && movType === "in"       && "Ajoute la quantité au stock existant."}
              {!initMode && movType === "out"      && "Retire la quantité du stock existant."}
              {!initMode && movType === "adjustment" && "Définit le stock à la valeur exacte saisie (écrase la valeur actuelle)."}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.75, marginBottom: 8, color: "rgba(255,255,255,0.92)" }}>
                  {initMode ? "Stock initial" : movType === "adjustment" ? "Nouveau stock" : "Quantité"} <span style={{ color: "rgba(255,100,100,0.7)" }}>*</span>
                </div>
                <input
                  autoFocus
                  value={movQty}
                  onChange={e => setMovQty(e.target.value)}
                  placeholder={movType === "adjustment" ? "ex: 42" : "ex: 10"}
                  inputMode="numeric"
                  style={{ width: "100%", height: 48, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: `1px solid ${TYPE_LABELS[movType].border}`, outline: "none", fontSize: 18, fontWeight: 800 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.75, marginBottom: 8, color: "rgba(255,255,255,0.92)" }}>Note <span style={{ opacity: 0.5 }}>(optionnel)</span></div>
                <input
                  value={movNote}
                  onChange={e => setMovNote(e.target.value)}
                  placeholder="ex: Réapprovisionnement fournisseur, Retour client…"
                  style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setModalOpen(false)}
                style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", fontWeight: 750, cursor: "pointer" }}>Annuler</button>
              <button type="button" onClick={saveMovement} disabled={movSaving || !movQty.trim()}
                style={{ height: 40, padding: "0 20px", borderRadius: 999, border: `1px solid ${TYPE_LABELS[movType].border}`, background: TYPE_LABELS[movType].bg, color: TYPE_LABELS[movType].color, fontWeight: 800, cursor: movSaving || !movQty.trim() ? "not-allowed" : "pointer", opacity: movSaving || !movQty.trim() ? 0.5 : 1 }}>
                {movSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}