export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { headers, rows, today } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "No API key" }, { status: 503 });
    }

    const SYSTEM_PROMPT = `Tu es un expert en nettoyage de données CRM pour commerces physiques français. Tu reçois un échantillon CSV potentiellement très mal formaté.

MISSION : analyser chaque colonne et retourner un JSON de transformation complet.

CHAMPS CLIENTFLOW DISPONIBLES : prenom, nom, nom_complet, email, telephone, date_naissance, adresse, montant_achat, date_achat, produit_achat, notes, ignorer

RÈGLES DE MAPPING (priorité absolue) :
- Colonne avec des @ dans les données → email (même si header = 'Contact', 'Coordonnées', etc.)
- Colonne avec 06/07/+33 dans les données → telephone
- Colonne avec €/euros/chiffres+virgule dans les données → montant_achat
- Colonne avec des dates ou expressions temporelles → date_achat si ressemble à une date d'achat, date_naissance si ressemble à un âge/naissance
- Colonne avec noms de personnes → nom_complet
- Colonne avec villes/adresses → adresse
- Colonne avec descriptions de produits → produit_achat
- Colonne avec commentaires/remarques → notes
- Numéros de ligne séquentiels (1,2,3...) → ignorer
- Civilités seules (M./Mme) → ignorer

TRANSFORMATIONS À APPLIQUER SUR CHAQUE VALEUR :

Pour nom_complet :
- Supprime civilités : M., Mme, Mme., Mr, M, Madame, Monsieur, épouse, veuve
- Supprime contenus entre parenthèses
- Si format 'NOM Prénom' (majuscules en premier) → inverse en 'Prénom NOM'
- Si format 'NOM, Prénom' → split sur la virgule
- Split final : premier mot = prénom, reste = nom
- Ex: 'DUPONT Marie' → prenom='Marie', nom='Dupont'
- Ex: 'Mme Lefevre Camille' → prenom='Camille', nom='Lefevre'
- Ex: 'Martin, Jean-Claude' → prenom='Jean-Claude', nom='Martin'
- Ex: 'Sylvie MARTIN (femme de Jean-Claude)' → prenom='Sylvie', nom='Martin'

Pour montant_achat :
- Supprime €, euros, EUR, espaces, espaces insécables
- Remplace virgule décimale par point
- parseFloat du résultat
- Si résultat = 0 ou NaN ou vide → null (pas de vente à créer)
- Ex: '1 240,50 €' → 1240.50, '89 euros' → 89.00, '€ 340' → 340.00

Pour date_achat et date_naissance (aujourd'hui = ${today}) :
- DD/MM/YYYY → parser correctement
- YYYY-MM-DD → garder tel quel
- DD-MM-YYYY → parser
- 'il y a X jours' → aujourd'hui - X jours
- 'il y a X semaines' → aujourd'hui - X*7 jours
- 'il y a X mois' → aujourd'hui - X mois
- 'avant-hier' → aujourd'hui - 2 jours, 'hier' → aujourd'hui - 1 jour
- 'la semaine dernière' → aujourd'hui - 7 jours
- 'le mois dernier' → premier jour du mois précédent
- 'mars 2024' → 2024-03-01, 'début 2025' → 2025-01-01, 'mi-2024' → 2024-07-01, 'fin 2023' → 2023-12-01
- 'Noël YYYY' → YYYY-12-25, 'été YYYY' → YYYY-07-01
- 'YYYY' seul → YYYY-01-01
- Date impossible (29/02 année non bissextile) → prendre le 28/02
- Si vraiment impossible à parser → null

Pour telephone :
- Supprime espaces, points, tirets, slashes, parenthèses
- Si commence par 0033 → remplace par +33
- Si commence par 33 et 11 chiffres → ajoute +
- Garde le + si présent

Pour email :
- Lowercase, trim espaces
- Si pas de @ → null

RETOURNE UNIQUEMENT ce JSON strict sans markdown ni explication :
{"mapping":{"colonne_csv":"champ_clientflow"},"donnees_transformees":[{"prenom":"Marie","nom":"Dupont","email":"marie@gmail.com","telephone":"0611223344","montant_achat":127.00,"date_achat":"2026-03-04","date_naissance":"1985-01-12","adresse":"Lyon","produit_achat":"robe rouge","notes":"très sympa"}]}

Inclure dans donnees_transformees TOUS les champs qui ont une valeur non-nulle. Omettre les clés avec valeur null ou vide.`;

    const userContent = `Aujourd'hui : ${today}
En-têtes CSV : ${JSON.stringify(headers)}
Données (${rows.length} lignes) :
${(rows as string[][]).map((r, i) => `Ligne ${i + 1}: ${JSON.stringify(Object.fromEntries((headers as string[]).map((h: string, j: number) => [h, r[j] ?? ""])))}`).join("\n")}`;

    const callClaude = async (userMsg: string) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
      const data = await res.json();
      return data.content?.[0]?.text ?? "";
    };

    let text = await callClaude(userContent);

    // Extract JSON
    let parsed: any = null;
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch {}
    }

    // Retry once with simplified prompt if failed
    if (!parsed?.donnees_transformees) {
      const retryMsg = `Aujourd'hui : ${today}
En-têtes : ${JSON.stringify(headers)}
Ligne 1 : ${JSON.stringify(Object.fromEntries((headers as string[]).map((h: string, j: number) => [h, (rows as string[][])[0]?.[j] ?? ""])))}
Réponds UNIQUEMENT avec le JSON demandé, rien d'autre.`;
      text = await callClaude(retryMsg);
      const m2 = text.match(/\{[\s\S]*\}/);
      if (m2) { try { parsed = JSON.parse(m2[0]); } catch {} }
    }

    return Response.json({
      mapping: parsed?.mapping ?? {},
      donnees_transformees: parsed?.donnees_transformees ?? [],
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
