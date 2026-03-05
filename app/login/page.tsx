"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const request = supabase.auth.signInWithPassword({ email: email.trim(), password });
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout (15s)")), 15000));
      const { data, error: authError } = await Promise.race([request, timeout]);
      if (authError) { setError(authError.message); return; }
      if (!data?.session) { setError("Aucune session renvoyée."); return; }
      window.location.href = "/dashboard/import";
    } catch (err: any) {
      setError(err?.message ?? "Erreur login.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #0c0c14 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700;900&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40, justifyContent: "center" }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, #6378ff, #4f63e8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "DM Mono", boxShadow: "0 0 24px rgba(99,120,255,0.4)" }}>CF</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.95)", fontFamily: "DM Mono" }}>CLIENTFLOW</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Gestion clientèle</div>
          </div>
        </div>

        {/* Card */}
        <div style={{ background: "rgba(19,19,31,0.95)", border: "1px solid rgba(99,120,255,0.15)", borderRadius: 20, padding: "36px 32px", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: "rgba(255,255,255,0.95)", letterSpacing: -0.5 }}>Connexion</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", marginTop: 6, fontWeight: 300 }}>Accède à ton espace ClientFlow</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.50)", marginBottom: 7, letterSpacing: 0.5 }}>EMAIL</div>
              <input
                placeholder="ton@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && signIn()}
                style={{ width: "100%", height: 46, borderRadius: 12, padding: "0 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.92)", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "DM Sans" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.50)", marginBottom: 7, letterSpacing: 0.5 }}>MOT DE PASSE</div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && signIn()}
                style={{ width: "100%", height: 46, borderRadius: 12, padding: "0 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.92)", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "DM Sans" }}
              />
            </div>

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,80,80,0.10)", border: "1px solid rgba(255,80,80,0.25)", color: "rgba(255,120,100,0.95)", fontSize: 13, fontWeight: 600 }}>
                ⚠ {error}
              </div>
            )}

            <button
              onClick={signIn}
              disabled={pending || !email || !password}
              style={{ height: 48, borderRadius: 12, border: "none", background: pending || !email || !password ? "rgba(99,120,255,0.25)" : "linear-gradient(135deg, #6378ff, #4f63e8)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: pending || !email || !password ? "not-allowed" : "pointer", marginTop: 6, fontFamily: "DM Sans", boxShadow: pending || !email || !password ? "none" : "0 8px 24px rgba(99,120,255,0.35)", transition: "all 150ms" }}
            >
              {pending ? "Connexion en cours…" : "Se connecter →"}
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.20)", fontFamily: "DM Mono" }}>
          v1.0 · BETA
        </div>
      </div>
    </div>
  );
}