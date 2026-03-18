// ---------------------------------------------------------------------------
// Détection locale des colonnes CSV — zéro appel externe
// ---------------------------------------------------------------------------

export interface DetectionResult {
  mapping: Record<string, string>;
  colonnes_a_concatener?: Record<string, string[]>;
}

// Normalise un header pour la comparaison :
// "Né(e) le" → "ne e le" | "Tel / Port." → "tel port" | "Qui ?" → "qui"
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprime les accents
    .replace(/[^a-z0-9\s]/g, " ")    // supprime tout sauf lettres/chiffres
    .replace(/\s+/g, " ")
    .trim();
}

// Récupère les valeurs non-vides d'une colonne dans l'échantillon
function getVals(echantillon: string[][], colIdx: number): string[] {
  return echantillon.map(r => (r[colIdx] ?? "").trim()).filter(Boolean);
}

// Proportion de valeurs satisfaisant un prédicat
function ratio(vals: string[], pred: (v: string) => boolean): number {
  if (!vals.length) return 0;
  return vals.filter(pred).length / vals.length;
}

// ---------------------------------------------------------------------------
// Détection par contenu
// ---------------------------------------------------------------------------

function isEmail(v: string): boolean {
  return v.includes("@") && /\.\w{2,}$/.test(v);
}

function isPhone(v: string): boolean {
  const s = v.replace(/[\s.\-\/()]/g, "");
  return /^(\+33|0033|06|07|0[1-9])\d{6,}$/.test(s) || /^\+\d{10,14}$/.test(s);
}

function isMoney(v: string): boolean {
  // Présence d'un symbole monétaire → sûr
  if (/[€$£]|euros?/i.test(v)) return true;
  // Nombre décimal (virgule ou point) — évite ZIP codes (ex: "75001" sans décimale)
  const s = v.replace(/[\s\u00a0]/g, "");
  if (!/[,.]/.test(s)) return false;
  const n = parseFloat(s.replace(/[^0-9.,-]/g, "").replace(",", "."));
  return !isNaN(n) && n > 0;
}

function isDate(v: string): boolean {
  // Format strict D/M/Y ou Y-M-D (anchored pour éviter de matcher les tél.)
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(v.trim())) return true;
  if (/^\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2}/.test(v.trim())) return true;
  // Expressions relatives françaises
  if (/^(il y a|hier|avant-hier|la semaine|le mois)/i.test(v.trim())) return true;
  if (/^(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)/i.test(v.trim())) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Règles par nom de colonne (normalisé → champ)
// ---------------------------------------------------------------------------

// Chaque entrée : [liste de patterns normalisés, champ cible]
const HEADER_RULES: Array<[string[], string]> = [
  [
    ["prenom", "firstname", "first name", "given name", "givenname", "first name client"],
    "prénom",
  ],
  [
    ["nom de famille", "lastname", "last name", "surname", "family name", "familyname", "nom famille"],
    "nom",
  ],
  [
    [
      "nom complet", "nom complet client", "fullname", "full name",
      "qui", "client", "nom et prenom", "nom et prenom client",
      "identite", "nom prenom", "contact client",
    ],
    "nom_complet",
  ],
  [
    ["email", "e mail", "mail", "courriel", "adresse mail", "adresse email", "adresse e mail"],
    "email",
  ],
  [
    [
      "tel", "tél", "telephone", "phone", "mobile", "portable",
      "gsm", "cel", "port", "tel port", "tel portable", "numero telephone",
      "num tel", "tel gsm", "numero mobile", "tel mobile",
    ],
    "téléphone",
  ],
  [
    [
      "naissance", "birthday", "birth", "dob", "date de naissance",
      "ne e le", "date naissance", "ne le", "annee naissance", "ne en",
      "annee de naissance", "date de naiss", "date naiss",
    ],
    "date_naissance",
  ],
  [
    ["adresse", "address", "rue", "street", "domicile", "habitation", "adresse postale"],
    "adresse",
  ],
  [
    ["ville", "city", "commune", "localite", "localisation", "lieu", "cit"],
    "ville",
  ],
  [
    ["code postal", "cp", "codepostal", "postal code", "zip", "zipcode", "code post"],
    "cp",
  ],
  [
    [
      "derniere visite", "last visit", "date achat", "date d achat",
      "derniere commande", "last order", "last purchase",
      "derniere fois", "dernier achat", "date dernier achat",
      "date du dernier achat", "date derniere visite",
    ],
    "date_achat",
  ],
  [
    [
      "montant", "total", "amount", "chiffre", "ca", "ca total",
      "valeur", "combien", "depense", "montant total", "achat total",
      "total euros", "montant achat", "montant en euros", "total achat",
      "panier", "panier moyen",
    ],
    "montant_achat",
  ],
  [
    [
      "produit", "article", "quoi", "produits achetes", "items",
      "commande", "produit achete", "articles achetes", "produit commande",
    ],
    "produit_achat",
  ],
  [
    [
      "notes", "note", "commentaire", "commentaires", "remarque", "remarques",
      "info", "infos", "observations", "commentaires perso", "notes vendeur",
      "annotation", "annotations", "fidelite", "gold", "silver", "platinum",
      "statut client", "tier", "niveau",
    ],
    "notes",
  ],
  [
    [
      "id", "n", "numero", "ref", "reference", "code", "nb visites",
      "nombre visites", "visits", "identifiant", "index", "rang", "ligne",
    ],
    "ignorer",
  ],
];

