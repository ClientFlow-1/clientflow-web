"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

export type StatusOverride = "vip" | "regular" | "inactive" | "new" | null;

export interface ClientForEdit {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  birthdate?: string | null;
  notes?: string | null;
  status_override?: StatusOverride;
}

interface Props {
  client: ClientForEdit | null;
  onClose: () => void;
  onSaved: (updated: ClientForEdit) => void;
}

const STATUS_OPTIONS: {
  value: StatusOverride;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  { value: null, label: "Auto", emoji: "🔄", color: "rgba(238,238,245,0.5)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)" },
  { value: "vip", label: "VIP", emoji: "👑", color: "#f5c842", bg: "rgba(245,200,66,0.1)", border: "rgba(245,200,66,0.3)" },
  { value: "regular", label: "Régulier", emoji: "⭐", color: "#6378ff", bg: "rgba(99,120,255,0.1)", border: "rgba(99,120,255,0.3)" },
  { value: "inactive", label: "Inactif", emoji: "😴", color: "rgba(238,238,245,0.45)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" },
  { value: "new", label: "Nouveau", emoji: "✨", color: "#4ecdc4", bg: "rgba(78,205,196,0.1)", border: "rgba(78,205,196,0.3)" },
];

export default function ClientEditDrawer({ client, onClose, onSaved }: Props) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [notes, setNotes] = useState("");
  const [statusOverride, setStatusOverride] = useState<StatusOverride>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (client) {
      setPrenom(client.prenom || "");
      setNom(client.nom || "");
      setEmail(client.email || "");
      setBirthdate(client.birthdate || "");
      setNotes(client.notes || "");
      setStatusOverride(client.status_override ?? null);
      setError(null);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [client]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    if (client) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [client]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const handleSave = async () => {
    if (!client) return;
    if (!prenom.trim() || !nom.trim()) {
      setError("Le prénom et le nom sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);

    const updates = {
      prenom: prenom.trim(),
      nom: nom.trim(),
      email: email.trim(),
      birthdate: birthdate || null,
      notes: notes.trim() || null,
      status_override: statusOverride,
    };

    const { error: supaErr } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", client.id);

    setSaving(false);

    if (supaErr) {
      setError("Erreur lors de la sauvegarde : " + supaErr.message);
      return;
    }

    onSaved({ ...client, ...updates });
    handleClose();
  };

  if (!client) return null;

  return createPortal(
    <>
      <div
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(2px)",
          zIndex: 999,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.28s ease",
        }}
      />
      <div
        ref={drawerRef}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(480px, 100vw)",
          background: "linear-gradient(180deg, #16162a 0%, #13131f 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          zIndex: 1000,
          display: "flex", flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
          boxShadow: "-24px 0 80px rgba(0,0,0,0.5)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ padding: "28px 28px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 12, color: "rgba(238,238,245,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              Modifier le client
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#eeeef5", margin: 0 }}>
              {client.prenom} {client.nom}
            </h2>
          </div>
          <button
            onClick={handleClose}
            style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(238,238,245,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, transition: "background 0.15s, color 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#eeeef5"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(238,238,245,0.5)"; }}
          >✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Identité */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(238,238,245,0.3)", marginBottom: 14 }}>Identité</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <DrawerField label="Prénom" value={prenom} onChange={setPrenom} placeholder="Jean" />
                <DrawerField label="Nom" value={nom} onChange={setNom} placeholder="Dupont" />
              </div>
              <DrawerField label="Email" value={email} onChange={setEmail} placeholder="jean@example.com" type="email" />
              <DrawerField label="Date de naissance" value={birthdate} onChange={setBirthdate} type="date" />
            </div>
          </div>

          {/* Statut */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(238,238,245,0.3)", marginBottom: 14 }}>Statut client</p>
            <p style={{ fontSize: 13, color: "rgba(238,238,245,0.4)", marginBottom: 14, lineHeight: 1.5 }}>
              Par défaut, le statut est calculé automatiquement. Vous pouvez le forcer manuellement.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {STATUS_OPTIONS.map((opt) => {
                const active = statusOverride === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    onClick={() => setStatusOverride(opt.value)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, border: `1px solid ${active ? opt.border : "rgba(255,255,255,0.08)"}`, background: active ? opt.bg : "rgba(255,255,255,0.03)", color: active ? opt.color : "rgba(238,238,245,0.5)", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", transform: active ? "scale(1.02)" : "scale(1)" }}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                    {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: opt.color, display: "inline-block", marginLeft: 2 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(238,238,245,0.3)", marginBottom: 14 }}>Notes internes</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergie aux produits X, préfère les RDV le matin..."
                rows={4}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", color: "#eeeef5", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box", transition: "border-color 0.15s" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,120,255,0.4)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.25)", color: "#ff8080", fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "20px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12, flexShrink: 0 }}>
          <button
            onClick={handleClose}
            style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(238,238,245,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          >Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 2, padding: "12px", borderRadius: 12, border: "1px solid rgba(99,120,255,0.35)", background: saving ? "rgba(99,120,255,0.15)" : "linear-gradient(135deg, rgba(99,120,255,0.25) 0%, rgba(140,99,255,0.25) 100%)", color: saving ? "rgba(99,120,255,0.5)" : "#8899ff", cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,120,255,0.4) 0%, rgba(140,99,255,0.4) 100%)"; }}
            onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,120,255,0.25) 0%, rgba(140,99,255,0.25) 100%)"; }}
          >
            {saving ? (
              <>
                <span style={{ width: 14, height: 14, border: "2px solid rgba(99,120,255,0.3)", borderTopColor: "#6378ff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                Sauvegarde...
              </>
            ) : "Sauvegarder les modifications"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>,
    document.body
  );
}

function DrawerField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "rgba(238,238,245,0.45)", fontWeight: 500 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", color: "#eeeef5", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color 0.15s", colorScheme: "dark" }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,120,255,0.4)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
      />
    </div>
  );
}