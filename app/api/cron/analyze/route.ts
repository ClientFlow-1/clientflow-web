import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

/* ── Types ──────────────────────────────────────────────────── */
type NotifType = "stock" | "relance" | "inactif" | "suggestion";

interface NotificationInsert {
  workspace_id: string;
  type: NotifType;
  title: string;
  message: string;
}

/* ── Supabase admin client (bypasses RLS) ───────────────────── */
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/* ── Dedup: vrai si une notif identique existe dans les 24h ─── */
async function alreadyNotified(
  sb: ReturnType<typeof adminClient>,
  workspaceId: string,
  type: NotifType,
  title: string
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("notifications")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("type", type)
    .eq("title", title)
    .gte("created_at", since)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/* ── Helpers ────────────────────────────────────────────────── */
function listNames(names: string[], max = 3): string {
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} et ${names.length - max} autres` : shown;
}

/* ── GET /api/cron/analyze ──────────────────────────────────── */
export async function GET(request: NextRequest) {
  /* 0. Vérification du token */
  const auth = request.headers.get("Authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = adminClient();
  const now = new Date();
  const insertedLog: string[] = [];

  try {
    /* 1. Tous les workspaces ─────────────────────────────────── */
    const { data: workspaces, error: wsErr } = await sb
      .from("workspaces")
      .select("id, name");

    if (wsErr) throw wsErr;
    if (!workspaces?.length) return Response.json({ ok: true, processed: 0 });

    for (const ws of workspaces) {
      const toInsert: NotificationInsert[] = [];

      /* 2. Stock faible ou rupture ──────────────────────────── */
      const { data: lowStock } = await sb
        .from("inventory")
        .select("quantity, product_id, products(name)")
        .eq("workspace_id", ws.id)
        .lte("quantity", 5)
        .gte("quantity", 0);

      for (const item of lowStock ?? []) {
        const productName = (item.products as unknown as { name: string } | null)?.name ?? "Produit inconnu";
        const isRupture = item.quantity === 0;
        const title = isRupture
          ? `Rupture de stock : ${productName}`
          : `Stock faible : ${productName}`;
        const message = isRupture
          ? `${productName} est en rupture totale. Réapprovisionnez dès que possible.`
          : `${productName} n'a plus que ${item.quantity} unité(s) en stock.`;

        if (!(await alreadyNotified(sb, ws.id, "stock", title))) {
          toInsert.push({ workspace_id: ws.id, type: "stock", title, message });
        }
      }

      /* 3 & 4. Segments clients ─────────────────────────────── */
      // Dernière vente par client
      const { data: allSales } = await sb
        .from("sales")
        .select("client_id, created_at")
        .eq("workspace_id", ws.id)
        .order("created_at", { ascending: false });

      const lastSaleMap = new Map<string, Date>();
      for (const s of allSales ?? []) {
        if (!lastSaleMap.has(s.client_id)) {
          lastSaleMap.set(s.client_id, new Date(s.created_at));
        }
      }

      // Tous les clients du workspace
      const { data: clients } = await sb
        .from("clients")
        .select("id, prenom, nom")
        .eq("workspace_id", ws.id);

      const seg30: string[] = [];
      const seg60: string[] = [];
      const seg90: string[] = [];
      const seg180: string[] = [];
      const noSale: string[] = [];

      for (const client of clients ?? []) {
        const fullName = `${client.prenom} ${client.nom}`.trim();
        const last = lastSaleMap.get(client.id);
        if (!last) {
          noSale.push(fullName);
          continue;
        }
        const days = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
        if (days >= 180) seg180.push(fullName);
        else if (days >= 90) seg90.push(fullName);
        else if (days >= 60) seg60.push(fullName);
        else if (days >= 30) seg30.push(fullName);
      }

      // Relances à 30j
      if (seg30.length) {
        const title = `${seg30.length} client(s) à relancer — sans achat depuis 30 j`;
        if (!(await alreadyNotified(sb, ws.id, "relance", title))) {
          toInsert.push({
            workspace_id: ws.id, type: "relance", title,
            message: `${listNames(seg30)} n'ont pas acheté depuis plus de 30 jours. Envoyez une relance personnalisée.`,
          });
        }
      }
      // Relances à 60j
      if (seg60.length) {
        const title = `${seg60.length} client(s) à relancer — sans achat depuis 60 j`;
        if (!(await alreadyNotified(sb, ws.id, "relance", title))) {
          toInsert.push({
            workspace_id: ws.id, type: "relance", title,
            message: `${listNames(seg60)} sont sans achat depuis plus de 60 jours. Une offre ciblée peut les faire revenir.`,
          });
        }
      }
      // Relances à 90j
      if (seg90.length) {
        const title = `${seg90.length} client(s) à relancer — sans achat depuis 90 j`;
        if (!(await alreadyNotified(sb, ws.id, "relance", title))) {
          toInsert.push({
            workspace_id: ws.id, type: "relance", title,
            message: `${listNames(seg90)} n'ont pas acheté depuis plus de 90 jours. Utilisez un template de réactivation fort.`,
          });
        }
      }
      // Inactifs +180j
      if (seg180.length) {
        const title = `${seg180.length} client(s) inactif(s) depuis +6 mois`;
        if (!(await alreadyNotified(sb, ws.id, "inactif", title))) {
          toInsert.push({
            workspace_id: ws.id, type: "inactif", title,
            message: `${listNames(seg180)} sont inactifs depuis plus de 6 mois. Envisagez une campagne de réactivation ou de nettoyage de base.`,
          });
        }
      }
      // Sans aucun achat
      if (noSale.length) {
        const title = `${noSale.length} client(s) sans aucun achat enregistré`;
        if (!(await alreadyNotified(sb, ws.id, "relance", title))) {
          toInsert.push({
            workspace_id: ws.id, type: "relance", title,
            message: `${listNames(noSale)} sont dans votre base mais n'ont jamais acheté. Relancez-les avec une offre de bienvenue.`,
          });
        }
      }

      /* 5. Suggestion IA (Claude) ───────────────────────────── */
      if (process.env.ANTHROPIC_API_KEY) {
        const prompt = [
          `Tu es un assistant CRM expert pour boutiques physiques.`,
          `Voici le résumé de la boutique "${ws.name}" aujourd'hui :`,
          `- Produits en stock faible ou rupture : ${lowStock?.length ?? 0}`,
          `- Clients sans achat depuis 30 j : ${seg30.length}`,
          `- Clients sans achat depuis 60 j : ${seg60.length}`,
          `- Clients sans achat depuis 90 j : ${seg90.length}`,
          `- Clients inactifs depuis +180 j : ${seg180.length}`,
          `- Clients sans aucun achat : ${noSale.length}`,
          ``,
          `Génère UNE suggestion concrète, personnalisée et directement actionnable en français (2 phrases max).`,
          `Ne cite pas les chiffres bruts. Donne un conseil stratégique précis adapté à la situation.`,
        ].join("\n");

        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 256,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const suggestion: string | undefined = aiData.content?.[0]?.text?.trim();
          if (suggestion) {
            const title = `Suggestion IA — ${now.toLocaleDateString("fr-FR")}`;
            if (!(await alreadyNotified(sb, ws.id, "suggestion", title))) {
              toInsert.push({ workspace_id: ws.id, type: "suggestion", title, message: suggestion });
            }
          }
        }
      }

      /* 6. Insertion des notifications ─────────────────────── */
      if (toInsert.length) {
        const { error: insertErr } = await sb.from("notifications").insert(toInsert);
        if (!insertErr) {
          insertedLog.push(...toInsert.map((n) => `[${ws.name}] ${n.type}: ${n.title}`));
        } else {
          console.error(`[cron/analyze] insert error for ${ws.name}:`, insertErr.message);
        }
      }
    }

    return Response.json({
      ok: true,
      processed: workspaces.length,
      inserted: insertedLog.length,
      log: insertedLog,
    });
  } catch (err) {
    console.error("[cron/analyze] fatal:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

/* Empêche Next.js de mettre la route en cache */
export const dynamic = "force-dynamic";
