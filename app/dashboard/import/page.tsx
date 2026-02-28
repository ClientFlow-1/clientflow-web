"use client";

import { useMemo, useState } from "react";

type ParsedRow = Record<string, string>;

/** Split CSV line with quote support (") */
function splitCSVLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // Escaped quote ""
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === sep) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

/**
 * Parse CSV robuste:
 * - détecte le meilleur séparateur
 * - supporte guillemets
 * - FIX IMPORTANT: si une ligne a + de colonnes que l'entête, on recolle le surplus dans la dernière colonne.
 *   (cas CSV séparé par "," + décimales "1340,60" sans guillemets)
 */
function parseCSV(text: string): ParsedRow[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!raw) return [];

  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const candidates = [";", ",", "\t"];

  function scoreWithSep(sep: string) {
    const header = splitCSVLine(lines[0], sep).map((h) => h.trim());
    const expected = header.length;
    if (expected <= 1) return { sep, score: -1, header };

    let ok = 0;
    let total = 0;

    for (let i = 1; i < lines.length; i++) {
      let cols = splitCSVLine(lines[i], sep);

      // IMPORTANT: normalisation de la largeur (favorise la cohérence)
      if (cols.length > expected) {
        cols = cols
          .slice(0, expected - 1)
          .concat([cols.slice(expected - 1).join(sep)]);
      } else if (cols.length < expected) {
        cols = cols.concat(Array(expected - cols.length).fill(""));
      }

      if (cols.length === expected) ok++;
      total++;
    }

    const ratio = total > 0 ? ok / total : 0;
    return { sep, score: ratio, header };
  }

  const scored = candidates.map(scoreWithSep).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const order = { ";": 0, ",": 1, "\t": 2 } as const;
    return order[a.sep as ";" | "," | "\t"] - order[b.sep as ";" | "," | "\t"];
  });

  const best = scored[0];
  const sep = best.score >= 0 ? best.sep : ",";

  const headers = splitCSVLine(lines[0], sep).map((h) => h.trim());
  const expected = headers.length;

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    let cols = splitCSVLine(lines[i], sep);

    // FIX IMPORTANT: recoller le surplus dans la dernière colonne
    if (cols.length > expected) {
      cols = cols
        .slice(0, expected - 1)
        .concat([cols.slice(expected - 1).join(sep)]);
    } else if (cols.length < expected) {
      cols = cols.concat(Array(expected - cols.length).fill(""));
    }

    const row: ParsedRow = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });

    const hasData = Object.values(row).some((v) => v !== "");
    if (hasData) rows.push(row);
  }

  return rows;
}

/**
 * Parse robuste pour montants:
 * - "1245", "1 245", "1 245,00", "1.245,00", "1,245.00", "1245.50", "1245,50", "€1,245.00"
 * - si '.' et ',' existent, le dernier est décimal, l'autre = milliers
 */
