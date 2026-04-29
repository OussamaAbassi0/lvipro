// Shared TypeScript types for the LVI data store
// These match the payloads n8n workflows POST to /api/data

export type VeilleStatut = "🔴 Nouveau" | "🟡 En cours" | "🟢 Traité";
export type CampagneStatut = "Importé" | "Brouillon IA" | "Exporté Lemlist";
export type InteretLevel = "Très Fort" | "Fort" | "Moyen" | "Faible";
export type BudgetLevel = "Élevé" | "Moyen" | "Faible" | "Inconnu";
export type SalonStatus = "Scraped" | "En cours" | "À venir";

export interface VeilleLead {
  id: string;
  dateDetection: string;
  concurrent: string;
  clientFinal: string | null;
  secteur: string | null;
  typeProjet: string | null;
  localisation: string | null;
  technologie: string | null;
  scoreIA: string;     // "85%"
  scoreNum: number;    // 0–100
  opportunite: string | null;
  extraitPost: string;
  citationCle: string | null;
  urlPost: string;
  datePost: string;
  statut: VeilleStatut;
}

export interface CampagneLead {
  id: string;
  nom: string;
  entite: string;
  email: string;
  segment: string;
  icebreaker: string;
  statut: CampagneStatut;
  updatedAt: string;
  visualAssigne?: string;
  visualLabel?: string;
  /** Source of the current `entite` value — guides the "À enrichir" filter */
  entiteConfidence?: "high" | "medium" | "low" | null;
  /** Raw CSV signals kept for later enrichment (never displayed directly) */
  meta?: {
    formulaire?: string;
    codePostal?: string;
    ville?: string;
    telephone?: string;
  };
}

export interface SalonLead {
  id: string;
  entreprise: string;
  interet: InteretLevel;
  budget: BudgetLevel;
  argumentIA: string;
  sector: string;
  employees?: string;
  email?: string;
  linkedin?: string;
}

export interface Salon {
  id: string;
  nom: string;
  lieu: string;
  dates: string;
  secteur: string;
  visiteurs: string;
  status: SalonStatus;
  leads: SalonLead[];
  updatedAt: string;
}

export interface AppDataStore {
  veille: VeilleLead[];
  campagnes: CampagneLead[];
  salons: Salon[];
  lastSync: {
    auto1: string | null;
    auto2: string | null;
    auto3: string | null;
  };
}

export const EMPTY_STORE: AppDataStore = {
  veille: [],
  campagnes: [],
  salons: [],
  lastSync: { auto1: null, auto2: null, auto3: null },
};
