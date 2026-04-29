import { createClient } from "@supabase/supabase-js";

// Do NOT throw at module level — Next.js evaluates this at build time when
// env vars are not yet available. The client will fail gracefully on actual
// requests if the variables are missing at runtime.
export const supabase = createClient(
  process.env.SUPABASE_URL     ?? "",
  process.env.SUPABASE_ANON_KEY ?? ""
);
