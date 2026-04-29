export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CampagneRow, rowToLead } from "@/lib/campagnesDb";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── PATCH /api/data/campagnes/:id ───────────────────────────────────────────
// Body: partial CampagneLead update (frontend camelCase)
// Convertit en colonnes SQL (snake_case) avant l'update.

type PatchableField =
  | "nom" | "email" | "entite" | "segment" | "icebreaker"
  | "statut" | "visualAssigne" | "visualLabel" | "entiteConfidence" | "meta";

const FIELD_MAP: Record<PatchableField, string> = {
  nom: "nom",
  email: "email",
  entite: "entite",
  segment: "segment",
  icebreaker: "icebreaker",
  statut: "statut",
  visualAssigne: "visual_assigne",
  visualLabel: "visual_label",
  entiteConfidence: "entite_confidence",
  meta: "meta",
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    const col = FIELD_MAP[k as PatchableField];
    if (col) patch[col] = v;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No patchable fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("campagnes")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: rowToLead(data as CampagneRow) });
}

// ─── DELETE /api/data/campagnes/:id ──────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { error } = await supabase.from("campagnes").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
