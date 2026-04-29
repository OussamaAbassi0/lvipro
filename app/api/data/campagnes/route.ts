import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CampagneRow, rowToLead } from "@/lib/campagnesDb";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── GET /api/data/campagnes ─────────────────────────────────────────────────
// Pagination SQL native sur la table `campagnes`.
//
// Query params:
//   page    — 1-indexed (default 1)
//   limit   — items per page (default 100, max 500)
//   statut  — filter exact (optional)
//   segment — filter exact (optional). "__none__" pour les segments vides.
//   search  — substring case-insensitive sur nom/entite/email/segment
//   sort    — "updated_desc" (default) | "nom_asc" | "email_asc"
//
// Response: { items: CampagneLead[]; total: number; page: number; totalPages: number }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    500,
    Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100)
  );
  const statut = searchParams.get("statut") ?? "";
  const segment = searchParams.get("segment") ?? "";
  const search = (searchParams.get("search") ?? "").trim();
  const sort = searchParams.get("sort") ?? "updated_desc";

  let query = supabase
    .from("campagnes")
    .select("*", { count: "exact" });

  if (statut) query = query.eq("statut", statut);
  if (segment === "__none__") query = query.or("segment.is.null,segment.eq.");
  else if (segment) query = query.eq("segment", segment);

  if (search) {
    const esc = search.replace(/[%_,]/g, (c) => `\\${c}`);
    const pat = `%${esc}%`;
    query = query.or(
      `nom.ilike.${pat},entite.ilike.${pat},email.ilike.${pat},segment.ilike.${pat}`
    );
  }

  // Tri
  if (sort === "nom_asc") query = query.order("nom", { ascending: true });
  else if (sort === "email_asc") query = query.order("email", { ascending: true });
  else query = query.order("updated_at", { ascending: false });

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("[/api/data/campagnes] error:", error);
    return NextResponse.json(
      { error: "Read failed", details: error.message },
      { status: 500 }
    );
  }

  const items = (data as CampagneRow[] | null)?.map(rowToLead) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json({
    items,
    total,
    page: Math.min(page, totalPages),
    totalPages,
  });
}
