"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/lib/workspaceContext";

type Product = {
  id: string;
  name: string;
  category: string[] | null;
  price: number;
  stock: number | null;
  stock_alert: number | null;
  created_at: string;
};

function formatEUR(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v); } catch { return `${v.toFixed(2)} €`; }
}

function getCategories(p: Product): string[] {
  if (Array.isArray(p.category)) return p.category;
  if (typeof p.category === "string" && p.category) return [p.category];
  return [];
}

function StockBadge({ stock, stockAlert }: { stock: number | null; stockAlert: number | null }) {
  if (stock === null) return <span style={{ opacity: 0.3 }}>—</span>;
  const isAlert = stockAlert !== null && stock <= stockAlert;
  const isEmpty = stock === 0;
  const color = isEmpty
    ? { bg: "rgba(255,80,80,0.12)", border: "rgba(255,80,80,0.28)", text: "rgba(255,110,110,0.95)" }
    : isAlert
    ? { bg: "rgba(255,160,50,0.12)", border: "rgba(255,160,50,0.30)", text: "rgba(255,180,60,0.95)" }
    : { bg: "rgba(80,210,140,0.10)", border: "rgba(80,210,140,0.25)", text: "rgba(80,210,140,0.95)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: color.bg, border: `1px solid ${color.border}`, color: color.text }}>
      {isEmpty ? "⛔" : isAlert ? "⚠️" : "✓"} {stock}
    </span>
  );
}

