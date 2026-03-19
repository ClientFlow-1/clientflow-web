"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkspace, Workspace } from "@/lib/workspaceContext";
import { useRole } from "@/lib/useRole";
import { supabase } from "@/lib/supabaseClient";

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

function BottomNavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link href={href} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: "8px 4px", textDecoration: "none", color: active ? "rgba(165,180,255,0.95)" : "rgba(255,255,255,0.35)", transition: "color 150ms", position: "relative" }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.3, fontFamily: "DM Sans, sans-serif" }}>{label}</span>
      {active && <span style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 24, height: 2.5, borderRadius: 2, background: "rgba(99,120,255,0.9)", boxShadow: "0 0 8px rgba(99,120,255,0.6)" }} />}
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
        {step === "confirm" && (<>
          <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 8 }}>🗑️ Supprimer "{target.name}" ?</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24, lineHeight: 1.6 }}>Cette boutique sera supprimée. Vous pourrez choisir de transférer ou supprimer toutes les données associées.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
            <button type="button" onClick={() => setStep("choice")} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: "rgba(255,80,80,0.18)", color: "rgba(255,120,100,0.95)", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Continuer →</button>
          </div>
        </>)}
        {step === "choice" && (<>
          <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 6 }}>Que faire des données ?</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>Clients et ventes de "{target.name}"</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <label onClick={() => setChoice("transfer")} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 14, border: `1px solid ${choice === "transfer" ? "rgba(120,160,255,0.45)" : "rgba(255,255,255,0.08)"}`, background: choice === "transfer" ? "rgba(120,160,255,0.08)" : "rgba(255,255,255,0.02)", cursor: "pointer" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${choice === "transfer" ? "rgba(120,160,255,0.9)" : "rgba(255,255,255,0.25)"}`, background: choice === "transfer" ? "rgba(120,160,255,0.9)" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {choice === "transfer" && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <div><div style={{ fontWeight: 800, fontSize: 14, color: "rgba(255,255,255,0.92)", marginBottom: 3 }}>↗️ Transférer vers une autre boutique</div><div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Les clients et ventes seront déplacés.</div></div>
            </label>
            <label onClick={() => setChoice("delete")} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 14, border: `1px solid ${choice === "delete" ? "rgba(255,80,80,0.40)" : "rgba(255,255,255,0.08)"}`, background: choice === "delete" ? "rgba(255,80,80,0.08)" : "rgba(255,255,255,0.02)", cursor: "pointer" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${choice === "delete" ? "rgba(255,100,80,0.9)" : "rgba(255,255,255,0.25)"}`, background: choice === "delete" ? "rgba(255,100,80,0.9)" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {choice === "delete" && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <div><div style={{ fontWeight: 800, fontSize: 14, color: "rgba(255,120,100,0.95)", marginBottom: 3 }}>🗑️ Supprimer toutes les données</div><div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Action irréversible.</div></div>
            </label>
          </div>
          {choice === "transfer" && (
            <div style={{ marginBottom: 20 }}>
              {others.length > 0 ? (<>
                <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Transférer vers :</div>
                <CustomSelect options={others.map(w => ({ value: w.id, label: w.name }))} value={transferTo} onChange={setTransferTo} />
              </>) : (
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,180,60,0.08)", border: "1px solid rgba(255,180,60,0.20)", fontSize: 13, color: "rgba(255,200,80,0.9)", fontWeight: 700 }}>⚠️ Aucune autre boutique disponible.</div>
              )}
            </div>
          )}
          {error && <div style={{ fontSize: 13, color: "rgba(255,120,100,0.95)", fontWeight: 700, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setStep("confirm")} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Retour</button>
            <button type="button" disabled={!choice || saving} onClick={() => { if (choice === "transfer" && others.length === 0) { setStep("create"); return; } handleDelete(); }}
              style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: choice === "delete" ? "rgba(255,80,80,0.18)" : "rgba(120,160,255,0.18)", color: choice === "delete" ? "rgba(255,120,100,0.95)" : "rgba(120,160,255,0.95)", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: !choice || saving ? 0.4 : 1 }}>
              {saving ? "En cours…" : choice === "delete" ? "Supprimer définitivement" : "Transférer et supprimer"}
            </button>
          </div>
        </>)}
        {step === "create" && (<>
          <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 6 }}>Créer une boutique de destination</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>Les données de "{target.name}" seront transférées ici.</div>
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
        </>)}
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
    const dropW = Math.max(r.width, 260);
    const left = Math.min(r.left, window.innerWidth - dropW - 12);
    setPos({ top: r.bottom + 6, left: Math.max(12, left), width: dropW });
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

  const triggerBtn = (compact?: boolean) => (
    <button ref={btnRef} type="button" onClick={() => setOpen(v => !v)}
      style={compact ? {
        display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px",
        borderRadius: 10, background: "rgba(99,120,255,0.10)", border: "1px solid rgba(99,120,255,0.25)",
        cursor: "pointer", color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: 700, maxWidth: 180,
      } : {
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(99,120,255,0.08)",
        border: "1px solid rgba(99,120,255,0.20)", cursor: "pointer", color: "rgba(255,255,255,0.92)",
        fontSize: 13, fontWeight: 700,
      }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(99,120,255,0.9)", flexShrink: 0, boxShadow: "0 0 8px rgba(99,120,255,0.6)" }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {activeWorkspace?.name ?? "Boutique"}
      </span>
      <span style={{ opacity: 0.5, fontSize: 10, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
    </button>
  );

  const dropdown = open && mounted && createPortal(
    <div ref={dropRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 99999, borderRadius: 14, padding: 10, background: "linear-gradient(180deg, rgba(18,20,28,0.99), rgba(10,11,16,0.99))", border: "1px solid rgba(99,120,255,0.18)", boxShadow: "0 20px 60px rgba(0,0,0,0.7)", backdropFilter: "blur(20px)" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, opacity: 0.4, color: "rgba(255,255,255,0.9)", padding: "4px 8px 8px", textTransform: "uppercase" }}>Mes boutiques</div>
      {workspaces.length === 0 && !creating && <div style={{ padding: "8px 10px", opacity: 0.5, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>Aucun workspace</div>}
      {workspaces.map(w => (
        <div key={w.id}>
          {renamingId === w.id ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 2px" }}>
              <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleRename(w.id); if (e.key === "Escape") setRenamingId(null); }}
                style={{ flex: 1, height: 32, borderRadius: 8, padding: "0 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(99,120,255,0.35)", color: "rgba(255,255,255,0.92)", fontSize: 13, outline: "none" }} />
              <button type="button" onClick={() => handleRename(w.id)} disabled={renameSaving} style={{ height: 32, padding: "0 10px", borderRadius: 8, border: "none", background: "rgba(99,120,255,0.25)", color: "rgba(255,255,255,0.95)", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: renameSaving ? 0.5 : 1 }}>{renameSaving ? "…" : "✓"}</button>
              <button type="button" onClick={() => setRenamingId(null)} style={{ height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>✕</button>
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
                style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(99,120,255,0.15)", background: "rgba(99,120,255,0.05)", color: "rgba(99,120,255,0.6)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✏️</button>
              <button type="button" onClick={e => { e.stopPropagation(); setDeleteTarget(w); setOpen(false); }} title="Supprimer"
                style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,80,80,0.15)", background: "rgba(255,80,80,0.05)", color: "rgba(255,100,80,0.7)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🗑</button>
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
            <button type="button" onClick={() => { setCreating(false); setNewName(""); }} style={{ flex: 1, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer" }}>Annuler</button>
            <button type="button" onClick={handleCreate} disabled={saving || !newName.trim()} style={{ flex: 1, height: 32, borderRadius: 8, border: "none", background: "rgba(99,120,255,0.25)", color: "rgba(255,255,255,0.95)", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: !newName.trim() ? 0.5 : 1 }}>{saving ? "…" : "Créer"}</button>
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
  );

  return (
    <>
      <span className="ds-workspace-desktop">{triggerBtn(false)}</span>
      <span className="ds-workspace-mobile">{triggerBtn(true)}</span>
      {dropdown}
      {deleteTarget && mounted && (
        <DeleteWorkspaceModal target={deleteTarget} workspaces={workspaces} onClose={() => setDeleteTarget(null)} onDeleted={() => setDeleteTarget(null)} />
      )}
    </>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, { color: string; bg: string; border: string; label: string }> = {
    owner:   { color: "#f5c842", bg: "rgba(245,200,66,0.10)",  border: "rgba(245,200,66,0.30)",  label: "Owner"   },
    admin:   { color: "#6378ff", bg: "rgba(99,120,255,0.10)",  border: "rgba(99,120,255,0.30)",  label: "Admin"   },
    vendeur: { color: "#4ecdc4", bg: "rgba(78,205,196,0.10)",  border: "rgba(78,205,196,0.30)",  label: "Vendeur" },
  };
  const s = styles[role] ?? { color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", label: role };
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: s.bg, border: `1px solid ${s.border}`, color: s.color, letterSpacing: 0.5 }}>
      {s.label}
    </span>
  );
}

function ProfileMenu({ role }: { role: string | null }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => { if (data?.user?.email) setUserEmail(data.user.email); });
  }, []);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { const t = e.target as Node; if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return; setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initial = (userEmail?.[0] ?? "?").toUpperCase();

  return (
    <>
      <button ref={btnRef} className="ds-profile" type="button" onClick={() => setOpen(v => !v)} aria-label="Profil">
        {initial}
      </button>
      {open && mounted && createPortal(
        <div ref={dropRef} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 99999, width: 240, borderRadius: 14, padding: 12, background: "linear-gradient(180deg, rgba(18,20,28,0.99), rgba(10,11,16,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 20px 60px rgba(0,0,0,0.7)", backdropFilter: "blur(20px)" }}>
          <div style={{ padding: "8px 10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #6378ff, #4f63e8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {initial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.90)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail || "—"}</div>
                {role && <div style={{ marginTop: 3 }}><RoleBadge role={role} /></div>}
              </div>
            </div>
          </div>
          <button type="button" onClick={handleSignOut}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "none", background: "transparent", color: "rgba(255,120,120,0.85)", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,80,80,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
            <span style={{ fontSize: 16 }}>🚪</span> Se déconnecter
          </button>
        </div>,
        document.body
      )}
    </>
  );
}


/* ─────────── Toast system ─────────── */
type ToastData = {
  id: string;
  type: "stock" | "relance" | "inactif" | "suggestion";
  title: string;
  message: string;
};

function ToastCard({ t, onDismiss }: { t: ToastData; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  function close() {
    setExiting(true);
    setTimeout(() => onDismiss(t.id), 340);
  }

  useEffect(() => {
    const timer = setTimeout(close, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`ds-toast${exiting ? " ds-toast-exit" : ""}`}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 12px 11px 14px" }}>
        <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
          {NOTIF_ICON[t.type] ?? "🔔"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.95)", marginBottom: 3, lineHeight: 1.3 }}>
            {t.title}
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.48)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {t.message}
          </div>
        </div>
        <button type="button" onClick={close} style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.38)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, fontFamily: "inherit", marginTop: 1 }}>✕</button>
      </div>
      <div className="ds-toast-bar" />
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || toasts.length === 0) return null;
  return createPortal(
    <div style={{ position: "fixed", top: 80, right: 20, bottom: "auto", zIndex: 99997, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none", maxWidth: 360 }}>
      {toasts.map(t => <ToastCard key={t.id} t={t} onDismiss={onDismiss} />)}
    </div>,
    document.body
  );
}

/* ─────────── NotificationBell ─────────── */
type DBNotification = {
  id: string;
  workspace_id: string;
  type: "stock" | "relance" | "inactif" | "suggestion";
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

const NOTIF_ICON: Record<string, string> = {
  stock: "📦",
  relance: "👥",
  inactif: "💤",
  suggestion: "✨",
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

function getNotifAction(n: DBNotification): string | null {
  if (n.type === "stock") {
    const match = n.title.match(/:\s*(.+)$/);
    const produit = match ? match[1].trim() : n.title;
    return `/dashboard/inventaire?produit=${encodeURIComponent(produit)}&openStock=true`;
  }
  if (n.type === "relance" || n.type === "inactif") {
    const seg = n.type === "inactif" ? "180"
      : n.title.includes("30 j") ? "30"
      : n.title.includes("60 j") ? "60"
      : n.title.includes("90 j") ? "90"
      : null;
    if (!seg) return null;
    const names = n.message.split(",").map(s => s.trim()).filter(Boolean);
    const clientsParam = names.length > 0 ? `&clients=${encodeURIComponent(names.join(","))}` : "";
    return `/dashboard/relances?segment=${seg}&openComposer=true${clientsParam}`;
  }
  return null;
}

function NotificationBell() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<DBNotification[]>([]);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const lastTimestamp = useRef<string | null>(null);
  const isFirstFetch = useRef(true);

  useEffect(() => { setMounted(true); }, []);

  const unread = notifs.filter(n => !n.read).length;

  const fetchNotifs = useRef(async (wsId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!data) return;
    setNotifs(data as DBNotification[]);
    // Détecter les nouvelles notifs (skip au premier fetch pour ne pas inonder)
    if (!isFirstFetch.current && lastTimestamp.current) {
      const newOnes = (data as DBNotification[]).filter(n => n.created_at > lastTimestamp.current!);
      if (newOnes.length > 0) {
        setToasts(prev => {
          const slots = 3 - prev.length;
          if (slots <= 0) return prev;
          const toAdd = newOnes.slice(0, slots).map(n => ({ id: n.id, type: n.type, title: n.title, message: n.message }));
          return [...prev, ...toAdd];
        });
      }
    }
    if (data.length > 0) lastTimestamp.current = data[0].created_at;
    isFirstFetch.current = false;
  });

  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  useEffect(() => {
    if (!activeWorkspace) return;
    fetchNotifs.current(activeWorkspace.id);
    const iv = setInterval(() => fetchNotifs.current(activeWorkspace.id), 60_000);
    return () => clearInterval(iv);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function markAllRead() {
    if (!activeWorkspace) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("workspace_id", activeWorkspace.id)
      .eq("read", false);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function markOneRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  return (
    <>
      <button
        ref={btnRef}
        className="ds-notif-btn"
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="ds-notif-badge">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>

      {open && mounted && createPortal(
        <div ref={dropRef} style={{
          position: "fixed", top: pos.top, right: pos.right, zIndex: 99999,
          width: 360, maxWidth: "calc(100vw - 24px)", borderRadius: 16,
          background: "linear-gradient(180deg, rgba(18,20,28,0.99), rgba(10,11,16,0.99))",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.75)", backdropFilter: "blur(20px)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>🔔</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>Notifications</span>
              {unread > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "rgba(255,60,60,0.14)", border: "1px solid rgba(255,60,60,0.28)", color: "rgba(255,130,110,0.95)" }}>
                  {unread} non lue{unread > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} style={{ fontSize: 11, fontWeight: 700, color: "rgba(99,120,255,0.85)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6, fontFamily: "inherit", transition: "color 150ms" }}
                onMouseEnter={e => { e.currentTarget.style.color = "rgba(99,120,255,1)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(99,120,255,0.85)"; }}>
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div style={{ maxHeight: 420, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
            {notifs.length === 0 ? (
              <div style={{ padding: "36px 16px", textAlign: "center", color: "rgba(255,255,255,0.28)", fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🔕</div>
                Aucune notification
              </div>
            ) : notifs.map(n => (
              <div key={n.id} style={{
                display: "flex", gap: 12, padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: n.read ? "transparent" : "rgba(99,120,255,0.04)",
              }}>
                <div style={{ fontSize: 19, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
                  {NOTIF_ICON[n.type] ?? "🔔"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 600 : 800, color: n.read ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.95)", marginBottom: 3, lineHeight: 1.35 }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", lineHeight: 1.55 }}>
                    {n.message}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.22)", fontFamily: "DM Mono, monospace" }}>
                        {relativeTime(n.created_at)}
                      </div>
                      {!n.read && (
                        <button type="button" onClick={async () => { await markOneRead(n.id); }}
                          style={{ fontSize: 10.5, color: "rgba(255,255,255,0.28)", background: "none", border: "none", cursor: "pointer", padding: "0 4px", fontFamily: "inherit", transition: "color 150ms" }}
                          onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
                          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.28)"; }}>
                          Marquer comme lu
                        </button>
                      )}
                    </div>
                    {getNotifAction(n) && (
                      <button
                        type="button"
                        onClick={async () => { setOpen(false); await markOneRead(n.id); window.location.href = getNotifAction(n)!; }}
                        style={{ fontSize: 11, fontWeight: 700, color: "rgba(99,120,255,0.80)", background: "none", border: "1px solid rgba(99,120,255,0.20)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "border-color 150ms, color 150ms" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "rgba(99,120,255,1)"; e.currentTarget.style.borderColor = "rgba(99,120,255,0.45)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "rgba(99,120,255,0.80)"; e.currentTarget.style.borderColor = "rgba(99,120,255,0.20)"; }}
                      >
                        {n.type === "stock" ? "Réapprovisionner →" : "Relancer →"}
                      </button>
                    )}
                  </div>
                </div>
                {!n.read && (
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(99,120,255,0.9)", flexShrink: 0, marginTop: 4, boxShadow: "0 0 6px rgba(99,120,255,0.6)" }} />
                )}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

// ── Nav items ── //
// 📦 Inventaire ajouté entre Produits et Relances
const ALL_NAV_ITEMS = [
  { href: "/dashboard/import",      label: "Import",      icon: "📥", showFor: ["owner"] },
  { href: "/dashboard/clients",     label: "Clients",     icon: "👤", showFor: ["owner", "admin", "vendeur"] },
  { href: "/dashboard/produits",    label: "Produits",    icon: "🛍️", showFor: ["owner", "admin", "vendeur"] },
  { href: "/dashboard/inventaire",  label: "Inventaire",  icon: "📦", showFor: ["owner", "admin", "vendeur"] },
  { href: "/dashboard/relances",    label: "Relances",    icon: "🔔", showFor: ["owner", "admin"] },
  { href: "/dashboard/analytiques", label: "Analytiques", icon: "📊", showFor: ["owner"] },
  { href: "/dashboard/parametres",  label: "Paramètres",  icon: "⚙️", showFor: ["owner", "admin"] },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, loading: roleLoading, isBlocked: shopClosed } = useRole();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setIsTransitioning(true);
    const t = setTimeout(() => { setDisplayChildren(children); setIsTransitioning(false); }, 180);
    return () => clearTimeout(t);
  }, [pathname]);

  const navItems = roleLoading
    ? []
    : ALL_NAV_ITEMS.filter(i => role && i.showFor.includes(role));

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
          --sidebar-w: 220px; --topbar-h: 56px; --bottom-nav-h: 64px;
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
        .ds-workspace-desktop { display: block; }
        .ds-workspace-mobile { display: none; }
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
        .ds-topbar { height: var(--topbar-h); display: flex; align-items: center; justify-content: space-between; padding: 0 16px 0 28px; border-bottom: 1px solid var(--sidebar-border); flex-shrink: 0; gap: 10px; }
        .ds-topbar-title { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.5); font-family: var(--font-mono); letter-spacing: 1px; display: none; }
        .ds-profile { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-mid) 100%); border: none; cursor: pointer; font-size: 13px; font-weight: 600; color: #fff; font-family: var(--font-mono); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px var(--accent-glow); transition: box-shadow 0.2s, transform 0.2s; flex-shrink: 0; }
        .ds-profile:hover { box-shadow: 0 0 22px var(--accent-glow-strong); transform: scale(1.05); }
        .ds-content { flex: 1; overflow-y: auto; padding: 32px 36px; scrollbar-width: thin; scrollbar-color: var(--surface-2) transparent; }
        .ds-content::-webkit-scrollbar { width: 5px; }
        .ds-content::-webkit-scrollbar-thumb { background: var(--surface-2); border-radius: 10px; }
        .ds-page-wrapper { transition: opacity 0.18s ease, transform 0.18s ease; }
        .ds-page-wrapper.entering { opacity: 0; transform: translateY(7px); }
        .ds-page-wrapper.visible { opacity: 1; }
        .ds-page { display: flex; flex-direction: column; gap: 20px; }
        .ds-topline { font-size: 12px; color: var(--text-tertiary); font-family: var(--font-mono); letter-spacing: 0.5px; }
        .ds-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .ds-title { font-size: clamp(22px, 4vw, 40px); font-weight: 900; letter-spacing: -1px; color: var(--text-primary); line-height: 1.1; }
        .ds-subtitle { font-size: 14px; color: var(--text-secondary); margin-top: 6px; font-weight: 300; }
        .ds-right-tools { display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding-top: 6px; }
        .ds-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
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
        .ds-notif-btn { position: relative; width: 32px; height: 32px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.70); font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 150ms, border-color 150ms, color 150ms; }
        .ds-notif-btn:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.90); }
        .ds-notif-badge { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; border-radius: 999px; background: rgba(235,60,60,0.92); border: 1.5px solid var(--bg); color: #fff; font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0 3px; line-height: 1; font-family: var(--font-mono); pointer-events: none; }
        @keyframes dsToastIn  { from { transform:translateX(calc(100% + 24px)); opacity:0; } to { transform:translateX(0); opacity:1; } }
        @keyframes dsToastOut { from { transform:translateX(0); opacity:1; } to { transform:translateX(calc(100% + 24px)); opacity:0; } }
        @keyframes dsToastProg { from { transform:scaleX(1); } to { transform:scaleX(0); } }
        .ds-toast { min-width:300px; max-width:360px; border-radius:14px; overflow:hidden; background:linear-gradient(180deg,rgba(20,22,32,0.99),rgba(12,12,20,0.99)); border:1px solid rgba(255,255,255,0.10); box-shadow:0 16px 48px rgba(0,0,0,0.70),0 0 0 1px rgba(99,120,255,0.08); animation:dsToastIn 0.35s cubic-bezier(0.4,0,0.2,1) forwards; pointer-events:auto; }
        .ds-toast-exit { animation:dsToastOut 0.35s cubic-bezier(0.4,0,0.2,1) forwards; }
        .ds-toast-bar { height:2px; background:linear-gradient(90deg,rgba(99,120,255,0.90),rgba(160,120,255,0.70)); transform-origin:left; animation:dsToastProg 5s linear forwards; }
        .ds-bottom-nav { display: none; }
        @media (max-width: 768px) {
          .ds-sidebar { display: none; }
          .ds-topbar-title { display: block; }
          .ds-workspace-desktop { display: none; }
          .ds-workspace-mobile { display: flex; align-items: center; flex: 1; min-width: 0; }
          .ds-workspace-mobile button { max-width: 100%; }
          .ds-content { padding: 16px 14px 80px; }
          .ds-bottom-nav {
            display: flex; position: fixed; bottom: 0; left: 0; right: 0;
            height: var(--bottom-nav-h); background: rgba(12,12,20,0.97);
            border-top: 1px solid rgba(99,120,255,0.12); backdrop-filter: blur(20px);
            z-index: 1000; padding-bottom: env(safe-area-inset-bottom);
          }
          .ds-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .ds-title { font-size: 22px; }
          .ds-card { padding: 14px 14px; }
          .ds-right-tools { gap: 6px; }
          .ds-btn { height: 32px; padding: 0 12px; font-size: 12px; }
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
            {navItems.map(item => <NavItem key={item.href} {...item} />)}
          </nav>
          <div className="ds-sidebar-footer">
            {role && <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><RoleBadge role={role} /></div>}
            <div className="ds-version">v1.0 · BETA</div>
          </div>
        </aside>

        <div className="ds-main">
          <div className="ds-topbar">
            <div className="ds-topbar-title">CLIENTFLOW</div>
            <WorkspacePicker />
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: "auto" }}>
              <NotificationBell />
              <ProfileMenu role={role} />
            </div>
          </div>
          <main className="ds-content">
            <div className={`ds-page-wrapper ${isTransitioning ? "entering" : "visible"}`}>
              {displayChildren}
            </div>
          </main>
        </div>

        <nav className="ds-bottom-nav">
          {navItems.map(item => <BottomNavItem key={item.href} {...item} />)}
        </nav>
      </div>

      {/* ── Overlay boutique fermée (vendeurs uniquement) ── */}
      {shopClosed && mounted && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 999999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(6,6,12,0.82)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          padding: 24,
          pointerEvents: "all",
        }}>
          {/* Bouton déconnexion haut droite */}
          <button
            type="button"
            onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
            style={{
              position: "absolute", top: 20, right: 20,
              display: "flex", alignItems: "center", gap: 6,
              height: 32, padding: "0 14px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.35)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "color 150ms, background 150ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,120,120,0.85)"; e.currentTarget.style.background = "rgba(255,80,80,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          >
            🚪 Se déconnecter
          </button>

          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
            maxWidth: 420, width: "100%",
            borderRadius: 24, padding: "48px 40px",
            background: "linear-gradient(180deg, rgba(18,18,30,0.95), rgba(10,10,18,0.98))",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 40px 120px rgba(0,0,0,0.8)",
          }}>
            {/* Icône cadenas */}
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(255,80,80,0.10)",
              border: "1px solid rgba(255,80,80,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32,
              boxShadow: "0 0 40px rgba(255,60,60,0.15)",
            }}>🔒</div>

            {/* Texte */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 10, letterSpacing: "-0.5px" }}>
                Boutique fermée
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, fontWeight: 400 }}>
                Le propriétaire a temporairement désactivé l'accès.<br />Revenez plus tard.
              </div>
            </div>

            {/* Badge rôle */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              height: 34, padding: "0 16px", borderRadius: 999,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)",
            }}>
              Connecté en tant que <span style={{ color: "rgba(78,205,196,0.85)", marginLeft: 4 }}>Vendeur</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}