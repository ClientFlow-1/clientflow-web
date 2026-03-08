"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type InvitationInfo = {
  id: string;
  invited_email: string;
  role: "admin" | "vendeur";
  token: string;
  expires_at: string;
  accepted_at: string | null;
  workspace_id: string;
  workspace_name?: string;
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Auth form
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => { init(); }, [token]);

  async function init() {
    setLoading(true);
    try {
      // Récupère l'utilisateur courant
      const { data: auth } = await supabase.auth.getUser();
      setCurrentUser(auth?.user ?? null);

      // Récupère l'invitation
      const { data, error } = await supabase
        .from("workspace_invitations")
        .select("id,invited_email,role,token,expires_at,accepted_at,workspace_id")
        .eq("token", token)
        .single();

      if (error || !data) { setError("Invitation introuvable ou invalide."); return; }
      if (data.accepted_at) { setError("Cette invitation a déjà été utilisée."); return; }
      if (new Date(data.expires_at) < new Date()) { setError("Cette invitation a expiré."); return; }

      // Récupère le nom du workspace
      const { data: ws } = await supabase
        .from("workspaces")
        .select("name")
        .eq("id", data.workspace_id)
        .single();

      setInvitation({ ...data, workspace_name: ws?.name ?? "ce workspace" });

      // Pré-rempli l'email
      if (auth?.user) {
        setEmail(auth.user.email ?? "");
      } else {
        setEmail(data.invited_email);
      }
    } catch (e: any) { setError(e?.message ?? "Erreur inconnue"); }
    finally { setLoading(false); }
  }

  async function handleAuth() {
    setAuthLoading(true); setAuthError("");
    try {
      if (authMode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setCurrentUser(data.user);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setCurrentUser(data.user);
      }
    } catch (e: any) { setAuthError(e?.message ?? "Erreur auth"); }
    finally { setAuthLoading(false); }
  }

  async function acceptInvitation() {
    if (!invitation || !currentUser) return;
    setJoining(true); setError("");
    try {
      // Vérifie que l'email correspond
      if (currentUser.email?.toLowerCase() !== invitation.invited_email.toLowerCase()) {
        setError(`Cette invitation est destinée à ${invitation.invited_email}. Connecte-toi avec cet email.`);
        return;
      }

      // Ajoute le membre
      const { error: memberErr } = await supabase
        .from("workspace_members")
        .upsert({
          workspace_id: invitation.workspace_id,
          user_id: currentUser.id,
          role: invitation.role,
          invited_email: invitation.invited_email,
          status: "active",
        }, { onConflict: "workspace_id,user_id" });

      if (memberErr) throw memberErr;

      // Marque l'invitation comme acceptée
      await supabase
        .from("workspace_invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);

      setSuccess(true);

      // Redirige vers le dashboard après 2s
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (e: any) { setError(e?.message ?? "Erreur"); }
    finally { setJoining(false); }
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: "Administrateur",
    vendeur: "Vendeur",
    owner: "Propriétaire",
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0b0e 0%, #13131f 50%, #0a0b0e 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ width: 480, maxWidth: "100%" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #6378ff, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            ClientFlow
          </div>
        </div>

        <div style={{ borderRadius: 20, padding: 28, background: "linear-gradient(180deg, rgba(20,22,28,0.99), rgba(12,13,16,0.99))", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", opacity: 0.5 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>⟳</div>
              <div style={{ fontSize: 14 }}>Vérification de l'invitation…</div>
            </div>
          ) : error && !invitation ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 8 }}>Invitation invalide</div>
              <div style={{ fontSize: 14, color: "rgba(255,120,120,0.9)", marginBottom: 24 }}>{error}</div>
              <button type="button" onClick={() => router.push("/dashboard")}
                style={{ height: 44, padding: "0 24px", borderRadius: 12, border: "1px solid rgba(120,160,255,0.30)", background: "rgba(120,160,255,0.10)", color: "rgba(120,160,255,0.95)", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                Aller au dashboard
              </button>
            </div>
          ) : success ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 8 }}>Bienvenue !</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>Tu as rejoint <strong style={{ color: "rgba(255,255,255,0.85)" }}>{invitation?.workspace_name}</strong></div>
              <div style={{ fontSize: 13, color: "rgba(100,220,140,0.8)", marginTop: 16 }}>Redirection en cours…</div>
            </div>
          ) : invitation ? (
            <>
              {/* Header invitation */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(99,120,255,0.15)", border: "1px solid rgba(99,120,255,0.30)", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>✉️</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 6 }}>Tu es invité(e) !</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", lineHeight: 1.6 }}>
                  Rejoins <strong style={{ color: "rgba(255,255,255,0.85)" }}>{invitation.workspace_name}</strong> en tant que{" "}
                  <span style={{ fontWeight: 800, color: "#6378ff" }}>{ROLE_LABELS[invitation.role]}</span>
                </div>
              </div>

              {/* Info invitation */}
              <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(99,120,255,0.06)", border: "1px solid rgba(99,120,255,0.15)", marginBottom: 20, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                Invitation envoyée à <strong style={{ color: "rgba(255,255,255,0.85)" }}>{invitation.invited_email}</strong>
              </div>

              {error && (
                <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.20)", color: "rgba(255,120,120,0.95)", fontWeight: 700, fontSize: 13 }}>{error}</div>
              )}

              {/* Si pas connecté → formulaire auth */}
              {!currentUser ? (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                    {(["login", "register"] as const).map(mode => (
                      <button key={mode} type="button" onClick={() => setAuthMode(mode)}
                        style={{ flex: 1, height: 38, borderRadius: 10, border: `1px solid ${authMode === mode ? "rgba(120,160,255,0.40)" : "rgba(255,255,255,0.10)"}`, background: authMode === mode ? "rgba(120,160,255,0.14)" : "rgba(255,255,255,0.03)", color: authMode === mode ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                        {mode === "login" ? "Se connecter" : "Créer un compte"}
                      </button>
                    ))}
                  </div>

                  {authError && <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.20)", color: "rgba(255,120,120,0.95)", fontWeight: 700, fontSize: 13 }}>{authError}</div>}

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.6, marginBottom: 6 }}>Email</div>
                      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" type="email"
                        style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 14, boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.6, marginBottom: 6 }}>Mot de passe</div>
                      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password"
                        onKeyDown={e => { if (e.key === "Enter") handleAuth(); }}
                        style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 14, boxSizing: "border-box" }} />
                    </div>
                  </div>

                  <button type="button" onClick={handleAuth} disabled={authLoading || !email || !password}
                    style={{ width: "100%", height: 46, borderRadius: 12, border: "1px solid rgba(120,160,255,0.40)", background: "rgba(120,160,255,0.16)", color: "rgba(255,255,255,0.95)", fontWeight: 800, fontSize: 15, cursor: authLoading || !email || !password ? "not-allowed" : "pointer", opacity: authLoading || !email || !password ? 0.5 : 1 }}>
                    {authLoading ? "Connexion…" : authMode === "login" ? "Se connecter" : "Créer mon compte"}
                  </button>
                </>
              ) : (
                /* Si connecté → bouton rejoindre */
                <>
                  <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(99,120,255,0.15)", border: "1px solid rgba(99,120,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "rgba(120,160,255,0.9)", flexShrink: 0 }}>
                      {(currentUser.email?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>{currentUser.email}</div>
                      <div style={{ fontSize: 12, opacity: 0.5 }}>Connecté(e)</div>
                    </div>
                    <button type="button" onClick={async () => { await supabase.auth.signOut(); setCurrentUser(null); }}
                      style={{ marginLeft: "auto", height: 28, padding: "0 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 11, cursor: "pointer" }}>
                      Changer
                    </button>
                  </div>

                  <button type="button" onClick={acceptInvitation} disabled={joining}
                    style={{ width: "100%", height: 46, borderRadius: 12, border: "1px solid rgba(120,160,255,0.40)", background: "rgba(120,160,255,0.16)", color: "rgba(255,255,255,0.95)", fontWeight: 800, fontSize: 15, cursor: joining ? "not-allowed" : "pointer", opacity: joining ? 0.6 : 1 }}>
                    {joining ? "Rejoindre…" : `🚀 Rejoindre ${invitation.workspace_name}`}
                  </button>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}