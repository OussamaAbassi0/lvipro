import { NextRequest, NextResponse } from "next/server";

// ─── POST /api/auto3-export-lemlist ────────────────────────────────────────
// Body: { leads: SalonLeadExport[] }
// Sends validated salon leads to n8n (N8N_WEBHOOK_AUTO3_LEMLIST) for Lemlist
// injection. Same architecture as /api/export-lemlist (Auto 2).
//
// Configure in .env.local:
//   N8N_WEBHOOK_AUTO3_LEMLIST=https://<instance>.n8n.cloud/webhook/auto3-export-lemlist

interface SalonLeadExport {
  id: string;
  entreprise: string;
  email: string;
  linkedin?: string;
  argumentIA: string;
  sector: string;
  salonNom: string;
  salonLieu?: string;
  salonDates?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const leads: SalonLeadExport[] = Array.isArray(body.leads) ? body.leads : [];

  if (leads.length === 0) {
    return NextResponse.json({ error: "Aucun lead à exporter" }, { status: 400 });
  }

  const webhookUrl = process.env.N8N_WEBHOOK_AUTO3_LEMLIST;

  if (!webhookUrl || webhookUrl.includes("CONFIGURE")) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_AUTO3_LEMLIST non configuré — ajoutez-le dans .env.local" },
      { status: 503 }
    );
  }

  // Map salon lead to Lemlist-compatible payload
  // companyName = entreprise, firstName/lastName split from entreprise name
  const payload = {
    source: "lvi-dashboard-auto3",
    triggeredAt: new Date().toISOString(),
    leads: leads.map((l) => {
      const parts = l.entreprise.trim().split(/\s+/);
      return {
        id: l.id,
        email: l.email,
        firstName: parts[0] || l.entreprise,
        lastName: parts.slice(1).join(" ") || "",
        companyName: l.entreprise,
        icebreaker: l.argumentIA,
        typeProjet: l.sector,
        linkedin: l.linkedin || "",
        salonNom: l.salonNom,
        salonLieu: l.salonLieu || "",
        salonDates: l.salonDates || "",
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
