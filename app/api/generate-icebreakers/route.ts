export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { CampagneLead } from "@/lib/dataTypes";

// ─── POST /api/generate-icebreakers ────────────────────────────────────────
// Body: { leads: CampagneLead[] }
// Sends selected leads to n8n (N8N_WEBHOOK_GENERATE) for GPT-4o icebreaker
// generation and returns: { leads: { id: string; icebreaker: string }[] }
//
// n8n webhook should respond synchronously (responseMode: "lastNode") with
// the enriched leads array so the dashboard can update the Brouillon IA column.

function splitName(nom: string): { firstName: string; lastName: string } {
  const parts = nom.trim().split(/\s+/);
  return { firstName: parts[0] || nom, lastName: parts.slice(1).join(" ") || "" };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const leads: CampagneLead[] = Array.isArray(body.leads) ? body.leads : [];

  if (leads.length === 0) {
    return NextResponse.json({ error: "Aucun contact fourni" }, { status: 400 });
  }

  const webhookUrl = process.env.N8N_WEBHOOK_GENERATE;

  // Graceful fallback when webhook is not yet configured
  if (!webhookUrl || webhookUrl.includes("CONFIGURE")) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_GENERATE non configuré — ajoutez-le dans .env.local" },
      { status: 503 }
    );
  }

  // Map CampagneLead → n8n Formatage payload shape
  const payload = {
    source: "lvi-dashboard",
    triggeredAt: new Date().toISOString(),
    leads: leads.map((l) => {
      const { firstName, lastName } = splitName(l.nom);
      return {
        id: l.id,
        email: l.email,
        firstName,
        lastName,
        companyName: l.entite,
        segment: l.segment,
        typeProjet: l.segment,
        currentIcebreaker: l.icebreaker || "",
      };
    }),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Erreur n8n: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    // n8n should return: { leads: [{ id, icebreaker, visuel_url? }...] }
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur réseau" },
      { status: 502 }
    );
  }
}
