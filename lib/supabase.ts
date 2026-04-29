import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_ANON_KEY ?? "";

// Typed as `any` so query-result types remain `any` throughout the codebase,
// matching the original createClient("","") inference. Only instantiated when
// both env vars are present — avoids the build-time throw on Vercel.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = url && key ? createClient(url, key) : null;
