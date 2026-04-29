export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CampagneLead } from "@/lib/dataTypes";
import { leadToRow } from "@/lib/campagnesDb";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 500;

// ─── POST /api/data/campagnes/bulk ───────────────────────────────────────────
// Upsert batch (CSV import, n8n Auto 2 push). Body: { leads: CampagneLead[] }
// Chunké par 500 pour éviter les payloads massifs côté Postgres.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const leads: CampagneLead[] = Array.isArray(body.leads) ? body.leads : [];

  if (leads.length === 0) {
    return NextResponse.json({ upserted: 0 });
  }

  const rows = leads.map(leadToRow);
  let upserted = 0;
  const errors: Array<{ batch: number; message: string }> = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("campagnes")
      .upsert(batch, { onConflict: "id" });

    if (error) errors.push({ batch: i / BATCH_SIZE, message: error.message });
    else upserted += batch.length;
  }

  // Mettre à jour lastSync.auto2 dans leads_store (le GET /api/data le renvoie toujours)
  const nowIso = new Date().toISOString();
  const { data: store } = await supabase
    .from("leads_store")
    .select("data_json")
    .eq("type_auto", "main")
    .single();
  if (store?.data_json) {
    const next = store.data_json as Record<string, unknown>;
    const lastSync = (next.lastSync as Record<string, string>) ?? {};
    lastSync.auto2 = nowIso;
    next.lastSync = lastSync;
    await supabase
      .from("leads_store")
      .upsert({ type_auto: "main", data_json: next }, { onConflict: "type_auto" });
  }

  return NextResponse.json({
    success: errors.length === 0,
    upserted,
    total: leads.length,
    errors,
  });
}

// ─── DELETE /api/data/campagnes/bulk ─────────────────────────────────────────
// Body: { ids: string[] } — suppression groupée.

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

  if (ids.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  let deleted = 0;
  const errors: Array<{ batch: number; message: string }> = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from("campagnes")
      .delete({ count: "exact" })
      .in("id", batch);

    if (error) errors.push({ batch: i / BATCH_SIZE, message: error.message });
    else deleted += count ?? 0;
  }

  return NextResponse.json({ success: errors.length === 0, deleted, errors });
}
