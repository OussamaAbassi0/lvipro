export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AppDataStore, CampagneLead } from "@/lib/dataTypes";
import { leadToRow } from "@/lib/campagnesDb";

export const runtime = "nodejs";
export const maxDuration = 300;

const STORE_KEY = "main";
const BATCH_SIZE = 500;

// POST /api/admin/migrate-campagnes
// Headers: x-admin-secret: <ADMIN_MIGRATION_SECRET>
// One-shot migration du JSONB leads_store.data_json.campagnes vers la table campagnes.
// Ne vide PAS le JSONB — une rollback reste possible jusqu'au nettoyage manuel.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_MIGRATION_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error: readErr } = await supabase
    .from("leads_store")
    .select("data_json")
    .eq("type_auto", STORE_KEY)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json(
      { error: "Read failed", details: readErr.message },
      { status: 500 }
    );
  }

  const store = (data?.data_json as AppDataStore) ?? null;
  const leads: CampagneLead[] = store?.campagnes ?? [];

  if (leads.length === 0) {
    return NextResponse.json({ migrated: 0, total: 0, message: "Rien à migrer" });
  }

  const rows = leads.map(leadToRow);
  let migrated = 0;
  const errors: Array<{ batch: number; message: string }> = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("campagnes")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      errors.push({ batch: i / BATCH_SIZE, message: error.message });
    } else {
      migrated += batch.length;
    }
  }

  return NextResponse.json({
    migrated,
    total: leads.length,
    errors,
    note:
      "Migration terminée. Le JSONB source n'a PAS été effacé — lance /api/admin/migrate-campagnes?purge=1 après vérification pour le vider.",
  });
}

// DELETE /api/admin/migrate-campagnes?purge=1
// Vide data_json.campagnes après vérification (sécurité rollback)
export async function DELETE(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_MIGRATION_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("purge") !== "1") {
    return NextResponse.json({ error: "Pass ?purge=1 to confirm" }, { status: 400 });
  }

  const { data, error: readErr } = await supabase
    .from("leads_store")
    .select("data_json")
    .eq("type_auto", STORE_KEY)
    .maybeSingle();

  if (readErr || !data) {
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }

  const store = data.data_json as AppDataStore;
  const before = store.campagnes?.length ?? 0;
  store.campagnes = [];

  const { error: writeErr } = await supabase
    .from("leads_store")
    .upsert({ type_auto: STORE_KEY, data_json: store }, { onConflict: "type_auto" });

  if (writeErr) {
    return NextResponse.json({ error: "Write failed", details: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({ purged: before });
}
