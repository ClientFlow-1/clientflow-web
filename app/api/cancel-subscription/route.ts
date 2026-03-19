import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // 1. Auth
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Parse body
  const { workspaceId } = await req.json().catch(() => ({}));
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId requis" }, { status: 400 });
  }

  // 3. Verify ownership + get stripe_subscription_id
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("id, user_id, stripe_subscription_id, subscription_status")
    .eq("id", workspaceId)
    .single();

  if (wsError || !workspace) {
    return NextResponse.json({ error: "Workspace introuvable" }, { status: 404 });
  }

  if (workspace.user_id !== user.id) {
    return NextResponse.json({ error: "Accès refusé — vous n'êtes pas owner de ce workspace" }, { status: 403 });
  }

  if (workspace.subscription_status === "cancelled") {
    return NextResponse.json({ error: "Abonnement déjà résilié" }, { status: 400 });
  }

  if (!workspace.stripe_subscription_id) {
    return NextResponse.json({ error: "Aucun abonnement Stripe associé à ce workspace" }, { status: 400 });
  }

  // 4. Cancel at period end via Stripe
  const subscription = await stripe.subscriptions.update(workspace.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  const endsAt = new Date(subscription.current_period_end * 1000).toISOString();

  // 5. Update workspaces table
  const { error: updateError } = await supabase
    .from("workspaces")
    .update({
      subscription_status: "cancelled",
      subscription_ends_at: endsAt,
    })
    .eq("id", workspaceId);

  if (updateError) {
    return NextResponse.json({ error: "Stripe mis à jour mais erreur BDD : " + updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, subscription_ends_at: endsAt });
}
