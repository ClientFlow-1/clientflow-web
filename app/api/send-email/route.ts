import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, test, to, subject, html, from: fromEmail } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "Clé API manquante" }, { status: 400 });
    }

    const resend = new Resend(apiKey);

    // Mode test : vérifie que la clé est valide sans envoyer d'email
    if (test) {
      const { error } = await resend.domains.list();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (!to?.length) {
      return NextResponse.json({ error: "Aucun destinataire" }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ error: "Objet manquant" }, { status: 400 });
    }
    if (!html) {
      return NextResponse.json({ error: "Contenu HTML manquant" }, { status: 400 });
    }

    // Resend limite à 50 destinataires par appel — on envoie par batch
    const BATCH_SIZE = 50;
    const batches: string[][] = [];
    for (let i = 0; i < to.length; i += BATCH_SIZE) {
      batches.push(to.slice(i, i + BATCH_SIZE));
    }

    let totalSent = 0;
    for (const batch of batches) {
      const { error } = await resend.emails.send({
        from: fromEmail ?? "onboarding@resend.dev",
        to: batch,
        subject,
        html,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      totalSent += batch.length;
    }

    return NextResponse.json({ success: true, sent: totalSent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
