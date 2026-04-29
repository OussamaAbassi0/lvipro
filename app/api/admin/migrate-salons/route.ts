import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AppDataStore } from "@/lib/dataTypes";
import { salonToRow, salonLeadToRow } from "@/lib/salonsDb";

export const runtime = "nodejs";
export const maxDuration = 300;

const STORE_KEY = "main";

function auth(req: NextRequest): string | null {
  const expected = process.env.ADMIN_MIGRATION_SECRET;
  if (!expected) return "ADMIN_MIGRATION_SECRET env var not set";
  const got = req.headers.get("x-admin-secret");
  if (got !== expected) return "Invalid x-admin-secret";
  return null;
}

// POST : migre JSONB leads_store.data_json.salons → tables salons + salon_leads
export async function POST(req: NextRequest) {
  const err = auth(req);
  if (err) return NextResponse.json({ error: err }, { status: 401 });

  const { data, error } = await supabase
    .from("leads_store")
    .select("data_json")
    .eq("type_auto", STORE_KEY)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const store = (data?.data_json ?? {}) as AppDataStore;
  const salons = Array.isArray(store.salons) ? store.salons : [];

  let migratedSalons = 0;
  let migratedLeads = 0;

  for (const salon of salons) {
    if (!salon.id || !salon.nom) continue;
    const { error: sErr } = await supabase
      .from("salons")
      .upsert(salonToRow(salon), { onConflict: "id" });
    if (sErr) {
      return NextResponse.json(
        { error: `salon upsert failed: ${sErr.message}` },
        { status: 500 }
      );
    }
    migratedSalons++;

    if (Array.isArray(salon.leads) && salon.leads.length > 0) {
      const rows = salon.leads
        .filter((l) => l.id)
        .map((l) => salonLeadToRow(l, salon.id));
      if (rows.length > 0) {
        const { error: lErr } = await supabase
          .from("salon_leads")
          .upsert(rows, { onConflict: "id" });
        if (lErr) {
          return NextResponse.json(
            { error: `leads upsert failed: ${lErr.message}` },
            { status: 500 }
          );
        }
        migratedLeads += rows.length;
      }
    }
  }

  return NextResponse.json({ success: true, migratedSalons, migratedLeads });
}

// DELETE ?purge=1 : vide le JSONB salons après vérification
export async function DELETE(req: NextRequest) {
  const err = auth(req);
  if (err) return NextResponse.json({ error: err }, { status: 401 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("purge") !== "1") {
    return NextResponse.json(
      { error: "Pass ?purge=1 to confirm" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("leads_store")
    .select("data_json")
    .eq("type_auto", STORE_KEY)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const store = (data?.data_json ?? {}) as AppDataStore;
  store.salons = [];

  const { error: wErr } = await supabase
    .from("leads_store")
    .upsert(
      { type_auto: STORE_KEY, data_json: store },
      { onConflict: "type_auto" }
    );

  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
