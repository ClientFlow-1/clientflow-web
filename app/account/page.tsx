"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type WorkspaceSub = {
  id: string;
  name: string;
  subscription_status: string | null;
  subscription_ends_at: string | null;
};

const CANCEL_MAILTO = "mailto:client.flow@outlook.com?subject=Demande%20de%20r%C3%A9siliation%20d'abonnement%20ClientFlow&body=Bonjour%2C%0A%0AJe%20souhaite%20r%C3%A9silier%20mon%20abonnement%20ClientFlow.%0A%0ANom%20du%20workspace%20%3A%20%5B%C3%A0%20compl%C3%A9ter%5D%0AEmail%20du%20compte%20%3A%20%5B%C3%A0%20compl%C3%A9ter%5D%0A%0ACordialement";

export default function AccountPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true); setErrorMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { window.location.href = "/login"; return; }
      setUserEmail(auth.user.email ?? "");

      const { data, error } = await supabase
        .from("workspaces")
        .select("id,name,subscription_status,subscription_ends_at")
        .eq("user_id", auth.user.id)
        .order("name", { ascending: true });
      if (error) throw error;
      setWorkspaces((data ?? []) as WorkspaceSub[]);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur inconnue"); }
    finally { setLoading(false); }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "'DM Sans', system-ui, sans-serif", padding: "0 0 60px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&family=DM+Mono:wght@400;500&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #6378ff, #4f63e8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 900, color: "rgba(255,255,255,0.90)", letterSpacing: "-0.3px" }}>Mon compte</span>
          </div>
          <Link href="/dashboard/clients" style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Dashboard
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 0" }}>

        {/* User info */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "rgba(255,255,255,0.95)", letterSpacing: "-0.5px", marginBottom: 6 }}>Mon compte</h1>
          {userEmail && <div style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", fontFamily: "'DM Mono', monospace" }}>{userEmail}</div>}
        </div>

        {errorMsg && (
          <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.20)", color: "rgba(255,120,120,0.95)", fontWeight: 700, fontSize: 13, marginBottom: 16 }}>{errorMsg}</div>
        )}

        {/* Subscription section */}
        <div style={{ borderRadius: 18, background: "linear-gradient(145deg, rgba(18,18,28,0.98), rgba(10,10,15,0.99))", border: "1px solid rgba(99,120,255,0.18)", overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(99,120,255,0.40), transparent)" }} />
          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.90)" }}>💳 Gérer mon abonnement</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 4 }}>Abonnement ClientFlow par workspace</div>
          </div>

          {loading ? (
            <div style={{ padding: "40px 24px", textAlign: "center", opacity: 0.4, fontSize: 14 }}>Chargement…</div>
          ) : workspaces.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", opacity: 0.4, fontSize: 14 }}>Aucun workspace trouvé.</div>
          ) : (
            <div style={{ padding: "8px 0" }}>
              {workspaces.map((ws, i) => {
                const isCancelled = ws.subscription_status === "cancelled";
                const endsDate = ws.subscription_ends_at ? new Date(ws.subscription_ends_at) : null;
                const isExpired = isCancelled && endsDate && endsDate < new Date();
                return (
                  <div key={ws.id} style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderBottom: i < workspaces.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ws.name}</div>
                        {isCancelled && endsDate && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>
                            {isExpired ? "Expiré le" : "Accès jusqu'au"} {formatDate(ws.subscription_ends_at!)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px", borderRadius: 999, background: isCancelled ? "rgba(239,68,68,0.10)" : "rgba(80,200,120,0.10)", border: `1px solid ${isCancelled ? "rgba(239,68,68,0.25)" : "rgba(80,200,120,0.25)"}`, color: isCancelled ? "rgba(255,130,130,0.90)" : "rgba(100,220,140,0.95)", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: isCancelled ? "rgba(239,68,68,0.90)" : "rgba(80,220,120,0.90)", flexShrink: 0 }} />
                        {isCancelled ? (isExpired ? "Expiré" : "Résilié") : "Actif"}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {!isCancelled ? (
                        <a href={CANCEL_MAILTO}
                          style={{ height: 36, padding: "0 16px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.07)", color: "rgba(255,120,120,0.90)", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap" }}>
                          Résilier mon abonnement
                        </a>
                      ) : (
                        <a href="https://clientflow-web-3.vercel.app/#pricing"
                          style={{ height: 36, padding: "0 16px", borderRadius: 9, border: "1px solid rgba(99,120,255,0.30)", background: "rgba(99,120,255,0.10)", color: "rgba(160,180,255,0.90)", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap" }}>
                          Renouveler →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "rgba(255,255,255,0.30)", lineHeight: 1.6 }}>
          Pour toute question sur votre abonnement, contactez-nous à{" "}
          <a href="mailto:client.flow@outlook.com" style={{ color: "rgba(160,180,255,0.70)", textDecoration: "none", fontWeight: 600 }}>client.flow@outlook.com</a>
        </div>
      </div>
    </div>
  );
}
