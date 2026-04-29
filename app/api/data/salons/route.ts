import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Salon, SalonLead } from "@/lib/dataTypes";
import {
  SalonRow,
  SalonLeadRow,
  salonRowToSalon,
  leadRowToSalonLead,
  salonToRow,
  salonLeadToRow,
} from "@/lib/salonsDb";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── GET /api/data/salons ─────────────────────────────────────────────────────
// Retourne les salons avec leurs leads (1 requête SQL chacune, merge en JS).
export async function GET() {
  const [salonsRes, leadsRes] = await Promise.all([
    supabase.from("salons").select("*").order("updated_at", { ascending: false }),
    supabase.from("salon_leads").select("*"),
  ]);

  if (salonsRes.error) {
    return NextResponse.json({ error: salonsRes.error.message }, { status: 500 });
  }
  if (leadsRes.error) {
    return NextResponse.json({ error: leadsRes.error.message }, { status: 500 });
  }

  const salonRows = (salonsRes.data as SalonRow[] | null) ?? [];
  const leadRows  = (leadsRes.data  as SalonLeadRow[] | null) ?? [];

  const leadsBySalon = new Map<string, SalonLead[]>();
  for (const r of leadRows) {
    const arr = leadsBySalon.get(r.salon_id) ?? [];
    arr.push(leadRowToSalonLead(r));
    leadsBySalon.set(r.salon_id, arr);
  }

  const salons = salonRows
    .map((r) => salonRowToSalon(r, leadsBySalon.get(r.id) ?? []))
    .filter((s) => s.leads.length > 0);

  return NextResponse.json({ salons });
}

// ─── POST /api/data/salons ────────────────────────────────────────────────────
// Upsert d'un salon complet avec tous ses leads (utilisé par n8n source=auto3).
// Body: { salon: Salon }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const salon = body.salon as Salon | undefined;

  if (!salon || !salon.id || !salon.nom) {
    return NextResponse.json(
      { success: false, error: "salon.id and salon.nom required" },
      { status: 400 }
    );
  }

  const { error: sErr } = await supabase
    .from("salons")
    .upsert(salonToRow(salon), { onConflict: "id" });

  if (sErr) {
    return NextResponse.json({ success: false, error: sErr.message }, { status: 500 });
  }

  if (Array.isArray(salon.leads) && salon.leads.length > 0) {
    const rows = salon.leads.map((l) => salonLeadToRow(l, salon.id));
    const { error: lErr } = await supabase
      .from("salon_leads")
      .upsert(rows, { onConflict: "id" });

    if (lErr) {
      return NextResponse.json({ success: false, error: lErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