// Pré-normalise tous les patterns une seule fois
const NORMALIZED_RULES = HEADER_RULES.map(([patterns, champ]) => ({
  patterns: patterns.map(norm),
  champ,
}));

function matchParNom(header: string): string | null {
  const hn = norm(header);
  // 1. Correspondance exacte
  for (const rule of NORMALIZED_RULES) {
    if (rule.patterns.includes(hn)) return rule.champ;
  }
  // 2. Correspondance partielle (pattern >3 chars contenus dans header ou inversement)
  for (const rule of NORMALIZED_RULES) {
    for (const p of rule.patterns) {
      if (p.length > 3 && (hn.includes(p) || p.includes(hn))) {
        return rule.champ;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

export function detecterColonnes(
  headers: string[],
  echantillon: string[][]
): DetectionResult {
  const rawMapping: Record<string, string> = {};

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h.trim()) continue;

    const vals = getVals(echantillon, i);
    const hn = norm(h);

    // ── 1. Détection par contenu (priorité absolue) ─────────────────────────

    if (ratio(vals, isEmail) > 0.4) {
      rawMapping[h] = "email";
      continue;
    }

    if (ratio(vals, isPhone) > 0.3) {
      rawMapping[h] = "téléphone";
      continue;
    }

    if (ratio(vals, isMoney) > 0.4) {
      rawMapping[h] = "montant_achat";
      continue;
    }

    // Date : contenu + contexte header pour distinguer naissance vs achat
    if (ratio(vals, isDate) > 0.4) {
      const naissanceKeywords = /naiss|birth|n[eé]|born|age|dob|ne e|naissance/;
      rawMapping[h] = naissanceKeywords.test(hn) ? "date_naissance" : "date_achat";
      continue;
    }

    // ── 2. Détection par nom de colonne ─────────────────────────────────────

    const byName = matchParNom(h);
    if (byName) {
      rawMapping[h] = byName;
      continue;
    }

    // "contact" sans données → fallback nom_complet (souvent = colonne client)
    if (hn === "contact" || hn.includes("contact")) {
      rawMapping[h] = "nom_complet";
      continue;
    }

    // Fallback : ignorer
    rawMapping[h] = "ignorer";
  }

  // ── 3. Post-traitement : cas spéciaux ─────────────────────────────────────

  const vals = Object.values(rawMapping);
  const hasPrenomCol = vals.includes("prénom");
  const hasNomCol = vals.includes("nom");

  // Si seul "nom" détecté sans "prénom" → probablement un nom complet
  if (hasNomCol && !hasPrenomCol) {
    for (const col of Object.keys(rawMapping)) {
      if (rawMapping[col] === "nom") rawMapping[col] = "nom_complet";
    }
  }

  // Si "nom_complet" ET "nom" séparés → garder nom_complet, mettre nom en ignorer
  if (vals.includes("nom_complet") && hasNomCol) {
    for (const col of Object.keys(rawMapping)) {
      if (rawMapping[col] === "nom") rawMapping[col] = "ignorer";
    }
  }

  // ── 4. Concaténation adresse + CP + ville ────────────────────────────────

  const colonnes_a_concatener: Record<string, string[]> = {};

  const adresseCol = Object.keys(rawMapping).find(k => rawMapping[k] === "adresse");
  const villeCol = Object.keys(rawMapping).find(k => rawMapping[k] === "ville");
  const cpCol = Object.keys(rawMapping).find(k => rawMapping[k] === "cp");

  if (villeCol || cpCol) {
    const parts: string[] = [];
    if (adresseCol) parts.push(adresseCol);
    if (cpCol) parts.push(cpCol);
    if (villeCol) parts.push(villeCol);

    if (parts.length > 1) {
      // Plusieurs colonnes → concaténer
      colonnes_a_concatener["adresse"] = parts;
      for (const col of parts) rawMapping[col] = "adresse";
    } else {
      // Colonne unique ville/CP → traiter comme adresse
      if (villeCol) rawMapping[villeCol] = "adresse";
      if (cpCol) rawMapping[cpCol] = "adresse";
    }
  }

  return {
    mapping: rawMapping,
    colonnes_a_concatener: Object.keys(colonnes_a_concatener).length > 0
      ? colonnes_a_concatener
      : undefined,
  };
}
