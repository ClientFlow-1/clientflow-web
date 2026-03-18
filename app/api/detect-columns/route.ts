export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { headers, sampleRows } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "No API key" }, { status: 503 });

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
Retourne UNIQUEMENT le JSON de mapping, rien d'autre, pas de markdown.
Format : {"NomColonneCSV": "champ_clientflow", ...}`;

    const buildMsg = (rows: string[][]) => {
      const sample = rows.slice(0, 3);
      return `En-têtes : ${JSON.stringify(headers)}
Exemples de données :
${sample
  .map(
    (r, i) =>
      `Ligne ${i + 1}: ${JSON.stringify(
        Object.fromEntries((headers as string[]).map((h: string, j: number) => [h, r[j] ?? ""]))
      )}`
  )
  .join("\n")}`;
    };

    const callClaude = async (userMsg: string): Promise<string> => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: SYSTEM,
          messages: [{ role: "user", content: userMsg }],
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      return data.content?.[0]?.text ?? "";
    };

    const extractMapping = (text: string): Record<string, string> | null => {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        const parsed = JSON.parse(match[0]);
        // Handle both {"mapping": {...}} and direct {"col": "field"}
        const m = parsed.mapping ?? parsed;
        if (typeof m === "object" && !Array.isArray(m) && Object.keys(m).length > 0) return m;
        return null;
      } catch {
        return null;
      }
    };

    let text = await callClaude(buildMsg(sampleRows));
    let mapping = extractMapping(text);

    // Retry once on failure
    if (!mapping) {
      text = await callClaude(buildMsg(sampleRows));
      mapping = extractMapping(text);
    }

    return Response.json({ mapping: mapping ?? {} });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
