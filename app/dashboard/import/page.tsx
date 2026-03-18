"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/lib/workspaceContext";
import { detecterColonnes } from "@/lib/detecterColonnes";
import type { DetectionResult } from "@/lib/detecterColonnes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "upload" | "loading" | "done";

interface TransformedRow {
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
  telephone?: string | null;
  montant_achat?: number | null;
  date_achat?: string | null;
  date_naissance?: string | null;
  adresse?: string | null;
  produit_achat?: string | null;
  notes?: string | null;
}

interface ImportReport {
  imported: number;
  merged: number;
  salesCreated: number;
  ignored: number;
  errors: number;
  errorDetails: string[];
}

const LOADING_MESSAGES = [
  "Lecture du fichier…",
  "Détection des colonnes…",
  "Nettoyage des données…",
  "Import en base…",
];

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------

async function readFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (utf8.includes("\uFFFD")) {
    return new TextDecoder("iso-8859-1").decode(buffer);
  }
  return utf8;
}

function detectSeparator(firstLine: string): string {
  const candidates: [string, number][] = [
    [";", firstLine.split(";").length],
    [",", firstLine.split(",").length],
    ["|", firstLine.split("|").length],
    ["\t", firstLine.split("\t").length],
  ];
  return candidates.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function splitCSVLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
      continue;
    }
    if (!inQ && ch === sep) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseCSVToRows(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n").filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const sep = detectSeparator(lines[0]);
  const headers = splitCSVLine(lines[0], sep);
  const expected = headers.length;
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    let cols = splitCSVLine(lines[i], sep);
    if (cols.length > expected) cols = [...cols.slice(0, expected - 1), cols.slice(expected - 1).join(sep)];
    else if (cols.length < expected) cols = [...cols, ...Array(expected - cols.length).fill("")];
    if (cols.some(c => c !== "")) rows.push(cols);
  }
  return { headers, rows };
}

async function parseFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const text = await readFileText(file);
  return parseCSVToRows(text);
}

// ---------------------------------------------------------------------------
// Data cleaning helpers
// ---------------------------------------------------------------------------

function nettoyerNomComplet(valeur: string): { prenom: string | null; nom: string | null } {
  let s = valeur.trim();
  // Remove civilités
  s = s.replace(/\b(M\.|Mme\.?|Mr\.?|Madame|Monsieur|épouse|veuve)\s*/gi, "").trim();
  // Remove parentheses content
  s = s.replace(/\(.*?\)/g, "").trim();
  if (!s) return { prenom: null, nom: null };
  // NOM, Prénom (comma format) → split on comma, invert
  if (s.includes(",")) {
    const [nomPart, ...rest] = s.split(",");
    return {
      prenom: rest.join(",").trim() || null,
      nom: capitalize(nomPart.trim()) || null,
    };
  }
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length === 1) return { prenom: capitalize(words[0]), nom: null };
  // First word ALL CAPS → NOM Prénom format → invert
  if (words[0] === words[0].toUpperCase() && words[0].length > 1) {
    return {
      prenom: words.slice(1).map(capitalize).join(" "),
      nom: capitalize(words[0]),
    };
  }
  return {
    prenom: capitalize(words[0]),
    nom: words.slice(1).map(capitalize).join(" "),
  };
}

