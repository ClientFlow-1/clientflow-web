"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/lib/workspaceContext";

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
  "Analyse IA en cours…",
  "Nettoyage des données…",
  "Préparation de l'import…",
  "Import en cours…",
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
  const candidates: [string, string][] = [
    [";", ";"],
    [",", ","],
    ["|", "\\|"],
    ["\t", "\\t"],
  ];
  let bestSep = ",";
  let bestCount = 0;
  for (const [sep] of candidates) {
    const count = firstLine.split(sep).length;
    if (count > bestCount) { bestCount = count; bestSep = sep; }
  }
  return bestSep;
}

function splitCSVLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
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
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const wb = xlsxRead(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: any[][] = xlsxUtils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!data.length) return { headers: [], rows: [] };
    const headers = (data[0] as any[]).map(h => String(h ?? "").trim());
    const rows = data.slice(1)
      .filter((r: any[]) => r.some(c => String(c ?? "").trim() !== ""))
      .map((r: any[]) => r.map(c => String(c ?? "").trim()));
    return { headers, rows };
  }
  const text = await readFileText(file);
  return parseCSVToRows(text);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ImportPage() {
  const { activeWorkspace } = useWorkspace();
  const [step, setStep] = useState<Step>("upload");
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycling loading messages
  useEffect(() => {
    if (step === "loading") {
      let idx = 0;
      loadingIntervalRef.current = setInterval(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setLoadingIdx(idx);
        setLoadingMsg(LOADING_MESSAGES[idx]);
      }, 2200);
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    }
    return () => { if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current); };
  }, [step]);

  async function processFile(file: File) {
    if (!activeWorkspace) { setErrorMsg("Sélectionne un workspace d'abord."); return; }
    setErrorMsg("");
    setStep("loading");
    setLoadingMsg(LOADING_MESSAGES[0]);
    setLoadingIdx(0);

    try {
      // 1. Parse file
      const { headers, rows } = await parseFile(file);
      if (!headers.length || !rows.length) {
        setErrorMsg("Fichier vide ou format non reconnu.");
        setStep("upload");
        return;
      }

      const MAX_ROWS = 500;
      const limitedRows = rows.slice(0, MAX_ROWS);
      const wasLimited = rows.length > MAX_ROWS;

      // 2. Call Claude API
      const today = new Date().toISOString().split("T")[0];
      const sampleRows = limitedRows.slice(0, 5);

      const apiRes = await fetch("/api/detect-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, rows: sampleRows, today }),
      });

      if (!apiRes.ok) throw new Error("Erreur API détection colonnes");
      const { mapping, donnees_transformees: sampleTransformed } = await apiRes.json();

      // 3. For rows beyond sample: apply mapping client-side
      //    For sample rows: use Claude's transformations
      const allTransformed: TransformedRow[] = [];

      // Use Claude-transformed sample rows
      for (let i = 0; i < Math.min(sampleRows.length, sampleTransformed?.length ?? 0); i++) {
        allTransformed.push(sampleTransformed[i] ?? {});
      }

      // Apply mapping to remaining rows client-side
      if (limitedRows.length > sampleRows.length) {
        for (let i = sampleRows.length; i < limitedRows.length; i++) {
          const row = limitedRows[i];
          const rowObj: Record<string, string> = {};
          headers.forEach((h, j) => { rowObj[h] = row[j] ?? ""; });
          allTransformed.push(applyMapping(mapping, rowObj, today));
        }
      }

      // 4. Import to Supabase
      const rpt = await importRows(allTransformed, activeWorkspace.id);
      if (wasLimited) {
        rpt.errorDetails.unshift(`⚠ Fichier tronqué à ${MAX_ROWS} lignes (${rows.length} lignes dans le fichier)`);
      }

      setReport(rpt);
      setStep("done");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Erreur inattendue.");
      setStep("upload");
    }
  }

  // Client-side mapping fallback for rows not processed by Claude
  function applyMapping(
    mapping: Record<string, string>,
    rowObj: Record<string, string>,
    today: string
  ): TransformedRow {
    const out: TransformedRow = {};
    for (const [col, field] of Object.entries(mapping)) {
      const raw = (rowObj[col] ?? "").trim();
      if (!raw || field === "ignorer") continue;

      if (field === "prenom") out.prenom = raw;
      else if (field === "nom") out.nom = raw;
      else if (field === "nom_complet") {
        const { prenom, nom } = splitFullName(raw);
        if (!out.prenom) out.prenom = prenom;
        if (!out.nom) out.nom = nom;
      }
      else if (field === "email") {
        const e = raw.toLowerCase().trim();
        if (e.includes("@")) out.email = e;
      }
      else if (field === "telephone") out.telephone = normalizePhone(raw);
      else if (field === "montant_achat") {
        const n = parseMoney(raw);
        if (n > 0) out.montant_achat = n;
      }
      else if (field === "date_achat") out.date_achat = parseDate(raw, today);
      else if (field === "date_naissance") out.date_naissance = parseDate(raw, today);
      else if (field === "adresse") out.adresse = raw;
      else if (field === "produit_achat") out.produit_achat = raw;
      else if (field === "notes") out.notes = raw;
    }
    return out;
  }

  async function importRows(rows: TransformedRow[], workspaceId: string): Promise<ImportReport> {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) { window.location.href = "/login"; throw new Error("Non authentifié"); }

    const rpt: ImportReport = { imported: 0, merged: 0, salesCreated: 0, ignored: 0, errors: 0, errorDetails: [] };

    // Fetch existing clients for dedup
    const { data: existing } = await supabase.from("clients").select("id, email").eq("workspace_id", workspaceId);
    const emailToId = new Map<string, string>();
    for (const c of existing ?? []) {
      if (c.email) emailToId.set(c.email.toLowerCase().trim(), c.id);
    }

    // Fetch products for name → id lookup
    const { data: products } = await supabase.from("products").select("id, name, price").eq("workspace_id", workspaceId);
    const productMap = new Map<string, { id: string; price: number }>();
    for (const p of products ?? []) {
      if (p.name) productMap.set(p.name.toLowerCase().trim(), { id: p.id, price: p.price ?? 0 });
    }

    const BATCH = 50;

    // Separate new vs merged
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

      const payload: Record<string, any> = {
        user_id: userId,
        workspace_id: workspaceId,
        prenom: row.prenom || null,
        nom: row.nom || null,
        email: email || null,
      };
      if (row.date_naissance) payload.birthdate = row.date_naissance;
      const noteParts: string[] = [];
      if (row.telephone) noteParts.push(`Tél : ${row.telephone}`);
      if (row.adresse) noteParts.push(`Adresse : ${row.adresse}`);
      if (row.notes) noteParts.push(row.notes);
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
          rpt.errorDetails.push(`Clients: ${error.message}`);
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

    // Merge: update empty fields only
    for (const { row, clientId } of toMerge) {
      rpt.merged++;
      const update: Record<string, any> = {};
      if (row.date_naissance) update.birthdate = row.date_naissance;
      const { data: existing } = await supabase.from("clients").select("notes, birthdate").eq("id", clientId).single();
      if (!existing?.birthdate && row.date_naissance) update.birthdate = row.date_naissance;
      const noteParts: string[] = [];
      if (row.telephone) noteParts.push(`Tél : ${row.telephone}`);
      if (row.adresse) noteParts.push(`Adresse : ${row.adresse}`);
      if (row.notes) noteParts.push(row.notes);
      if (noteParts.length && !existing?.notes) update.notes = noteParts.join(" · ");
      if (Object.keys(update).length) {
        await supabase.from("clients").update(update).eq("id", clientId);
      }
    }

    // Build sale rows
    interface SaleRow {
      payload: Record<string, any>;
      productLink: { product_id: string; product_name: string; price: number; quantity: number } | null;
    }
    const saleRows: SaleRow[] = [];

    const addSaleIfNeeded = (row: TransformedRow, clientId: string | null) => {
      if (!(row.montant_achat && row.montant_achat > 0)) return;
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
          rpt.errorDetails.push(`Ventes: ${error.message}`);
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
          rpt.errorDetails.push(`Produits vente: ${error.message}`);
        }
      }
    }

    return rpt;
  }

  function reset() {
    setStep("upload");
    setReport(null);
    setErrorMsg("");
    setFileInputKey(k => k + 1);
    setDragOver(false);
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [activeWorkspace]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Import</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Import Clients</h1>
          <p className="ds-subtitle">
            Import intelligent CSV/Excel avec nettoyage IA automatique
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
                ou clique pour choisir · CSV ou Excel (.xlsx) · jusqu'à 500 clients
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
                transition: "all 150ms",
              }}>
                Choisir un fichier
              </div>
              <input
                key={fileInputKey}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
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

          {/* Fields legend */}
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
          {/* Spinner */}
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
            {loadingMsg}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            L'IA nettoie et normalise automatiquement vos données…
          </div>
          {/* Progress dots */}
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
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
              <div className="ds-stat-label">🔄 Clients fusionnés</div>
              <div className="ds-stat-value" style={{ color: "rgba(99,120,255,0.95)" }}>{report.merged}</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">💰 Ventes créées</div>
              <div className="ds-stat-value" style={{ color: "rgba(80,210,140,0.95)" }}>{report.salesCreated}</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">⚠️ Lignes ignorées</div>
              <div className="ds-stat-value" style={{ color: report.ignored > 0 ? "rgba(255,180,60,0.95)" : "rgba(255,255,255,0.35)" }}>{report.ignored}</div>
            </div>
          </div>

          <div className="ds-card" style={{ marginTop: 24 }}>
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
            {report.errorDetails.filter(e => e.startsWith("⚠")).map((e, i) => (
              <div key={i} style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(255,180,60,0.07)", border: "1px solid rgba(255,180,60,0.2)", fontSize: 13, color: "rgba(255,200,80,0.9)", fontWeight: 600 }}>
                {e}
              </div>
            ))}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="/dashboard/clients" className="ds-btn" style={{ textDecoration: "none" }}>
                Voir les clients importés
              </a>
              <button className="ds-btn ds-btn-ghost" onClick={reset}>
                Importer un autre fichier
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client-side transformation helpers (fallback for rows > 5)
// ---------------------------------------------------------------------------