function CategoryMultiSelect({ selected, onChange, suggestions }: {
  selected: string[];
  onChange: (cats: string[]) => void;
  suggestions: string[];
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = suggestions.filter(s => !selected.includes(s) && s.toLowerCase().includes(input.toLowerCase()));
  const canAdd = input.trim() !== "" && !selected.includes(input.trim()) && !suggestions.includes(input.trim());

  function add(cat: string) {
    const trimmed = cat.trim();
    if (trimmed && !selected.includes(trimmed)) onChange([...selected, trimmed]);
    setInput("");
    inputRef.current?.focus();
  }

  function remove(cat: string) {
    onChange(selected.filter(c => c !== cat));
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
        style={{
          minHeight: 44, padding: "6px 10px", borderRadius: 12, cursor: "text",
          background: "rgba(10,11,14,0.65)", border: "1px solid rgba(255,255,255,0.12)",
          display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
        }}
      >
        {selected.map(cat => (
          <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 26, padding: "0 8px 0 10px", borderRadius: 999, background: "rgba(120,160,255,0.14)", border: "1px solid rgba(120,160,255,0.30)", color: "rgba(160,185,255,0.95)", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {cat}
            <button type="button" onMouseDown={e => { e.preventDefault(); remove(cat); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(120,160,255,0.6)", fontSize: 14, padding: 0, lineHeight: 1, display: "flex", alignItems: "center", marginLeft: 2 }}>×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); if (input.trim()) add(filtered[0] ?? input); }
            if (e.key === "Backspace" && !input && selected.length > 0) remove(selected[selected.length - 1]);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={selected.length === 0 ? "Sélectionne ou tape une catégorie…" : ""}
          style={{ flex: 1, minWidth: 120, background: "none", border: "none", outline: "none", color: "rgba(255,255,255,0.92)", fontSize: 14, padding: "2px 4px" }}
        />
      </div>

      {open && (filtered.length > 0 || canAdd) && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, borderRadius: 12, overflow: "hidden", background: "linear-gradient(180deg, rgba(18,20,28,0.99), rgba(10,11,16,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}>
          {filtered.map(cat => (
            <button key={cat} type="button"
              onMouseDown={e => { e.preventDefault(); add(cat); }}
              style={{ width: "100%", padding: "9px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(120,160,255,0.10)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(120,160,255,0.10)", border: "1px solid rgba(120,160,255,0.20)", color: "rgba(120,160,255,0.9)" }}>{cat}</span>
            </button>
          ))}
          {canAdd && (
            <button type="button"
              onMouseDown={e => { e.preventDefault(); add(input); }}
              style={{ width: "100%", padding: "9px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, borderTop: filtered.length > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ opacity: 0.5 }}>＋</span> Créer "{input.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
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
  const [formCategories, setFormCategories] = useState<string[]>([]);
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formStockAlert, setFormStockAlert] = useState("");
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
        .from("products").select("id,name,category,price,stock,stock_alert,created_at")
        .eq("workspace_id", activeWorkspace.id)
        .order("name", { ascending: true });
      if (error) throw error;
      setProducts((data ?? []) as Product[]);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur inconnue"); }
    finally { setLoading(false); }
  }

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => getCategories(p).forEach(c => cats.add(c)));
    extraCategories.forEach(c => cats.add(c));
    return Array.from(cats).sort();
  }, [products, extraCategories]);

  const filtered = useMemo(() => {
    let list = products;
    if (filterCat !== "all") list = list.filter(p => getCategories(p).includes(filterCat));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || getCategories(p).some(c => c.toLowerCase().includes(q)));
    }
    return list;
  }, [products, filterCat, search]);

  const stockAlertCount = useMemo(() =>
    products.filter(p => p.stock !== null && p.stock_alert !== null && p.stock <= p.stock_alert).length,
  [products]);

  function openCreate() {
    setEditId(null); setFormName(""); setFormCategories([]); setFormPrice("");
    setFormStock(""); setFormStockAlert(""); setModalOpen(true); setErrorMsg("");
  }
  function openEdit(p: Product) {
    setEditId(p.id); setFormName(p.name); setFormCategories(getCategories(p));
    setFormPrice(String(p.price));
    setFormStock(p.stock !== null ? String(p.stock) : "");
    setFormStockAlert(p.stock_alert !== null ? String(p.stock_alert) : "");
    setModalOpen(true); setErrorMsg("");
  }

  async function saveProduct() {
    if (!formName.trim()) { setErrorMsg("Le nom est requis."); return; }
    const price = parseFloat(formPrice.replace(",", "."));
    if (isNaN(price) || price < 0) { setErrorMsg("Prix invalide."); return; }
    const stock = formStock.trim() === "" ? null : parseInt(formStock, 10);
    const stockAlert = formStockAlert.trim() === "" ? null : parseInt(formStockAlert, 10);
    if (stock !== null && isNaN(stock)) { setErrorMsg("Stock invalide."); return; }
    if (stockAlert !== null && isNaN(stockAlert)) { setErrorMsg("Seuil d'alerte invalide."); return; }
    setFormSaving(true); setErrorMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user; if (!user) { window.location.href = "/login"; return; }
      const payload = {
        name: formName.trim(),
        category: formCategories.length > 0 ? formCategories : null,
        price, stock, stock_alert: stockAlert,
        user_id: user.id, workspace_id: activeWorkspace?.id,
      };
      if (editId) {
        const oldProduct = products.find(p => p.id === editId);
        const { error } = await supabase.from("products").update(payload).eq("id", editId);
        if (error) throw error;
        setProducts(prev => prev.map(p => p.id === editId ? { ...p, ...payload } : p));
        // Historique stock si le stock a changé
        const oldStock = oldProduct?.stock ?? null;
        if (stock !== null && oldStock !== null && stock !== oldStock) {
          const delta = stock - oldStock;
          await supabase.from("stock_movements").insert({
            product_id: editId,
            workspace_id: activeWorkspace?.id,
            type: delta > 0 ? "in" : "out",
            quantity: Math.abs(delta),
            note: "Modification manuelle via la page Produits",
            created_by: user.id,
          });
        } else if (stock !== null && oldStock === null) {
          // Stock initialisé pour la première fois
          await supabase.from("stock_movements").insert({
            product_id: editId,
            workspace_id: activeWorkspace?.id,
            type: "adjustment",
            quantity: stock,
            note: "Initialisation du stock via la page Produits",
            created_by: user.id,
          });
        }
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id,name,category,price,stock,stock_alert,created_at").single();
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
    setCatName(""); setCatError("");
  }

  async function renameCategory(oldName: string) {
    const newName = renameVal.trim();
    if (!newName || newName === oldName) { setRenamingCat(null); return; }
    if (categories.includes(newName)) { setCatError("Cette catégorie existe déjà."); return; }
    setCatSaving(true); setCatError("");
    try {
      const toUpdate = products.filter(p => getCategories(p).includes(oldName));
      await Promise.all(toUpdate.map(p => {
        const newCats = getCategories(p).map(c => c === oldName ? newName : c);
        return supabase.from("products").update({ category: newCats }).eq("id", p.id);
      }));
      setProducts(prev => prev.map(p => {
        const cats = getCategories(p);
        if (!cats.includes(oldName)) return p;
        return { ...p, category: cats.map(c => c === oldName ? newName : c) };
      }));
      setExtraCategories(prev => prev.map(c => c === oldName ? newName : c));
      if (filterCat === oldName) setFilterCat(newName);
      setRenamingCat(null); setRenameVal("");
    } catch (e: any) { setCatError(e?.message ?? "Erreur renommage"); }
    finally { setCatSaving(false); }
  }

  async function deleteCategory(name: string) {
    if (!confirm(`Supprimer la catégorie "${name}" ? Les produits associés perdront cette catégorie.`)) return;
    setCatSaving(true); setCatError("");
    try {
      const toUpdate = products.filter(p => getCategories(p).includes(name));
      await Promise.all(toUpdate.map(p => {
        const newCats = getCategories(p).filter(c => c !== name);
        return supabase.from("products").update({ category: newCats.length > 0 ? newCats : null }).eq("id", p.id);
      }));
      setProducts(prev => prev.map(p => {
        const cats = getCategories(p);
        if (!cats.includes(name)) return p;
        const newCats = cats.filter(c => c !== name);
        return { ...p, category: newCats.length > 0 ? newCats : null };
      }));
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
          <p className="ds-subtitle">
            Catalogue produits — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong>
            {stockAlertCount > 0 && (
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 800, padding: "2px 10px", borderRadius: 999, background: "rgba(255,160,50,0.12)", border: "1px solid rgba(255,160,50,0.30)", color: "rgba(255,180,60,0.95)" }}>
                ⚠️ {stockAlertCount} alerte{stockAlertCount > 1 ? "s" : ""} stock
              </span>
            )}
          </p>
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
        <div className="ds-stat-card">
          <div className="ds-stat-label">Alertes stock</div>
          <div className="ds-stat-value" style={{ color: stockAlertCount > 0 ? "rgba(255,180,60,0.95)" : "var(--text-primary)" }}>{stockAlertCount}</div>
        </div>
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
                <tr>
                  <th>Produit</th>
                  <th>Catégories</th>
                  <th className="ds-right">Prix</th>
                  <th className="ds-right">Stock</th>
                  <th className="ds-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const cats = getCategories(p);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700 }}>{p.name}</td>
                      <td>
                        {cats.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {cats.map(cat => (
                              <span key={cat} style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(120,160,255,0.10)", border: "1px solid rgba(120,160,255,0.20)", color: "rgba(120,160,255,0.9)", whiteSpace: "nowrap" }}>{cat}</span>
                            ))}
                          </div>
                        ) : <span style={{ opacity: 0.35 }}>—</span>}
                      </td>
                      <td className="ds-right" style={{ fontWeight: 800, color: "rgba(120,160,255,0.9)" }}>{formatEUR(p.price)}</td>
                      <td className="ds-right">
                        <StockBadge stock={p.stock} stockAlert={p.stock_alert} />
                      </td>
                      <td className="ds-right">
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button type="button" onClick={() => openEdit(p)}
                            style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.80)", fontSize: 12, fontWeight: 750, cursor: "pointer" }}>Modifier</button>
                          <button type="button" onClick={() => deleteProduct(p.id)}
                            style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.20)", background: "rgba(255,80,80,0.06)", color: "rgba(255,120,120,0.85)", fontSize: 12, fontWeight: 750, cursor: "pointer" }}>Suppr.</button>
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

            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, opacity: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Catégories existantes ({categories.length})</div>
            {categories.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", opacity: 0.4, fontSize: 13 }}>Aucune catégorie pour l'instant</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                {categories.map(cat => {
                  const count = products.filter(p => getCategories(p).includes(cat)).length;
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
              {/* Nom */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.75, marginBottom: 8, color: "rgba(255,255,255,0.92)" }}>Nom du produit <span style={{ color: "rgba(255,100,100,0.7)" }}>*</span></div>
                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="ex: Coupe femme, Massage 1h…"
                  style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.12)", outline: "none", fontSize: 14 }} />
              </div>

              {/* Catégories */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.75, marginBottom: 8, color: "rgba(255,255,255,0.92)" }}>
                  Catégories <span style={{ opacity: 0.5, fontWeight: 500 }}>(optionnel)</span>
                </div>
                <CategoryMultiSelect
                  selected={formCategories}
                  onChange={setFormCategories}
                  suggestions={categories}
                />
                <div style={{ fontSize: 11, opacity: 0.4, marginTop: 6 }}>Tape pour chercher ou créer une catégorie. Entrée ou clic pour ajouter. Backspace pour supprimer le dernier tag.</div>
              </div>

              {/* Prix */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.75, marginBottom: 8, color: "rgba(255,255,255,0.92)" }}>Prix (€) <span style={{ color: "rgba(255,100,100,0.7)" }}>*</span></div>
                <input value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="ex: 49,90" inputMode="decimal"
                  style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.12)", outline: "none", fontSize: 14 }} />
              </div>

              {/* Stock */}
              <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(80,210,140,0.04)", border: "1px solid rgba(80,210,140,0.12)" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(80,210,140,0.8)", marginBottom: 12 }}>📦 Gestion du stock <span style={{ opacity: 0.5, fontWeight: 500 }}>(optionnel)</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.65, marginBottom: 6, color: "rgba(255,255,255,0.9)" }}>Stock actuel</div>
                    <input value={formStock} onChange={e => setFormStock(e.target.value)} placeholder="ex: 50" inputMode="numeric"
                      style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 12px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(80,210,140,0.20)", outline: "none", fontSize: 13 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.65, marginBottom: 6, color: "rgba(255,255,255,0.9)" }}>Seuil d'alerte</div>
                    <input value={formStockAlert} onChange={e => setFormStockAlert(e.target.value)} placeholder="ex: 5" inputMode="numeric"
                      style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 12px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,160,50,0.20)", outline: "none", fontSize: 13 }} />
                  </div>
                </div>
                <div style={{ fontSize: 11, opacity: 0.4, marginTop: 8 }}>Laisser vide pour ne pas suivre le stock de ce produit.</div>
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
