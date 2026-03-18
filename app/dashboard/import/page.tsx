"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/lib/workspaceContext";

// ---------------------------------------------------------------------------
// CSV utilities (preserved from original)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Step = "upload" | "detecting" | "mapping" | "importing" | "done";
type CFField =
  | "prenom"
  | "nom"
  | "nom_complet"
  | "email"
  | "telephone"
  | "date_naissance"
  | "adresse"
  | "montant_achat"
  | "date_achat"
  | "produit_achat"
  | "notes"
  | "ignorer";

const CF_FIELDS: { value: CFField; label: string; color?: string }[] = [
  { value: "ignorer",        label: "— Ignorer" },
  { value: "prenom",         label: "Prénom",              color: "rgba(120,220,200,0.9)" },
  { value: "nom",            label: "Nom",                 color: "rgba(120,220,200,0.9)" },
  { value: "nom_complet",    label: "Prénom + Nom",        color: "rgba(80,210,160,0.9)" },
  { value: "email",          label: "Email",               color: "rgba(99,120,255,0.9)" },
  { value: "telephone",      label: "Téléphone",           color: "rgba(160,130,255,0.9)" },
  { value: "date_naissance", label: "Date de naissance",   color: "rgba(255,180,60,0.9)" },
  { value: "adresse",        label: "Adresse",             color: "rgba(255,160,80,0.9)" },
  { value: "montant_achat",  label: "Montant achat (€)",   color: "rgba(80,210,140,0.9)" },
  { value: "date_achat",     label: "Date d'achat",        color: "rgba(255,180,60,0.9)" },
  { value: "produit_achat",  label: "Produit acheté",      color: "rgba(200,160,255,0.9)" },
  { value: "notes",          label: "Notes",               color: "rgba(255,255,255,0.5)" },
];

interface ImportReport {
  imported: number;
  merged: number;
  skipped: number;
  errors: number;
  salesInserted: number;
  errorDetails: string[];
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

async function readFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (utf8.includes("\uFFFD")) {
    return new TextDecoder("iso-8859-1").decode(buffer);
  }
  return utf8;
}

