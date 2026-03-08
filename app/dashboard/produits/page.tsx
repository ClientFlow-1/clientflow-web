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
  created_at: string;
};

function formatEUR(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v); } catch { return `${v.toFixed(2)} €`; }
}

export default function ProduitsPage() {
  const { activeWorkspace } = useWorkspace();
  const [products, setProducts] = useState<Product[]>([]);
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  // Modal produit
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Modal catégorie
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  // Filtre catégorie
  const [filterCat, setFilterCat] = useState<string>("all");

  useEffect(() => { setMounted(true); fetchProducts(); }, [activeWorkspace?.id]);

  async function fetchProducts() {
    setLoading(true); setErrorMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { window.location.href = "/login"; return; }
      if (!activeWorkspace) { setProducts([]); setLoading(false); return; }
      const { data, error } = await supabase
        .from("products").select("id,name,category,price,created_at")
        .eq("workspace_id", activeWorkspace.id)
        .order("category", { ascending: true }).order("name", { ascending: true });
      if (error) throw error;
      setProducts((data ?? []) as Product[]);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur inconnue"); }
    finally { setLoading(false); }
  }

  const categories = useMemo(() => {
    const cats = new Set([
      ...products.map(p => p.category ?? "Sans catégorie"),
      ...extraCategories,
    ]);
    return Array.from(cats).sort();
  }, [products, extraCategories]);

  const filtered = useMemo(() => {
    let list = products;
    if (filterCat !== "all") list = list.filter(p => (p.category ?? "Sans catégorie") === filterCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [products, filterCat, search]);

  function openCreate() {
    setEditId(null); setFormName(""); setFormCategory(""); setFormPrice(""); setModalOpen(true); setErrorMsg("");
  }
  function openEdit(p: Product) {
    setEditId(p.id); setFormName(p.name); setFormCategory(p.category ?? ""); setFormPrice(String(p.price)); setModalOpen(true); setErrorMsg("");
  }

  async function saveProduct() {
    if (!formName.trim()) { setErrorMsg("Le nom est requis."); return; }
    const price = parseFloat(formPrice.replace(",", "."));
    if (isNaN(price) || price < 0) { setErrorMsg("Prix invalide."); return; }
    setFormSaving(true); setErrorMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user; if (!user) { window.location.href = "/login"; return; }
      const payload = { name: formName.trim(), category: formCategory.trim() || null, price, user_id: user.id, workspace_id: activeWorkspace?.id };
      if (editId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editId);
        if (error) throw error;
        setProducts(prev => prev.map(p => p.id === editId ? { ...p, ...payload } : p));
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id,name,category,price,created_at").single();
        if (error) throw error;
        setProducts(prev => [data as Product, ...prev]);
      }
      setModalOpen(false);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur sauvegarde"); }
    finally { setFormSaving(false); }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    try {
      setLoading(true);
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur suppression"); }
    finally { setLoading(false); }
  }

  function createCategory() {
    const name = catName.trim();
    if (!name) { setCatError("Nom requis."); return; }
    if (categories.includes(name)) { setCatError("Cette catégorie existe déjà."); return; }
    setExtraCategories(prev => [...prev, name]);
    setCatName("");
    setCatError("");
  }

  async function renameCategory(oldName: string) {
    const newName = renameVal.trim();
    if (!newName || newName === oldName) { setRenamingCat(null); return; }
    if (categories.includes(newName)) { setCatError("Cette catégorie existe déjà."); return; }
    setCatSaving(true); setCatError("");
    try {
      const toUpdate = products.filter(p => (p.category ?? "Sans catégorie") === oldName);
      await Promise.all(toUpdate.map(p =>
        supabase.from("products").update({ category: newName === "Sans catégorie" ? null : newName }).eq("id", p.id)
      ));
      setProducts(prev => prev.map(p =>
        (p.category ?? "Sans catégorie") === oldName ? { ...p, category: newName === "Sans catégorie" ? null : newName } : p
      ));
      setExtraCategories(prev => prev.map(c => c === oldName ? newName : c));
      if (filterCat === oldName) setFilterCat(newName);
      setRenamingCat(null); setRenameVal("");
    } catch (e: any) { setCatError(e?.message ?? "Erreur renommage"); }
    finally { setCatSaving(false); }
  }

  async function deleteCategory(name: string) {
    if (!confirm(`Supprimer la catégorie "${name}" ? Les produits associés passeront en "Sans catégorie".`)) return;
    setCatSaving(true); setCatError("");
    try {
      const toUpdate = products.filter(p => (p.category ?? "Sans catégorie") === name);
      await Promise.all(toUpdate.map(p =>
        supabase.from("products").update({ category: null }).eq("id", p.id)
      ));
      setProducts(prev => prev.map(p =>
        (p.category ?? "Sans catégorie") === name ? { ...p, category: null } : p
      ));
      setExtraCategories(prev => prev.filter(c => c !== name));
      if (filterCat === name) setFilterCat("all");
    } catch (e: any) { setCatError(e?.message ?? "Erreur suppression"); }
    finally { setCatSaving(false); }
  }

  if (!activeWorkspace) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Produits</div>
      <h1 className="ds-title">Produits</h1>
      <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Aucun workspace sélectionné</div>
      </div>
    </div>
  );

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Produits</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Produits</h1>
          <p className="ds-subtitle">Catalogue produits — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong></p>
          {errorMsg && <p style={{ marginTop: 8, color: "rgba(255,120,120,0.95)", fontWeight: 800 }}>Erreur : {errorMsg}</p>}
        </div>
        <div className="ds-right-tools">
          <button className="ds-btn ds-btn-ghost" type="button" onClick={fetchProducts} disabled={loading}>{loading ? "Chargement..." : "Actualiser"}</button>
          <button type="button" onClick={() => { setCatName(""); setCatError(""); setRenamingCat(null); setCatModalOpen(true); }}
            style={{ height: 40, padding: "0 16px", borderRadius: 12, background: "rgba(255,200,80,0.10)", border: "1px solid rgba(255,200,80,0.30)", color: "rgba(255,210,80,0.95)", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            🏷 Catégories
          </button>
          <button type="button" onClick={openCreate}
            style={{ height: 40, padding: "0 18px", borderRadius: 12, background: "rgba(120,160,255,0.16)", border: "1px solid rgba(120,160,255,0.40)", color: "rgba(255,255,255,0.95)", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            ＋ Nouveau produit
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="ds-stats-grid">
        <div className="ds-stat-card"><div className="ds-stat-label">Produits</div><div className="ds-stat-value">{products.length}</div></div>
        <div className="ds-stat-card"><div className="ds-stat-label">Catégories</div><div className="ds-stat-value">{categories.length}</div></div>
        <div className="ds-stat-card"><div className="ds-stat-label">Prix moyen</div><div className="ds-stat-value">{formatEUR(products.length > 0 ? products.reduce((a, p) => a + p.price, 0) / products.length : 0)}</div></div>
        <div className="ds-stat-card"><div className="ds-stat-label">Prix max</div><div className="ds-stat-value">{formatEUR(products.length > 0 ? Math.max(...products.map(p => p.price)) : 0)}</div></div>
      </div>

      {/* Recherche + filtre */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4, pointerEvents: "none" }}>⌕</span>
          <input placeholder="Rechercher un produit…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px 0 40px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 14 }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setFilterCat("all")}
            style={{ height: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${filterCat === "all" ? "rgba(120,160,255,0.45)" : "rgba(255,255,255,0.10)"}`, background: filterCat === "all" ? "rgba(120,160,255,0.16)" : "rgba(255,255,255,0.03)", color: filterCat === "all" ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Tout
          </button>
          {categories.map(cat => (
            <button key={cat} type="button" onClick={() => setFilterCat(cat)}
              style={{ height: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${filterCat === cat ? "rgba(120,160,255,0.45)" : "rgba(255,255,255,0.10)"}`, background: filterCat === cat ? "rgba(120,160,255,0.16)" : "rgba(255,255,255,0.03)", color: filterCat === cat ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="ds-card">
        <div className="ds-card-head">
          <div>
            <div className="ds-card-title">Catalogue</div>
            <div className="ds-card-sub">{filtered.length} / {products.length} produits</div>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>◈</div>
            <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Aucun produit</div>
            <div style={{ fontSize: 13, marginTop: 6, opacity: 0.5 }}>Crée ton premier produit avec le bouton en haut à droite.</div>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr><th>Produit</th><th>Catégorie</th><th className="ds-right">Prix</th><th className="ds-right">Action</th></tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.name}</td>
                    <td>
                      {p.category ? (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(120,160,255,0.10)", border: "1px solid rgba(120,160,255,0.20)", color: "rgba(120,160,255,0.9)" }}>{p.category}</span>
                      ) : <span style={{ opacity: 0.35 }}>—</span>}
                    </td>
                    <td className="ds-right" style={{ fontWeight: 800, color: "rgba(120,160,255,0.9)" }}>{formatEUR(p.price)}</td>
                    <td className="ds-right">
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <button type="button" onClick={() => openEdit(p)}
                          style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.80)", fontSize: 12, fontWeight: 750, cursor: "pointer" }}>Modifier</button>
                        <button type="button" onClick={() => deleteProduct(p.id)}
                          style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.20)", background: "rgba(255,80,80,0.06)", color: "rgba(255,120,120,0.85)", fontSize: 12, fontWeight: 750, cursor: "pointer" }}>Suppr.</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Catégories ── */}
      {catModalOpen && mounted && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(0,0,0,0.60)", backdropFilter: "blur(10px)" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setCatModalOpen(false); }}>
          <div style={{ width: 480, maxWidth: "100%", borderRadius: 18, padding: 24, background: "linear-gradient(180deg, rgba(20,22,28,0.99), rgba(12,13,16,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
            onMouseDown={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.95)" }}>🏷 Gérer les catégories</div>
                <div style={{ fontSize: 13, opacity: 0.5, marginTop: 3 }}>Crée, renomme ou supprime des catégories</div>
              </div>
              <button type="button" onClick={() => setCatModalOpen(false)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999, color: "rgba(255,255,255,0.7)", padding: "8px 14px", cursor: "pointer", fontWeight: 750 }}>Fermer</button>
            </div>

            {catError && <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.20)", color: "rgba(255,120,120,0.95)", fontWeight: 700, fontSize: 13 }}>{catError}</div>}

            {/* Créer */}
            <div style={{ marginBottom: 20, padding: 16, borderRadius: 14, background: "rgba(255,200,80,0.05)", border: "1px solid rgba(255,200,80,0.15)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,210,80,0.9)", marginBottom: 10 }}>＋ Nouvelle catégorie</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="ex: Soins, Coupes, Accessoires…"
                  onKeyDown={e => { if (e.key === "Enter") createCategory(); }}
                  style={{ flex: 1, height: 40, borderRadius: 10, padding: "0 12px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,200,80,0.25)", outline: "none", fontSize: 13 }} />
                <button type="button" onClick={createCategory} disabled={!catName.trim()}
                  style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid rgba(255,200,80,0.40)", background: "rgba(255,200,80,0.14)", color: "rgba(255,210,80,0.95)", fontWeight: 800, fontSize: 13, cursor: !catName.trim() ? "not-allowed" : "pointer", opacity: !catName.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}>
                  Créer
                </button>
              </div>
            </div>

            {/* Liste */}
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, opacity: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Catégories existantes ({categories.length})</div>
            {categories.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", opacity: 0.4, fontSize: 13 }}>Aucune catégorie pour l'instant</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                {categories.map(cat => {
                  const count = products.filter(p => (p.category ?? "Sans catégorie") === cat).length;
                  return (
                    <div key={cat}>
                      {renamingCat === cat ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, background: "rgba(120,160,255,0.06)", border: "1px solid rgba(120,160,255,0.25)" }}>
                          <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") renameCategory(cat); if (e.key === "Escape") setRenamingCat(null); }}
                            style={{ flex: 1, height: 32, borderRadius: 8, padding: "0 10px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(120,160,255,0.35)", outline: "none", fontSize: 13 }} />
                          <button type="button" onClick={() => renameCategory(cat)} disabled={catSaving}
                            style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "none", background: "rgba(120,160,255,0.20)", color: "rgba(255,255,255,0.95)", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: catSaving ? 0.5 : 1 }}>{catSaving ? "…" : "✓"}</button>
                          <button type="button" onClick={() => setRenamingCat(null)}
                            style={{ height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: "rgba(120,160,255,0.10)", border: "1px solid rgba(120,160,255,0.20)", color: "rgba(120,160,255,0.9)", flexShrink: 0 }}>{cat}</span>
                          <span style={{ fontSize: 12, opacity: 0.4, flex: 1 }}>{count} produit{count > 1 ? "s" : ""}</span>
                          <button type="button" onClick={() => { setRenamingCat(cat); setRenameVal(cat); setCatError(""); }}
                            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(120,160,255,0.15)", background: "rgba(120,160,255,0.05)", color: "rgba(120,160,255,0.7)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✏️</button>
                          <button type="button" onClick={() => deleteCategory(cat)}
                            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,80,80,0.15)", background: "rgba(255,80,80,0.05)", color: "rgba(255,100,80,0.7)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🗑</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal produit ── */}
      {modalOpen && mounted && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(0,0,0,0.58)", backdropFilter: "blur(10px)" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={{ width: 500, maxWidth: "100%", borderRadius: 18, padding: 24, background: "linear-gradient(180deg, rgba(20,22,28,0.98), rgba(12,13,16,0.98))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
            onMouseDown={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.95)" }}>{editId ? "Modifier le produit" : "Nouveau produit"}</div>
                <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>Les informations seront disponibles lors de l'ajout d'une vente.</div>
              </div>
              <button type="button" onClick={() => setModalOpen(false)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999, color: "rgba(255,255,255,0.7)", padding: "8px 14px", cursor: "pointer", fontWeight: 750 }}>Fermer</button>
            </div>

            {errorMsg && <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.20)", color: "rgba(255,120,120,0.95)", fontWeight: 700, fontSize: 13 }}>{errorMsg}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.75, marginBottom: 8, color: "rgba(255,255,255,0.92)" }}>Nom du produit <span style={{ color: "rgba(255,100,100,0.7)" }}>*</span></div>
                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="ex: Coupe femme, Massage 1h…"
                  style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.12)", outline: "none", fontSize: 14 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.75, marginBottom: 8, color: "rgba(255,255,255,0.92)" }}>Catégorie <span style={{ opacity: 0.5 }}>(optionnel)</span></div>
                  <input value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder="ex: Soins, Coupes…"
                    list="cat-suggestions"
                    style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.12)", outline: "none", fontSize: 14 }} />
                  <datalist id="cat-suggestions">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.75, marginBottom: 8, color: "rgba(255,255,255,0.92)" }}>Prix (€) <span style={{ color: "rgba(255,100,100,0.7)" }}>*</span></div>
                  <input value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="ex: 49,90" inputMode="decimal"
                    style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.12)", outline: "none", fontSize: 14 }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setModalOpen(false)}
                style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", fontWeight: 750, cursor: "pointer" }}>Annuler</button>
              <button type="button" onClick={saveProduct} disabled={formSaving}
                style={{ height: 40, padding: "0 20px", borderRadius: 999, border: "1px solid rgba(120,160,255,0.40)", background: "rgba(120,160,255,0.16)", color: "rgba(255,255,255,0.95)", fontWeight: 800, cursor: formSaving ? "not-allowed" : "pointer", opacity: formSaving ? 0.6 : 1 }}>
                {formSaving ? "Enregistrement…" : editId ? "Enregistrer" : "Créer le produit"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}