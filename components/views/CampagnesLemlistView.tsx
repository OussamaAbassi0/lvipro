"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mail,
  Send,
  Sparkles,
  Filter,
  Download,
  Upload,
  CheckCircle2,
  BarChart3,
  ZoomIn,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Square,
  Minus,
  Trash2,
  Loader2,
  Inbox,
  Wand2,
  Settings2,
  Plus,
  Pencil,
  Check,
} from "lucide-react";
import clsx from "clsx";
import { useToast } from "@/components/ToastProvider";
import { useAppData } from "@/providers/AppDataProvider";
import { CampagneLead, CampagneStatut } from "@/lib/dataTypes";
import {
  guessCompanyFromEmail,
  classifyNom,
} from "@/lib/companyEnrichment";

interface Props {
  searchQuery: string;
}

// ─── Status badge ──────────────────────────────────────────────────────────────

const statutConfig: Record<
  CampagneStatut,
  { color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  "Importé": {
    color: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-200",
    icon: <Inbox size={11} />,
  },
  "Brouillon IA": {
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    icon: <Sparkles size={11} />,
  },
  "Exporté Lemlist": {
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: <Send size={11} />,
  },
};

/** Map legacy statuts (pre-lifecycle refactor) onto the new 3-state cycle. */
function normalizeStatut(raw: string | null | undefined): CampagneStatut {
  if (!raw) return "Importé";
  switch (raw) {
    case "Importé":
    case "Brouillon IA":
    case "Exporté Lemlist":
      return raw;
    case "Brouillon Lemlist":
      return "Brouillon IA";
    case "Envoyé":
    case "Ouvert":
    case "Répondu":
    case "Bounced":
      return "Exporté Lemlist";
    default:
      return "Importé";
  }
}

// Liste stricte des 13 catégories officielles gérées par l'IA (n8n).
const PREDEFINED_SEGMENTS = [
  "SECTEUR PUBLIC / MAIRIES",
  "SPORT AUTOMOBILE / GARAGES",
  "RETAIL / COMMERCE / BOUTIQUES",
  "ÉVÉNEMENTIEL / FANZONES",
  "GRANDS ÉVÉNEMENTS / JO",
  "ARMÉE / DÉFENSE",
  "IMMOBILIER",
  "MUSÉES / AVIATION",
  "STANDS / SALONS PRO",
  "BUREAUX / SIÈGES SOCIAUX (HALL)",
  "STUDIO / TV / TOURNAGE",
  "CLUBS SPORTIFS",
  "GÉNÉRIQUE",
];

const segmentColors: Record<string, string> = {
  "SECTEUR PUBLIC / MAIRIES":         "text-blue-600 bg-blue-50 border-blue-200",
  "SPORT AUTOMOBILE / GARAGES":       "text-red-600 bg-red-50 border-red-200",
  "RETAIL / COMMERCE / BOUTIQUES":    "text-amber-600 bg-amber-50 border-amber-200",
  "ÉVÉNEMENTIEL / FANZONES":          "text-pink-600 bg-pink-50 border-pink-200",
  "GRANDS ÉVÉNEMENTS / JO":           "text-violet-600 bg-violet-50 border-violet-200",
  "ARMÉE / DÉFENSE":                  "text-slate-700 bg-slate-100 border-slate-200",
  "IMMOBILIER":                       "text-emerald-700 bg-emerald-50 border-emerald-200",
  "MUSÉES / AVIATION":                "text-indigo-600 bg-indigo-50 border-indigo-200",
  "STANDS / SALONS PRO":              "text-cyan-600 bg-cyan-50 border-cyan-200",
  "BUREAUX / SIÈGES SOCIAUX (HALL)":  "text-teal-600 bg-teal-50 border-teal-200",
  "STUDIO / TV / TOURNAGE":           "text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200",
  "CLUBS SPORTIFS":                   "text-orange-600 bg-orange-50 border-orange-200",
  "GÉNÉRIQUE":                        "text-slate-500 bg-gray-50 border-gray-200",
};

function StatutBadge({ statut }: { statut: CampagneStatut }) {
  const cfg = statutConfig[statut] ?? statutConfig["Importé"];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap",
        cfg.color,
        cfg.bg,
        cfg.border
      )}
    >
      {cfg.icon}
      {statut}
    </span>
  );
}

// ─── Image thumbnail with lightbox ────────────────────────────────────────────

