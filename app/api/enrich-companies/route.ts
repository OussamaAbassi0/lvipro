import { NextRequest, NextResponse } from "next/server";
import { AppDataStore, EMPTY_STORE, CampagneLead } from "@/lib/dataTypes";
import { supabase } from "@/lib/supabase";
import { guessCompanyFromEmail, isEntiteSuspicious } from "@/lib/companyEnrichment";

// ─── POST /api/enrich-companies ─────────────────────────────────────────────
// Body: { limit?: number }  (default 500)
//
// 2-layer pipeline run against every CampagneLead flagged by
// `isEntiteSuspicious()`:
//
//   Layer 1 (free, instantaneous): derive the company from the pro-email
//   domain via `guessCompanyFromEmail`. Skips free/personal providers.
//
//   Layer 2 (GPT-4o via N8N_WEBHOOK_ENRICH_COMPANY): the remaining leads
//   are sent to an n8n workflow that does a web search + GPT-4o inference
//   using nom / code postal / ville / téléphone / formulaire as signals.
//
// Returns: { totalProcessed, localHits, iaHits, remaining }
// `remaining` is the count of leads that are still suspicious AFTER this
// batch — the UI loops until either `totalProcessed === 0` or
// `remaining === 0`.

const STORE_KEY = "main";

async function read(): Promise<AppDataStore> {
  const { data, error } = await supabase
    .from("leads_store")
    .select("data_json")
    .eq("type_auto", STORE_KEY)
    .single();
  if (error || !data) return { ...EMPTY_STORE };
  return (data.data_json as AppDataStore) ?? { ...EMPTY_STORE };
}

async function write(store: AppDataStore): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("leads_store")
    .upsert(
      { type_auto: STORE_KEY, data_json: store },
      { onConflict: "type_auto" }
    );
  return { error: error?.message ?? null };
}

interface IaResponseItem {
  id: string;
  entite?: string;
  company?: string;
  confidence?: "high" | "medium" | "low";
}

async function callIaWebhook(leads: CampagneLead[]): Promise<Map<string, { entite: string; confidence: "high" | "medium" | "low" }>> {
  const result = new Map<string, { entite: string; confidence: "high" | "medium" | "low" }>();
  const webhookUrl = process.env.N8N_WEBHOOK_ENRICH_COMPANY;
  if (!webhookUrl || webhookUrl.includes("CONFIGURE") || leads.length === 0) {
    return result;
  }

  const payload = {
    source: "lvi-dashboard",
    triggeredAt: new Date().toISOString(),
    leads: leads.map((l) => ({
      id: l.id,
      nom: l.nom,
      email: l.email,
      currentEntite: l.entite || "",
      formulaire: l.meta?.formulaire || "",
      codePostal: l.meta?.codePostal || "",
      ville: l.meta?.ville || "",
      telephone: l.meta?.telephone || "",
    })),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return result;
    const data = await res.json().catch(() => ({}));
    const items: IaResponseItem[] = Array.isArray(data?.leads) ? data.leads : [];
    for (const item of items) {
      if (!item?.id) continue;
      const entite = (item.entite || item.company || "").trim();
      if (!entite) continue;
      result.set(item.id, {
        entite,
        confidence: item.confidence ?? "medium",
      });
    }
  } catch {
    // Network failures leave the leads suspicious; the user can retry.
  }
  return result;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const limit = Number.isFinite(body.limit) && body.limit > 0 ? Math.min(body.limit, 2000) : 500;
  const ids: string[] | null = Array.isArray(body.ids) && body.ids.length > 0 ? body.ids : null;

  const store = await read();
  // When explicit ids are given, enrich exactly those leads (no suspicion
  // filter — the user picked them on purpose). Otherwise fall back to the
  // auto-detected suspicious pool.
  const pool = ids
    ? store.campagnes.filter((l) => ids.includes(l.id))
    : store.campagnes.filter(isEntiteSuspicious);
  const batch = pool.slice(0, limit);

  let localHits = 0;
  let iaHits = 0;
  const remainingForIa: CampagneLead[] = [];
  const patches = new Map<string, Partial<CampagneLead>>();

  // Layer 1 — free email-domain guess
  for (const lead of batch) {
    const guess = guessCompanyFromEmail(lead.email);
    if (guess) {
      patches.set(lead.id, { entite: guess.entite, entiteConfidence: guess.confidence });
      localHits++;
    } else {
      remainingForIa.push(lead);
    }
  }

  // Layer 2 — IA via n8n (best-effort; silently degrades if unconfigured)
  if (remainingForIa.length > 0) {
    const iaResults = await callIaWebhook(remainingForIa);
    iaResults.forEach((value, id) => {
      patches.set(id, { entite: value.entite, entiteConfidence: value.confidence });
      iaHits++;
    });
  }

  // Apply patches
  if (patches.size > 0) {
    store.campagnes = store.campagnes.map((l) => {
      const patch = patches.get(l.id);
      return patch ? { ...l, ...patch } : l;
    });
    const { error } = await write(store);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
  }

  const remaining = store.campagnes.filter(isEntiteSuspicious).length;

  return NextResponse.json({
    totalProcessed: batch.length,
    localHits,
    iaHits,
    remaining,
  });
}
