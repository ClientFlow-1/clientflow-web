export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { headers, sampleRows } = body;

    console.log("[detect-columns] Reçu:", {
      headersCount: headers?.length,
      headers,
      sampleRowsCount: sampleRows?.length,
    });

    if (!Array.isArray(headers) || headers.length === 0) {
      return Response.json({ error: "headers manquants ou invalides", mapping: {} }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[detect-columns] ANTHROPIC_API_KEY manquante");
      return Response.json({ error: "Clé API Anthropic manquante (variable ANTHROPIC_API_KEY)", mapping: {} }, { status: 503 });
    }

    const SYSTEM = `Tu mappes des colonnes CSV vers ces champs exactement : nom_complet, email, téléphone, date_naissance, adresse, date_achat, montant_achat, produit_achat, notes, ignorer.
RÈGLES STRICTES :
- Colonne avec @ dans les données = email
- Colonne avec 06/07/+33 dans les données = téléphone
- Colonne avec €/euros/chiffres dans les données = montant_achat
- Colonne avec noms de personnes = nom_complet
- Colonne avec dates ou expressions de temps = date_achat (si contexte achat) ou date_naissance (si contexte naissance)
- Colonne avec villes/adresses = adresse
- Colonne avec descriptions produits = produit_achat
- Colonne avec commentaires = notes
- N° séquentiels = ignorer
Retourne UNIQUEMENT le JSON de mapping, rien d'autre, pas de markdown, pas de texte avant ou après.
Format exact attendu : {"NomColonneCSV": "champ_clientflow", "AutreColonne": "champ_clientflow"}`;

    const buildMsg = (rows: string[][]) => {
      const sample = (rows ?? []).slice(0, 3);
      return `En-têtes CSV : ${JSON.stringify(headers)}
Exemples de données (${sample.length} lignes) :
${sample
  .map(
    (r, i) =>
      `Ligne ${i + 1}: ${JSON.stringify(
        Object.fromEntries((headers as string[]).map((h: string, j: number) => [h, r[j] ?? ""]))
      )}`
  )
  .join("\n")}`;
    };

    const callClaude = async (userMsg: string): Promise<{ text: string; error?: string }> => {
      // Manual timeout instead of AbortSignal.timeout (not available on all Vercel runtimes)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        console.log("[detect-columns] Appel Claude...");
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: SYSTEM,
            messages: [{ role: "user", content: userMsg }],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await res.json();
        console.log("[detect-columns] Réponse Anthropic status:", res.status, "type:", data?.type);

        // Detect Anthropic API errors
        if (data?.type === "error" || data?.error) {
          const errMsg = data?.error?.message ?? data?.error ?? "Erreur Anthropic inconnue";
          console.error("[detect-columns] Erreur Anthropic:", errMsg);
          return { text: "", error: `Anthropic API : ${errMsg}` };
        }

        const text = data?.content?.[0]?.text ?? "";
        console.log("[detect-columns] Texte Claude brut:", text.slice(0, 500));
        return { text };
      } catch (e: any) {
        clearTimeout(timeoutId);
        const isTimeout = e?.name === "AbortError";
        console.error("[detect-columns] Erreur fetch Claude:", isTimeout ? "TIMEOUT 30s" : e?.message);
        return { text: "", error: isTimeout ? "Timeout Claude (30s)" : `Erreur réseau : ${e?.message}` };
      }
    };

    const extractMapping = (text: string): Record<string, string> | null => {
      if (!text) return null;
      // Strip markdown code blocks if present
      const stripped = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
      const match = stripped.match(/\{[\s\S]*\}/);
      if (!match) {
        console.warn("[detect-columns] Aucun JSON trouvé dans la réponse Claude:", text.slice(0, 200));
        return null;
      }
      try {
        const parsed = JSON.parse(match[0]);
        // Handle both {"mapping": {...}} and direct {"col": "field"}
        const m = parsed.mapping ?? parsed;
        if (typeof m === "object" && !Array.isArray(m) && Object.keys(m).length > 0) {
          console.log("[detect-columns] Mapping extrait:", m);
          return m;
        }
        console.warn("[detect-columns] JSON parsé mais vide ou invalide:", parsed);
        return null;
      } catch (e) {
        console.error("[detect-columns] Erreur JSON.parse:", e, "Texte:", match[0].slice(0, 200));
        return null;
      }
    };

    // First attempt
    const { text: text1, error: err1 } = await callClaude(buildMsg(sampleRows));
    let mapping = extractMapping(text1);

    // Retry once on failure
    if (!mapping) {
      console.log("[detect-columns] Retry...", err1 ? `(erreur: ${err1})` : "(JSON invalide)");
      const { text: text2, error: err2 } = await callClaude(buildMsg(sampleRows));
      mapping = extractMapping(text2);

      if (!mapping) {
        const reason = err2 ?? err1 ?? "JSON invalide retourné par Claude";
        console.error("[detect-columns] Échec après retry. Raison:", reason);
        return Response.json({
          mapping: {},
          error: reason,
          debug: {
            attempt1: text1?.slice(0, 300) || "(vide)",
            attempt2: text2?.slice(0, 300) || "(vide)",
          },
        });
      }
    }

    console.log("[detect-columns] Succès. Colonnes mappées:", Object.keys(mapping).length);
    return Response.json({ mapping });
  } catch (err: any) {
    console.error("[detect-columns] Erreur non gérée:", err);
    return Response.json({ error: String(err?.message ?? err), mapping: {} }, { status: 500 });
  }
}
