import { createClient } from "@supabase/supabase-js";

// Guard against build-time evaluation with missing env vars.
// Next.js evaluates modules during static analysis; createClient throws on
// empty strings, so we only instantiate when both vars are present.
const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_ANON_KEY ?? "";

export const supabase = (
  url && key ? createClient(url, key) : null
) as ReturnType<typeof createClient>;
