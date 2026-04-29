export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { AppDataStore, EMPTY_STORE, VeilleLead, CampagneLead, Salon, SalonLead } from "@/lib/dataTypes";
import { supabase } from "@/lib/supabase";
import { leadToRow } from "@/lib/campagnesDb";
import { salonToRow, salonLeadToRow } from "@/lib/salonsDb";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── n8n workflows POST here when they finish ───────────────────────────────
//
// Storage:
//   - veille     : table `veille`       (rows)
//   - campagnes  : table `campagnes`    (rows)
//   - salons     : table `salons`       (rows, relationnel)
//   - salon_leads: table `salon_leads`  (rows, FK salon_id)
//   - lastSync   : table `leads_store`  (JSONB — uniquement timestamps)
//
// Toutes les sources n8n legacy (auto2, auto3, auto3-lead, patch/delete
// collection=campagnes, patch-salon-lead, delete-salon-lead) sont acceptées
// et redirigées vers les tables SQL dédiées pour compat rétroactive.

const STORE_KEY = "main";
const CAMP_BATCH = 500;

async function readStore(): Promise<AppDataStore> {
  const { data, error } = await supabase
    .from("leads_store")
    .select("data_json")
    .eq("type_auto", STORE_KEY)
    .single();

  if (error || !data) return { ...EMPTY_STORE };
  return (data.data_json as AppDataStore) ?? { ...EMPTY_STORE };
}

async function writeStore(store: AppDataStore): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("leads_store")
    .upsert(
      { type_auto: STORE_KEY, data_json: store },
      { onConflict: "type_auto" }
    );
  return { error: error?.message ?? null };
}

async function upsertCampagnesBatch(leads: CampagneLead[]): Promise<string | null> {
  const rows = leads.map(leadToRow);
  for (let i = 0; i < rows.length; i += CAMP_BATCH) {
    const batch = rows.slice(i, i + CAMP_BATCH);
    const { error } = await supabase
      .from("campagnes")
      .upsert(batch, { onConflict: "id" });
    if (error) return error.message;
  }
  return null;
}

// ─── Salon helpers (atomic, SQL) ─────────────────────────────────────────────