function splitFullName(raw: string): { prenom: string | null; nom: string | null } {
  let s = raw.trim();
  // Remove civilités
  s = s.replace(/\b(M\.|Mme\.?|Mr\.?|Madame|Monsieur|épouse|veuve)\s*/gi, "").trim();
  // Remove parentheses content
  s = s.replace(/\(.*?\)/g, "").trim();
  if (!s) return { prenom: null, nom: null };
  // NOM, Prénom (comma format)
  if (s.includes(",")) {
    const [nom, ...rest] = s.split(",");
    return { prenom: rest.join(",").trim() || null, nom: nom.trim() || null };
  }
  const words = s.split(/\s+/);
  if (words.length === 1) return { prenom: words[0], nom: null };
  // If first word is ALL CAPS → likely NOM Prénom format → invert
  if (words[0] === words[0].toUpperCase() && words[0].length > 1) {
    const nom = capitalize(words[0]);
    const prenom = words.slice(1).map(capitalize).join(" ");
    return { prenom, nom };
  }
  const prenom = words[0];
  const nom = words.slice(1).join(" ");
  return { prenom, nom };
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

function parseMoney(v: string): number {
  if (!v) return 0;
  let s = v.trim()
    .replace(/\s/g, "").replace(/\u00a0/g, "")
    .replace(/€|euros?|EUR/gi, "")
    .replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const after = s.length - lastComma - 1;
    if (after <= 2) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizePhone(v: string): string {
  let s = v.replace(/[\s.\-\/()]/g, "");
  if (s.startsWith("0033")) s = "+33" + s.slice(4);
  else if (/^33\d{9}$/.test(s)) s = "+" + s;
  return s;
}

function parseDate(v: string, today: string): string | null {
  if (!v?.trim()) return null;
  const s = v.trim();

  // Relative expressions
  const t = new Date(today + "T12:00:00");
  const rel = s.toLowerCase();
  if (rel === "hier") return shiftDate(t, -1);
  if (rel === "avant-hier") return shiftDate(t, -2);
  if (rel === "la semaine dernière" || rel === "la semaine derniere") return shiftDate(t, -7);
  if (rel === "le mois dernier") { t.setDate(1); t.setMonth(t.getMonth() - 1); return fmt(t); }

  const ilYa = rel.match(/^il y a (\d+)\s*(jour|jours|semaine|semaines|mois)/);
  if (ilYa) {
    const n = parseInt(ilYa[1]);
    if (ilYa[2].startsWith("jour")) return shiftDate(t, -n);
    if (ilYa[2].startsWith("semaine")) return shiftDate(t, -n * 7);
    if (ilYa[2] === "mois") { t.setMonth(t.getMonth() - n); return fmt(t); }
  }

  // Month name + year
  const FR_MONTHS: Record<string, number> = {
    janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
  };
  const monthYear = rel.match(/^(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+(\d{4})$/);
  if (monthYear) return `${monthYear[2]}-${String(FR_MONTHS[monthYear[1]]).padStart(2, "0")}-01`;

  const noelMatch = rel.match(/^no[eë]l\s+(\d{4})$/);
  if (noelMatch) return `${noelMatch[1]}-12-25`;

  const seasonMatch = rel.match(/^(début|debut|mi-?|fin)\s*(\d{4})$/);
  if (seasonMatch) {
    const y = seasonMatch[2];
    const p = seasonMatch[1].replace("é", "e").replace("-", "");
    if (p === "debut") return `${y}-01-01`;
    if (p === "mi") return `${y}-07-01`;
    if (p === "fin") return `${y}-12-01`;
  }

  const eteMatch = rel.match(/^[eé]t[eé]\s+(\d{4})$/);
  if (eteMatch) return `${eteMatch[1]}-07-01`;

  // Just a year
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;

  // Parse structured dates
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
      // Handle invalid dates like 29/02 on non-leap years
      const d = new Date(year, month - 1, day);
      if (isNaN(d.getTime())) {
        if (month === 2 && day > 28) return `${year}-02-28`;
        return null;
      }
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Last resort: JS parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

function shiftDate(d: Date, days: number): string {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return fmt(copy);
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