function parseDate(s: string): string | null {
  if (!s?.trim()) return null;
  const raw = s.trim();
  // Strip time component (e.g. "2024-03-15 14:30" or "2024-03-15T14:30:00Z")
  const dateOnly = raw.split(/[\sT]/)[0];
  const parts = dateOnly.split(/[\/\-\.]/);
  if (parts.length < 3) {
    // Fallback: let JS parse it (handles ISO 8601 etc.)
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return null;
  }
  const p = parts.map(Number);
  let day: number, month: number, year: number;
  if (parts[0].length === 4) {
    // YYYY-MM-DD
    [year, month, day] = p;
  } else {
    year = p[2];
    if (year < 100) year += year < 50 ? 2000 : 1900;
    // Disambiguate DD/MM vs MM/DD: if first part > 12 → must be day
    if (p[0] > 12) { day = p[0]; month = p[1]; }
    else if (p[1] > 12) { month = p[0]; day = p[1]; } // MM/DD/YYYY
    else { day = p[0]; month = p[1]; } // French default: DD/MM
  }
  if (!day || !month || !year) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildHeuristicMapping(hdrs: string[], sample: ParsedRow): Record<string, CFField> {
  const result: Record<string, CFField> = {};
  for (const h of hdrs) {
    const norm = normalizeKey(h);
    const val = sample[h] ?? "";
    // Email: check both header name and sample content
    if (
      norm.includes("email") || norm.includes("mail") || norm.includes("courriel") ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
    ) {
      result[h] = "email"; continue;
    }
    if (norm.includes("nomcomplet") || norm.includes("fullname") || norm.includes("nom_complet") || norm.includes("clientname") || norm === "client" || norm === "name") {
      result[h] = "nom_complet"; continue;
    }
    if (
      norm === "prenom" || norm === "firstname" || norm.startsWith("prenom") ||
      norm === "givenname" || norm === "first"
    ) {
      result[h] = "prenom"; continue;
    }
    if (
      (norm === "nom" || norm === "lastname" || norm === "surname" || norm === "familyname") &&
      !norm.includes("prenom")
    ) {
      result[h] = "nom"; continue;
    }
    if (norm.includes("tel") || norm.includes("phone") || norm.includes("mobile") || norm.includes("portable")) {
      result[h] = "telephone"; continue;
    }
    if (norm.includes("naissance") || norm.includes("birth") || norm.includes("dob")) {
      result[h] = "date_naissance"; continue;
    }
    if (norm.includes("adresse") || norm.includes("address") || norm.includes("ville") || norm.includes("city")) {
      result[h] = "adresse"; continue;
    }
    if (
      norm.includes("montant") || norm.includes("total") || norm.includes("amount") ||
      norm.includes("ca") || norm.includes("spent") || norm.includes("prix")
    ) {
      result[h] = "montant_achat"; continue;
    }
    if (norm.includes("dateachat") || norm.includes("datecommande") || norm.includes("orderdate")) {
      result[h] = "date_achat"; continue;
    }
    if (norm.includes("produit") || norm.includes("product") || norm.includes("article")) {
      result[h] = "produit_achat"; continue;
    }
    if (norm.includes("note") || norm.includes("comment") || norm.includes("remarque")) {
      result[h] = "notes"; continue;
    }
    result[h] = "ignorer";
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ImportPage() {
  const { activeWorkspace } = useWorkspace();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, CFField>>({});
  const [aiUsed, setAiUsed] = useState(false);
  const [detectError, setDetectError] = useState("");
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [report, setReport] = useState<ImportReport | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [manualMode, setManualMode] = useState(false);

  async function onPickFile(file: File | null) {
    if (!file) return;
    setStep("detecting");
    setDetectError("");
    setAiUsed(false);
    setReport(null);

    try {
      const text = await readFileText(file);
      const parsed = parseCSV(text);
      if (!parsed.length) {
        setDetectError("Fichier vide ou format non reconnu.");
        setStep("upload");
        return;
      }

      const hdrs = Object.keys(parsed[0]);
      const sample = parsed.slice(0, 3).map(r => hdrs.map(h => r[h] ?? ""));
      const limitedRows = parsed.slice(0, 1000);

      setRows(limitedRows);
      setHeaders(hdrs);
      setFileName(file.name);

      let detectedMapping: Record<string, CFField> = {};

      // Try AI detection
      try {
        const res = await fetch("/api/detect-columns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ headers: hdrs, sample }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.mapping && typeof data.mapping === "object") {
            detectedMapping = data.mapping as Record<string, CFField>;
            setAiUsed(true);
          }
        }
      } catch {}

      // Fill unmapped columns with heuristics
      const heuristic = buildHeuristicMapping(hdrs, parsed[0] ?? {});
      for (const h of hdrs) {
        if (!detectedMapping[h] || !CF_FIELDS.find(f => f.value === detectedMapping[h])) {
          detectedMapping[h] = heuristic[h] ?? "ignorer";
        }
      }

      setMapping(detectedMapping);
      setManualMode(false);
      setStep("mapping");
    } catch (e: any) {
      setDetectError(e?.message ?? "Erreur de lecture du fichier.");
      setStep("upload");
    }
  }

  async function runImport() {
    if (!activeWorkspace) return;
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) { window.location.href = "/login"; return; }

    setStep("importing");
    setImportProgress({ done: 0, total: rows.length });

    const rpt: ImportReport = { imported: 0, merged: 0, skipped: 0, errors: 0, salesInserted: 0, errorDetails: [] };

    // Helper: find first column mapped to a given CF field
    const colFor = (field: CFField): string | undefined =>
      Object.entries(mapping).find(([, v]) => v === field)?.[0];

    const prenomCol      = colFor("prenom");
    const nomCol         = colFor("nom");
    const nomCompletCol  = colFor("nom_complet");
    const emailCol       = colFor("email");
    const phoneCol     = colFor("telephone");
    const dobCol       = colFor("date_naissance");
    const adresseCol   = colFor("adresse");
    const notesCol     = colFor("notes");
    const montantCol   = colFor("montant_achat");
    const dateAchatCol = colFor("date_achat");
    const produitCol   = colFor("produit_achat");

    // Fetch existing clients by email for dedup
    const { data: existingClients } = await supabase
      .from("clients").select("id, email").eq("workspace_id", activeWorkspace.id);
    const existingEmailMap = new Map<string, string>();
    for (const c of existingClients ?? []) {
      if (c.email) existingEmailMap.set(c.email.toLowerCase().trim(), c.id);
    }

    // Separate rows: new clients vs merges
    const newRows: { row: ParsedRow; payload: Record<string, any> }[] = [];
    const mergedRows: { row: ParsedRow; clientId: string }[] = [];

    for (const row of rows) {
      const email = emailCol ? (row[emailCol] ?? "").trim().toLowerCase() || null : null;
      if (email && existingEmailMap.has(email)) {
        mergedRows.push({ row, clientId: existingEmailMap.get(email)! });
        rpt.merged++;
        continue;
      }
      let prenom = prenomCol ? (row[prenomCol] ?? "").trim() || null : null;
      let nom = nomCol ? (row[nomCol] ?? "").trim() || null : null;
      // Split nom_complet: first word = prenom, rest = nom
      if (nomCompletCol && (row[nomCompletCol] ?? "").trim()) {
        const parts = (row[nomCompletCol] ?? "").trim().split(/\s+/);
        if (!prenom) prenom = parts[0] || null;
        if (!nom) nom = parts.length > 1 ? parts.slice(1).join(" ") : null;
      }
      if (!prenom && !nom && !email) { rpt.skipped++; continue; }

      const noteParts: string[] = [];
      if (phoneCol && (row[phoneCol] ?? "").trim()) noteParts.push(`Tél : ${row[phoneCol].trim()}`);
      if (adresseCol && (row[adresseCol] ?? "").trim()) noteParts.push(`Adresse : ${row[adresseCol].trim()}`);
      if (notesCol && (row[notesCol] ?? "").trim()) noteParts.push(row[notesCol].trim());

      const payload: Record<string, any> = {
        user_id: userId,
        workspace_id: activeWorkspace.id,
        prenom,
        nom,
        email: email || null,
      };
      const dob = dobCol ? parseDate(row[dobCol] ?? "") : null;
      if (dob) payload.birthdate = dob;
      if (noteParts.length) payload.notes = noteParts.join(" · ");

      newRows.push({ row, payload });
    }

    // Batch insert new clients (50 per batch)
    const BATCH = 50;
    const insertedIdMap = new Map<number, string>(); // index in newRows → client id

    for (let i = 0; i < newRows.length; i += BATCH) {
      const batch = newRows.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("clients")
        .insert(batch.map(b => b.payload))
        .select("id, email");

      if (error) {
        rpt.errors += batch.length;
        if (!rpt.errorDetails.includes(error.message)) rpt.errorDetails.push(error.message);
      } else {
        rpt.imported += (data ?? []).length;
        for (let j = 0; j < (data ?? []).length; j++) {
          const id = data![j]?.id;
          if (id) {
            insertedIdMap.set(i + j, id);
            const em = data![j]?.email;
            if (em) existingEmailMap.set(em.toLowerCase(), id);
          }
        }
      }
      setImportProgress({ done: i + batch.length, total: rows.length });
    }

    // Insert sales + sale_products if montant_achat is mapped
    if (montantCol) {
      // Fetch products from workspace for product name → id/price lookup
      const { data: workspaceProducts } = await supabase
        .from("products").select("id, name, price").eq("workspace_id", activeWorkspace.id);
      const productMap = new Map<string, { id: string; price: number }>();
      for (const p of workspaceProducts ?? []) {
        if (p.name) productMap.set(p.name.toLowerCase().trim(), { id: p.id, price: p.price ?? 0 });
      }

      // Helper: build a sale row
      function buildSaleRow(row: ParsedRow, clientId: string | null) {
        const amount = moneyToNumber(row[montantCol!] ?? "");
        if (!(amount > 0)) return null;
        const rawDate = dateAchatCol ? (row[dateAchatCol] ?? "").trim() : "";
        const parsedISO = rawDate ? parseDate(rawDate) : null;
        const createdAt = parsedISO
          ? new Date(`${parsedISO}T12:00:00`).toISOString() // midi pour éviter décalage UTC
          : new Date().toISOString();
        const prodName = produitCol ? (row[produitCol] ?? "").trim() || null : null;
        const product = prodName ? productMap.get(prodName.toLowerCase().trim()) : undefined;
        return {
          salePayload: {
            user_id: userId,
            workspace_id: activeWorkspace!.id,
            client_id: clientId,
            amount,
            created_at: createdAt,
            product_id: product?.id ?? null,
            product_name: prodName,
          },
          productLink: product ? { product_id: product.id, product_name: prodName!, price: product.price, quantity: 1 } : null,
        };
      }

      // Collect all sale rows (new clients + merged)
      const allSaleRows: { salePayload: Record<string, any>; productLink: { product_id: string; product_name: string; price: number; quantity: number } | null }[] = [];
      for (let i = 0; i < newRows.length; i++) {
        const built = buildSaleRow(newRows[i].row, insertedIdMap.get(i) ?? null);
        if (built) allSaleRows.push(built);
      }
      for (const { row, clientId } of mergedRows) {
        const built = buildSaleRow(row, clientId);
        if (built) allSaleRows.push(built);
      }

      // Batch insert sales and collect returned IDs
      const insertedSaleIds: string[] = [];
      for (let i = 0; i < allSaleRows.length; i += BATCH) {
        const batch = allSaleRows.slice(i, i + BATCH);
        const { data: inserted, error } = await supabase
          .from("sales")
          .insert(batch.map(r => r.salePayload))
          .select("id");
        if (error) {
          if (!rpt.errorDetails.includes(`Ventes: ${error.message}`)) rpt.errorDetails.push(`Ventes: ${error.message}`);
        } else {
          rpt.salesInserted += (inserted ?? []).length;
          for (const s of inserted ?? []) insertedSaleIds.push(s.id);
        }
      }

      // Insert sale_products for sales that matched a product
      const spPayload: Record<string, any>[] = [];
      for (let i = 0; i < allSaleRows.length; i++) {
        const saleId = insertedSaleIds[i];
        const link = allSaleRows[i].productLink;
        if (saleId && link) {
          spPayload.push({ sale_id: saleId, ...link });
        }
      }
      for (let i = 0; i < spPayload.length; i += BATCH) {
        const { error } = await supabase.from("sale_products").insert(spPayload.slice(i, i + BATCH));
        if (error && !rpt.errorDetails.includes(`Produits vente: ${error.message}`)) {
          rpt.errorDetails.push(`Produits vente: ${error.message}`);
        }
      }
    }

    setReport(rpt);
    setStep("done");
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setRows([]);
    setHeaders([]);
    setMapping({});
    setAiUsed(false);
    setDetectError("");
    setReport(null);
    setFileInputKey(k => k + 1);
  }

  // Computed values for mapping step
  const mappedCount = headers.filter(h => mapping[h] && mapping[h] !== "ignorer").length;
  const progressPct = importProgress.total > 0
    ? Math.round(importProgress.done / importProgress.total * 100)
    : 0;

  return (
    <div className="ds-page">
      {/* Header */}
      <div className="ds-topline">Dashboard / Import</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Import Clients</h1>
          <p className="ds-subtitle">
            Import intelligent CSV avec détection IA des colonnes
            {activeWorkspace
              ? <> — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong></>
              : <span style={{ color: "rgba(255,120,80,0.8)" }}> — Aucun workspace</span>}
          </p>
        </div>
        {step !== "upload" && (
          <button className="ds-btn ds-btn-ghost" type="button" onClick={reset}>
            Réinitialiser
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Step: done — stats grid at top                                       */}
      {/* ------------------------------------------------------------------ */}
      {step === "done" && report && (
        <div className="ds-stats-grid">
          <div className="ds-stat-card">
            <div className="ds-stat-label">Importés</div>
            <div className="ds-stat-value" style={{ color: "rgba(120,220,120,0.95)" }}>{report.imported}</div>
          </div>
          <div className="ds-stat-card">
            <div className="ds-stat-label">Fusionnés</div>
            <div className="ds-stat-value" style={{ color: "rgba(99,120,255,0.95)" }}>{report.merged}</div>
          </div>
          <div className="ds-stat-card">
            <div className="ds-stat-label">Ignorés</div>
            <div className="ds-stat-value" style={{ color: "rgba(255,180,60,0.95)" }}>{report.skipped}</div>
          </div>
          <div className="ds-stat-card">
            <div className="ds-stat-label">Erreurs</div>
            <div className="ds-stat-value" style={{ color: report.errors > 0 ? "rgba(255,90,90,0.95)" : "rgba(255,255,255,0.4)" }}>{report.errors}</div>
          </div>
          {report.salesInserted > 0 && (
            <div className="ds-stat-card">
              <div className="ds-stat-label">Achats importés</div>
              <div className="ds-stat-value" style={{ color: "rgba(80,210,140,0.95)" }}>{report.salesInserted}</div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step: upload                                                         */}
      {/* ------------------------------------------------------------------ */}
      {step === "upload" && (
        <div className="ds-card">
          <div className="ds-card-head">
            <div>
              <div className="ds-card-title">Import CSV</div>
              <div className="ds-card-sub">Détection automatique des colonnes par IA · UTF-8 et Latin-1 · séparateur , ou ;</div>
            </div>
          </div>

          <label
            className="im-upload-zone"
            style={{
              border: "2px dashed rgba(99,120,255,0.30)",
              borderRadius: 18,
              padding: "48px 32px",
              textAlign: "center",
              background: "rgba(99,120,255,0.03)",
              cursor: "pointer",
              transition: "border-color 150ms, background 150ms",
              display: "block",
              marginTop: 20,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "rgba(255,255,255,0.92)", marginBottom: 8 }}>
              Importer un fichier CSV
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>
              Détection automatique des colonnes par IA · UTF-8 et Latin-1 · séparateur , ou ;
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 24px",
                borderRadius: 12,
                background: "rgba(99,120,255,0.15)",
                border: "1px solid rgba(99,120,255,0.35)",
                color: "rgba(255,255,255,0.92)",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              Choisir un fichier
            </div>
            <input
              key={fileInputKey}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={e => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {detectError && (
            <div style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(255,80,80,0.07)",
              border: "1px solid rgba(255,80,80,0.20)",
              color: "rgba(255,120,120,0.95)",
              fontWeight: 600,
              fontSize: 13,
            }}>
              {detectError}
            </div>
          )}

          <div style={{ marginTop: 24, padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.35)", letterSpacing: 0.8, marginBottom: 10 }}>
              FORMATS ACCEPTÉS
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CF_FIELDS.filter(f => f.value !== "ignorer").map(f => (
                <span
                  key={f.value}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: "rgba(99,120,255,0.08)",
                    border: "1px solid rgba(99,120,255,0.18)",
                    fontSize: 12,
                    color: "rgba(160,180,255,0.85)",
                    fontWeight: 600,
                  }}
                >
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step: detecting                                                      */}
      {/* ------------------------------------------------------------------ */}
      {step === "detecting" && (
        <div className="ds-card" style={{ textAlign: "center", padding: "56px 32px" }}>
          <div className="im-spinner" />
          <div style={{ fontWeight: 800, fontSize: 18, color: "rgba(255,255,255,0.92)", marginBottom: 10 }}>
            Analyse IA en cours...
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
            Claude analyse vos colonnes pour mapper automatiquement les champs
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step: mapping                                                        */}
      {/* ------------------------------------------------------------------ */}
      {step === "mapping" && (
        <div className="ds-card">
          <div className="ds-card-head">
            <div>
              <div className="ds-card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {manualMode ? "Modifier le mapping" : "Mapping détecté"}
                {aiUsed && !manualMode && (
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 20, background: "rgba(99,120,255,0.15)", border: "1px solid rgba(99,120,255,0.35)", color: "rgba(160,180,255,0.95)", letterSpacing: 0.3 }}>✨ IA</span>
                )}
              </div>
              <div className="ds-card-sub">
                {fileName} · {rows.length} ligne{rows.length !== 1 ? "s" : ""} · {mappedCount} colonne{mappedCount !== 1 ? "s" : ""} mappée{mappedCount !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          <div className="ds-table-wrap" style={{ marginTop: 20 }}>
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Colonne CSV</th>
                  <th>Aperçu</th>
                  <th style={{ minWidth: manualMode ? 200 : 160 }}>→ Champ ClientFlow</th>
                </tr>
              </thead>
              <tbody>
                {headers.map(h => {
                  const mapped = mapping[h] ?? "ignorer";
                  const isIgnored = mapped === "ignorer";
                  const fieldInfo = CF_FIELDS.find(f => f.value === mapped);
                  const sample1 = rows[0]?.[h] ?? "";
                  const sample2 = rows[1]?.[h] ?? "";
                  return (
                    <tr key={h} style={{ opacity: isIgnored ? 0.38 : 1, transition: "opacity 150ms" }}>
                      <td>
                        <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.88)", fontSize: 13 }}>{h}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {sample1 ? (
                            <span className="ds-mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)" }}>
                              {sample1.length > 32 ? sample1.slice(0, 32) + "…" : sample1}
                            </span>
                          ) : null}
                          {sample2 ? (
                            <span className="ds-mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.03)" }}>
                              {sample2.length > 32 ? sample2.slice(0, 32) + "…" : sample2}
                            </span>
                          ) : null}
                          {!sample1 && !sample2 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>—</span>}
                        </div>
                      </td>
                      <td>
                        {manualMode ? (
                          <select
                            value={mapped}
                            onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value as CFField }))}
                            style={{ height: 34, padding: "0 10px", borderRadius: 8, background: "rgba(10,11,14,0.80)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.12)", outline: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" }}
                          >
                            {CF_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                        ) : (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                            background: isIgnored ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.25)",
                            border: `1px solid ${isIgnored ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.10)"}`,
                            color: fieldInfo?.color ?? "rgba(255,255,255,0.30)",
                          }}>
                            {fieldInfo?.label ?? "Ignorer"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                {rows.length} ligne{rows.length !== 1 ? "s" : ""} prêtes à l'import
                {rows.length === 1000 && <span style={{ marginLeft: 8, color: "rgba(255,180,60,0.8)", fontWeight: 600 }}>(limité à 1000)</span>}
              </div>
              <button
                type="button"
                onClick={() => setManualMode(m => !m)}
                style={{ background: "none", border: "none", padding: 0, color: "rgba(99,120,255,0.60)", fontSize: 12, cursor: "pointer", textDecoration: "underline", textAlign: "left", fontWeight: 600 }}
              >
                {manualMode ? "← Retour au résumé" : "Modifier le mapping manuellement"}
              </button>
            </div>
            {activeWorkspace ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={reset} style={{ height: 48, padding: "0 20px", borderRadius: 14, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Annuler</button>
                <button
                  type="button"
                  onClick={runImport}
                  style={{ height: 48, padding: "0 32px", borderRadius: 14, background: "linear-gradient(135deg, rgba(99,120,255,0.32), rgba(99,120,255,0.20))", border: "1px solid rgba(99,120,255,0.55)", color: "rgba(255,255,255,0.97)", fontWeight: 800, fontSize: 15, cursor: "pointer", letterSpacing: 0.2 }}
                >
                  Confirmer l'import ({rows.length})
                </button>
              </div>
            ) : (
              <div style={{ padding: "12px 20px", borderRadius: 12, background: "rgba(255,120,80,0.07)", border: "1px solid rgba(255,120,80,0.20)", color: "rgba(255,160,120,0.95)", fontWeight: 700, fontSize: 13 }}>
                Sélectionne un workspace pour importer
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step: importing                                                      */}
      {/* ------------------------------------------------------------------ */}
      {step === "importing" && (
        <div className="ds-card" style={{ padding: "40px 32px" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "rgba(255,255,255,0.92)", marginBottom: 8 }}>
            Import en cours...
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
            {importProgress.done} / {importProgress.total} lignes traitées
          </div>
          <div
            style={{
              height: 12,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
              marginTop: 16,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #6378ff, #818cf8)",
                borderRadius: 999,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(99,120,255,0.7)", fontWeight: 700 }}>
            {progressPct}%
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step: done                                                           */}
      {/* ------------------------------------------------------------------ */}
      {step === "done" && report && (
        <div className="ds-card">
          <div className="ds-card-head">
            <div>
              <div className="ds-card-title" style={{ color: "rgba(120,220,120,0.95)" }}>
                Import terminé
              </div>
              <div className="ds-card-sub">{fileName}</div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(120,220,120,0.07)", border: "1px solid rgba(120,220,120,0.18)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(120,220,120,0.7)", letterSpacing: 0.5, marginBottom: 6 }}>IMPORTÉS</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "rgba(120,220,120,0.95)" }}>{report.imported}</div>
              </div>
              <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(99,120,255,0.07)", border: "1px solid rgba(99,120,255,0.18)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(120,160,255,0.7)", letterSpacing: 0.5, marginBottom: 6 }}>FUSIONNÉS</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "rgba(120,160,255,0.95)" }}>{report.merged}</div>
              </div>
              <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,180,60,0.06)", border: "1px solid rgba(255,180,60,0.18)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,180,60,0.7)", letterSpacing: 0.5, marginBottom: 6 }}>IGNORÉS</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "rgba(255,180,60,0.95)" }}>{report.skipped}</div>
              </div>
              <div style={{ padding: "16px 20px", borderRadius: 14, background: report.errors > 0 ? "rgba(255,80,80,0.07)" : "rgba(255,255,255,0.03)", border: `1px solid ${report.errors > 0 ? "rgba(255,80,80,0.20)" : "rgba(255,255,255,0.07)"}` }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: report.errors > 0 ? "rgba(255,120,120,0.7)" : "rgba(255,255,255,0.25)", letterSpacing: 0.5, marginBottom: 6 }}>ERREURS</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: report.errors > 0 ? "rgba(255,120,120,0.95)" : "rgba(255,255,255,0.25)" }}>{report.errors}</div>
              </div>
            </div>

            {report.errorDetails.length > 0 && (
              <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.15)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,120,120,0.8)", letterSpacing: 0.5, marginBottom: 8 }}>DÉTAILS DES ERREURS</div>
                {report.errorDetails.map((err, i) => (
                  <div key={i} style={{ fontSize: 12, color: "rgba(255,160,160,0.75)", marginBottom: 4, fontFamily: "monospace" }}>
                    {err}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  height: 44,
                  padding: "0 24px",
                  borderRadius: 12,
                  background: "rgba(99,120,255,0.15)",
                  border: "1px solid rgba(99,120,255,0.35)",
                  color: "rgba(255,255,255,0.92)",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "background 150ms",
                }}
              >
                Importer un autre fichier
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .im-upload-zone:hover {
          border-color: rgba(99, 120, 255, 0.55) !important;
          background: rgba(99, 120, 255, 0.06) !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .im-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(99, 120, 255, 0.2);
          border-top-color: #6378ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 20px;
        }
        @media (max-width: 640px) {
          .ds-table-wrap {
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
}
