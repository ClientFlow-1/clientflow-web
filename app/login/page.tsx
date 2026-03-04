"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn() {
    if (pending) return;

    setPending(true);
    try {
      const request = supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout Supabase (15s)")), 15000)
      );

      const { data, error } = await Promise.race([request, timeout]);

      if (error) {
        console.error("LOGIN ERROR:", error);
        alert(error.message);
        return;
      }

      if (!data?.session) {
        console.error("NO SESSION RETURNED:", data);
        alert("Aucune session renvoyée. Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        return;
      }

      alert("Connecté ✅");
      window.location.href = "/dashboard/import";
    } catch (err: any) {
      console.error("LOGIN CATCH:", err);
      alert(err?.message ?? "Erreur login.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ color: "white", marginBottom: 16 }}>Login</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 360 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(0,0,0,0.35)",
            color: "white",
            outline: "none",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(0,0,0,0.35)",
            color: "white",
            outline: "none",
          }}
        />

        <button
          onClick={signIn}
          disabled={pending || !email || !password}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            background: pending ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.95)",
            color: "black",
            fontWeight: 700,
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "Connexion..." : "Se connecter"}
        </button>
      </div>
    </div>
  );
}