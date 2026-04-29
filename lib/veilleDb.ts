import { VeilleLead } from "@/lib/dataTypes";

export interface VeilleRow {
  id: string;
  date_detection: string | null;
  concurrent: string | null;
  client_final: string | null;
  secteur: string | null;
  type_projet: string | null;
  localisation: string | null;
  technologie: string | null;
  score_ia: string | null;
  score_num: number | null;
  opportunite: string | null;
  extrait_post: string | null;
  citation_cle: string | null;
  url_post: string | null;
  statut: string | null;
  created_at: string | null;
}

export function rowToVeilleLead(row: VeilleRow): VeilleLead {
  return {
    id: row.id,
    dateDetection: row.date_detection ?? "",
    concurrent: row.concurrent ?? "",
    clientFinal: row.client_final ?? null,
    secteur: row.secteur ?? null,
    typeProjet: row.type_projet ?? null,
    localisation: row.localisation ?? null,
    technologie: row.technologie ?? null,
    scoreIA: row.score_ia ?? "0%",
    scoreNum: row.score_num ?? 0,
    opportunite: row.opportunite ?? null,
    extraitPost: row.extrait_post ?? "",
    citationCle: row.citation_cle ?? null,
    urlPost: row.url_post ?? "",
    datePost: "",
    statut: (row.statut as VeilleLead["statut"]) ?? "🔴 Nouveau",
  };
}

export function veilleLeadToRow(lead: VeilleLead): Omit<VeilleRow, "created_at"> {
  return {
    id: lead.id,
    date_detection: lead.dateDetection ?? null,
    concurrent: lead.concurrent ?? null,
    client_final: lead.clientFinal ?? null,
    secteur: lead.secteur ?? null,
    type_projet: lead.typeProjet ?? null,
    localisation: lead.localisation ?? null,
    technologie: lead.technologie ?? null,
    score_ia: lead.scoreIA ?? null,
    score_num: lead.scoreNum ?? null,
    opportunite: lead.opportunite ?? null,
    extrait_post: lead.extraitPost ?? null,
    citation_cle: lead.citationCle ?? null,
    url_post: lead.urlPost ?? null,
    statut: lead.statut ?? "🔴 Nouveau",
  };
}