function moneyToNumber(v: string): number {
  if (!v) return 0;

  let s = String(v)
    .trim()
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace(/[^\d.,-]/g, "");

  if (!s) return 0;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const hasComma = lastComma !== -1;
  const hasDot = lastDot !== -1;

  if (hasComma && hasDot) {
    const decimalIsComma = lastComma > lastDot;
    const decimalSep = decimalIsComma ? "," : ".";
    const thousandSep = decimalIsComma ? "." : ",";

    s = s.replace(new RegExp("\\" + thousandSep, "g"), "");
    s = s.replace(decimalSep, ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  const sep = hasComma ? "," : hasDot ? "." : "";
  if (!sep) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  const idx = s.lastIndexOf(sep);
  const digitsAfter = s.length - idx - 1;

  if (digitsAfter >= 1 && digitsAfter <= 2) {
    s = s.replace(sep, ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  s = s.replace(new RegExp("\\" + sep, "g"), "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatEUR(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// ✅ FIX NOM vs PRENOM: empêche "prenom" de matcher "nom"
function pickKey(obj: Record<string, any>, candidates: string[]) {
  const keys = Object.keys(obj ?? {});
  const lower = keys.map((k) => k.toLowerCase());

  // exact
  for (const c of candidates) {
    const cl = c.toLowerCase();
    const idx = lower.findIndex((k) => k === cl);
    if (idx !== -1) return keys[idx];
  }

  // startsWith
  for (const c of candidates) {
    const cl = c.toLowerCase();
    const idx = lower.findIndex((k) => k.startsWith(cl));
    if (idx !== -1) return keys[idx];
  }

  // includes (avec garde-fou)
  for (const c of candidates) {
    const cl = c.toLowerCase();
    const idx = lower.findIndex((k) => {
      if (cl === "nom" && k.includes("prenom")) return false;
      return k.includes(cl);
    });
    if (idx !== -1) return keys[idx];
  }

  return "";
}

type StoredClient = { email: string; prenom: string; nom: string; total: number };
const STORAGE_KEY = "clientflow_clients";

export default function ImportPage() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const stats = useMemo(() => {
    const clients = rows.length;
    const totalKey = pickKey(rows[0] ?? {}, ["total", "montant", "amount", "ca", "spent"]);
    const ca = totalKey ? rows.reduce((acc, r) => acc + moneyToNumber(r[totalKey] ?? ""), 0) : 0;
    const panier = clients > 0 ? ca / clients : 0;
    return { clients, ca, panier };
  }, [rows]);

  async function onPickFile(file: File | null) {
    if (!file) return;
    setPending(true);
    setSaved(false);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setRows(parsed);
      setFileName(file.name);
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setRows([]);
    setFileName("");
    setSaved(false);
  }

  function confirmImport() {
    if (!rows.length) return;

    const sample = rows[0] ?? {};
    const emailKey = pickKey(sample, ["email", "mail"]);
    const prenomKey = pickKey(sample, ["prenom", "prénom", "firstname", "first name"]);
    const nomKey = pickKey(sample, ["nom", "lastname", "last name", "surname"]);
    const totalKey = pickKey(sample, ["total", "montant", "amount", "ca", "spent"]);

    const clients: StoredClient[] = rows.map((r) => ({
      email: String(emailKey ? r[emailKey] ?? "" : ""),
      prenom: String(prenomKey ? r[prenomKey] ?? "" : ""),
      nom: String(nomKey ? r[nomKey] ?? "" : ""),
      total: totalKey ? moneyToNumber(String(r[totalKey] ?? "")) : 0,
    }));

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    setSaved(true);
  }

  const canConfirm = rows.length > 0 && !pending;

  return (
    <div className="page">
      <div className="crumb">Dashboard</div>

      <div className="page-title">Import Clients</div>
      <div className="page-subtitle">Choisis un CSV, on calcule les stats et on affiche un feedback.</div>

      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-label">CA Total</div>
          <div className="stat-value">{formatEUR(stats.ca)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Panier moyen</div>
          <div className="stat-value">{formatEUR(stats.panier)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Clients importés</div>
          <div className="stat-value">{stats.clients}</div>
        </div>
      </div>

      <div className="card section-card">
        <div className="section-head-row">
          <div>
            <div className="section-title">Import CSV</div>
            <div className="section-subtitle">Choisis un fichier puis confirme l’import</div>
          </div>
        </div>

        <div className="import-row">
          <label className="btn btn-soft">
            Importer un CSV
            <input
              className="file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="file-pill">
            <div className="file-title">{fileName ? fileName : "Aucun fichier importé"}</div>
            <div className="file-sub">
              {pending
                ? "Chargement..."
                : fileName
                ? `${rows.length} ligne(s) détectée(s)`
                : "Sélectionne un CSV pour calculer les stats."}
              {saved ? " • Import confirmé ✅" : ""}
            </div>
          </div>

          <div className="import-actions">
            <button className="btn btn-ghost" type="button" onClick={reset} disabled={!fileName && rows.length === 0}>
              Reset
            </button>

            <button className="btn btn-primary" type="button" disabled={!canConfirm} onClick={confirmImport}>
              Confirmer l’import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}