function VisualCell({ src, label }: { src: string; label: string }) {
  const [lightbox, setLightbox] = useState(false);
  const [broken, setBroken] = useState(false);

  if (broken) {
    return <span className="text-[11px] text-slate-400 italic">—</span>;
  }

  return (
    <>
      <button
        onClick={() => setLightbox(true)}
        className="group/img flex items-center gap-2.5 focus:outline-none"
        title={`Aperçu : ${label}`}
      >
        <div className="relative w-12 h-9 rounded-lg overflow-hidden border border-gray-200 bg-white flex-shrink-0 shadow-md transition-all duration-200 group-hover/img:scale-105 group-hover/img:border-blue-500/50 group-hover/img:shadow-blue-500/20 group-hover/img:shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            className="w-full h-full object-cover"
            onError={() => setBroken(true)}
          />
          <div className="absolute inset-0 bg-blue-500/0 group-hover/img:bg-blue-500/20 transition-colors duration-200 flex items-center justify-center">
            <ZoomIn size={14} className="text-slate-900 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 drop-shadow" />
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-400 group-hover/img:text-slate-600 transition-colors max-w-[80px] truncate">
          {label}
        </span>
      </button>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightbox(false)}
        >
          <div
            className="relative max-w-2xl w-full rounded-2xl overflow-hidden border border-gray-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
              <p className="text-[12px] font-semibold text-slate-900">{label}</p>
              <button onClick={() => setLightbox(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-white/10 transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="relative w-full aspect-video bg-white flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={label}
                className="max-w-full max-h-full object-contain"
                onError={() => setBroken(true)}
              />
            </div>
            <div className="px-4 py-2.5 bg-white border-t border-gray-200">
              <p className="text-[11px] text-slate-400 font-mono">{src}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function isValidVisualUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith("/")) return false;
  const file = trimmed.split("/").pop() ?? "";
  return /\.[a-zA-Z0-9]+$/.test(file);
}

// ─── CSV helpers ───────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === "," || ch === ";") && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function csvToLeads(text: string): CampagneLead[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

  const findIdx = (keys: string[]): number => {
    for (const key of keys) {
      const idx = headers.findIndex((h) => h.includes(key));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const idxNom        = findIdx(["nomcomplet", "fullname", "nom", "name", "prenom", "prnom"]);
  const idxEntite     = findIdx(["entreprise", "entite", "company", "societe", "organisation", "organization"]);
  const idxEmail      = findIdx(["email", "mail"]);
  const idxSegment    = findIdx(["segment", "secteur", "categorie", "category"]);
  const idxIcebreaker = findIdx(["icebreaker", "message", "iceb"]);
  const idxFormulaire = findIdx(["formulaire", "form", "source"]);
  const idxCP         = findIdx(["codepostal", "cp", "zip", "postal"]);
  const idxVille      = findIdx(["ville", "city"]);
  const idxTel        = findIdx(["telephone", "tel", "phone", "mobile"]);

  const pick = (cols: string[], idx: number) => (idx >= 0 ? (cols[idx] || "").trim() : "");

  return lines
    .slice(1)
    .map((line, i): CampagneLead => {
      const cols = parseCsvLine(line);
      const rawNom = pick(cols, idxNom);
      const email  = pick(cols, idxEmail);
      const rawEnt = pick(cols, idxEntite);

      const cls = classifyNom(rawNom);
      let nom    = cls.nom;
      let entite = rawEnt || cls.entite;
      let confidence: CampagneLead["entiteConfidence"];
      if (rawEnt) confidence = "medium";
      else if (cls.kind === "company" || cls.kind === "domain") confidence = "high";
      else confidence = null;

      if (!entite) {
        const guess = guessCompanyFromEmail(email);
        if (guess) {
          entite = guess.entite;
          confidence = guess.confidence;
        }
      }
      if (!entite) confidence = "low";

      if (!nom && cls.kind === "person") nom = cls.nom;
      if (!nom && !entite) nom = rawNom;

      return {
        id: `import-${Date.now()}-${i}`,
        nom,
        entite,
        email,
        segment: pick(cols, idxSegment),
        icebreaker: pick(cols, idxIcebreaker),
        statut: "Importé" as const,
        updatedAt: new Date().toISOString(),
        entiteConfidence: confidence,
        meta: {
          formulaire: pick(cols, idxFormulaire),
          codePostal: pick(cols, idxCP),
          ville:      pick(cols, idxVille),
          telephone:  pick(cols, idxTel),
        },
      };
    })
    .filter((l) => l.nom || l.email);
}

// ─── Checkbox component ────────────────────────────────────────────────────────

function Checkbox({
  checked,
  indeterminate = false,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={clsx(
        "w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0",
        checked || indeterminate
          ? "bg-blue-500 border-blue-500"
          : "bg-transparent border-gray-300 hover:border-[#4B5563]"
      )}
    >
      {indeterminate ? (
        <Minus size={9} className="text-slate-900" />
      ) : checked ? (
        <CheckCircle2 size={9} className="text-slate-900" />
      ) : (
        <Square size={9} className="text-transparent" />
      )}
    </button>
  );
}

// ─── Types locaux pour le fetch paginé ────────────────────────────────────────

interface Stats {
  total: number;
  imported: number;
  draft: number;
  exported: number;
  suspicious: number;
  segments: string[];
}

interface PageResult {
  items: CampagneLead[];
  total: number;
  page: number;
  totalPages: number;
}

const EMPTY_STATS: Stats = {
  total: 0, imported: 0, draft: 0, exported: 0, suspicious: 0, segments: [],
};

function visualLabel(url: string): string {
  if (!url) return "";
  const file = url.split("/").pop() ?? url;
  return file.replace(/\.[^.]+$/, "");
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function CampagnesLemlistView({ searchQuery }: Props) {
  useAppData();
  const { notify } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [statutFilter, setStatutFilter] = useState<CampagneStatut | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [segmentFilterOpen, setSegmentFilterOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generatingIB, setGeneratingIB] = useState(false);
  const [selectCountInput, setSelectCountInput] = useState("");

  const PAGE_SIZE = 100;
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState<PageResult>({
    items: [], total: 0, page: 1, totalPages: 1,
  });
  const [loadingPage, setLoadingPage] = useState(false);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichCountInput, setEnrichCountInput] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localIcebreakers, setLocalIcebreakers] = useState<Record<string, string>>({});
  const [localVisuals, setLocalVisuals] = useState<Record<string, string>>({});
  const [localSegments, setLocalSegments] = useState<Record<string, string>>({});

  // Segments management
  const [dbSegments, setDbSegments] = useState<string[]>([]);
  const [segmentsModalOpen, setSegmentsModalOpen] = useState(false);
  const [renamingSegment, setRenamingSegment] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newSegmentInput, setNewSegmentInput] = useState("");
  const [savingSegment, setSavingSegment] = useState(false);

  // ── Fetch paginated leads + stats from the API ─────────────────────────────
  const fetchPage = useCallback(async () => {
    setLoadingPage(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (statutFilter !== "all") params.set("statut", statutFilter);
      if (segmentFilter !== "all") params.set("segment", segmentFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const res = await fetch(`/api/data/campagnes?${params.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as PageResult;
        setPageData(json);
      } else {
        console.error("[CampagnesLemlistView] page fetch failed:", res.status);
      }
    } catch (err) {
      console.error("[CampagnesLemlistView] page fetch error:", err);
    } finally {
      setLoadingPage(false);
    }
  }, [page, statutFilter, segmentFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/data/campagnes/stats");
      if (res.ok) {
        const json = (await res.json()) as Stats;
        setStats(json);
      }
    } catch (err) {
      console.error("[CampagnesLemlistView] stats fetch error:", err);
    }
  }, []);

  const fetchDbSegments = useCallback(async () => {
    try {
      const res = await fetch("/api/data/campagnes/segments");
      if (res.ok) {
        const json = await res.json() as { segments?: string[] };
        if (Array.isArray(json.segments)) setDbSegments(json.segments);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchPage(); }, [fetchPage]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchDbSegments(); }, [fetchDbSegments]);

  // Reset to page 1 whenever filters/search change
  useEffect(() => { setPage(1); }, [statutFilter, segmentFilter, searchQuery]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchPage(), fetchStats()]);
  }, [fetchPage, fetchStats]);

  const leads = pageData.items;
  const total = stats.total;
  const filteredTotal = pageData.total;
  const totalPages = pageData.totalPages;
  const currentPage = pageData.page;
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + leads.length;

  // ── Overrides helpers (optimistic UI) ─────────────────────────────────────
  const getSegment = (lead: CampagneLead) =>
    localSegments[lead.id] !== undefined ? localSegments[lead.id] : lead.segment ?? "";
  const getIcebreaker = (lead: CampagneLead) =>
    localIcebreakers[lead.id] !== undefined ? localIcebreakers[lead.id] : lead.icebreaker ?? "";
  const getVisual = (lead: CampagneLead) =>
    localVisuals[lead.id] !== undefined ? localVisuals[lead.id] : lead.visualAssigne ?? "";
  const getEntite = (lead: CampagneLead) => lead.entite ?? "";

  const availableSegments = dbSegments.length > 0
    ? dbSegments
    : Array.from(new Set([...PREDEFINED_SEGMENTS, ...stats.segments])).sort((a, b) => a.localeCompare(b, "fr"));

  // ── Checkbox helpers ────────────────────────────────────────────────────────
  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const someSelected = leads.some((l) => selectedIds.has(l.id)) && !allSelected;
  const selectionCount = selectedIds.size;

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) leads.forEach((l) => next.delete(l.id));
      else leads.forEach((l) => next.add(l.id));
      return next;
    });
  };
  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Select N across pages (fetches first N ids matching current filters) ──
  const handleSelectN = async () => {
    const n = parseInt(selectCountInput, 10);
    if (!Number.isFinite(n) || n <= 0) {
      notify("Entrez un nombre supérieur à 0", "error");
      return;
    }
    if (filteredTotal === 0) {
      notify("Aucun contact à sélectionner", "error");
      return;
    }
    const count = Math.min(n, filteredTotal);
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("limit", String(Math.min(500, count)));
    if (statutFilter !== "all") params.set("statut", statutFilter);
    if (segmentFilter !== "all") params.set("segment", segmentFilter);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());

    const acc = new Set<string>();
    let pageCursor = 1;
    const pageSize = Math.min(500, count);
    while (acc.size < count) {
      params.set("page", String(pageCursor));
      const res = await fetch(`/api/data/campagnes?${params.toString()}`);
      if (!res.ok) break;
      const json = (await res.json()) as PageResult;
      for (const l of json.items) {
        if (acc.size >= count) break;
        acc.add(l.id);
      }
      if (json.items.length < pageSize) break;
      pageCursor += 1;
    }
    setSelectedIds(acc);
    notify(
      acc.size < n
        ? `${acc.size} contact(s) sélectionné(s) (seulement ${acc.size} disponibles)`
        : `${acc.size} contact(s) sélectionné(s)`,
      "success"
    );
  };

  // ── Delete selected (new bulk endpoint) ────────────────────────────────────
  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/data/campagnes/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSelectedIds(new Set());
      await refreshAll();
      notify(`${ids.length} contact${ids.length > 1 ? "s" : ""} supprimé${ids.length > 1 ? "s" : ""}`, "success");
    } catch {
      notify("Erreur lors de la suppression", "error");
    } finally {
      setDeleting(false);
    }
  };

  // ── Save a single field patch (new PATCH endpoint) ─────────────────────────
  const saveField = (id: string, field: string, value: string) => {
    if (field === "segment" && !value.trim()) return;
    fetch(`/api/data/campagnes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    }).catch(() => {});
  };

  // ── Enrichir ─────────────────────────────────────────────────────────────
  const suspiciousCount = stats.suspicious;
  const ENRICH_CHUNK = 50;

  const handleEnrichCompanies = async () => {
    const useSelection = selectionCount > 0;

    if (!useSelection && suspiciousCount === 0) {
      notify("Aucun lead à enrichir — sélectionnez des contacts ou aucun suspect détecté", "info");
      return;
    }

    let targetIds: string[] = [];
    let target: number;

    if (useSelection) {
      targetIds = Array.from(selectedIds);
      target = targetIds.length;
    } else {
      const requested = parseInt(enrichCountInput, 10);
      if (!Number.isFinite(requested) || requested <= 0) {
        notify(
          `Sélectionnez des contacts (cases à cocher) ou entrez un nombre entre 1 et ${suspiciousCount}`,
          "error"
        );
        return;
      }
      target = Math.min(requested, suspiciousCount);
    }

    setEnriching(true);
    try {
      let totalLocal = 0;
      let totalIA = 0;
      let totalRemaining = 0;
      let processed = 0;
      let cursor = 0;
      while (processed < target) {
        const chunkSize = Math.min(ENRICH_CHUNK, target - processed);
        const payload: Record<string, unknown> = { limit: chunkSize };
        if (useSelection) payload.ids = targetIds.slice(cursor, cursor + chunkSize);
        const res = await fetch("/api/enrich-companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        const json = await res.json();
        const done = json.totalProcessed ?? 0;
        totalLocal    += json.localHits ?? 0;
        totalIA       += json.iaHits ?? 0;
        totalRemaining = json.remaining ?? 0;
        processed     += done;
        cursor        += chunkSize;
        if (done === 0) break;
        if (!useSelection && totalRemaining === 0) break;
        if (processed < target) {
          notify(`Enrichissement en cours… ${processed}/${target} traités`, "info");
        }
      }
      await refreshAll();
      setEnrichCountInput("");
      notify(
        `Enrichissement terminé · ${processed} traités · ${totalLocal} via email · ${totalIA} via IA${
          useSelection ? "" : ` · ${totalRemaining} restants`
        }`,
        "success"
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erreur lors de l'enrichissement", "error");
    } finally {
      setEnriching(false);
    }
  };

  // ── Import CSV (new bulk endpoint) ─────────────────────────────────────────
  const handleImportCSV = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const newLeads = csvToLeads(text);
      if (newLeads.length === 0) {
        notify("Aucun contact valide trouvé dans le CSV", "error");
        return;
      }

      const CHUNK_SIZE = 1000;
      const totalN = newLeads.length;
      let imported = 0;
      for (let i = 0; i < totalN; i += CHUNK_SIZE) {
        const chunk = newLeads.slice(i, i + CHUNK_SIZE);
        const res = await fetch("/api/data/campagnes/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads: chunk }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status} lot ${i / CHUNK_SIZE + 1}`);
        }
        imported += chunk.length;
        if (totalN > CHUNK_SIZE) {
          notify(`Import en cours… ${imported} / ${totalN}`, "info");
        }
      }
      await refreshAll();
      notify(`${imported} contacts importés avec succès`, "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erreur lors de l'import CSV", "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Generate icebreakers via n8n (patches via new PATCH endpoint) ──────────
  const handleGenerateIcebreakers = async () => {
    if (selectionCount === 0) {
      notify("Sélectionnez au moins un contact pour générer les icebreakers", "error");
      return;
    }
    // Besoin des leads complets — pour la sélection courante on a besoin des objets.
    // Filtre sur les leads visibles de la page + complète avec un fetch by-id si besoin.
    const visibleSelected = leads.filter((l) => selectedIds.has(l.id));
    // Pour simplifier, on prend uniquement les sélectionnés visibles sur la page courante.
    // Pour envoyer TOUS les sélectionnés, l'utilisateur doit paginer.
    if (visibleSelected.length === 0) {
      notify("Aucun contact sélectionné visible sur cette page", "error");
      return;
    }
    setGeneratingIB(true);
    try {
      const leadsWithOverrides = visibleSelected.map((l) => ({
        ...l,
        entite: getEntite(l),
        segment: getSegment(l),
      }));
      const res = await fetch("/api/generate-icebreakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: leadsWithOverrides }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify(err.error || `Erreur ${res.status}`, "error");
        return;
      }
      const result = await res.json();

      type IaItem = { id: string; icebreaker: string; visuel_url?: string; segment?: string };
      let iaLeads: IaItem[] = [];
      if (Array.isArray(result?.leads)) iaLeads = result.leads as IaItem[];
      else if (Array.isArray(result)) iaLeads = result as IaItem[];
      else if (result && typeof result === "object" && typeof result.id === "string") iaLeads = [result as IaItem];

      if (iaLeads.length > 0) {
        const ibUpdates: Record<string, string> = {};
        const visUpdates: Record<string, string> = {};
        const segUpdates: Record<string, string> = {};
        await Promise.all(
          iaLeads.map(async (item) => {
            if (!item.id) return;
            const patch: Record<string, string> = {};
            if (item.icebreaker) {
              ibUpdates[item.id] = item.icebreaker;
              patch.icebreaker = item.icebreaker;
            }
            if (item.visuel_url) {
              visUpdates[item.id] = item.visuel_url;
              patch.visualAssigne = item.visuel_url;
              patch.visualLabel = visualLabel(item.visuel_url);
            }
            const seg = (item.segment ?? "").trim();
            if (seg) {
              segUpdates[item.id] = seg;
              patch.segment = seg;
            }
            if (item.icebreaker) patch.statut = "Brouillon IA";
            if (Object.keys(patch).length === 0) return;
            await fetch(`/api/data/campagnes/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patch),
            }).catch(() => {});
          })
        );
        setLocalIcebreakers((prev) => ({ ...prev, ...ibUpdates }));
        setLocalVisuals((prev) => ({ ...prev, ...visUpdates }));
        setLocalSegments((prev) => ({ ...prev, ...segUpdates }));
        await refreshAll();
        const hasVisuals = Object.keys(visUpdates).length > 0;
        const hasSegments = Object.keys(segUpdates).length > 0;
        notify(
          `${iaLeads.length} icebreakers générés` +
            (hasVisuals ? ` · ${Object.keys(visUpdates).length} visuels assignés` : "") +
            (hasSegments ? ` · ${Object.keys(segUpdates).length} segments détectés` : ""),
          "success"
        );
      } else {
        notify("Workflow déclenché — les icebreakers arrivent via webhook", "info");
      }
    } catch {
      notify("Erreur réseau lors de la génération", "error");
    } finally {
      setGeneratingIB(false);
    }
  };

  // ── Export Lemlist (same webhook, individual PATCH after) ──────────────────
  const handleExportLemlist = async () => {
    const visibleSelected = leads.filter((l) => selectedIds.has(l.id));
    const toExport = visibleSelected
      .map((l) => ({
        ...l,
        entite: getEntite(l),
        segment: getSegment(l) || l.segment || "",
        icebreaker: getIcebreaker(l),
        visualAssigne: getVisual(l) || l.visualAssigne || "",
        visualLabel: visualLabel(getVisual(l) || l.visualAssigne || ""),
      }))
      .filter((l) => l.icebreaker && l.email);

    if (toExport.length === 0) {
      notify(
        "Aucun contact valide — sélectionnez des contacts (visibles sur cette page) avec un email et un brouillon IA",
        "error"
      );
      return;
    }

    setExporting(true);
    try {
      const res = await fetch("/api/export-lemlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: toExport }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify(err.error || `Erreur ${res.status}`, "error");
        return;
      }
      await Promise.all(
        toExport.map((l) =>
          fetch(`/api/data/campagnes/${l.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ statut: "Exporté Lemlist" }),
          })
        )
      );
      await refreshAll();
      setSelectedIds(new Set());
      notify(`${toExport.length} contacts envoyés vers Lemlist`, "success");
    } catch {
      notify("Erreur réseau lors de l'export Lemlist", "error");
    } finally {
      setExporting(false);
    }
  };

  // ── Download CSV — streaming depuis l'API ─────────────────────────────────
  const handleDownloadCSV = () => {
    if (total === 0) {
      notify("Aucun contact à exporter", "error");
      return;
    }
    const params = new URLSearchParams();
    if (statutFilter !== "all") params.set("statut", statutFilter);
    if (segmentFilter !== "all") params.set("segment", segmentFilter);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    const qs = params.toString();
    window.location.href = `/api/data/campagnes/export${qs ? `?${qs}` : ""}`;
  };

  // ── Segment management handlers ────────────────────────────────────────────

  const handleCreateSegment = async () => {
    const name = newSegmentInput.trim().toUpperCase();
    if (!name) return;
    setSavingSegment(true);
    try {
      const res = await fetch("/api/data/campagnes/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify(err.error || "Erreur lors de la création", "error");
        return;
      }
      await fetchDbSegments();
      setNewSegmentInput("");
      notify(`Segment "${name}" créé`, "success");
    } catch {
      notify("Erreur réseau", "error");
    } finally {
      setSavingSegment(false);
    }
  };

  const handleRenameSegment = async (oldName: string) => {
    const newName = renameValue.trim().toUpperCase();
    if (!newName || newName === oldName) {
      setRenamingSegment(null);
      return;
    }
    setSavingSegment(true);
    try {
      const res = await fetch("/api/data/campagnes/segments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old: oldName, new: newName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify(err.error || "Erreur lors du renommage", "error");
        return;
      }
      await fetchDbSegments();
      setRenamingSegment(null);
      notify(`Renommé en "${newName}" — contacts mis à jour`, "success");
    } catch {
      notify("Erreur réseau", "error");
    } finally {
      setSavingSegment(false);
    }
  };

  const handleDeleteSegment = async (name: string) => {
    if (!window.confirm(`Supprimer le segment "${name}" ?\n\nLes contacts conserveront leur valeur actuelle.`)) return;
    setSavingSegment(true);
    try {
      const res = await fetch("/api/data/campagnes/segments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        notify("Erreur lors de la suppression", "error");
        return;
      }
      await fetchDbSegments();
      notify(`Segment "${name}" supprimé`, "success");
    } catch {
      notify("Erreur réseau", "error");
    } finally {
      setSavingSegment(false);
    }
  };

  const importedCount = stats.imported;
  const draftCount = stats.draft;
  const exportedCount = stats.exported;

  return (
    <div className="space-y-5 animate-fade-in">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportCSV(file);
        }}
      />

      {/* ── Segments Management Modal ──────────────────────────────────────── */}
      {segmentsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => { setSegmentsModalOpen(false); setRenamingSegment(null); }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-[13px] font-bold text-slate-900">Gérer les Segments</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">{availableSegments.length} segments · l&apos;IA n&apos;utilisera que ces valeurs</p>
              </div>
              <button
                onClick={() => { setSegmentsModalOpen(false); setRenamingSegment(null); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-gray-100 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Segment list */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100">
              {availableSegments.map((seg) => (
                <div key={seg} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50">
                  {renamingSegment === seg ? (
                    <>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameSegment(seg);
                          if (e.key === "Escape") setRenamingSegment(null);
                        }}
                        className="flex-1 rounded-lg px-2 py-1 text-[12px] border border-blue-300 outline-none focus:border-blue-500 text-slate-900"
                      />
                      <button
                        onClick={() => handleRenameSegment(seg)}
                        disabled={savingSegment}
                        className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                      >
                        {savingSegment ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                      <button
                        onClick={() => setRenamingSegment(null)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className={clsx(
                          "flex-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                          segmentColors[seg] || "text-slate-500 bg-gray-50 border-gray-200"
                        )}
                      >
                        {seg}
                      </span>
                      <button
                        onClick={() => { setRenamingSegment(seg); setRenameValue(seg); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Renommer"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteSegment(seg)}
                        disabled={savingSegment}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new segment */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <input
                  value={newSegmentInput}
                  onChange={(e) => setNewSegmentInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateSegment()}
                  placeholder="Nouveau segment…"
                  className="flex-1 rounded-lg px-3 py-2 text-[12px] border border-gray-200 bg-white outline-none focus:border-blue-300 text-slate-900 placeholder-slate-400"
                />
                <button
                  onClick={handleCreateSegment}
                  disabled={savingSegment || !newSegmentInput.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-[12px] font-semibold disabled:opacity-50 transition-colors"
                  style={{ background: "var(--blue)" }}
                >
                  {savingSegment ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Ajouter
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">Le nom sera automatiquement mis en majuscules.</p>
            </div>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full text-white text-[12px] font-bold hover:brightness-110 transition-colors disabled:opacity-60"
          style={{ background: "var(--blue)" }}
        >
          <Upload size={13} />
          {importing ? "Import…" : "Importer CSV"}
        </button>

        <button
          onClick={handleGenerateIcebreakers}
          disabled={generatingIB || selectionCount === 0}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-gray-200 text-slate-600 text-[12px] hover:border-gray-300 transition-colors disabled:opacity-50"
          title={selectionCount === 0 ? "Sélectionnez des contacts d'abord" : `Générer pour ${selectionCount} contact(s)`}
        >
          <Sparkles size={13} className="text-violet-600" />
          {generatingIB
            ? "Génération…"
            : selectionCount > 0
            ? `Générer IA (${selectionCount})`
            : "Générer Icebreakers IA"}
        </button>

        <button
          onClick={handleExportLemlist}
          disabled={exporting || selectionCount === 0}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-emerald-200 text-emerald-700 text-[12px] hover:border-emerald-500/60 hover:bg-emerald-50 transition-colors disabled:opacity-50"
          title={selectionCount === 0 ? "Sélectionnez des contacts d'abord" : `Exporter ${selectionCount} contact(s) vers Lemlist`}
        >
          <Send size={13} />
          {exporting
            ? "Export…"
            : selectionCount > 0
            ? `Exporter Lemlist (${selectionCount})`
            : "Exporter Lemlist"}
        </button>

        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-gray-200"
          title="Sélectionner automatiquement les N premiers contacts (sur l'ensemble du filtre, pas juste la page)"
        >
          <input
            type="number"
            min={1}
            max={filteredTotal || 1}
            value={selectCountInput}
            onChange={(e) => setSelectCountInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSelectN();
              }
            }}
            placeholder={`N sur ${filteredTotal}`}
            disabled={filteredTotal === 0}
            className="w-24 px-2 py-1 text-[12px] bg-transparent text-slate-900 placeholder-slate-400 outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSelectN}
            disabled={filteredTotal === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 text-[11px] font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            Sélectionner
          </button>
        </div>

        <button
          onClick={handleDownloadCSV}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-gray-200 text-slate-600 text-[12px] hover:border-gray-300 transition-colors"
        >
          <Download size={13} />
          CSV
        </button>

        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-amber-200"
          title={
            selectionCount > 0
              ? `Enrichir les ${selectionCount} contact(s) cochés`
              : suspiciousCount === 0
              ? "Aucun lead à enrichir"
              : `Entrez le nombre à enrichir (max ${suspiciousCount})`
          }
        >
          <Wand2 size={13} className="text-amber-700 ml-1" />
          {selectionCount > 0 ? (
            <span className="px-2 py-1 text-[11px] text-amber-700 font-semibold whitespace-nowrap">
              {selectionCount} sélectionné{selectionCount > 1 ? "s" : ""}
            </span>
          ) : (
            <input
              type="number"
              min={1}
              max={suspiciousCount || 1}
              value={enrichCountInput}
              onChange={(e) => setEnrichCountInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !enriching) {
                  e.preventDefault();
                  handleEnrichCompanies();
                }
              }}
              placeholder={suspiciousCount > 0 ? `N sur ${suspiciousCount}` : "0"}
              disabled={enriching || suspiciousCount === 0}
              className="w-24 px-2 py-1 text-[12px] bg-transparent text-slate-900 placeholder-slate-400 outline-none disabled:opacity-50"
            />
          )}
          <button
            onClick={handleEnrichCompanies}
            disabled={
              enriching ||
              (selectionCount === 0 && (suspiciousCount === 0 || !enrichCountInput))
            }
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-[11px] font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            {enriching && <Loader2 size={11} className="animate-spin" />}
            {enriching ? "Enrichissement…" : "Enrichir"}
          </button>
        </div>

        {/* Segment management */}
        <button
          onClick={() => setSegmentsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-slate-500 text-[12px] hover:border-gray-300 hover:text-slate-700 transition-colors ml-auto"
          title="Gérer les segments (ajouter, renommer, supprimer)"
        >
          <Settings2 size={12} />
          Segments
        </button>

        {/* Segment filter */}
        <div className="relative">
          <button
            onClick={() => setSegmentFilterOpen(!segmentFilterOpen)}
            disabled={availableSegments.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-slate-500 text-[12px] hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            <Filter size={12} />
            <span>{segmentFilter === "all" ? "Filtrer par segment" : segmentFilter}</span>
            <ChevronDown size={11} />
          </button>
          {segmentFilterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSegmentFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden min-w-[200px] max-h-[280px] overflow-y-auto">
                <button
                  onClick={() => {
                    setSegmentFilter("all");
                    setSegmentFilterOpen(false);
                  }}
                  className={clsx(
                    "w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50 transition-colors",
                    segmentFilter === "all" ? "text-blue-600" : "text-slate-500"
                  )}
                >
                  Tous les segments
                </button>
                {availableSegments.map((seg) => (
                  <button
                    key={seg}
                    onClick={() => {
                      setSegmentFilter(seg);
                      setSegmentFilterOpen(false);
                    }}
                    className={clsx(
                      "w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50 transition-colors",
                      segmentFilter === seg ? "text-blue-600" : "text-slate-500"
                    )}
                  >
                    {seg}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Status filter */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-slate-500 text-[12px] hover:border-gray-300 transition-colors"
          >
            <Filter size={12} />
            <span>{statutFilter === "all" ? "Filtrer par statut" : statutFilter}</span>
            <ChevronDown size={11} />
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden min-w-[180px]">
                {(["all", "Importé", "Brouillon IA", "Exporté Lemlist"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setStatutFilter(v);
                      setFilterOpen(false);
                    }}
                    className={clsx(
                      "w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50 transition-colors",
                      statutFilter === v ? "text-blue-600" : "text-slate-500"
                    )}
                  >
                    {v === "all" ? "Tous les statuts" : v}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Selection banner */}
      {selectionCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200">
          <CheckCircle2 size={13} className="text-blue-600 flex-shrink-0" />
          <p className="text-[12px] text-blue-600">
            <strong>{selectionCount}</strong> contact{selectionCount > 1 ? "s" : ""} sélectionné{selectionCount > 1 ? "s" : ""}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              {deleting ? "Suppression…" : `Supprimer (${selectionCount})`}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[11px] text-blue-600 hover:text-blue-600 transition-colors"
            >
              Désélectionner
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Base", value: total, icon: <BarChart3 size={14} />, color: "text-blue-600" },
          { label: "Importés", value: importedCount, icon: <Inbox size={14} />, color: "text-slate-600" },
          { label: "Brouillons IA", value: draftCount, icon: <Sparkles size={14} />, color: "text-violet-600" },
          { label: "Exportés Lemlist", value: exportedCount, icon: <Send size={14} />, color: "text-emerald-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 border border-gray-200 bg-white flex items-center gap-3">
            <div className={clsx("flex-shrink-0", s.color)}>{s.icon}</div>
            <div>
              <p className="text-[22px] font-black text-slate-900 leading-none">{s.value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Mail size={14} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-[13px] font-bold text-slate-900">Base Campagne Lemlist</h2>
            <p className="text-[11px] text-slate-400">
              Sélectionnez des contacts · Éditez le brouillon IA · Exportez vers Lemlist
            </p>
          </div>
          <span className="ml-auto text-[11px] text-slate-400">{filteredTotal} contacts</span>
        </div>

        {filteredTotal === 0 && !loadingPage ? (
          <div className="px-5 py-14 text-center">
            <Mail size={28} className="text-slate-500 mx-auto mb-3" />
            <p className="text-[13px] text-slate-400 font-medium">
              {total === 0
                ? "Aucun contact — importez un CSV pour commencer"
                : "Aucun résultat pour ce filtre"}
            </p>
            {total === 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 px-4 py-2 rounded-full text-white text-[12px] font-bold hover:brightness-110 transition-colors"
                style={{ background: "var(--blue)" }}
              >
                Importer un CSV
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pl-5 pr-2 py-3 w-8">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleAll}
                    />
                  </th>
                  {["Contact", "Segment", "Brouillon IA", "Visuel Assigné", "Statut"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.map((lead) => {
                  const isSelected = selectedIds.has(lead.id);
                  const icebreaker = getIcebreaker(lead);
                  return (
                    <tr
                      key={lead.id}
                      className={clsx(
                        "transition-colors group",
                        isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"
                      )}
                    >
                      <td className="pl-5 pr-2 py-3.5">
                        <Checkbox checked={isSelected} onChange={() => toggleRow(lead.id)} />
                      </td>
                      <td className="px-5 py-3.5">
                        {(() => {
                          const primary = lead.nom?.trim() || lead.entite?.trim() || "—";
                          const isCompanyOnly = !lead.nom?.trim() && !!lead.entite?.trim();
                          return (
                            <div className="flex items-center gap-2.5">
                              <div
                                className={clsx(
                                  "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-slate-900 flex-shrink-0",
                                  isSelected
                                    ? "bg-blue-500"
                                    : isCompanyOnly
                                    ? "bg-gradient-to-br from-amber-500 to-orange-600"
                                    : "bg-gradient-to-br from-violet-600 to-blue-700"
                                )}
                                title={isCompanyOnly ? "Entreprise (pas de nom de contact)" : "Contact"}
                              >
                                {(primary[0] || "?").toUpperCase()}
                              </div>
                              <div>
                                <p
                                  className={clsx(
                                    "text-[12px] font-semibold text-slate-900",
                                    !isCompanyOnly && "capitalize"
                                  )}
                                >
                                  {primary}
                                </p>
                                {lead.email && (
                                  <p className="text-[10px] text-slate-400 font-mono">{lead.email}</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3.5 min-w-[160px]">
                        {(() => {
                          const seg = getSegment(lead);
                          return (
                            <select
                              value={seg}
                              onChange={(e) => {
                                const v = e.target.value;
                                setLocalSegments((prev) => ({ ...prev, [lead.id]: v }));
                                saveField(lead.id, "segment", v);
                              }}
                              className={clsx(
                                "w-full rounded-lg px-2 py-1 text-[11px] font-semibold border outline-none transition-colors cursor-pointer",
                                seg
                                  ? segmentColors[seg] || "text-slate-500 bg-slate-50 border-slate-200"
                                  : "text-slate-400 bg-white border-gray-200"
                              )}
                            >
                              <option value="">— Segment —</option>
                              {availableSegments.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3 max-w-[260px]">
                        <textarea
                          value={icebreaker}
                          onChange={(e) =>
                            setLocalIcebreakers((prev) => ({
                              ...prev,
                              [lead.id]: e.target.value,
                            }))
                          }
                          onBlur={(e) => saveField(lead.id, "icebreaker", e.target.value)}
                          rows={2}
                          placeholder="Brouillon IA…"
                          className={clsx(
                            "w-full resize-none rounded-lg px-2.5 py-2 text-[11px] leading-snug",
                            "bg-white border transition-colors outline-none",
                            "text-slate-600 placeholder-slate-400",
                            icebreaker
                              ? "border-violet-200 focus:border-violet-500/50"
                              : "border-gray-200 focus:border-gray-300"
                          )}
                        />
                        {icebreaker &&
                          localIcebreakers[lead.id] !== undefined &&
                          localIcebreakers[lead.id] !== lead.icebreaker && (
                            <span className="text-[9px] text-amber-600 mt-0.5 block">
                              Modifié (non sauvegardé)
                            </span>
                          )}
                      </td>
                      <td className="px-5 py-3.5">
                        {(() => {
                          const src = getVisual(lead);
                          return isValidVisualUrl(src) ? (
                            <VisualCell src={src} label={visualLabel(src)} />
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">—</span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatutBadge statut={normalizeStatut(lead.statut)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredTotal > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-200 bg-white">
            <p className="text-[11px] text-slate-500">
              {loadingPage ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Chargement…</span>
              ) : (
                <>
                  Affichage <strong className="text-slate-900">{pageStart + 1}</strong>–
                  <strong className="text-slate-900">{pageEnd}</strong> sur{" "}
                  <strong className="text-slate-900">{filteredTotal}</strong>
                  {filteredTotal !== total && (
                    <span className="text-slate-400"> (filtré sur {total})</span>
                  )}
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={currentPage === 1 || loadingPage}
                className="px-2.5 py-1 rounded-md bg-white border border-gray-200 text-slate-500 text-[11px] font-semibold hover:border-gray-300 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Première page"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loadingPage}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-slate-500 text-[11px] font-semibold hover:border-gray-300 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={11} />
                Précédent
              </button>
              <span className="px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-600 text-[11px] font-semibold">
                Page {currentPage} sur {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loadingPage}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-slate-500 text-[11px] font-semibold hover:border-gray-300 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Suivant
                <ChevronRight size={11} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={currentPage >= totalPages || loadingPage}
                className="px-2.5 py-1 rounded-md bg-white border border-gray-200 text-slate-500 text-[11px] font-semibold hover:border-gray-300 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Dernière page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Funnel */}
      {total > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-[13px] font-bold text-slate-900 mb-4">Funnel de Campagne</h3>
          <div className="space-y-2.5">
            {[
              {
                label: "Contacts importés",
                count: total,
                pct: 100,
                color: "from-slate-500 to-slate-600",
              },
              {
                label: "Brouillons IA prêts",
                count: draftCount + exportedCount,
                pct: Math.round(((draftCount + exportedCount) / total) * 100),
                color: "from-violet-500 to-violet-600",
              },
              {
                label: "Exportés vers Lemlist",
                count: exportedCount,
                pct: Math.round((exportedCount / total) * 100),
                color: "from-emerald-500 to-emerald-600",
              },
            ].map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <p className="text-[11px] text-slate-500 w-40 flex-shrink-0">{step.label}</p>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                      step.color
                    )}
                    style={{ width: `${step.pct}%` }}
                  />
                </div>
                <p className="text-[11px] font-bold text-slate-900 w-8 text-right">{step.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
