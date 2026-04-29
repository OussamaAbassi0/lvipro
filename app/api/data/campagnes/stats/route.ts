import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── GET /api/data/campagnes/stats ───────────────────────────────────────────
// Counters pour les KPI de la vue Auto 2.
// Retourne: { total, imported, draft, exported, bySegment: [{segment,count}] }

export async function GET() {
  // Compte total + par statut via head/count (pas de data transferée)
  const totalP = supabase
    .from("campagnes")
    .select("id", { count: "exact", head: true });

  const importedP = supabase
    .from("campagnes")
    .select("id", { count: "exact", head: true })
    .eq("statut", "Importé");

  // Brouillons IA = contacts avec un icebreaker non vide
  // (le statut peut rester "Importé" après génération — on compte par contenu)
  const draftP = supabase
    .from("campagnes")
    .select("id", { count: "exact", head: true })
    .not("icebreaker", "is", null)
    .neq("icebreaker", "");

  const exportedP = supabase
    .from("campagnes")
    .select("id", { count: "exact", head: true })
    .eq("statut", "Exporté Lemlist");

  // Segments disponibles (distinct) — utile pour le filtre dropdown
  const segmentsP = supabase
    .from("campagnes")
    .select("segment")
    .not("segment", "is", null)
    .neq("segment", "")
    .limit(10000); // safety cap

  // Approximation des leads suspects (entite vide OU confidence basse).
  const suspiciousP = supabase
    .from("campagnes")
    .select("id", { count: "exact", head: true })
    .or("entite.eq.,entite_confidence.eq.low,entite_confidence.is.null");

  const [totalR, importedR, draftR, exportedR, suspiciousR, segmentsR] = await Promise.all([
    totalP,
    importedP,
    draftP,
    exportedP,
    suspiciousP,
    segmentsP,
  ]);

  if (totalR.error) {
    return NextResponse.json(
      { error: "Stats read failed", details: totalR.error.message },
      { status: 500 }
    );
  }

  // Segments uniques côté Node (Supabase ne supporte pas distinct facilement via JS client)
  const segSet = new Set<string>();
  (segmentsR.data as { segment: string | null }[] | null)?.forEach((r) => {
    if (r.segment) segSet.add(r.segment);
  });

  return NextResponse.json({
    total: totalR.count ?? 0,
    imported: importedR.count ?? 0,
    draft: draftR.count ?? 0,
    exported: exportedR.count ?? 0,
    suspicious: suspiciousR.count ?? 0,
    segments: Array.from(segSet).sort((a, b) => a.localeCompare(b, "fr")),
  });
}