function nettoyerMontant(valeur: string): number | null {
  if (!valeur?.trim()) return null;
  let s = valeur
    .trim()
    .replace(/\s/g, "")
    .replace(/\u00a0/g, "")
    .replace(/€|euros?|EUR/gi, "")
    .replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const after = s.length - lastComma - 1;
    s = after <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function nettoyerDate(valeur: string, today: string): string | null {
  if (!valeur?.trim()) return null;
  const s = valeur.trim();
  const t = new Date(today + "T12:00:00");
  const rel = s.toLowerCase();

  if (rel === "hier") return shiftDate(t, -1);
  if (rel === "avant-hier") return shiftDate(t, -2);
  if (rel === "la semaine dernière" || rel === "la semaine derniere") return shiftDate(t, -7);
  if (rel === "le mois dernier") {
    t.setDate(1);
    t.setMonth(t.getMonth() - 1);
    return fmt(t);
  }

  const ilYa = rel.match(/^il y a (\d+)\s*(jour|jours|semaine|semaines|mois)/);
  if (ilYa) {
    const n = parseInt(ilYa[1]);
    if (ilYa[2].startsWith("jour")) return shiftDate(t, -n);
    if (ilYa[2].startsWith("semaine")) return shiftDate(t, -n * 7);
    if (ilYa[2] === "mois") { t.setMonth(t.getMonth() - n); return fmt(t); }
  }

  // Month name + year
  const FR_MONTHS: Record<string, number> = {
    janvier: 1, "f\u00e9vrier": 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, "ao\u00fbt": 8, aout: 8, septembre: 9, octobre: 10, novembre: 11,
    "d\u00e9cembre": 12, decembre: 12,
  };
  const monthYear = rel.match(
    /^(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+(\d{4})$/
  );
  if (monthYear) {
    const mNum = FR_MONTHS[monthYear[1]] ?? FR_MONTHS[monthYear[1].normalize("NFD").replace(/\p{M}/gu, "")];
    if (mNum) return `${monthYear[2]}-${String(mNum).padStart(2, "0")}-01`;
  }

  const noelMatch = rel.match(/^no[eë]l\s+(\d{4})$/);
  if (noelMatch) return `${noelMatch[1]}-12-25`;

  const prefixYear = rel.match(/^(début|debut|mi-?|fin)\s*(\d{4})$/);
  if (prefixYear) {
    const y = prefixYear[2];
    const p = prefixYear[1].replace(/[éè]/g, "e").replace("-", "");
    if (p === "debut") return `${y}-01-01`;
    if (p === "mi") return `${y}-07-01`;
    if (p === "fin") return `${y}-12-01`;
  }

  const eteMatch = rel.match(/^[eé]t[eé]\s+(\d{4})$/);
  if (eteMatch) return `${eteMatch[1]}-07-01`;

  const saisonMatch = rel.match(/^(printemps|automne|hiver)\s+(\d{4})$/);
  if (saisonMatch) {
    const y = saisonMatch[2];
    const s2 = saisonMatch[1];
    if (s2 === "printemps") return `${y}-04-01`;
    if (s2 === "automne") return `${y}-10-01`;
    if (s2 === "hiver") return `${y}-01-01`;
  }

  const neEnMatch = rel.match(/^né[e]? en\s+(\d{4})$/);
  if (neEnMatch) return `${neEnMatch[1]}-06-01`;

  if (/^\d{4}$/.test(s)) return `${s}-06-01`;

  // Structured date parsing
  const dateOnly = s.split(/[\sT]/)[0];
  const parts = dateOnly.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const p = parts.map(Number);
    let day: number, month: number, year: number;
    if (parts[0].length === 4) {
      [year, month, day] = p;
    } else {
      year = p[2] < 100 ? p[2] + (p[2] < 50 ? 2000 : 1900) : p[2];
      if (p[0] > 12) { day = p[0]; month = p[1]; }
      else if (p[1] > 12) { month = p[0]; day = p[1]; }
      else { day = p[0]; month = p[1]; }
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      if (month === 2 && day > 28) {
        const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        day = isLeap ? 29 : 28;
      }
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

function nettoyerTelephone(valeur: string): string {
  let s = valeur.replace(/[\s.\-\/()]/g, "");
  if (s.startsWith("0033")) s = "+33" + s.slice(4);
  else if (/^33\d{9}$/.test(s)) s = "+" + s;
  return s;
}

function nettoyerEmail(valeur: string): string | null {
  const s = valeur.trim().toLowerCase();
  return s.includes("@") ? s : null;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

function shiftDate(d: Date, days: number): string {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return fmt(copy);
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Apply mapping to a single row
// ---------------------------------------------------------------------------

function applyMapping(
  mapping: Record<string, string>,
  headers: string[],
  row: string[],
  today: string,
  colonnes_a_concatener?: Record<string, string[]>
): TransformedRow {
  const rowObj: Record<string, string> = {};
  headers.forEach((h, j) => { rowObj[h] = row[j] ?? ""; });

  const out: TransformedRow = {};

  // Colonnes à concaténer pour l'adresse (ex: Adresse + CP + Ville)
  const adresseCols = colonnes_a_concatener?.adresse;

  for (const [col, field] of Object.entries(mapping)) {
    if (!field || field === "ignorer") continue;

    // Cas spécial : adresse concaténée — traiter une seule fois
    if (field === "adresse" && adresseCols && adresseCols.length > 1) {
      if (col !== adresseCols[0]) continue; // traiter uniquement à la première colonne du groupe
      const parts = adresseCols
        .map(c => (rowObj[c] ?? "").trim())
        .filter(Boolean);
      if (parts.length) out.adresse = parts.join(", ");
      continue;
    }

    const raw = (rowObj[col] ?? "").trim();
    if (!raw) continue;

    switch (field) {
      case "nom_complet": {
        const { prenom, nom } = nettoyerNomComplet(raw);
        if (!out.prenom && prenom) out.prenom = prenom;
        if (!out.nom && nom) out.nom = nom;
        break;
      }
      case "prénom":
      case "prenom": {
        if (!out.prenom) out.prenom = capitalize(raw);
        break;
      }
      case "nom": {
        if (!out.nom) out.nom = capitalize(raw);
        break;
      }
      case "email": {
        const e = nettoyerEmail(raw);
        if (e) out.email = e;
        break;
      }
      case "téléphone":
      case "telephone": {
        out.telephone = nettoyerTelephone(raw);
        break;
      }
      case "montant_achat": {
        const n = nettoyerMontant(raw);
        if (n !== null) out.montant_achat = n;
        break;
      }
      case "date_achat": {
        out.date_achat = nettoyerDate(raw, today);
        break;
      }
      case "date_naissance": {
        out.date_naissance = nettoyerDate(raw, today);
        break;
      }
      case "adresse": {
        out.adresse = raw;
        break;
      }
      case "produit_achat": {
        out.produit_achat = raw;
        break;
      }
      case "notes": {
        // Concaténer si plusieurs colonnes mappées sur notes
        out.notes = out.notes ? `${out.notes} · ${raw}` : raw;
        break;
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Supabase import
// ---------------------------------------------------------------------------

async function importRows(rows: TransformedRow[], workspaceId: string): Promise<ImportReport> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) { window.location.href = "/login"; throw new Error("Non authentifié"); }

  const rpt: ImportReport = { imported: 0, merged: 0, salesCreated: 0, ignored: 0, errors: 0, errorDetails: [] };

  // Fetch existing clients for dedup
  const { data: existingClients } = await supabase
    .from("clients")
    .select("id, email")
    .eq("workspace_id", workspaceId);
  const emailToId = new Map<string, string>();
  for (const c of existingClients ?? []) {
    if (c.email) emailToId.set(c.email.toLowerCase().trim(), c.id);
  }

  // Fetch products for name → id lookup
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price")
    .eq("workspace_id", workspaceId);
  const productMap = new Map<string, { id: string; price: number }>();
  for (const p of products ?? []) {
    if (p.name) productMap.set(p.name.toLowerCase().trim(), { id: p.id, price: p.price ?? 0 });
  }

  const BATCH = 50;
  const toInsert: { row: TransformedRow; payload: Record<string, any> }[] = [];
  const toMerge: { row: TransformedRow; clientId: string }[] = [];

  for (const row of rows) {
    const email = row.email?.toLowerCase().trim() || null;
    const hasIdentifier = !!(email || row.prenom || row.nom);
    if (!hasIdentifier) { rpt.ignored++; continue; }

    if (email && emailToId.has(email)) {
      toMerge.push({ row, clientId: emailToId.get(email)! });
      continue;
    }

    const noteParts: string[] = [];
    if (row.telephone) noteParts.push(`Tél : ${row.telephone}`);
    if (row.adresse) noteParts.push(`Adresse : ${row.adresse}`);
    if (row.notes) noteParts.push(row.notes);

    const payload: Record<string, any> = {
      user_id: userId,
      workspace_id: workspaceId,
      prenom: row.prenom || null,
      nom: row.nom || null,
      email: email || null,
    };
    if (row.date_naissance) payload.birthdate = row.date_naissance;
    if (noteParts.length) payload.notes = noteParts.join(" · ");

    toInsert.push({ row, payload });
  }

  // Batch insert new clients
  const insertedIdMap = new Map<number, string>();
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("clients")
      .insert(batch.map(b => b.payload))
      .select("id, email");
    if (error) {
      rpt.errors += batch.length;
      if (!rpt.errorDetails.some(e => e.includes(error.message))) {
        rpt.errorDetails.push(`Clients : ${error.message}`);
      }
    } else {
      rpt.imported += (data ?? []).length;
      for (let j = 0; j < (data ?? []).length; j++) {
        const id = data![j]?.id;
        if (id) {
          insertedIdMap.set(i + j, id);
          const em = data![j]?.email;
          if (em) emailToId.set(em.toLowerCase(), id);
        }
      }
    }
  }

  // Merge: update only empty fields
  for (const { row, clientId } of toMerge) {
    rpt.merged++;
    try {
      const { data: existing } = await supabase
        .from("clients")
        .select("notes, birthdate")
        .eq("id", clientId)
        .single();

      const update: Record<string, any> = {};
      if (!existing?.birthdate && row.date_naissance) update.birthdate = row.date_naissance;

      const noteParts: string[] = [];
      if (row.telephone) noteParts.push(`Tél : ${row.telephone}`);
      if (row.adresse) noteParts.push(`Adresse : ${row.adresse}`);
      if (row.notes) noteParts.push(row.notes);
      if (noteParts.length && !existing?.notes) update.notes = noteParts.join(" · ");

      if (Object.keys(update).length) {
        await supabase.from("clients").update(update).eq("id", clientId);
      }
    } catch {
      // continue silently
    }
  }

  // Build sale rows
  interface SaleRow {
    payload: Record<string, any>;
    productLink: { product_id: string; product_name: string; price: number; quantity: number } | null;
  }
  const saleRows: SaleRow[] = [];

  const addSaleIfNeeded = (row: TransformedRow, clientId: string | null) => {
    if (!row.montant_achat || row.montant_achat <= 0) return;
    const createdAt = row.date_achat
      ? new Date(`${row.date_achat}T12:00:00`).toISOString()
      : new Date().toISOString();
    const prodName = row.produit_achat?.trim() || null;
    const product = prodName ? productMap.get(prodName.toLowerCase()) : undefined;
    saleRows.push({
      payload: {
        user_id: userId,
        workspace_id: workspaceId,
        client_id: clientId,
        amount: row.montant_achat,
        created_at: createdAt,
        product_id: product?.id ?? null,
        product_name: prodName,
      },
      productLink: product
        ? { product_id: product.id, product_name: prodName!, price: product.price, quantity: 1 }
        : null,
    });
  };

  for (let i = 0; i < toInsert.length; i++) {
    addSaleIfNeeded(toInsert[i].row, insertedIdMap.get(i) ?? null);
  }
  for (const { row, clientId } of toMerge) {
    addSaleIfNeeded(row, clientId);
  }

  // Batch insert sales
  const insertedSaleIds: string[] = [];
  for (let i = 0; i < saleRows.length; i += BATCH) {
    const batch = saleRows.slice(i, i + BATCH);
    const { data: inserted, error } = await supabase
      .from("sales")
      .insert(batch.map(r => r.payload))
      .select("id");
    if (error) {
      if (!rpt.errorDetails.some(e => e.includes(error.message))) {
        rpt.errorDetails.push(`Ventes : ${error.message}`);
      }
    } else {
      rpt.salesCreated += (inserted ?? []).length;
      for (const s of inserted ?? []) insertedSaleIds.push(s.id);
    }
  }

  // Insert sale_products
  const spRows: Record<string, any>[] = [];
  for (let i = 0; i < saleRows.length; i++) {
    if (insertedSaleIds[i] && saleRows[i].productLink) {
      spRows.push({ sale_id: insertedSaleIds[i], ...saleRows[i].productLink });
    }
  }
  if (spRows.length) {
    for (let i = 0; i < spRows.length; i += BATCH) {
      const { error } = await supabase.from("sale_products").insert(spRows.slice(i, i + BATCH));
      if (error && !rpt.errorDetails.some(e => e.includes(error.message))) {
        rpt.errorDetails.push(`Produits vente : ${error.message}`);
      }
    }
  }

  return rpt;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ImportPage() {
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function processFile(file: File) {
    if (!activeWorkspace) { setErrorMsg("Sélectionne un workspace d'abord."); return; }
    setErrorMsg("");
    setStep("loading");
    setLoadingIdx(0); // "Lecture du fichier…"

    try {
      // ── Étape 1 : Parsing ─────────────────────────────────────────────────
      const { headers, rows } = await parseFile(file);

      if (!headers.length || !rows.length) {
        setErrorMsg("Fichier vide ou format non reconnu.");
        setStep("upload");
        return;
      }

      // ── Étape 2 : Détection locale des colonnes ───────────────────────────
      setLoadingIdx(1); // "Détection des colonnes…"
      const detection: DetectionResult = detecterColonnes(headers, rows.slice(0, 10));
      const { mapping, colonnes_a_concatener } = detection;

      const champsMappés = Object.values(mapping).filter(v => v !== "ignorer");
      if (champsMappés.length === 0) {
        setErrorMsg(
          "Aucune colonne reconnue dans ce fichier. " +
          `Headers détectés : ${headers.join(", ")}`
        );
        setStep("upload");
        return;
      }

      // ── Étape 3 : Transformation de toutes les lignes ─────────────────────
      setLoadingIdx(2); // "Nettoyage des données…"
      const today = new Date().toISOString().split("T")[0];
      const transformed: TransformedRow[] = [];
      for (const row of rows) {
        try {
          transformed.push(applyMapping(mapping, headers, row, today, colonnes_a_concatener));
        } catch {
          // ligne ignorée, comptée plus bas
        }
      }

      const validRows = transformed.filter(r => r.prenom || r.nom || r.email);
      if (validRows.length === 0) {
        setErrorMsg(
          "Aucun client trouvé. Mapping détecté : " +
          Object.entries(mapping)
            .filter(([, v]) => v !== "ignorer")
            .map(([k, v]) => `${k}→${v}`)
            .join(", ")
        );
        setStep("upload");
        return;
      }

      // ── Étape 4 : Import Supabase ─────────────────────────────────────────
      setLoadingIdx(3); // "Import en base…"
      const rpt = await importRows(transformed, activeWorkspace.id);
      setReport(rpt);
      setStep("done");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Erreur inattendue lors de l'import.");
      setStep("upload");
    }
  }

  function reset() {
    setStep("upload");
    setReport(null);
    setErrorMsg("");
    setFileInputKey(k => k + 1);
    setDragOver(false);
    setLoadingIdx(0);
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [activeWorkspace] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="ds-page">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="ds-topline">Dashboard / Import</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Import Clients</h1>
          <p className="ds-subtitle">
            Import intelligent CSV avec détection IA automatique
            {activeWorkspace
              ? <> — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong></>
              : <span style={{ color: "rgba(255,120,80,0.8)" }}> — Aucun workspace</span>}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* UPLOAD                                                               */}
      {/* ------------------------------------------------------------------ */}
      {step === "upload" && (
        <div className="ds-card">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            style={{
              border: `2px dashed ${dragOver ? "rgba(99,120,255,0.7)" : "rgba(99,120,255,0.28)"}`,
              borderRadius: 18,
              padding: "52px 32px",
              textAlign: "center",
              background: dragOver ? "rgba(99,120,255,0.07)" : "rgba(99,120,255,0.025)",
              cursor: "pointer",
              transition: "all 200ms",
              marginTop: 8,
            }}
          >
            <label style={{ cursor: "pointer", display: "block" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📂</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: "rgba(255,255,255,0.92)", marginBottom: 8 }}>
                Glisse ton fichier ici
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", marginBottom: 24 }}>
                ou clique pour choisir · CSV · tous les clients du fichier seront importés
              </div>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 28px",
                borderRadius: 12,
                background: "rgba(99,120,255,0.18)",
                border: "1px solid rgba(99,120,255,0.38)",
                color: "rgba(255,255,255,0.92)",
                fontWeight: 700,
                fontSize: 14,
              }}>
                Choisir un fichier
              </div>
              <input
                key={fileInputKey}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={onFileChange}
              />
            </label>
          </div>

          {errorMsg && (
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
              {errorMsg}
            </div>
          )}

          <div style={{ marginTop: 28, padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 0.8, marginBottom: 10 }}>
              COLONNES RECONNUES AUTOMATIQUEMENT
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {[
                { label: "Prénom / Nom", color: "rgba(120,220,200,0.85)" },
                { label: "Email", color: "rgba(99,120,255,0.85)" },
                { label: "Téléphone", color: "rgba(160,130,255,0.85)" },
                { label: "Date naissance", color: "rgba(255,180,60,0.85)" },
                { label: "Adresse", color: "rgba(255,160,80,0.85)" },
                { label: "Montant achat", color: "rgba(80,210,140,0.85)" },
                { label: "Date achat", color: "rgba(255,180,60,0.85)" },
                { label: "Produit acheté", color: "rgba(200,160,255,0.85)" },
                { label: "Notes", color: "rgba(255,255,255,0.45)" },
              ].map(f => (
                <span key={f.label} style={{
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${f.color}`,
                  fontSize: 12,
                  color: f.color,
                  fontWeight: 600,
                }}>
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* LOADING                                                              */}
      {/* ------------------------------------------------------------------ */}
      {step === "loading" && (
        <div className="ds-card" style={{ textAlign: "center", padding: "60px 32px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              border: "3px solid rgba(99,120,255,0.15)",
              borderTop: "3px solid rgba(99,120,255,0.9)",
              animation: "spin 0.9s linear infinite",
            }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "rgba(255,255,255,0.9)", marginBottom: 8 }}>
            {LOADING_MESSAGES[loadingIdx]}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            L'IA détecte et nettoie automatiquement vos données…
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 28 }}>
            {LOADING_MESSAGES.map((_, i) => (
              <div key={i} style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: i === loadingIdx ? "rgba(99,120,255,0.9)" : "rgba(255,255,255,0.12)",
                transition: "all 300ms",
              }} />
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* DONE                                                                 */}
      {/* ------------------------------------------------------------------ */}
      {step === "done" && report && (
        <>
          <div className="ds-stats-grid">
            <div className="ds-stat-card">
              <div className="ds-stat-label">✅ Clients importés</div>
              <div className="ds-stat-value" style={{ color: "rgba(120,220,120,0.95)" }}>{report.imported}</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">🔄 Clients mis à jour</div>
              <div className="ds-stat-value" style={{ color: "rgba(99,120,255,0.95)" }}>{report.merged}</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">💰 Ventes enregistrées</div>
              <div className="ds-stat-value" style={{ color: "rgba(80,210,140,0.95)" }}>{report.salesCreated}</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">⚠️ Lignes ignorées</div>
              <div className="ds-stat-value" style={{ color: report.ignored > 0 ? "rgba(255,180,60,0.95)" : "rgba(255,255,255,0.35)" }}>
                {report.ignored}
              </div>
            </div>
          </div>

          <div className="ds-card" style={{ marginTop: 24 }}>
            {report.ignored > 0 && (
              <div style={{
                marginBottom: 16,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(255,180,60,0.06)",
                border: "1px solid rgba(255,180,60,0.18)",
                fontSize: 13,
                color: "rgba(255,200,80,0.85)",
              }}>
                ⚠️ {report.ignored} ligne{report.ignored > 1 ? "s" : ""} ignorée{report.ignored > 1 ? "s" : ""} — pas d'email ni de nom détecté
              </div>
            )}
            {report.errors > 0 && (
              <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "rgba(255,80,80,0.07)", border: "1px solid rgba(255,80,80,0.18)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "rgba(255,120,120,0.95)", marginBottom: 6 }}>
                  {report.errors} erreur{report.errors > 1 ? "s" : ""}
                </div>
                {report.errorDetails.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: "rgba(255,160,160,0.8)", marginTop: 3 }}>{e}</div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <button onClick={() => router.push("/dashboard/clients")} style={{ padding: "10px 24px", borderRadius: 8, background: "#6378ff", color: "white", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                Voir les clients importés
              </button>
              <button onClick={() => setStep("upload")} style={{ padding: "10px 24px", borderRadius: 8, background: "transparent", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontWeight: 500, fontSize: 14 }}>
                Importer un autre fichier
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
