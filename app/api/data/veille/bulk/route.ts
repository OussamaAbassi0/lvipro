import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { VeilleLead } from "@/lib/dataTypes";
import { veilleLeadToRow } from "@/lib/veilleDb";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH = 500;

// ─── POST /api/data/veille/bulk ───────────────────────────────────────────────
// n8n Auto 1 POST ici avec { leads: VeilleLead[] }
// Upsert en lots de 500.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const leads = (body.leads ?? []) as VeilleLead[];

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ success: true, upserted: 0 });
  }

  const rows = leads.map(veilleLeadToRow);
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("veille")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, upserted: leads.length });
}

// ─── DELETE /api/data/veille/bulk ─────────────────────────────────────────────
// Body: { ids: string[] }

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids = (body.ids ?? []) as string[];

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ success: true, deleted: 0 });
  }

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { error } = await supabase.from("veille").delete().in("id", batch);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, deleted: ids.length });
}
