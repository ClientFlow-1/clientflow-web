"use client";

import { useEffect, useMemo, useState } from "react";

type ClientRow = {
  id: string;
  email?: string;
  prenom?: string;
  nom?: string;
  total?: number;
};

function formatEUR(n: number) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  } catch {
    return `${n.toFixed(2)} €`;
  }
}

// ✅ même parseur montant que celui qui marche (accepte number ou string)
function moneyToNumberAny(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

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

const STORAGE_KEYS = ["clientflow_clients", "clients", "imported_clients", "clientflow:clients"];

// ✅ FIX NOM vs PRENOM
function pickHeader(obj: any, names: string[]) {
  const keys = Object.keys(obj ?? {});
  const lowerMap = new Map(keys.map((k) => [k.toLowerCase(), k]));

  // exact
  for (const n of names) {
    const exact = lowerMap.get(n.toLowerCase());
    if (exact) return exact;
  }

  // startsWith
  for (const n of names) {
    const found = keys.find((k) => k.toLowerCase().startsWith(n.toLowerCase()));
    if (found) return found;
  }

  // includes (garde-fou)
  for (const n of names) {
    const nl = n.toLowerCase();
    const found = keys.find((k) => {
      const kl = k.toLowerCase();
      if (nl === "nom" && kl.includes("prenom")) return false;
      return kl.includes(nl);
    });
    if (found) return found;
  }

  return "";
}

function normalizeClients(arr: any[]): ClientRow[] {
  if (!arr?.length) return [];
  const sample = arr[0] ?? {};

  const kEmail = pickHeader(sample, ["email", "e-mail", "mail"]);
  const kPrenom = pickHeader(sample, ["prenom", "prénom", "first", "firstname", "first name"]);
  const kNom = pickHeader(sample, ["nom", "last", "lastname", "last name", "surname"]);
  const kTotal = pickHeader(sample, ["total", "montant", "amount", "ca"]);

  return arr.map((c, idx) => {
    const email = (c?.[kEmail] ?? c?.email ?? c?.Email ?? c?.mail ?? "").toString().trim();
    const prenom = (c?.[kPrenom] ?? c?.prenom ?? c?.Prénom ?? c?.firstName ?? "").toString().trim();
    const nom = (c?.[kNom] ?? c?.nom ?? c?.Nom ?? c?.lastName ?? "").toString().trim();
    const total = moneyToNumberAny(c?.[kTotal] ?? c?.total ?? c?.Total ?? c?.amount ?? c?.ca ?? 0);

    return {
      id: `${email || "row"}-${idx}`,
      email,
      prenom,
      nom,
      total,
    };
  });
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // ✅ NOUVEAU: on retient la clé de stockage réellement utilisée (celle où on a trouvé les clients)
  const [activeStorageKey, setActiveStorageKey] = useState<string>(STORAGE_KEYS[0]);

  // ✅ NOUVEAU: persister la liste après suppression pour éviter le "retour" au refresh
  function persistClients(next: ClientRow[]) {
    try {
      // on sauvegarde sous la clé active (celle de l’import) pour rester cohérent
      const payload = next.map(({ email, prenom, nom, total }) => ({
        email: email ?? "",
        prenom: prenom ?? "",
        nom: nom ?? "",
        total: moneyToNumberAny(total),
      }));
      window.localStorage.setItem(activeStorageKey, JSON.stringify(payload));
    } catch {}
  }

  function loadFromStorage() {
    for (const k of STORAGE_KEYS) {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const normalized = normalizeClients(parsed);
          setClients(normalized);
          setSelected({});
          setActiveStorageKey(k); // ✅ NOUVEAU
          return;
        }
      } catch {}
    }
    setClients([]);
    setSelected({});
    setActiveStorageKey(STORAGE_KEYS[0]); // ✅ NOUVEAU
  }

  useEffect(() => {
    loadFromStorage();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const blob = `${c.email ?? ""} ${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [clients, query]);

  const stats = useMemo(() => {
    const count = filtered.length;
    const ca = filtered.reduce((acc, c) => acc + moneyToNumberAny(c.total), 0);
    const panier = count > 0 ? ca / count : 0;
    return { count, ca, panier };
  }, [filtered]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);
  const selectedCount = selectedIds.length;

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = { ...prev };
      for (const c of filtered) next[c.id] = true;
      return next;
    });
  }

  function clearSelection() {
    setSelected({});
  }

  function deleteOne(id: string) {
    const next = clients.filter((c) => c.id !== id);
    setClients(next);
    setSelected((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    // ✅ NOUVEAU: persistance
    persistClients(next);
  }

  function deleteSelected() {
    if (selectedCount === 0) return;
    const toDelete = new Set(selectedIds);
    const next = clients.filter((c) => !toDelete.has(c.id));
    setClients(next);
    setSelected({});

    // ✅ NOUVEAU: persistance
    persistClients(next);
  }

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Clients</div>

      <div className="ds-header">
        <div>
          <h1 className="ds-title">Clients</h1>
          <p className="ds-subtitle">Recherche, stats, sélection et suppression des clients importés.</p>
        </div>

        <div className="ds-right-tools">
          <div className="ds-pill">
            Filtré : {filtered.length} / {clients.length}
          </div>
          <button className="ds-btn ds-btn-ghost" type="button" onClick={loadFromStorage}>
            Actualiser
          </button>
        </div>
      </div>

      <div className="ds-search">
        <span className="ds-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          className="ds-search-input"
          placeholder="Rechercher un client (email, prénom, nom)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.length > 0 && (
          <button className="ds-search-clear" type="button" onClick={() => setQuery("")}>
            Effacer
          </button>
        )}
      </div>

      <div className="ds-stats-grid">
        <div className="ds-stat-card">
          <div className="ds-stat-label">Nombre de clients</div>
          <div className="ds-stat-value">{stats.count}</div>
        </div>

        <div className="ds-stat-card">
          <div className="ds-stat-label">CA total</div>
          <div className="ds-stat-value">{formatEUR(stats.ca)}</div>
        </div>

        <div className="ds-stat-card">
          <div className="ds-stat-label">Panier moyen</div>
          <div className="ds-stat-value">{formatEUR(stats.panier)}</div>
        </div>
      </div>

      <div className="ds-card">
        <div className="ds-card-head">
          <div>
            <div className="ds-card-title">Liste clients</div>
            <div className="ds-card-sub">
              Affichage filtré : {filtered.length} / {clients.length} · Sélection : {selectedCount}
            </div>
          </div>

          <div className="ds-card-actions">
            <button className="ds-btn ds-btn-soft" type="button" onClick={selectAllFiltered} disabled={filtered.length === 0}>
              Tout sélectionner
            </button>
            <button className="ds-btn ds-btn-ghost" type="button" onClick={clearSelection} disabled={selectedCount === 0}>
              Désélectionner
            </button>
            <button className="ds-btn ds-btn-danger" type="button" onClick={deleteSelected} disabled={selectedCount === 0}>
              Supprimer ({selectedCount})
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="ds-empty">
            <div className="ds-empty-title">Aucun client</div>
            <div className="ds-empty-sub">
              Soit tu n’as pas encore confirmé l’import, soit aucun client ne correspond à ta recherche.
            </div>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th className="ds-col-check"></th>
                  <th>Email</th>
                  <th>Prénom</th>
                  <th>Nom</th>
                  <th className="ds-right">Total</th>
                  <th className="ds-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const checked = !!selected[c.id];
                  return (
                    <tr key={c.id}>
                      <td className="ds-col-check">
                        <label className="ds-check">
                          <input type="checkbox" checked={checked} onChange={() => toggleOne(c.id)} />
                          <span className="ds-check-ui" aria-hidden="true" />
                        </label>
                      </td>
                      <td className="ds-mono">{c.email || "—"}</td>
                      <td>{c.prenom || "—"}</td>
                      <td>{c.nom || "—"}</td>
                      <td className="ds-right">{formatEUR(moneyToNumberAny(c.total))}</td>
                      <td className="ds-right">
                        <button className="ds-btn ds-btn-danger-xs" type="button" onClick={() => deleteOne(c.id)}>
                          Suppr.
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}