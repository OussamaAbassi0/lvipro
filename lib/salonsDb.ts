import { Salon, SalonLead, SalonStatus, InteretLevel, BudgetLevel } from "@/lib/dataTypes";

export interface SalonRow {
  id: string;
  nom: string;
  lieu: string;
  dates: string;
  secteur: string;
  visiteurs: string;
  status: string;
  updated_at: string;
  created_at: string;
}

export interface SalonLeadRow {
  id: string;
  salon_id: string;
  entreprise: string;
  interet: string;
  budget: string;
  argument_ia: string;
  sector: string;
  employees: string | null;
  email: string | null;
  linkedin: string | null;
  created_at: string;
  updated_at: string;
}

export function salonRowToSalon(row: SalonRow, leads: SalonLead[]): Salon {
  return {
    id: row.id,
    nom: row.nom,
    lieu: row.lieu,
    dates: row.dates,
    secteur: row.secteur,
    visiteurs: row.visiteurs,
    status: (row.status as SalonStatus) || "Scraped",
    leads,
    updatedAt: row.updated_at,
  };
}

export function salonToRow(salon: Salon): Omit<SalonRow, "created_at"> {
  return {
    id: salon.id,
    nom: salon.nom ?? "",
    lieu: salon.lieu ?? "",
    dates: salon.dates ?? "",
    secteur: salon.secteur ?? "",
    visiteurs: salon.visiteurs ?? "",
    status: salon.status ?? "Scraped",
    updated_at: salon.updatedAt ?? new Date().toISOString(),
  };
}

export function leadRowToSalonLead(row: SalonLeadRow): SalonLead {
  return {
    id: row.id,
    entreprise: row.entreprise,
    interet: (row.interet as InteretLevel) || "Faible",
    budget: (row.budget as BudgetLevel) || "Inconnu",
    argumentIA: row.argument_ia,
    sector: row.sector,
    employees: row.employees ?? undefined,
    email: row.email ?? undefined,
    linkedin: row.linkedin ?? undefined,
  };
}

export function salonLeadToRow(
  lead: SalonLead,
  salonId: string
): Omit<SalonLeadRow, "created_at" | "updated_at"> {
  return {
    id: lead.id,
    salon_id: salonId,
    entreprise: lead.entreprise ?? "",
    interet: lead.interet ?? "Faible",
    budget: lead.budget ?? "Inconnu",
    argument_ia: lead.argumentIA ?? "",
    sector: lead.sector ?? "",
    employees: lead.employees ?? null,
    email: lead.email ?? null,
    linkedin: lead.linkedin ?? null,
  };
}
