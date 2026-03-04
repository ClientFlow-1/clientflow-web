"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/lib/workspaceContext";

type ParsedRow = Record<string, string>;

function splitCSVLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
      continue;
    }
    if (!inQuotes && ch === sep) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(text: string): ParsedRow[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!raw) return [];
  const lines = raw.split("\n").filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const candidates = [";", ",", "\t"];
  function scoreWithSep(sep: string) {
    const header = splitCSVLine(lines[0], sep).map(h => h.trim());
    const expected = header.length;
    if (expected <= 1) return { sep, score: -1, header };
    let ok = 0; let total = 0;
    for (let i = 1; i < lines.length; i++) {
      let cols = splitCSVLine(lines[i], sep);
      if (cols.length > expected) cols = cols.slice(0, expected - 1).concat([cols.slice(expected - 1).join(sep)]);
      else if (cols.length < expected) cols = cols.concat(Array(expected - cols.length).fill(""));
      if (cols.length === expected) ok++;
      total++;
    }
    return { sep, score: total > 0 ? ok / total : 0, header };
  }
  const scored = candidates.map(scoreWithSep).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const order = { ";": 0, ",": 1, "\t": 2 } as const;
    return order[a.sep as ";" | "," | "\t"] - order[b.sep as ";" | "," | "\t"];
  });
  const sep = scored[0].score >= 0 ? scored[0].sep : ",";
  const headers = splitCSVLine(lines[0], sep).map(h => h.trim());
  const expected = headers.length;
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    let cols = splitCSVLine(lines[i], sep);
    if (cols.length > expected) cols = cols.slice(0, expected - 1).concat([cols.slice(expected - 1).join(sep)]);
    else if (cols.length < expected) cols = cols.concat(Array(expected - cols.length).fill(""));
    const row: ParsedRow = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] ?? "").trim(); });
    if (Object.values(row).some(v => v !== "")) rows.push(row);
  }
  return rows;
}

function moneyToNumber(v: string): number {
  if (!v) return 0;
  let s = String(v).trim().replace(/\s/g, "").replace(/€/g, "").replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(","); const lastDot = s.lastIndexOf(".");
  const hasComma = lastComma !== -1; const hasDot = lastDot !== -1;
  if (hasComma && hasDot) {
    const decimalIsComma = lastComma > lastDot;
    const decimalSep = decimalIsComma ? "," : "."; const thousandSep = decimalIsComma ? "." : ",";
    s = s.replace(new RegExp("\\" + thousandSep, "g"), "").replace(decimalSep, ".");
    const n = Number(s); return Number.isFinite(n) ? n : 0;
  }
  const sep = hasComma ? "," : hasDot ? "." : "";
  if (!sep) { const n = Number(s); return Number.isFinite(n) ? n : 0; }
  const digitsAfter = s.length - s.lastIndexOf(sep) - 1;
  if (digitsAfter >= 1 && digitsAfter <= 2) { s = s.replace(sep, "."); const n = Number(s); return Number.isFinite(n) ? n : 0; }
  s = s.replace(new RegExp("\\" + sep, "g"), ""); const n = Number(s); return Number.isFinite(n) ? n : 0;
}

