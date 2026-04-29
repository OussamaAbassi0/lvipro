export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { VeilleRow, rowToVeilleLead } from "@/lib/veilleDb";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── GET /api/data/veille ─────────────────────────────────────────────────────
// Retourne les posts veille paginés depuis la table SQL.
// Params: page (0-based), limit (max 300), statut, search

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page  = Math.max(0, parseInt(searchParams.get("page")  ?? "0",   10));
  const limit = Math.min(300, Math.max(1, parseInt(searchParams.get("limit") ?? "300", 10)));
  const statut = searchParams.get("statut") ?? "";
  const search = (searchParams.get("search") ?? "").trim();

  let q = supabase
    .from("veille")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * limit, page * limit + limit - 1);

  if (statut) q = q.eq("statut", statut);
  if (search) {
    const esc = search.replace(/[%_]/g, (c) => `\\${c}`);
    const pat = `%${esc}%`;
    q = q.or(
      `concurrent.ilike.${pat},client_final.ilike.${pat},extrait_post.ilike.${pat},type_projet.ilike.${pat}`
    );
  }

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data as VeilleRow[] | null ?? []).map(rowToVeilleLead);
  const total = count ?? 0;

  return NextResponse.json({
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
