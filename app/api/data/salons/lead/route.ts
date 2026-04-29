import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SalonLead } from "@/lib/dataTypes";
import { salonLeadToRow } from "@/lib/salonsDb";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── POST /api/data/salons/lead ───────────────────────────────────────────────
// Atomic find-or-create salon + upsert lead — pas de race condition.
// Utilisé par n8n Auto 3 source=auto3-lead.
// Body: {
//   salonNom: string,
//   salonLieu?: string, salonDates?: string, salonSecteur?: string, salonVisiteurs?: string,
//   lead: SalonLead,
// }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    salonNom,
    salonLieu = "",
    salonDates = "",
    salonSecteur = "",
    salonVisiteurs = "",
    lead,
  } = body as {
    salonNom?: string;
    salonLieu?: string;
    salonDates?: string;
    salonSecteur?: string;
    salonVisiteurs?: string;
    lead?: SalonLead;
  };

  if (!salonNom || !lead || !lead.id) {
    return NextResponse.json(
      { success: false, error: "salonNom, lead.id required" },
      { status: 400 }
    );
  }

  // 1. Trouver ou créer le salon (unique index sur nom)
  const { data: existing, error: findErr } = await supabase
    .from("salons")
    .select("id, lieu, dates, secteur, visiteurs")
    .eq("nom", salonNom)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ success: false, error: findErr.message }, { status: 500 });
  }

  let salonId: string;
  if (existing) {
    salonId = existing.id;
    // Compléter les métadonnées du salon si elles étaient vides
    const updates: Record<string, string> = {};
    if (salonLieu      && !existing.lieu)      updates.lieu      = salonLieu;
    if (salonDates     && !existing.dates)     updates.dates     = salonDates;
    if (salonSecteur   && !existing.secteur)   updates.secteur   = salonSecteur;
    if (salonVisiteurs && !existing.visiteurs) updates.visiteurs = salonVisiteurs;
    updates.status = "Scraped";
    if (Object.keys(updates).length > 0) {
      await supabase.from("salons").update(updates).eq("id", salonId);
    }
  } else {
    salonId = `salon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { error: insErr } = await supabase.from("salons").insert({
      id: salonId,
      nom: salonNom,
      lieu: salonLieu,
      dates: salonDates,
      secteur: salonSecteur,
      visiteurs: salonVisiteurs,
      status: "Scraped",
    });
    // Si INSERT échoue pour conflit (race sur création), relire le salon existant
    if (insErr) {
      const { data: retry } = await supabase
        .from("salons")
        .select("id")
        .eq("nom", salonNom)
        .maybeSingle();
      if (retry) salonId = retry.id;
      else return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
    }
  }

  // 2. Upsert du lead (atomic, pas de read-modify-write)
  const leadRow = salonLeadToRow(lead, salonId);
  const { error: leadErr } = await supabase
    .from("salon_leads")
    .upsert(leadRow, { onConflict: "id" });

  if (leadErr) {
    return NextResponse.json({ success: false, error: leadErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, salonId, leadId: lead.id });
}
