export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { CampagneLead } from "@/lib/dataTypes";

// ─── POST /api/export-lemlist ───────────────────────────────────────────────
// Body: { leads: CampagneLead[] }  (already filtered: selected + has icebreaker)
// Sends validated leads to n8n (N8N_WEBHOOK_LEMLIST) which injects them into
// the Lemlist campaign via the existing '🚀 HTTP Request — Lemlist' node.
//
// Payload shape matches the '🗂️ Formatage payload Lemlist' Set node fields:
//   email, firstName, lastName, companyName, icebreaker, typeProjet

function splitName(nom: string): { firstName: string; lastName: string } {
  const parts = nom.trim().split(/\s+/);
  return { firstName: parts[0] || nom, lastName: parts.slice(1).join(" ") || "" };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const leads: CampagneLead[] = Array.isArray(body.leads) ? body.leads : [];

  if (leads.length === 0) {
    return NextResponse.json({ error: "Aucun contact à exporter" }, { status: 400 });
  }

  const webhookUrl = process.env.N8N_WEBHOOK_LEMLIST;

  if (!webhookUrl || webhookUrl.includes("CONFIGURE")) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_LEMLIST non configuré — ajoutez-le dans .env.local" },
      { status: 503 }
    );
  }

  // Map to Lemlist-ready shape (matches '🗂️ Formatage payload Lemlist' node)
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
        icebreaker: l.icebreaker,
        typeProjet: l.segment,
        visuel_url: l.visualAssigne || "",
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

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ success: true, exported: leads.length, ...data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur réseau" },
      { status: 502 }
    );
  }
}
