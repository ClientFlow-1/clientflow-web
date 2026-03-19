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
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature verification failed` }, { status: 400 });
  }

  const subscription = event.data.object as Stripe.Subscription;

  if (event.type === "customer.subscription.deleted") {
    const endsAt = new Date(subscription.current_period_end * 1000).toISOString();
    await supabase
      .from("workspaces")
      .update({
        subscription_status: "cancelled",
        subscription_ends_at: endsAt,
      })
      .eq("stripe_subscription_id", subscription.id);
  }

  if (event.type === "customer.subscription.updated" && subscription.status === "active") {
    await supabase
      .from("workspaces")
      .update({ subscription_status: "active" })
      .eq("stripe_subscription_id", subscription.id);
  }

  return NextResponse.json({ received: true });
}