async function findOrCreateSalon(
  nom: string,
  lieu = "",
  dates = "",
  secteur = "",
  visiteurs = ""
): Promise<{ salonId: string; error: string | null }> {
  const { data: existing, error: findErr } = await supabase
    .from("salons")
    .select("id, lieu, dates, secteur, visiteurs")
    .eq("nom", nom)
    .maybeSingle();

  if (findErr) return { salonId: "", error: findErr.message };

  if (existing) {
    const updates: Record<string, string> = {};
    if (lieu      && !existing.lieu)      updates.lieu      = lieu;
    if (dates     && !existing.dates)     updates.dates     = dates;
    if (secteur   && !existing.secteur)   updates.secteur   = secteur;
    if (visiteurs && !existing.visiteurs) updates.visiteurs = visiteurs;
    updates.status = "Scraped";
    if (Object.keys(updates).length > 0) {
      await supabase.from("salons").update(updates).eq("id", existing.id);
    }
    return { salonId: existing.id, error: null };
  }

  const salonId = `salon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error: insErr } = await supabase.from("salons").insert({
    id: salonId,
    nom,
    lieu,
    dates,
    secteur,
    visiteurs,
    status: "Scraped",
  });

  if (insErr) {
    // Race sur création concurrente → relire le salon existant
    const { data: retry } = await supabase
      .from("salons")
      .select("id")
      .eq("nom", nom)
      .maybeSingle();
    if (retry) return { salonId: retry.id, error: null };
    return { salonId: "", error: insErr.message };
  }

  return { salonId, error: null };
}

export async function GET() {
  const { data, error } = await supabase
    .from("leads_store")
    .select("data_json")
    .eq("type_auto", STORE_KEY)
    .single();

  if (error) {
    console.error("[/api/data] Supabase error:", error);
    return NextResponse.json(
      { error: "Supabase read failed", details: error.message },
      { status: 500 }
    );
  }

  const store = ((data?.data_json as AppDataStore) ?? { ...EMPTY_STORE });
  // campagnes + salons vivent dans leurs propres tables — jamais renvoyés ici.
  const { campagnes: _c, salons: _s, ...light } = store;
  void _c;
  void _s;
  return NextResponse.json({
    ...light,
    campagnes: [] as CampagneLead[],
    salons: [] as Salon[],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // ── Campagnes sources : SQL ──────────────────────────────────────────────
  if ((body.source === "auto2" || body.source === "manual_campagne") && Array.isArray(body.leads)) {
    const leads = body.leads as CampagneLead[];
    const err = await upsertCampagnesBatch(leads);
    if (err) {
      return NextResponse.json({ success: false, error: err }, { status: 500 });
    }
    const store = await readStore();
    store.lastSync.auto2 = new Date().toISOString();
    await writeStore(store);
    return NextResponse.json({ success: true, upserted: leads.length });
  }

  if (body.source === "patch" && body.collection === "campagnes" && body.id && body.update) {
    const update = body.update as Partial<CampagneLead>;
    const patch: Record<string, unknown> = {};
    if (update.nom !== undefined)              patch.nom = update.nom;
    if (update.email !== undefined)            patch.email = update.email;
    if (update.entite !== undefined)           patch.entite = update.entite;
    if (update.segment !== undefined)          patch.segment = update.segment;
    if (update.icebreaker !== undefined)       patch.icebreaker = update.icebreaker;
    if (update.statut !== undefined)           patch.statut = update.statut;
    if (update.visualAssigne !== undefined)    patch.visual_assigne = update.visualAssigne;
    if (update.visualLabel !== undefined)      patch.visual_label = update.visualLabel;
    if (update.entiteConfidence !== undefined) patch.entite_confidence = update.entiteConfidence;
    if (update.meta !== undefined)             patch.meta = update.meta;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true });
    }
    const { error } = await supabase.from("campagnes").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.source === "delete" && body.collection === "campagnes" && body.id) {
    const { error } = await supabase.from("campagnes").delete().eq("id", body.id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.source === "delete-many" && body.collection === "campagnes" && Array.isArray(body.ids)) {
    const ids = body.ids as string[];
    for (let i = 0; i < ids.length; i += CAMP_BATCH) {
      const batch = ids.slice(i, i + CAMP_BATCH);
      const { error } = await supabase.from("campagnes").delete().in("id", batch);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, deleted: ids.length });
  }

  // ── Salons sources : SQL atomic (pas de race condition) ──────────────────
  if (body.source === "auto3" && body.salon) {
    const salon = body.salon as Salon;
    if (!salon.id || !salon.nom) {
      return NextResponse.json(
        { success: false, error: "salon.id and salon.nom required" },
        { status: 400 }
      );
    }
    const { error: sErr } = await supabase
      .from("salons")
      .upsert(salonToRow(salon), { onConflict: "id" });
    if (sErr) return NextResponse.json({ success: false, error: sErr.message }, { status: 500 });

    if (Array.isArray(salon.leads) && salon.leads.length > 0) {
      const rows = salon.leads.map((l) => salonLeadToRow(l, salon.id));
      const { error: lErr } = await supabase
        .from("salon_leads")
        .upsert(rows, { onConflict: "id" });
      if (lErr) return NextResponse.json({ success: false, error: lErr.message }, { status: 500 });
    }

    const store = await readStore();
    store.lastSync.auto3 = new Date().toISOString();
    await writeStore(store);

    return NextResponse.json({ success: true });
  }

  if (body.source === "auto3-lead" && body.salonNom && body.lead) {
    const lead = body.lead as SalonLead;
    const salonNom = body.salonNom as string;
    if (!lead.id) {
      return NextResponse.json({ success: false, error: "lead.id required" }, { status: 400 });
    }

    const { salonId, error: sErr } = await findOrCreateSalon(
      salonNom,
      (body.salonLieu      as string) || "",
      (body.salonDates     as string) || "",
      (body.salonSecteur   as string) || "",
      (body.salonVisiteurs as string) || ""
    );
    if (sErr) return NextResponse.json({ success: false, error: sErr }, { status: 500 });

    const leadRow = salonLeadToRow(lead, salonId);
    const { error: leadErr } = await supabase
      .from("salon_leads")
      .upsert(leadRow, { onConflict: "id" });

    if (leadErr) return NextResponse.json({ success: false, error: leadErr.message }, { status: 500 });

    const store = await readStore();
    store.lastSync.auto3 = new Date().toISOString();
    await writeStore(store);

    return NextResponse.json({ success: true, salonId, leadId: lead.id });
  }

  if (body.source === "patch-salon-lead" && body.leadId && body.update) {
    const update = body.update as Partial<SalonLead>;
    const patch: Record<string, unknown> = {};
    if (update.entreprise !== undefined) patch.entreprise  = update.entreprise;
    if (update.interet    !== undefined) patch.interet     = update.interet;
    if (update.budget     !== undefined) patch.budget      = update.budget;
    if (update.argumentIA !== undefined) patch.argument_ia = update.argumentIA;
    if (update.sector     !== undefined) patch.sector      = update.sector;
    if (update.employees  !== undefined) patch.employees   = update.employees;
    if (update.email      !== undefined) patch.email       = update.email;
    if (update.linkedin   !== undefined) patch.linkedin    = update.linkedin;
    if (Object.keys(patch).length === 0) return NextResponse.json({ success: true });

    const { error } = await supabase.from("salon_leads").update(patch).eq("id", body.leadId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.source === "delete-salon-lead" && body.leadId) {
    const { data: lead } = await supabase
      .from("salon_leads")
      .select("salon_id")
      .eq("id", body.leadId)
      .maybeSingle();

    const { error } = await supabase.from("salon_leads").delete().eq("id", body.leadId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

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

  // ── Veille + lastSync : toujours le JSONB ────────────────────────────────
  const store = await readStore();

  if (body.source === "auto1" && Array.isArray(body.leads)) {
    const seen = new Set(store.veille.map((l) => l.urlPost));
    const fresh = (body.leads as VeilleLead[]).filter((l) => !seen.has(l.urlPost));
    store.veille = [...fresh, ...store.veille].slice(0, 300);
    store.lastSync.auto1 = new Date().toISOString();
  }

  if (body.source === "patch" && body.collection === "veille" && body.id && body.update) {
    const idx = store.veille.findIndex((i) => i.id === body.id);
    if (idx >= 0) store.veille[idx] = { ...store.veille[idx], ...(body.update as object) };
  }

  if (body.source === "delete" && body.collection === "veille" && body.id) {
    store.veille = store.veille.filter((i) => i.id !== body.id);
  }

  if (body.source === "delete-many" && body.collection === "veille" && Array.isArray(body.ids)) {
    const ids = new Set(body.ids as string[]);
    store.veille = store.veille.filter((i) => !ids.has(i.id));
  }

  const { error } = await writeStore(store);
  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE resets the entire store (veille + salons + campagnes)
export async function DELETE() {
  const { error: wErr } = await writeStore({ ...EMPTY_STORE });
  if (wErr) return NextResponse.json({ success: false, error: wErr }, { status: 500 });

  const { error: cErr } = await supabase.from("campagnes").delete().neq("id", "__impossible__");
  if (cErr) return NextResponse.json({ success: false, error: cErr.message }, { status: 500 });

  const { error: slErr } = await supabase.from("salon_leads").delete().neq("id", "__impossible__");
  if (slErr) return NextResponse.json({ success: false, error: slErr.message }, { status: 500 });

  const { error: sErr } = await supabase.from("salons").delete().neq("id", "__impossible__");
  if (sErr) return NextResponse.json({ success: false, error: sErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
