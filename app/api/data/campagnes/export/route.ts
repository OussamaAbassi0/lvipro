export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CampagneRow, rowToLead } from "@/lib/campagnesDb";

export const runtime = "nodejs";
export const maxDuration = 300;

// ─── GET /api/data/campagnes/export ──────────────────────────────────────────
// Streame le CSV de TOUTES les campagnes (filtres appliqués comme /campagnes).
// Chunk de 1000 par page Supabase pour tenir la limite de réponse.
// Content-Type: text/csv; charset=utf-8

const PAGE = 1000;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const statut = searchParams.get("statut") ?? "";
  const segment = searchParams.get("segment") ?? "";
  const search = (searchParams.get("search") ?? "").trim();

  const header = [
    "id",
    "nom",
    "email",
    "entite",
    "segment",
    "icebreaker",
    "statut",
    "visualLabel",
    "updatedAt",
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(header.join(",") + "\n"));

      let page = 0;
      while (true) {
        let q = supabase
          .from("campagnes")
          .select("*")
          .order("updated_at", { ascending: false })
          .range(page * PAGE, page * PAGE + PAGE - 1);

        if (statut) q = q.eq("statut", statut);
        if (segment === "__none__") q = q.or("segment.is.null,segment.eq.");
        else if (segment) q = q.eq("segment", segment);
        if (search) {
          const esc = search.replace(/[%_,]/g, (c) => `\\${c}`);
          const pat = `%${esc}%`;
          q = q.or(
            `nom.ilike.${pat},entite.ilike.${pat},email.ilike.${pat},segment.ilike.${pat}`
          );
        }

        const { data, error } = await q;
        if (error) {
          controller.enqueue(encoder.encode(`\n# ERROR: ${error.message}\n`));
          controller.close();
          return;
        }
        const rows = (data as CampagneRow[] | null) ?? [];
        if (rows.length === 0) break;

        for (const r of rows) {
          const l = rowToLead(r);
          const line = [
            l.id,
            l.nom,
            l.email,
            l.entite,
            l.segment,
            l.icebreaker,
            l.statut,
            l.visualLabel ?? "",
            l.updatedAt,
          ]
            .map(csvEscape)
            .join(",");
          controller.enqueue(encoder.encode(line + "\n"));
        }

        if (rows.length < PAGE) break;
        page++;
      }
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campagnes_lemlist_${Date.now()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
