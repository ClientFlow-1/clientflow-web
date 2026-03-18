export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { headers, sample } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "No API key" }, { status: 503 });
    }

    const prompt = `Tu es un assistant qui analyse des fichiers CSV de commerces physiques. On t'envoie les en-têtes et un échantillon de données.
Tu dois mapper chaque colonne vers un des champs ClientFlow : prenom, nom, email, telephone, date_naissance, adresse, montant_achat, date_achat, produit_achat, notes, ou "ignorer" si la colonne n'est pas utile.
Si une colonne contient clairement des emails (format xxx@xxx.xxx), mappe-la sur "email" même si le nom de colonne est inhabituel.
Réponds UNIQUEMENT en JSON valide, sans markdown : { "mapping": { "nom_colonne_csv": "champ_clientflow" } }

En-têtes CSV : ${JSON.stringify(headers)}
Échantillon (3 premières lignes) :
${(sample as string[][]).map((row, i) => `Ligne ${i + 1}: ${JSON.stringify(row)}`).join("\n")}`;

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
