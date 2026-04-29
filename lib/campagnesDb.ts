import { CampagneLead, CampagneStatut } from "./dataTypes";

// ─── Mappers entre CampagneLead (frontend) et la ligne SQL ───────────────────

export interface CampagneRow {
  id: string;
  nom: string;
  email: string;
  entite: string;
  segment: string;
  icebreaker: string;
  statut: string;
  visual_assigne: string | null;
  visual_label: string | null;
  entite_confidence: string | null;
  meta: Record<string, unknown>;
  updated_at: string;
  created_at?: string;
}

export function rowToLead(row: CampagneRow): CampagneLead {
  return {
    id: row.id,
    nom: row.nom ?? "",
    email: row.email ?? "",
    entite: row.entite ?? "",
    segment: row.segment ?? "",
    icebreaker: row.icebreaker ?? "",
    statut: (row.statut as CampagneStatut) ?? "Importé",
    updatedAt: row.updated_at,
    visualAssigne: row.visual_assigne ?? undefined,
    visualLabel: row.visual_label ?? undefined,
    entiteConfidence:
      (row.entite_confidence as CampagneLead["entiteConfidence"]) ?? null,
    meta: (row.meta as CampagneLead["meta"]) ?? undefined,
  };
}

export function leadToRow(lead: CampagneLead): Omit<CampagneRow, "created_at"> {
  return {
    id: lead.id,
    nom: lead.nom ?? "",
    email: lead.email ?? "",
    entite: lead.entite ?? "",
    segment: lead.segment ?? "",
    icebreaker: lead.icebreaker ?? "",
    statut: lead.statut ?? "Importé",
    visual_assigne: lead.visualAssigne ?? null,
    visual_label: lead.visualLabel ?? null,
    entite_confidence: lead.entiteConfidence ?? null,
    meta: (lead.meta as Record<string, unknown>) ?? {},
    updated_at: lead.updatedAt ?? new Date().toISOString(),
  };
}
