export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { headers, sample } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "No API key" }, { status: 503 });
    }

    // Format sample as objects for readability
    const sampleObjects = (sample as string[][]).map((row, i) =>
      `Ligne ${i + 1}: ${JSON.stringify(
        Object.fromEntries((headers as string[]).map((h: string, j: number) => [h, row[j] ?? ""]))
      )}`
    ).join("\n");

    const prompt = `Tu es un expert en import de données CRM pour commerces physiques français. Analyse ces en-têtes CSV et cet échantillon de données.

Mappe CHAQUE colonne vers le bon champ ClientFlow. Ne laisse JAMAIS une colonne utile sur "ignorer" si elle contient des données exploitables.

Champs disponibles :
- prenom : prénom seul
- nom : nom de famille seul
- nom_complet : prénom ET nom dans la même colonne (le système splittera automatiquement au premier espace)
- email : adresse email
- telephone : numéro de téléphone
- date_naissance : date de naissance
- adresse : adresse postale / ville / code postal
- montant_achat : montant en euros d'un achat
- date_achat : date d'un achat
- produit_achat : nom du produit acheté
- notes : commentaires / remarques libres
- ignorer : colonne sans intérêt CRM

Règles strictes :
- Si prénom ET nom sont dans la même colonne (ex: "Marie Dupont", "Jean-Paul Martin") → mappe sur "nom_complet"
- Si une valeur contient "@" → force "email" même si le nom de colonne est bizarre
- Si une valeur ressemble à un numéro de téléphone (chiffres, +33, espaces) → force "telephone"
- derniere_commande, date_commande, date_achat, last_purchase, order_date → "date_achat"
- valeur_commande, montant, total, amount, panier, ca, chiffre, prix, spent, revenue → "montant_achat"
- civilite, identifiant, id, ref, uuid, code, numero, rang → "ignorer"
- Sois agressif : mappe le maximum de colonnes vers des champs utiles.

Réponds UNIQUEMENT en JSON valide, aucun texte autour, aucun markdown :
{ "mapping": { "nom_colonne_csv": "champ_clientflow" } }

En-têtes CSV : ${JSON.stringify(headers)}
Échantillon de données :
${sampleObjects}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const text: string = aiData.content?.[0]?.text ?? "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return Response.json({ mapping: {} });
    }

    const parsed = JSON.parse(match[0]);
    return Response.json({ mapping: parsed.mapping ?? {} });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
