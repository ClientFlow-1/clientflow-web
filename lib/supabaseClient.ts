// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Preuve visuelle dans la console navigateur
if (typeof window !== "undefined") {
  console.log("[Supabase] URL:", supabaseUrl);
  console.log("[Supabase] KEY PREFIX:", supabaseAnonKey.slice(0, 12)); // doit afficher sb_publishable_
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env vars (URL or ANON key).");
}

// Si tu vois encore "sb_secret_" ici => tu mens à toi-même ou Next n'a pas reload.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});