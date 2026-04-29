export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── PATCH /api/data/veille/[id] ──────────────────────────────────────────────
// Body: { statut?: string, ... }

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const FIELD_MAP: Record<string, string> = {
    statut:       "statut",
    concurrent:   "concurrent",
    clientFinal:  "client_final",
    secteur:      "secteur",
    typeProjet:   "type_projet",
    localisation: "localisation",
    technologie:  "technologie",
    scoreIA:      "score_ia",
    scoreNum:     "score_num",
    opportunite:  "opportunite",
    extraitPost:  "extrait_post",
    citationCle:  "citation_cle",
    urlPost:      "url_post",
  };

  const patch: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(FIELD_MAP)) {
    if (body[key] !== undefined) patch[col] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase.from("veille").update(patch).eq("id", id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ─── DELETE /api/data/veille/[id] ─────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { error } = await supabase.from("veille").delete().eq("id", id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
