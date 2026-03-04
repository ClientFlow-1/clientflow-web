"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkspace, Workspace } from "@/lib/workspaceContext";

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link href={href} className={`ds-nav-item ${active ? "active" : ""}`}>
      <span className="ds-nav-icon">{icon}</span>
      <span className="ds-nav-label">{label}</span>
      {active && <span className="ds-nav-active-bar" />}
    </Link>
  );
}

function CustomSelect({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.95)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(99,120,255,0.30)", fontSize: 14, outline: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 0 0 1px rgba(99,120,255,0.10) inset" }}>
        <span>{selected?.label ?? "—"}</span>
        <span style={{ opacity: 0.4, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 99999, borderRadius: 12, overflow: "hidden", background: "linear-gradient(180deg, rgba(18,20,28,0.99), rgba(10,11,16,0.99))", border: "1px solid rgba(99,120,255,0.25)", boxShadow: "0 16px 48px rgba(0,0,0,0.7)", backdropFilter: "blur(20px)" }}>
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ width: "100%", padding: "11px 14px", background: o.value === value ? "rgba(99,120,255,0.14)" : "transparent", color: o.value === value ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.80)", fontSize: 14, fontWeight: o.value === value ? 800 : 500, border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 100ms" }}>
              {o.label}
              {o.value === value && <span style={{ fontSize: 11, color: "rgba(99,120,255,0.9)" }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type DeleteStep = "confirm" | "choice" | "create" | null;

function DeleteWorkspaceModal({ target, workspaces, onClose, onDeleted }: { target: Workspace; workspaces: Workspace[]; onClose: () => void; onDeleted: () => void; }) {
  const { deleteWorkspace, createWorkspace } = useWorkspace();
  const others = workspaces.filter(w => w.id !== target.id);
  const [step, setStep] = useState<DeleteStep>("confirm");
  const [choice, setChoice] = useState<"transfer" | "delete" | null>(null);
  const [transferTo, setTransferTo] = useState<string>(others[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setSaving(true); setError("");
    try {
      let targetId: string | null = null;
      if (choice === "transfer") {
        if (step === "create") {
          if (!newName.trim()) { setError("Saisis un nom de boutique."); setSaving(false); return; }
          const created = await createWorkspace(newName.trim());
          if (!created) { setError("Erreur création workspace."); setSaving(false); return; }
          targetId = created.id;
        } else { targetId = transferTo || null; }
      }
      const ok = await deleteWorkspace(target.id, targetId);
      if (!ok) { setError("Erreur lors de la suppression."); setSaving(false); return; }
      onDeleted();
    } catch (e: any) { setError(e?.message ?? "Erreur inconnue"); setSaving(false); }
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 480, maxWidth: "100%", borderRadius: 20, padding: 24, background: "linear-gradient(180deg, rgba(20,22,30,0.99), rgba(10,11,16,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 30px 80px rgba(0,0,0,0.7)" }}>
        {step === "confirm" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 8 }}>🗑️ Supprimer "{target.name}" ?</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24, lineHeight: 1.6 }}>Cette boutique sera supprimée. Vous pourrez choisir de transférer ou supprimer toutes les données associées (clients, ventes).</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
              <button type="button" onClick={() => setStep("choice")} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: "rgba(255,80,80,0.18)", color: "rgba(255,120,100,0.95)", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Continuer →</button>
            </div>
          </>
        )}
        {step === "choice" && (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 6 }}>Que faire des données ?</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>Clients et ventes de "{target.name}"</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <label onClick={() => setChoice("transfer")} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 14, border: `1px solid ${choice === "transfer" ? "rgba(120,160,255,0.45)" : "rgba(255,255,255,0.08)"}`, background: choice === "transfer" ? "rgba(120,160,255,0.08)" : "rgba(255,255,255,0.02)", cursor: "pointer" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${choice === "transfer" ? "rgba(120,160,255,0.9)" : "rgba(255,255,255,0.25)"}`, background: choice === "transfer" ? "rgba(120,160,255,0.9)" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {choice === "transfer" && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "rgba(255,255,255,0.92)", marginBottom: 3 }}>↗️ Transférer vers une autre boutique</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Les clients et ventes seront déplacés vers le workspace de ton choix.</div>
                </div>
              </label>
              <label onClick={() => setChoice("delete")} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 14, border: `1px solid ${choice === "delete" ? "rgba(255,80,80,0.40)" : "rgba(255,255,255,0.08)"}`, background: choice === "delete" ? "rgba(255,80,80,0.08)" : "rgba(255,255,255,0.02)", cursor: "pointer" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${choice === "delete" ? "rgba(255,100,80,0.9)" : "rgba(255,255,255,0.25)"}`, background: choice === "delete" ? "rgba(255,100,80,0.9)" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {choice === "delete" && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "rgba(255,120,100,0.95)", marginBottom: 3 }}>🗑️ Supprimer toutes les données</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Clients et ventes seront définitivement supprimés. Action irréversible.</div>
                </div>
              </label>
            </div>
            {choice === "transfer" && (
              <div style={{ marginBottom: 20 }}>
                {others.length > 0 ? (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Transférer vers :</div>
                    <CustomSelect options={others.map(w => ({ value: w.id, label: w.name }))} value={transferTo} onChange={setTransferTo} />
                  </>
                ) : (
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,180,60,0.08)", border: "1px solid rgba(255,180,60,0.20)", fontSize: 13, color: "rgba(255,200,80,0.9)", fontWeight: 700 }}>⚠️ Aucune autre boutique — tu devras en créer une pour le transfert.</div>
                )}
              </div>
            )}
            {error && <div style={{ fontSize: 13, color: "rgba(255,120,100,0.95)", fontWeight: 700, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStep("confirm")} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Retour</button>
              <button type="button" disabled={!choice || saving}
                onClick={() => { if (choice === "transfer" && others.length === 0) { setStep("create"); return; } handleDelete(); }}
                style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: choice === "delete" ? "rgba(255,80,80,0.18)" : "rgba(120,160,255,0.18)", color: choice === "delete" ? "rgba(255,120,100,0.95)" : "rgba(120,160,255,0.95)", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: !choice || saving ? 0.4 : 1 }}>
                {saving ? "En cours…" : choice === "delete" ? "Supprimer définitivement" : "Transférer et supprimer"}
              </button>
            </div>
          </>
        )}
        {step === "create" && (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 6 }}>Créer une boutique de destination</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>Les données de "{target.name}" seront transférées vers cette nouvelle boutique.</div>
            <input autoFocus placeholder="Nom de la nouvelle boutique…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleDelete(); }}
              style={{ width: "100%", height: 46, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.8)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(120,160,255,0.30)", fontSize: 14, outline: "none", marginBottom: 16 }} />
            {error && <div style={{ fontSize: 13, color: "rgba(255,120,100,0.95)", fontWeight: 700, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStep("choice")} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Retour</button>
              <button type="button" disabled={!newName.trim() || saving} onClick={handleDelete}
                style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: "rgba(120,160,255,0.18)", color: "rgba(120,160,255,0.95)", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: !newName.trim() || saving ? 0.4 : 1 }}>
                {saving ? "En cours…" : "Créer et transférer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function WorkspacePicker() {
  const { workspaces, activeWorkspace, setActiveWorkspace, createWorkspace, renameWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 240) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false); setCreating(false); setNewName(""); setRenamingId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    const w = await createWorkspace(newName.trim());
    if (w) { setActiveWorkspace(w); setCreating(false); setNewName(""); setOpen(false); }
    setSaving(false);
  }
  function startRename(w: Workspace) { setRenamingId(w.id); setRenameValue(w.name); setCreating(false); }
  async function handleRename(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    setRenameSaving(true);
    await renameWorkspace(id, renameValue.trim());
    setRenameSaving(false); setRenamingId(null);
  }

  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen(v => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(99,120,255,0.08)", border: "1px solid rgba(99,120,255,0.20)", cursor: "pointer", color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: 700 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(99,120,255,0.9)", flexShrink: 0, boxShadow: "0 0 8px rgba(99,120,255,0.6)" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeWorkspace?.name ?? "Aucun workspace"}</span>
        </div>
        <span style={{ opacity: 0.5, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && mounted && createPortal(
        <div ref={dropRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, borderRadius: 14, padding: 10, background: "linear-gradient(180deg, rgba(18,20,28,0.99), rgba(10,11,16,0.99))", border: "1px solid rgba(99,120,255,0.18)", boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,120,255,0.08) inset", backdropFilter: "blur(20px)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, opacity: 0.4, color: "rgba(255,255,255,0.9)", padding: "4px 8px 8px", textTransform: "uppercase" }}>Mes boutiques</div>
          {workspaces.length === 0 && !creating && (
            <div style={{ padding: "8px 10px", opacity: 0.5, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>Aucun workspace</div>
          )}
          {workspaces.map(w => (
            <div key={w.id}>
              {renamingId === w.id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 2px" }}>
                  <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleRename(w.id); if (e.key === "Escape") setRenamingId(null); }}
                    style={{ flex: 1, height: 32, borderRadius: 8, padding: "0 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(99,120,255,0.35)", color: "rgba(255,255,255,0.92)", fontSize: 13, outline: "none" }} />
                  <button type="button" onClick={() => handleRename(w.id)} disabled={renameSaving}
                    style={{ height: 32, padding: "0 10px", borderRadius: 8, border: "none", background: "rgba(99,120,255,0.25)", color: "rgba(255,255,255,0.95)", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: renameSaving ? 0.5 : 1 }}>
                    {renameSaving ? "…" : "✓"}
                  </button>
                  <button type="button" onClick={() => setRenamingId(null)}
                    style={{ height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button type="button" onClick={() => { setActiveWorkspace(w); setOpen(false); }}
                    style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 9, border: "none", background: w.id === activeWorkspace?.id ? "rgba(99,120,255,0.14)" : "transparent", color: "rgba(255,255,255,0.88)", cursor: "pointer", fontSize: 13, fontWeight: w.id === activeWorkspace?.id ? 800 : 500, textAlign: "left" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: w.id === activeWorkspace?.id ? "rgba(99,120,255,0.9)" : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
                    {w.id === activeWorkspace?.id && <span style={{ fontSize: 11, color: "rgba(99,120,255,0.9)" }}>✓</span>}
                  </button>
                  <button type="button" onClick={e => { e.stopPropagation(); startRename(w); }} title="Renommer"
                    style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(99,120,255,0.15)", background: "rgba(99,120,255,0.05)", color: "rgba(99,120,255,0.6)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,120,255,0.14)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(120,150,255,0.95)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,120,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(99,120,255,0.6)"; }}>✏️</button>
                  <button type="button" onClick={e => { e.stopPropagation(); setDeleteTarget(w); setOpen(false); }} title="Supprimer"
                    style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,80,80,0.15)", background: "rgba(255,80,80,0.05)", color: "rgba(255,100,80,0.7)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,80,80,0.14)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,120,100,0.95)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,80,80,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,100,80,0.7)"; }}>🗑</button>
                </div>
              )}
            </div>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
          {creating ? (
            <div style={{ padding: "6px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
              <input autoFocus placeholder="Nom de la boutique…" value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
                style={{ width: "100%", height: 36, borderRadius: 9, padding: "0 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(99,120,255,0.30)", color: "rgba(255,255,255,0.92)", fontSize: 13, outline: "none" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => { setCreating(false); setNewName(""); }}
                  style={{ flex: 1, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer" }}>Annuler</button>
                <button type="button" onClick={handleCreate} disabled={saving || !newName.trim()}
                  style={{ flex: 1, height: 32, borderRadius: 8, border: "none", background: "rgba(99,120,255,0.25)", color: "rgba(255,255,255,0.95)", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: !newName.trim() ? 0.5 : 1 }}>
                  {saving ? "…" : "Créer"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setCreating(true); setRenamingId(null); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 9, border: "1px dashed rgba(99,120,255,0.25)", background: "transparent", color: "rgba(99,120,255,0.8)", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              <span style={{ fontSize: 16 }}>＋</span> Nouvelle boutique
            </button>
          )}
        </div>,
        document.body
      )}
      {deleteTarget && mounted && (
        <DeleteWorkspaceModal target={deleteTarget} workspaces={workspaces} onClose={() => setDeleteTarget(null)} onDeleted={() => setDeleteTarget(null)} />
      )}
    </>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  useEffect(() => {
    setIsTransitioning(true);
    const t = setTimeout(() => { setDisplayChildren(children); setIsTransitioning(false); }, 180);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #0a0a0f; --sidebar-bg: #0c0c14; --sidebar-border: rgba(99,120,255,0.08);
          --surface: #13131f; --surface-2: #1a1a2e; --accent: #6378ff; --accent-mid: #4f63e8;
          --accent-dim: rgba(99,120,255,0.10); --accent-glow: rgba(99,120,255,0.22);
          --accent-glow-strong: rgba(99,120,255,0.35); --text-primary: #eeeef5;
          --text-secondary: rgba(238,238,245,0.45); --text-tertiary: rgba(238,238,245,0.22);
          --sidebar-w: 220px; --topbar-h: 56px;
          --font: 'DM Sans', sans-serif; --font-mono: 'DM Mono', monospace;
        }
        html, body { height: 100%; background: var(--bg); font-family: var(--font); color: var(--text-primary); }
        .ds-root { display: flex; height: 100vh; overflow: hidden; background: var(--bg); }
        .ds-sidebar { width: var(--sidebar-w); min-width: var(--sidebar-w); background: var(--sidebar-bg); border-right: 1px solid var(--sidebar-border); display: flex; flex-direction: column; position: relative; z-index: 10; }
        .ds-sidebar::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 120px; background: radial-gradient(ellipse at 50% 0%, rgba(99,120,255,0.08) 0%, transparent 70%); pointer-events: none; }
        .ds-brand { display: flex; align-items: center; gap: 12px; padding: 28px 20px 20px; border-bottom: 1px solid var(--sidebar-border); }
        .ds-logo { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-mid) 100%); flex-shrink: 0; box-shadow: 0 0 18px var(--accent-glow-strong); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: #fff; font-family: var(--font-mono); letter-spacing: 0.5px; }
        .ds-brand-title { font-size: 11px; font-weight: 600; letter-spacing: 2px; color: var(--text-primary); font-family: var(--font-mono); }
        .ds-brand-sub { font-size: 11px; color: var(--text-tertiary); margin-top: 3px; font-weight: 300; }
        .ds-workspace-wrap { padding: 14px 14px 12px; border-bottom: 1px solid var(--sidebar-border); }
        .ds-workspace-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; opacity: 0.35; color: rgba(255,255,255,0.9); margin-bottom: 7px; text-transform: uppercase; font-family: var(--font-mono); }
        .ds-nav { display: flex; flex-direction: column; gap: 4px; padding: 16px 14px; flex: 1; }
        .ds-nav-item { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border-radius: 9px; text-decoration: none; color: var(--text-secondary); font-size: 13.5px; font-weight: 400; position: relative; transition: all 0.2s ease; cursor: pointer; overflow: hidden; }
        .ds-nav-item:hover { color: var(--text-primary); background: rgba(99,120,255,0.06); }
        .ds-nav-item.active { color: #a5b4ff; background: var(--accent-dim); font-weight: 500; }
        .ds-nav-icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }
        .ds-nav-item.active .ds-nav-icon { filter: drop-shadow(0 0 6px rgba(99,120,255,0.6)); }
        .ds-nav-active-bar { position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 55%; border-radius: 2px 0 0 2px; background: var(--accent); box-shadow: 0 0 10px var(--accent-glow-strong); }
        .ds-sidebar-footer { padding: 20px 14px; border-top: 1px solid var(--sidebar-border); }
        .ds-version { font-size: 10px; color: var(--text-tertiary); font-family: var(--font-mono); text-align: center; letter-spacing: 1px; }
        .ds-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }
        .ds-topbar { height: var(--topbar-h); display: flex; align-items: center; justify-content: flex-end; padding: 0 28px; border-bottom: 1px solid var(--sidebar-border); flex-shrink: 0; }
        .ds-profile { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-mid) 100%); border: none; cursor: pointer; font-size: 13px; font-weight: 600; color: #fff; font-family: var(--font-mono); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px var(--accent-glow); transition: box-shadow 0.2s, transform 0.2s; }
        .ds-profile:hover { box-shadow: 0 0 22px var(--accent-glow-strong); transform: scale(1.05); }
        .ds-content { flex: 1; overflow-y: auto; padding: 32px 36px; scrollbar-width: thin; scrollbar-color: var(--surface-2) transparent; }
        .ds-content::-webkit-scrollbar { width: 5px; }
        .ds-content::-webkit-scrollbar-thumb { background: var(--surface-2); border-radius: 10px; }
        .ds-page-wrapper { transition: opacity 0.18s ease, transform 0.18s ease; }
        .ds-page-wrapper.entering { opacity: 0; transform: translateY(7px); }
        .ds-page-wrapper.visible { opacity: 1; transform: translateY(0); }
        .ds-page { display: flex; flex-direction: column; gap: 20px; }
        .ds-topline { font-size: 12px; color: var(--text-tertiary); font-family: var(--font-mono); letter-spacing: 0.5px; }
        .ds-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .ds-title { font-size: clamp(28px, 4vw, 40px); font-weight: 900; letter-spacing: -1px; color: var(--text-primary); line-height: 1.1; }
        .ds-subtitle { font-size: 14px; color: var(--text-secondary); margin-top: 6px; font-weight: 300; }
        .ds-right-tools { display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding-top: 6px; }
        .ds-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
        .ds-stat-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 18px 20px; transition: border-color 0.2s; }
        .ds-stat-card:hover { border-color: rgba(99,120,255,0.20); }
        .ds-stat-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; margin-bottom: 8px; letter-spacing: 0.3px; }
        .ds-stat-value { font-size: 24px; font-weight: 900; color: var(--text-primary); letter-spacing: -0.5px; }
        .ds-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 20px 22px; }
        .ds-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
        .ds-card-title { font-size: 15px; font-weight: 800; color: var(--text-primary); }
        .ds-card-sub { font-size: 12px; color: var(--text-secondary); margin-top: 3px; }
        .ds-table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); }
        .ds-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .ds-table thead tr { border-bottom: 1px solid rgba(255,255,255,0.07); }
        .ds-table th { padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-secondary); letter-spacing: 0.8px; text-transform: uppercase; white-space: nowrap; }
        .ds-table td { padding: 12px 14px; color: var(--text-primary); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .ds-table tbody tr:last-child td { border-bottom: none; }
        .ds-table tbody tr:hover td { background: rgba(255,255,255,0.02); }
        .ds-right { text-align: right !important; }
        .ds-mono { font-family: var(--font-mono); font-size: 12px !important; }
        .ds-btn { height: 36px; padding: 0 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.04); color: var(--text-primary); font-size: 13px; font-weight: 600; cursor: pointer; transition: background 120ms, border-color 120ms; white-space: nowrap; font-family: var(--font); }
        .ds-btn:hover:not(:disabled) { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.18); }
        .ds-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ds-btn-ghost { background: rgba(255,255,255,0.02); }
        .ds-btn-primary { background: rgba(99,120,255,0.15); border-color: rgba(99,120,255,0.35); color: #a5b4ff; }
        .ds-btn-primary:hover:not(:disabled) { background: rgba(99,120,255,0.22); border-color: rgba(99,120,255,0.50); }
        @media (max-width: 768px) {
          .ds-sidebar { width: 60px; min-width: 60px; }
          .ds-brand-title, .ds-brand-sub, .ds-nav-label, .ds-workspace-wrap { display: none; }
          .ds-brand { justify-content: center; padding: 20px 12px; }
          .ds-nav { padding: 20px 6px; gap: 8px; }
          .ds-nav-item { justify-content: center; padding: 10px; }
          .ds-nav-icon { width: auto; font-size: 17px; }
          .ds-nav-active-bar { display: none; }
          .ds-content { padding: 20px 16px; }
        }
      `}</style>
      <div className="ds-root">
        <aside className="ds-sidebar">
          <div className="ds-brand">
            <div className="ds-logo">CF</div>
            <div>
              <div className="ds-brand-title">CLIENTFLOW</div>
              <div className="ds-brand-sub">Multi-boutiques</div>
            </div>
          </div>
          <div className="ds-workspace-wrap">
            <div className="ds-workspace-label">Workspace</div>
            <WorkspacePicker />
          </div>
          <nav className="ds-nav">
            <NavItem href="/dashboard/import"     label="Import"      icon="📥" />
            <NavItem href="/dashboard/clients"    label="Clients"     icon="👤" />
            <NavItem href="/dashboard/produits"   label="Produits"    icon="🛍️" />
            <NavItem href="/dashboard/relances"   label="Relances"    icon="🔔" />
            <NavItem href="/dashboard/analytiques" label="Analytiques" icon="📊" />
          </nav>
          <div className="ds-sidebar-footer">
            <div className="ds-version">v1.0 · BETA</div>
          </div>
        </aside>
        <div className="ds-main">
          <div className="ds-topbar">
            <button className="ds-profile" type="button" aria-label="Profil">E</button>
          </div>
          <main className="ds-content">
            <div className={`ds-page-wrapper ${isTransitioning ? "entering" : "visible"}`}>
              {displayChildren}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}