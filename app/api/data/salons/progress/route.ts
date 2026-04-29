import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 10;

// GET /api/data/salons/progress?url=...&nom=...
// Returns the most recent job for a given salon URL or name.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const nom = searchParams.get("nom");

  if (!url && !nom) return NextResponse.json({ job: null });

  let query = supabase
    .from("scraping_jobs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1);

  if (url) {
    query = query.eq("salon_url", url);
  } else {
    query = query.ilike("nom_salon", `%${nom}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ job: data?.[0] ?? null });
}

// POST /api/data/salons/progress — upsert progress from n8n at each step
// Body: { salon_url, nom_salon?, status?, current_step?, step_label?, total_steps?, leads_found?, error_msg? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    salon_url,
    nom_salon,
    status,
    current_step,
    step_label,
    total_steps,
    leads_found,
    error_msg,
  } = body as Record<string, unknown>;

  if (!salon_url) return NextResponse.json({ error: "salon_url required" }, { status: 400 });

  // Find an existing running job for this URL
  const { data: existing } = await supabase
    .from("scraping_jobs")
    .select("id")
    .eq("salon_url", String(salon_url))
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    await supabase
      .from("scraping_jobs")
      .update({
        status:       status       ?? "running",
        current_step: current_step ?? 1,
        step_label:   step_label   ?? "",
        total_steps:  total_steps  ?? 5,
        leads_found:  leads_found  ?? 0,
        error_msg:    error_msg    ?? null,
        updated_at:   new Date().toISOString(),
      })
      .eq("id", existing[0].id);
    return NextResponse.json({ ok: true, id: existing[0].id });
  }

  const { data: newJob, error } = await supabase
    .from("scraping_jobs")
    .insert({
      salon_url:    String(salon_url),
      nom_salon:    nom_salon    ? String(nom_salon)    : "",
      status:       status       ? String(status)       : "running",
      current_step: current_step ? Number(current_step) : 1,
      step_label:   step_label   ? String(step_label)   : "Démarrage",
      total_steps:  total_steps  ? Number(total_steps)  : 5,
      leads_found:  leads_found  ? Number(leads_found)  : 0,
      error_msg:    error_msg    ? String(error_msg)    : null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: newJob.id });
}
