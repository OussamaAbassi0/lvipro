export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

const FIELD_MAP: Record<string, string> = {
  entreprise: "entreprise",
  interet:    "interet",
  budget:     "budget",
  argumentIA: "argument_ia",
  sector:     "sector",
  employees:  "employees",
  email:      "email",
  linkedin:   "linkedin",
};

// ─── PATCH /api/data/salons/lead/[id] ─────────────────────────────────────────
// Body: { email?, argumentIA?, ... }

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(FIELD_MAP)) {
    if (body[key] !== undefined) patch[col] = body[key];
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ success: true });

  const { error } = await supabase.from("salon_leads").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// ─── DELETE /api/data/salons/lead/[id] ────────────────────────────────────────
// Si le salon devient vide, on le supprime aussi.

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // Récupère le salon_id avant suppression (pour nettoyage)
  const { data: lead } = await supabase
    .from("salon_leads")
    .select("salon_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("salon_leads").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Nettoyage : si le salon n'a plus de leads, on le supprime
  if (lead?.salon_id) {
    const { count } = await supabase
      .from("salon_leads")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", lead.salon_id);
    if ((count ?? 0) === 0) {
      await supabase.from("salons").delete().eq("id", lead.salon_id);
    }
  }

  return NextResponse.json({ success: true });
}
