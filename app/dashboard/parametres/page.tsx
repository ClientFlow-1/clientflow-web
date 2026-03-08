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
  prenom?: string;
  nom?: string;
};

type Invitation = {
  id: string;
  invited_email: string;
  role: "admin" | "vendeur";
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  owner:   { label: "Owner",   color: "#f5c842", bg: "rgba(245,200,66,0.10)",  border: "rgba(245,200,66,0.30)"  },
  admin:   { label: "Admin",   color: "#6378ff", bg: "rgba(99,120,255,0.10)",  border: "rgba(99,120,255,0.30)"  },
  vendeur: { label: "Vendeur", color: "#4ecdc4", bg: "rgba(78,205,196,0.10)",  border: "rgba(78,205,196,0.30)"  },
};

function RoleBadge({ role }: { role: string }) {
  const r = ROLE_LABELS[role] ?? { label: role, color: "rgba(255,255,255,0.6)", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)" };
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: r.bg, border: `1px solid ${r.border}`, color: r.color }}>
      {r.label}
    </span>
  );
}

export default function ParametresPage() {
  const { activeWorkspace } = useWorkspace();
  const { role, can, loading: roleLoading } = useRole();

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [mounted, setMounted] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "vendeur">("vendeur");
  const [inviting, setInviting] = useState(false);

  // Confirm modal
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

      const { data: membersData, error: mErr } = await supabase
        .from("workspace_members")
        .select("id,user_id,role,status,invited_email,created_at")
        .eq("workspace_id", activeWorkspace!.id)
        .order("created_at", { ascending: true });

      if (mErr) throw mErr;

      // Récupère les infos des users actifs
      const enriched: Member[] = await Promise.all(
        (membersData ?? []).map(async (m: any) => {
          if (m.user_id) {
            const { data: profile } = await supabase
              .from("clients")
              .select("prenom,nom,email")
              .eq("id", m.user_id)
              .single();
            // Essaie de récupérer l'email depuis auth (disponible uniquement pour l'user courant)
            if (m.user_id === auth.user!.id) {
              return { ...m, email: auth.user!.email, prenom: profile?.prenom, nom: profile?.nom };
            }
            return { ...m, email: m.invited_email ?? "—", prenom: profile?.prenom, nom: profile?.nom };
          }
          return { ...m };
        })
      );

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

  async function sendInvitation() {
    if (!inviteEmail.trim()) { setErrorMsg("Email requis."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) { setErrorMsg("Email invalide."); return; }
    setInviting(true); setErrorMsg(""); setSuccessMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();

      // Vérifie si déjà membre
      const already = members.find(m => m.invited_email === inviteEmail.trim() || m.email === inviteEmail.trim());
      if (already) { setErrorMsg("Cette personne est déjà membre."); return; }

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
      setInviteEmail("");

      // Génère le lien d'invitation
      const link = `${window.location.origin}/invite/${(data as Invitation).token}`;
      setSuccessMsg(`✅ Invitation créée ! Lien à partager : ${link}`);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur invitation"); }
    finally { setInviting(false); }
  }

  async function changeRole(memberId: string, newRole: "admin" | "vendeur") {
    try {
      const { error } = await supabase
        .from("workspace_members")
        .update({ role: newRole })
        .eq("id", memberId);
      if (error) throw error;
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setSuccessMsg("Rôle mis à jour.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur"); }
  }

  async function removeMember(memberId: string) {
    try {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
      setMembers(prev => prev.filter(m => m.id !== memberId));
      setSuccessMsg("Membre retiré.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur"); }
  }

  async function cancelInvitation(invId: string) {
    try {
      const { error } = await supabase
        .from("workspace_invitations")
        .delete()
        .eq("id", invId);
      if (error) throw error;
      setInvitations(prev => prev.filter(i => i.id !== invId));
      setSuccessMsg("Invitation annulée.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur"); }
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    setSuccessMsg("Lien copié !");
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  function confirm(text: string, action: () => void) {
    setConfirmText(text);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  }

  function pad2(n: number) { return String(n).padStart(2, "0"); }
  function formatDate(iso: string) {
    const d = new Date(iso);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  const isExpired = (iso: string) => new Date(iso) < new Date();

  if (!activeWorkspace) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Paramètres</div>
      <h1 className="ds-title">Paramètres</h1>
      <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Aucun workspace sélectionné</div>
      </div>
    </div>
  );

  if (!roleLoading && !can.manageMembers) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Paramètres</div>
      <h1 className="ds-title">Paramètres</h1>
      <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Accès réservé au propriétaire</div>
        <div style={{ fontSize: 13, marginTop: 6, opacity: 0.5 }}>Seul le owner du workspace peut gérer les membres.</div>
      </div>
    </div>
  );

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Paramètres</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Paramètres</h1>
          <p className="ds-subtitle">Gestion des membres — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong></p>
        </div>
        <div className="ds-right-tools">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 34, padding: "0 14px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>
            Mon rôle : <RoleBadge role={role ?? "—"} />
          </div>
        </div>
      </div>

      {errorMsg && <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.20)", color: "rgba(255,120,120,0.95)", fontWeight: 700, fontSize: 13 }}>{errorMsg}</div>}
      {successMsg && <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(80,200,120,0.08)", border: "1px solid rgba(80,200,120,0.20)", color: "rgba(100,220,140,0.95)", fontWeight: 700, fontSize: 13, wordBreak: "break-all" }}>{successMsg}</div>}

      {/* ── Inviter un membre ── */}
      <div className="ds-card" style={{ marginBottom: 24 }}>
        <div className="ds-card-head">
          <div className="ds-card-title">✉️ Inviter un membre</div>
          <div className="ds-card-sub">Le lien d'invitation est valable 7 jours.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
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
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as "admin" | "vendeur")}
              style={{ height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 14, cursor: "pointer" }}
            >
              <option value="vendeur">Vendeur</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="button"
            onClick={sendInvitation}
            disabled={inviting || !inviteEmail.trim()}
            style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "1px solid rgba(120,160,255,0.40)", background: "rgba(120,160,255,0.16)", color: "rgba(255,255,255,0.95)", fontWeight: 800, fontSize: 14, cursor: inviting || !inviteEmail.trim() ? "not-allowed" : "pointer", opacity: inviting || !inviteEmail.trim() ? 0.5 : 1, whiteSpace: "nowrap", marginTop: 22 }}
          >
            {inviting ? "Envoi…" : "＋ Inviter"}
          </button>
        </div>
      </div>

      {/* ── Membres actifs ── */}
      <div className="ds-card" style={{ marginBottom: 24 }}>
        <div className="ds-card-head">
          <div>
            <div className="ds-card-title">👥 Membres actifs</div>
            <div className="ds-card-sub">{members.filter(m => m.status === "active").length} membre(s)</div>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: "30px 0", textAlign: "center", opacity: 0.5 }}>Chargement…</div>
        ) : members.filter(m => m.status === "active").length === 0 ? (
          <div style={{ padding: "30px 0", textAlign: "center", opacity: 0.4, fontSize: 13 }}>Aucun membre actif</div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr><th>Email</th><th>Rôle</th><th>Depuis</th><th className="ds-right">Actions</th></tr>
              </thead>
              <tbody>
                {members.filter(m => m.status === "active").map(m => {
                  const isCurrentUser = false;
                  const isOwnerRow = m.role === "owner";
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 700 }}>{m.email || m.invited_email || "—"}</td>
                      <td>
                        {isOwnerRow ? (
                          <RoleBadge role="owner" />
                        ) : (
                          <select
                            value={m.role}
                            onChange={e => changeRole(m.id, e.target.value as "admin" | "vendeur")}
                            style={{ height: 30, borderRadius: 8, padding: "0 10px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 12, cursor: "pointer" }}
                          >
                            <option value="admin">Admin</option>
                            <option value="vendeur">Vendeur</option>
                          </select>
                        )}
                      </td>
                      <td style={{ opacity: 0.55, fontSize: 13 }}>{formatDate(m.created_at)}</td>
                      <td className="ds-right">
                        {!isOwnerRow && (
                          <button
                            type="button"
                            onClick={() => confirm(`Retirer ce membre du workspace ?`, () => removeMember(m.id))}
                            style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.20)", background: "rgba(255,80,80,0.06)", color: "rgba(255,120,120,0.85)", fontSize: 12, fontWeight: 750, cursor: "pointer" }}
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
                        <button
                          type="button"
                          onClick={() => copyLink(inv.token)}
                          style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(120,160,255,0.20)", background: "rgba(120,160,255,0.06)", color: "rgba(120,160,255,0.85)", fontSize: 12, fontWeight: 750, cursor: "pointer" }}
                        >📋 Copier le lien</button>
                        <button
                          type="button"
                          onClick={() => confirm("Annuler cette invitation ?", () => cancelInvitation(inv.id))}
                          style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.20)", background: "rgba(255,80,80,0.06)", color: "rgba(255,120,120,0.85)", fontSize: 12, fontWeight: 750, cursor: "pointer" }}
                        >Annuler</button>
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
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(0,0,0,0.60)", backdropFilter: "blur(10px)" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setConfirmOpen(false); }}>
          <div style={{ width: 400, maxWidth: "100%", borderRadius: 18, padding: 24, background: "linear-gradient(180deg, rgba(20,22,28,0.99), rgba(12,13,16,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 10 }}>Confirmation</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginBottom: 24, lineHeight: 1.6 }}>{confirmText}</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setConfirmOpen(false)}
                style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", fontWeight: 750, cursor: "pointer" }}>Annuler</button>
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