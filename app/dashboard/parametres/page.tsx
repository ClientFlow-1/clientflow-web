"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/lib/workspaceContext";
import { useRole } from "@/lib/useRole";

type Member = {
  id: string;
  user_id: string | null;
  role: "owner" | "admin" | "vendeur";
  status: "active" | "pending";
  invited_email: string | null;
  created_at: string;
  email?: string;
};

type Invitation = {
  id: string;
  invited_email: string;
  role: "owner" | "admin" | "vendeur";
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

const ROLE_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  owner:   { label: "Owner",   color: "#f5c842", bg: "rgba(245,200,66,0.10)",  border: "rgba(245,200,66,0.30)"  },
  admin:   { label: "Admin",   color: "#6378ff", bg: "rgba(99,120,255,0.10)",  border: "rgba(99,120,255,0.30)"  },
  vendeur: { label: "Vendeur", color: "#4ecdc4", bg: "rgba(78,205,196,0.10)",  border: "rgba(78,205,196,0.30)"  },
};

function RoleBadge({ role }: { role: string }) {
  const r = ROLE_STYLES[role] ?? { label: role, color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)" };
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: r.bg, border: `1px solid ${r.border}`, color: r.color, whiteSpace: "nowrap" }}>
      {r.label}
    </span>
  );
}

const ROLE_OPTIONS = [
  { value: "owner",   label: "Owner",   color: "#f5c842" },
  { value: "admin",   label: "Admin",   color: "#6378ff" },
  { value: "vendeur", label: "Vendeur", color: "#4ecdc4" },
];

const INVITE_ROLE_OPTIONS = [
  { value: "vendeur", label: "Vendeur", color: "#4ecdc4" },
  { value: "admin",   label: "Admin",   color: "#6378ff" },
  { value: "owner",   label: "Owner",   color: "#f5c842" },
];

function ThemedSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; color?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
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

  const selected = options.find(o => o.value === value);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ height: 40, minWidth: 120, padding: "0 12px", borderRadius: 10, background: "rgba(10,11,14,0.80)", color: selected?.color ?? "rgba(255,255,255,0.92)", border: "1px solid rgba(99,120,255,0.25)", outline: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, whiteSpace: "nowrap" }}
      >
        <span>{selected?.label ?? "—"}</span>
        <span style={{ opacity: 0.5, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && mounted && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 140), zIndex: 99999, borderRadius: 12, overflow: "hidden", background: "linear-gradient(180deg, rgba(18,20,28,0.99), rgba(10,11,16,0.99))", border: "1px solid rgba(99,120,255,0.25)", boxShadow: "0 16px 48px rgba(0,0,0,0.7)", backdropFilter: "blur(20px)" }}
        >
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ width: "100%", padding: "11px 14px", background: o.value === value ? "rgba(99,120,255,0.14)" : "transparent", color: o.color ?? "rgba(255,255,255,0.88)", fontSize: 13, fontWeight: o.value === value ? 800 : 500, border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 100ms", whiteSpace: "nowrap" }}
            >
              {o.label}
              {o.value === value && <span style={{ fontSize: 11, color: "rgba(99,120,255,0.9)" }}>✓</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// Import useRef manquant dans le scope du composant ThemedSelect
import { useRef } from "react";

export default function ParametresPage() {
  const { activeWorkspace } = useWorkspace();
  const { role, can, loading: roleLoading } = useRole();

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [togglingShop, setTogglingShop] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "admin" | "vendeur">("vendeur");
  const [inviting, setInviting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (activeWorkspace) fetchAll(); }, [activeWorkspace?.id]);

  async function fetchAll() {
    setLoading(true); setErrorMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { window.location.href = "/login"; return; }
      setCurrentUserId(auth.user.id);

      const { data: wsData } = await supabase
        .from("workspaces").select("is_open").eq("id", activeWorkspace!.id).single();
      setIsOpen(wsData?.is_open !== false);

      const { data: membersData, error: mErr } = await supabase
        .from("workspace_members")
        .select("id,user_id,role,status,invited_email,created_at")
        .eq("workspace_id", activeWorkspace!.id)
        .order("created_at", { ascending: true });
      if (mErr) throw mErr;

      // On affiche l'email qu'on a (invited_email ou l'email de l'user courant)
      const enriched: Member[] = (membersData ?? []).map((m: any) => ({
        ...m,
        email: m.user_id === auth.user!.id
          ? auth.user!.email
          : (m.invited_email ?? "—"),
      }));
      setMembers(enriched);

      const { data: invData, error: iErr } = await supabase
        .from("workspace_invitations")
        .select("id,invited_email,role,token,expires_at,accepted_at,created_at")
        .eq("workspace_id", activeWorkspace!.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (iErr) throw iErr;
      setInvitations((invData ?? []) as Invitation[]);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur inconnue"); }
    finally { setLoading(false); }
  }

  async function toggleShop() {
    setTogglingShop(true); setErrorMsg(""); setSuccessMsg("");
    try {
      const newVal = !isOpen;
      const { error } = await supabase.from("workspaces").update({ is_open: newVal }).eq("id", activeWorkspace!.id);
      if (error) throw error;
      setIsOpen(newVal);
      setSuccessMsg(newVal ? "✅ Boutique ouverte — les vendeurs ont accès." : "🔒 Boutique fermée — les vendeurs sont bloqués.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur"); }
    finally { setTogglingShop(false); }
  }

  async function sendInvitation() {
    if (!inviteEmail.trim()) { setErrorMsg("Email requis."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) { setErrorMsg("Email invalide."); return; }
    setInviting(true); setErrorMsg(""); setSuccessMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const already = members.find(m => m.invited_email === inviteEmail.trim() || m.email === inviteEmail.trim());
      if (already) { setErrorMsg("Cette personne est déjà membre."); setInviting(false); return; }

      const { data, error } = await supabase
        .from("workspace_invitations")
        .insert({
          workspace_id: activeWorkspace!.id,
          invited_email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          invited_by: auth.user!.id,
        })
        .select("id,invited_email,role,token,expires_at,accepted_at,created_at")
        .single();
      if (error) throw error;

      setInvitations(prev => [data as Invitation, ...prev]);
      const link = `${window.location.origin}/invite/${(data as Invitation).token}`;
      setSuccessMsg(`✅ Invitation créée ! Lien : ${link}`);
      setInviteEmail("");
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur invitation"); }
    finally { setInviting(false); }
  }

  async function changeRole(memberId: string, newRole: "owner" | "admin" | "vendeur") {
    try {
      const { error } = await supabase.from("workspace_members").update({ role: newRole }).eq("id", memberId);
      if (error) throw error;
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setSuccessMsg("✅ Rôle mis à jour."); setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur changement de rôle"); }
  }

  async function removeMember(memberId: string) {
    try {
      const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);
      if (error) throw error;
      setMembers(prev => prev.filter(m => m.id !== memberId));
      setSuccessMsg("✅ Membre retiré."); setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur suppression membre"); }
  }

  async function cancelInvitation(invId: string) {
    try {
      const { error } = await supabase.from("workspace_invitations").delete().eq("id", invId);
      if (error) throw error;
      setInvitations(prev => prev.filter(i => i.id !== invId));
      setSuccessMsg("✅ Invitation annulée."); setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur annulation"); }
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    setSuccessMsg("📋 Lien copié !"); setTimeout(() => setSuccessMsg(""), 3000);
  }

  function confirm(text: string, action: () => void) {
    setConfirmText(text); setConfirmAction(() => action); setConfirmOpen(true);
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  }
  const isExpired = (iso: string) => new Date(iso) < new Date();

  if (!activeWorkspace) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Paramètres</div>
      <h1 className="ds-title">Paramètres</h1>
      <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Aucun workspace sélectionné</div>
      </div>
    </div>
  );

  if (!roleLoading && !can.manageMembers) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Paramètres</div>
      <h1 className="ds-title">Paramètres</h1>
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Accès réservé au propriétaire</div>
      </div>
    </div>
  );

  const activeMembers = members.filter(m => m.status === "active");

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Paramètres</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Paramètres</h1>
          <p className="ds-subtitle">Gestion des membres — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong></p>
        </div>
        <div className="ds-right-tools">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 34, padding: "0 14px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>
            Mon rôle : <RoleBadge role={role ?? "—"} />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.20)", color: "rgba(255,120,120,0.95)", fontWeight: 700, fontSize: 13 }}>{errorMsg}</div>
      )}
      {successMsg && (
        <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(80,200,120,0.08)", border: "1px solid rgba(80,200,120,0.20)", color: "rgba(100,220,140,0.95)", fontWeight: 700, fontSize: 13, wordBreak: "break-all" }}>{successMsg}</div>
      )}

      {/* ── Statut boutique ── */}
      <div className="ds-card">
        <div className="ds-card-head">
          <div>
            <div className="ds-card-title">{isOpen ? "🟢" : "🔴"} Statut de la boutique</div>
            <div className="ds-card-sub">{isOpen ? "La boutique est ouverte — tous les membres ont accès." : "La boutique est fermée — les vendeurs sont bloqués."}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div
            onClick={() => !togglingShop && confirm(
              isOpen ? "Fermer la boutique ? Les vendeurs n'auront plus accès." : "Ouvrir la boutique ? Les vendeurs retrouveront leur accès.",
              toggleShop
            )}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderRadius: 14, border: `1px solid ${isOpen ? "rgba(80,200,120,0.30)" : "rgba(255,80,80,0.30)"}`, background: isOpen ? "rgba(80,200,120,0.06)" : "rgba(255,80,80,0.06)", cursor: togglingShop ? "not-allowed" : "pointer", transition: "all 200ms", opacity: togglingShop ? 0.6 : 1 }}
          >
            <div style={{ width: 48, height: 26, borderRadius: 999, background: isOpen ? "rgba(80,200,120,0.35)" : "rgba(255,80,80,0.25)", border: `1px solid ${isOpen ? "rgba(80,200,120,0.50)" : "rgba(255,80,80,0.40)"}`, position: "relative", transition: "all 200ms", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: isOpen ? 24 : 3, width: 18, height: 18, borderRadius: "50%", background: isOpen ? "rgba(80,220,120,0.95)" : "rgba(255,100,80,0.95)", transition: "left 200ms", boxShadow: `0 0 8px ${isOpen ? "rgba(80,220,120,0.5)" : "rgba(255,80,80,0.5)"}` }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: isOpen ? "rgba(100,220,140,0.95)" : "rgba(255,120,100,0.95)" }}>
                {togglingShop ? "En cours…" : isOpen ? "Boutique ouverte" : "Boutique fermée"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>{isOpen ? "Cliquer pour fermer" : "Cliquer pour ouvrir"}</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "rgba(255,255,255,0.50)", lineHeight: 1.6 }}>
            {isOpen ? "✅ Les vendeurs peuvent ajouter des clients et des ventes normalement." : "⛔ Les vendeurs voient un message de boutique fermée et ne peuvent rien faire."}
          </div>
        </div>
      </div>

      {/* ── Inviter un membre ── */}
      <div className="ds-card">
        <div className="ds-card-head">
          <div>
            <div className="ds-card-title">✉️ Inviter un membre</div>
            <div className="ds-card-sub">Le lien d'invitation est valable 7 jours.</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.6, marginBottom: 6 }}>Email</div>
            <input
              value={inviteEmail}
              onChange={e => { setInviteEmail(e.target.value); setErrorMsg(""); }}
              placeholder="collaborateur@email.com"
              onKeyDown={e => { if (e.key === "Enter") sendInvitation(); }}
              style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 14 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.6, marginBottom: 6 }}>Rôle</div>
            <ThemedSelect
              value={inviteRole}
              onChange={v => setInviteRole(v as "owner" | "admin" | "vendeur")}
              options={INVITE_ROLE_OPTIONS}
            />
          </div>
          <button
            type="button"
            onClick={sendInvitation}
            disabled={inviting || !inviteEmail.trim()}
            style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "1px solid rgba(120,160,255,0.40)", background: "rgba(120,160,255,0.16)", color: "rgba(255,255,255,0.95)", fontWeight: 800, fontSize: 14, cursor: inviting || !inviteEmail.trim() ? "not-allowed" : "pointer", opacity: inviting || !inviteEmail.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}
          >
            {inviting ? "Envoi…" : "＋ Inviter"}
          </button>
        </div>
      </div>

      {/* ── Membres actifs ── */}
      <div className="ds-card">
        <div className="ds-card-head">
          <div>
            <div className="ds-card-title">👥 Membres actifs</div>
            <div className="ds-card-sub">{activeMembers.length} membre(s)</div>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: "30px 0", textAlign: "center", opacity: 0.5 }}>Chargement…</div>
        ) : activeMembers.length === 0 ? (
          <div style={{ padding: "30px 0", textAlign: "center", opacity: 0.4, fontSize: 13 }}>Aucun membre actif</div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Depuis</th>
                  <th className="ds-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.map(m => {
                  const isSelf = m.user_id === currentUserId;
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 700 }}>
                        {m.email || m.invited_email || "—"}
                        {isSelf && <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.45, fontWeight: 500 }}>(vous)</span>}
                      </td>
                      <td>
                        <ThemedSelect
                          value={m.role}
                          onChange={v => changeRole(m.id, v as "owner" | "admin" | "vendeur")}
                          options={ROLE_OPTIONS}
                        />
                      </td>
                      <td style={{ opacity: 0.55, fontSize: 13 }}>{formatDate(m.created_at)}</td>
                      <td className="ds-right">
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => confirm(`Retirer ${m.email || m.invited_email || "ce membre"} du workspace ?`, () => removeMember(m.id))}
                            style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.20)", background: "rgba(255,80,80,0.06)", color: "rgba(255,120,120,0.85)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >Retirer</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Invitations en attente ── */}
      {invitations.length > 0 && (
        <div className="ds-card">
          <div className="ds-card-head">
            <div>
              <div className="ds-card-title">⏳ Invitations en attente</div>
              <div className="ds-card-sub">{invitations.length} invitation(s) non acceptée(s)</div>
            </div>
          </div>
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr><th>Email</th><th>Rôle</th><th>Expire le</th><th className="ds-right">Actions</th></tr>
              </thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id} style={{ opacity: isExpired(inv.expires_at) ? 0.5 : 1 }}>
                    <td style={{ fontWeight: 700 }}>{inv.invited_email}</td>
                    <td><RoleBadge role={inv.role} /></td>
                    <td style={{ fontSize: 13, color: isExpired(inv.expires_at) ? "rgba(255,120,120,0.8)" : "rgba(255,255,255,0.55)" }}>
                      {isExpired(inv.expires_at) ? "⚠️ Expirée" : formatDate(inv.expires_at)}
                    </td>
                    <td className="ds-right">
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <button type="button" onClick={() => copyLink(inv.token)}
                          style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(120,160,255,0.20)", background: "rgba(120,160,255,0.06)", color: "rgba(120,160,255,0.85)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          📋 Copier
                        </button>
                        <button type="button" onClick={() => confirm("Annuler cette invitation ?", () => cancelInvitation(inv.id))}
                          style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.20)", background: "rgba(255,80,80,0.06)", color: "rgba(255,120,120,0.85)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          Annuler
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal confirmation ── */}
      {confirmOpen && mounted && createPortal(
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(0,0,0,0.60)", backdropFilter: "blur(10px)" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setConfirmOpen(false); }}
        >
          <div style={{ width: 400, maxWidth: "100%", borderRadius: 18, padding: 24, background: "linear-gradient(180deg, rgba(20,22,28,0.99), rgba(12,13,16,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 10 }}>Confirmation</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginBottom: 24, lineHeight: 1.6 }}>{confirmText}</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setConfirmOpen(false)}
                style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", fontWeight: 700, cursor: "pointer" }}>Annuler</button>
              <button type="button" onClick={() => { confirmAction?.(); setConfirmOpen(false); }}
                style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,80,80,0.30)", background: "rgba(255,80,80,0.12)", color: "rgba(255,120,120,0.95)", fontWeight: 800, cursor: "pointer" }}>Confirmer</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}