function formatEUR(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// Normalise une clé CSV : minuscules, sans accents, sans caractères spéciaux
function normalizeKey(k: string): string {
  return k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function pickKey(obj: Record<string, any>, candidates: string[]): string {
  const keys = Object.keys(obj ?? {});
  const normKeys = keys.map(k => normalizeKey(k));
  const normCandidates = candidates.map(c => normalizeKey(c));
  // Exact match
  for (const c of normCandidates) {
    const idx = normKeys.findIndex(k => k === c);
    if (idx !== -1) return keys[idx];
  }
  // Starts with
  for (const c of normCandidates) {
    const idx = normKeys.findIndex(k => k.startsWith(c));
    if (idx !== -1) return keys[idx];
  }
  // Contains (avec exclusions pour éviter les faux positifs)
  for (const c of normCandidates) {
    const idx = normKeys.findIndex(k => {
      if (c === "nom" && (k.includes("prenom") || k.includes("firstname") || k.includes("first"))) return false;
      if (c === "last" && k.includes("first")) return false;
      return k.includes(c);
    });
    if (idx !== -1) return keys[idx];
  }
  return "";
}

type StoredClient = { email: string; prenom: string; nom: string; total: number };
const STORAGE_KEY = "clientflow_clients";

export default function ImportPage() {
  const { activeWorkspace } = useWorkspace();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detectedKeys, setDetectedKeys] = useState<{ email: string; prenom: string; nom: string; total: string } | null>(null);

  const stats = useMemo(() => {
    const clients = rows.length;
    const totalKey = detectedKeys?.total ?? pickKey(rows[0] ?? {}, ["total", "montant", "amount", "ca", "chiffre", "spent", "revenue", "prix"]);
    const ca = totalKey ? rows.reduce((acc, r) => acc + moneyToNumber(r[totalKey] ?? ""), 0) : 0;
    const panier = clients > 0 ? ca / clients : 0;
    return { clients, ca, panier };
  }, [rows, detectedKeys]);

  async function onPickFile(file: File | null) {
    if (!file) return;
    setPending(true); setSaved(false);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setRows(parsed);
      setFileName(file.name);
      if (parsed.length > 0) {
        const sample = parsed[0];
        setDetectedKeys({
          email:  pickKey(sample, ["email", "mail", "courriel"]),
          prenom: pickKey(sample, ["prenom", "prénom", "firstname", "first_name", "first name", "givenname", "forename", "first"]),
          nom:    pickKey(sample, ["nom", "lastname", "last_name", "last name", "surname", "familyname", "family_name", "last"]),
          total:  pickKey(sample, ["total", "montant", "amount", "ca", "chiffre", "spent", "revenue", "prix"]),
        });
      }
    } finally { setPending(false); }
  }

  function reset() { setRows([]); setFileName(""); setSaved(false); setDetectedKeys(null); }

  async function confirmImport() {
    if (!rows.length) return;
    if (!activeWorkspace) { alert("Aucun workspace sélectionné."); return; }

    let { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) { alert("Erreur auth."); return; }
    if (!sessionData.session) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) { alert("Session expirée."); return; }
      sessionData = refreshed;
    }
    const session = sessionData.session;
    if (!session) { window.location.href = "/login"; return; }
    const userId = session.user.id;
    const workspaceId = activeWorkspace.id;

    const sample = rows[0] ?? {};
    const emailKey  = detectedKeys?.email  ?? pickKey(sample, ["email", "mail", "courriel"]);
    const prenomKey = detectedKeys?.prenom ?? pickKey(sample, ["prenom", "prénom", "firstname", "first_name", "first name", "givenname", "forename", "first"]);
    const nomKey    = detectedKeys?.nom    ?? pickKey(sample, ["nom", "lastname", "last_name", "last name", "surname", "familyname", "family_name", "last"]);
    const totalKey  = detectedKeys?.total  ?? pickKey(sample, ["total", "montant", "amount", "ca", "chiffre", "spent", "revenue", "prix"]);

    const clientsPayload = rows.map(r => ({
      user_id: userId,
      workspace_id: workspaceId,
      email:  emailKey  ? (String(r[emailKey]  ?? "").trim() || null) : null,
      prenom: prenomKey ? (String(r[prenomKey] ?? "").trim() || null) : null,
      nom:    nomKey    ? (String(r[nomKey]    ?? "").trim() || null) : null,
    }));

    const { data: insertedClients, error: clientsError } = await supabase
      .from("clients").insert(clientsPayload).select("id, email");
    if (clientsError) { alert(`Erreur import clients: ${clientsError.message}`); return; }

    if (totalKey && insertedClients && insertedClients.length > 0) {
      const emailToId = new Map<string, string>();
      for (const c of insertedClients) { if (c.email) emailToId.set(c.email.toLowerCase(), c.id); }
      const salesPayload = rows.map(r => {
        const amount = moneyToNumber(String(r[totalKey] ?? ""));
        if (!(amount > 0)) return null;
        const email = String(emailKey ? r[emailKey] ?? "" : "").toLowerCase().trim();
        return { user_id: userId, workspace_id: workspaceId, client_id: emailToId.get(email) ?? null, amount, created_at: new Date().toISOString() };
      }).filter(Boolean);
      if (salesPayload.length > 0) {
        const { error: salesError } = await supabase.from("sales").insert(salesPayload);
        if (salesError) { alert(`Clients importés ✅ mais erreur ventes: ${salesError.message}`); setSaved(true); return; }
      }
    }

    try {
      const stored: StoredClient[] = rows.map(r => ({
        email:  emailKey  ? String(r[emailKey]  ?? "") : "",
        prenom: prenomKey ? String(r[prenomKey] ?? "") : "",
        nom:    nomKey    ? String(r[nomKey]    ?? "") : "",
        total:  totalKey  ? moneyToNumber(String(r[totalKey] ?? "")) : 0,
      }));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {}

    setSaved(true);
  }

  const canConfirm = rows.length > 0 && !pending && !!activeWorkspace;

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Import</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Import Clients</h1>
          <p className="ds-subtitle">
            Importe un fichier CSV pour ajouter des clients et leurs ventes
            {activeWorkspace
              ? <> — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong></>
              : <span style={{ color: "rgba(255,120,80,0.8)" }}> — ⚠️ Aucun workspace sélectionné</span>}
          </p>
        </div>
      </div>

      <div className="ds-stats-grid">
        <div className="ds-stat-card"><div className="ds-stat-label">CA Total</div><div className="ds-stat-value">{formatEUR(stats.ca)}</div></div>
        <div className="ds-stat-card"><div className="ds-stat-label">Panier moyen</div><div className="ds-stat-value">{formatEUR(stats.panier)}</div></div>
        <div className="ds-stat-card"><div className="ds-stat-label">Clients détectés</div><div className="ds-stat-value">{stats.clients}</div></div>
      </div>

      {!activeWorkspace && (
        <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,120,80,0.07)", border: "1px solid rgba(255,120,80,0.20)", color: "rgba(255,160,120,0.95)", fontWeight: 700, fontSize: 14 }}>
          ⚠️ Sélectionne une boutique dans le menu à gauche avant d'importer.
        </div>
      )}

      <div className="ds-card">
        <div className="ds-card-head">
          <div>
            <div className="ds-card-title">Import CSV</div>
            <div className="ds-card-sub">Colonnes détectées automatiquement — email, prénom, nom, montant.</div>
          </div>
        </div>

        <div className="im-row">
          <label className="im-upload-btn">
            <span>📂 Choisir un CSV</span>
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => onPickFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="im-file-pill">
            {saved ? <div className="im-file-icon im-success">✓</div> : fileName ? <div className="im-file-icon">📄</div> : <div className="im-file-icon im-empty">—</div>}
            <div className="im-file-info">
              <div className="im-file-name">{fileName || "Aucun fichier sélectionné"}</div>
              <div className="im-file-sub">
                {pending ? "Analyse en cours…" : saved ? `${rows.length} clients importés avec succès ✅` : fileName ? `${rows.length} ligne(s) détectée(s) · prêt à importer` : "Sélectionne un fichier CSV pour commencer"}
              </div>
            </div>
          </div>
          <div className="im-actions">
            <button className="ds-btn ds-btn-ghost" type="button" onClick={reset} disabled={!fileName && rows.length === 0}>Réinitialiser</button>
            <button className="im-confirm-btn" type="button" disabled={!canConfirm} onClick={confirmImport}>
              {pending ? "Chargement…" : "Confirmer l'import"}
            </button>
          </div>
        </div>

        {/* Colonnes détectées */}
        {detectedKeys && rows.length > 0 && !saved && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(120,160,255,0.06)", border: "1px solid rgba(120,160,255,0.15)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(120,160,255,0.9)", marginBottom: 8, letterSpacing: 0.5 }}>COLONNES DÉTECTÉES</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "Email",   val: detectedKeys.email },
                { label: "Prénom",  val: detectedKeys.prenom },
                { label: "Nom",     val: detectedKeys.nom },
                { label: "Montant", val: detectedKeys.total },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: val ? "rgba(120,220,120,0.08)" : "rgba(255,120,80,0.08)", border: `1px solid ${val ? "rgba(120,220,120,0.20)" : "rgba(255,120,80,0.20)"}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: val ? "rgba(120,220,120,0.9)" : "rgba(255,120,80,0.9)" }}>{label}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{val ? `→ "${val}"` : "non trouvé"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {rows.length > 0 && !saved && (
          <div style={{ marginTop: 20 }}>
            <div className="ds-card-sub" style={{ marginBottom: 10 }}>Aperçu — {Math.min(rows.length, 5)} première(s) ligne(s) sur {rows.length}</div>
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead><tr>{Object.keys(rows[0]).map(k => <th key={k}>{k}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>{Object.values(r).map((v, j) => <td key={j} className="ds-mono">{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {saved && (
          <div className="im-success-banner">
            <span className="im-success-icon">✅</span>
            <div>
              <div className="im-success-title">Import réussi !</div>
              <div className="im-success-sub">{rows.length} clients et leurs ventes ont été ajoutés à <strong>{activeWorkspace?.name}</strong>.</div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .im-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 16px; }
        .im-upload-btn { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.90); font-weight: 800; font-size: 14px; cursor: pointer; white-space: nowrap; transition: background 120ms, border-color 120ms; }
        .im-upload-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.20); }
        .im-file-pill { flex: 1; min-width: 200px; display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 16px; border-radius: 14px; background: rgba(10,11,14,0.65); border: 1px solid rgba(255,255,255,0.08); }
        .im-file-icon { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); }
        .im-file-icon.im-empty { opacity: 0.35; }
        .im-file-icon.im-success { background: rgba(120,220,120,0.12); border-color: rgba(120,220,120,0.25); color: rgba(120,220,120,0.95); font-weight: 900; }
        .im-file-info { min-width: 0; }
        .im-file-name { font-weight: 800; font-size: 14px; color: rgba(255,255,255,0.92); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .im-file-sub { font-size: 12px; opacity: 0.55; color: rgba(255,255,255,0.9); margin-top: 2px; }
        .im-actions { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
        .im-confirm-btn { height: 44px; padding: 0 20px; border-radius: 12px; background: rgba(120,160,255,0.16); border: 1px solid rgba(120,160,255,0.40); color: rgba(255,255,255,0.95); font-weight: 800; font-size: 14px; cursor: pointer; transition: background 120ms, border-color 120ms, opacity 120ms; white-space: nowrap; }
        .im-confirm-btn:hover:not(:disabled) { background: rgba(120,160,255,0.22); border-color: rgba(120,160,255,0.55); }
        .im-confirm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .im-success-banner { display: flex; align-items: center; gap: 14px; margin-top: 20px; padding: 16px 20px; border-radius: 14px; background: rgba(120,220,120,0.06); border: 1px solid rgba(120,220,120,0.18); }
        .im-success-icon { font-size: 24px; flex-shrink: 0; }
        .im-success-title { font-weight: 900; font-size: 15px; color: rgba(120,220,120,0.95); }
        .im-success-sub { font-size: 13px; opacity: 0.7; color: rgba(255,255,255,0.9); margin-top: 2px; }
      `}</style>
    </div>
  );
}