"use client";

import {
  Calendar,
  MapPin,
  Building2,
  TrendingUp,
  Sparkles,
  Star,
  Users,
  Target,
  Send,
  Linkedin,
  Mail,
  Filter,
  ChevronDown,
  CheckCircle2,
  Minus,
  Square,
  Globe,
  Play,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { useState, useEffect, useRef } from "react";
import { useAppData } from "@/providers/AppDataProvider";
import { useToast } from "@/components/ToastProvider";
import { triggerAuto3 } from "@/lib/n8nService";
import { SalonLead, InteretLevel, BudgetLevel } from "@/lib/dataTypes";

interface Props {
  searchQuery: string;
}

interface ScrapingJob {
  id: string;
  salon_url: string;
  nom_salon: string;
  status: "running" | "done" | "failed";
  current_step: number;
  step_label: string;
  total_steps: number;
  leads_found: number;
  error_msg?: string | null;
}

interface ActiveScraping {
  url: string;
  nom: string;
  startTime: number;
}

// ─── Config maps ───────────────────────────────────────────────────────────────

const interetConfig: Record<InteretLevel, { color: string; bg: string; border: string; stars: number }> = {
  "Très Fort": { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", stars: 4 },
  Fort:        { color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200",    stars: 3 },
  Moyen:       { color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",   stars: 2 },
  Faible:      { color: "text-slate-400",    bg: "bg-gray-500/10",    border: "border-gray-500/20",    stars: 1 },
};

const budgetConfig: Record<BudgetLevel, { color: string; label: string }> = {
  Élevé:   { color: "text-emerald-700", label: "💰💰💰 Élevé" },
  Moyen:   { color: "text-amber-600",   label: "💰💰 Moyen" },
  Faible:  { color: "text-slate-400",    label: "💰 Faible" },
  Inconnu: { color: "text-slate-400",    label: "— Inconnu" },
};

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Checkbox({ checked, indeterminate = false, onChange }: {
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
          ? "bg-violet-500 border-violet-500"
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

// ─── Flat lead row type ────────────────────────────────────────────────────────

interface FlatLead {
  lead: SalonLead;
  salonId: string;
  salonNom: string;
  salonLieu: string;
  salonDates: string;
  key: string; // `${salonId}:${lead.id}`
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function OpportunitesSalonsView({ searchQuery }: Props) {
  const { data, refresh } = useAppData();
  const { notify } = useToast();

  // Scraping form
  const [nomSalon,       setNomSalon]       = useState("");
  const [urlSource,      setUrlSource]      = useState("");
  const [exposantsBruts, setExposantsBruts] = useState("");
  const [mode,           setMode]           = useState<"auto" | "manuel">("auto");
  const [launching,      setLaunching]      = useState(false);

  // Local edits (persisted to store on export)
  const [localArgs,    setLocalArgs]    = useState<Record<string, string>>({});
  const [localEmails,  setLocalEmails]  = useState<Record<string, string>>({});

  // Selection
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Export state
  const [exporting, setExporting] = useState(false);

  // Delete state
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"qualify" | "delete" | null>(null);

  // Scraping progress
  const [activeScraping, setActiveScraping] = useState<ActiveScraping | null>(null);
  const [scrapingJob, setScrapingJob] = useState<ScrapingJob | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progressTick, setProgressTick] = useState(0);

  // Filter
  const [interetFilter, setInteretFilter] = useState<InteretLevel | "all">("all");
  const [filterOpen, setFilterOpen]       = useState(false);

  // Tab split — "qualified" = Fort/Très Fort, "rejected" = Faible/Moyen
  const [activeTab, setActiveTab] = useState<"qualified" | "rejected">("qualified");
  const isQualified = (l: SalonLead) => l.interet === "Fort" || l.interet === "Très Fort";

  // ── Derived flat list ───────────────────────────────────────────────────────

  const allFlatLeads: FlatLead[] = data.salons.flatMap((salon) =>
    salon.leads
      .filter((lead) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          lead.entreprise.toLowerCase().includes(q) ||
          salon.nom.toLowerCase().includes(q) ||
          lead.sector.toLowerCase().includes(q) ||
          (lead.email || "").toLowerCase().includes(q)
        );
      })
      .map((lead) => ({
        lead,
        salonId: salon.id,
        salonNom: salon.nom,
        salonLieu: salon.lieu,
        salonDates: salon.dates,
        key: `${salon.id}:${lead.id}`,
      }))
  );

  const qualifiedCount = allFlatLeads.filter((f) => isQualified(f.lead)).length;
  const rejectedCount  = allFlatLeads.length - qualifiedCount;

  const flatLeads: FlatLead[] = allFlatLeads.filter((f) => {
    const qualifiedLead = isQualified(f.lead);
    if (activeTab === "qualified" && !qualifiedLead) return false;
    if (activeTab === "rejected" && qualifiedLead) return false;
    if (interetFilter !== "all" && f.lead.interet !== interetFilter) return false;
    return true;
  });

  const isRejectedTab = activeTab === "rejected";

  // ── Selection helpers ───────────────────────────────────────────────────────

  const allSelected  = flatLeads.length > 0 && flatLeads.every((f) => selectedKeys.has(f.key));
  const someSelected = flatLeads.some((f) => selectedKeys.has(f.key)) && !allSelected;
  const selectionCount = flatLeads.filter((f) => selectedKeys.has(f.key)).length;

  const toggleAll = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSelected) flatLeads.forEach((f) => next.delete(f.key));
      else flatLeads.forEach((f) => next.add(f.key));
      return next;
    });
  };

  const toggleRow = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getArg   = (f: FlatLead) => localArgs[f.key]   !== undefined ? localArgs[f.key]   : f.lead.argumentIA ?? "";
  const getEmail = (f: FlatLead) => localEmails[f.key] !== undefined ? localEmails[f.key] : f.lead.email ?? "";

  // ── Export to Lemlist ───────────────────────────────────────────────────────

  const handleExport = async () => {
    const toExport = flatLeads
      .filter((f) => selectedKeys.has(f.key))
      .map((f) => ({
        id:         f.lead.id,
        entreprise: f.lead.entreprise,
        email:      getEmail(f),
        linkedin:   f.lead.linkedin ?? "",
        argumentIA: getArg(f),
        sector:     f.lead.sector,
        salonNom:   f.salonNom,
        salonLieu:  f.salonLieu,
        salonDates: f.salonDates,
      }))
      .filter((l) => l.email && l.argumentIA);

    if (toExport.length === 0) {
      notify("Aucun lead valide — chaque lead sélectionné doit avoir un email et un brouillon IA", "error");
      return;
    }

    setExporting(true);
    try {
      const res = await fetch("/api/auto3-export-lemlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: toExport }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify(err.error || `Erreur ${res.status}`, "error");
        return;
      }

      // Persist email edits to store
      await Promise.all(
        flatLeads
          .filter((f) => selectedKeys.has(f.key) && localEmails[f.key] !== undefined)
          .map((f) =>
            fetch("/api/data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                source:  "patch-salon-lead",
                salonId: f.salonId,
                leadId:  f.lead.id,
                update:  { email: localEmails[f.key], argumentIA: getArg(f) },
              }),
            })
          )
      );

      await refresh();
      setSelectedKeys(new Set());
      notify(`${toExport.length} leads envoyés vers Lemlist (Auto 3)`, "success");
    } catch {
      notify("Erreur réseau lors de l'export", "error");
    } finally {
      setExporting(false);
    }
  };

  // ── Delete a salon lead ─────────────────────────────────────────────────────

  const handleDeleteLead = async (salonId: string, leadId: string, key: string) => {
    setDeletingKey(key);
    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "delete-salon-lead", salonId, leadId }),
      });
      setSelectedKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
      await refresh();
      notify("Lead supprimé", "success");
    } catch {
      notify("Erreur lors de la suppression", "error");
    } finally {
      setDeletingKey(null);
    }
  };

  // ── Progress polling ────────────────────────────────────────────────────────

  // Re-render every 15s so time-based step labels update
  useEffect(() => {
    if (!activeScraping || scrapingJob?.status === "done" || scrapingJob?.status === "failed") return;
    const t = setInterval(() => setProgressTick((v) => v + 1), 15000);
    return () => clearInterval(t);
  }, [activeScraping, scrapingJob?.status]);

  // Poll progress endpoint + refresh data every 4s while active
  useEffect(() => {
    if (!activeScraping) return;
    let alive = true;

    const poll = async () => {
      if (!alive) return;
      try {
        const qs = activeScraping.url
          ? `url=${encodeURIComponent(activeScraping.url)}`
          : `nom=${encodeURIComponent(activeScraping.nom)}`;
        const res = await fetch(`/api/data/salons/progress?${qs}`);
        if (res.ok) {
          const json = await res.json() as { job: ScrapingJob | null };
          if (json.job && alive) {
            setScrapingJob(json.job);
            if (json.job.status === "done" || json.job.status === "failed") {
              await refresh();
              dismissRef.current = setTimeout(() => {
                if (alive) { setActiveScraping(null); setScrapingJob(null); }
              }, 4000);
              return;
            }
          }
        }
        // Always refresh data to detect when leads appear
        if (alive) await refresh();
      } catch {}
    };

    const interval = setInterval(poll, 4000);
    poll();
    return () => {
      alive = false;
      clearInterval(interval);
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, [activeScraping, refresh]);

  // Detect leads appearing in data as fallback completion signal
  useEffect(() => {
    if (!activeScraping || scrapingJob?.status === "done") return;
    const found = data.salons.find((s) =>
      s.nom.toLowerCase().includes(activeScraping.nom.toLowerCase())
    );
    if (found && found.leads.length > 0) {
      setScrapingJob({
        id: "local",
        salon_url: activeScraping.url,
        nom_salon: activeScraping.nom,
        status: "done",
        current_step: 5,
        step_label: "Terminé",
        total_steps: 5,
        leads_found: found.leads.length,
      });
      if (dismissRef.current) clearTimeout(dismissRef.current);
      dismissRef.current = setTimeout(() => {
        setActiveScraping(null);
        setScrapingJob(null);
      }, 4000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.salons, activeScraping?.nom]);

  // Time-based step label when n8n hasn't posted DB updates yet
  function getElapsedStep(startTime: number): { step: number; label: string } {
    const elapsed = Date.now() - startTime;
    if (elapsed < 30_000)  return { step: 1, label: "Scraping de la page" };
    if (elapsed < 120_000) return { step: 2, label: "Enrichissement Apollo" };
    if (elapsed < 240_000) return { step: 3, label: "Qualification GPT" };
    return { step: 4, label: "Finalisation…" };
  }

  // ── Bulk actions on rejected leads ──────────────────────────────────────────

  const handleBulkQualify = async () => {
    const ids = flatLeads.filter((f) => selectedKeys.has(f.key)).map((f) => f.lead.id);
    if (ids.length === 0) return;
    setBulkBusy("qualify");
    try {
      const res = await fetch("/api/data/salons/lead/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, update: { interet: "Fort" } }),
      });
      if (!res.ok) throw new Error();
      setSelectedKeys(new Set());
      await refresh();
      notify(`${ids.length} lead${ids.length > 1 ? "s" : ""} qualifié${ids.length > 1 ? "s" : ""}`, "success");
    } catch {
      notify("Erreur lors de la qualification", "error");
    } finally {
      setBulkBusy(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = flatLeads.filter((f) => selectedKeys.has(f.key)).map((f) => f.lead.id);
    if (ids.length === 0) return;
    if (!window.confirm(`Supprimer ${ids.length} lead${ids.length > 1 ? "s" : ""} ?`)) return;
    setBulkBusy("delete");
    try {
      const res = await fetch("/api/data/salons/lead/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      setSelectedKeys(new Set());
      await refresh();
      notify(`${ids.length} lead${ids.length > 1 ? "s" : ""} supprimé${ids.length > 1 ? "s" : ""}`, "success");
    } catch {
      notify("Erreur lors de la suppression", "error");
    } finally {
      setBulkBusy(null);
    }
  };

  // ── Launch scraping ─────────────────────────────────────────────────────────

  const handleLaunch = async () => {
    if (!nomSalon.trim()) {
      notify("Renseignez le nom du salon", "error");
      return;
    }
    if (mode === "auto" && !urlSource.trim()) {
      notify("Renseignez l'URL des exposants", "error");
      return;
    }
    if (mode === "manuel" && !exposantsBruts.trim()) {
      notify("Collez la liste des exposants", "error");
      return;
    }

    setLaunching(true);
    try {
      const payload = mode === "auto"
        ? {
            type_source: "html" as const,
            nom_salon:   nomSalon.trim(),
            url_source:  urlSource.trim(),
          }
        : {
            type_source:     "manuel" as const,
            nom_salon:       nomSalon.trim(),
            exposants_bruts: exposantsBruts.trim(),
          };

      const result = await triggerAuto3(payload);

      if (result.success) {
        // Register progress job so the UI can track
        const trackingUrl = mode === "auto" ? urlSource.trim() : `manuel:${nomSalon.trim()}`;
        fetch("/api/data/salons/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salon_url: trackingUrl,
            nom_salon: nomSalon.trim(),
            status: "running",
            current_step: 1,
            step_label: "Démarrage",
          }),
        }).catch(() => {});
        setActiveScraping({ url: trackingUrl, nom: nomSalon.trim(), startTime: Date.now() });
        setScrapingJob(null);
        notify(`✅ Scraping lancé — ${nomSalon.trim()}`, "success");
        setNomSalon("");
        setUrlSource("");
        setExposantsBruts("");
      } else if (mode === "auto") {
        notify(
          "❌ Échec du scraping : Ce site est probablement protégé (Cloudflare) ou vide. Veuillez utiliser le Mode Manuel.",
          "error"
        );
      } else {
        notify(
          result.failedNode
            ? `❌ Échec à l'étape : ${result.failedNode}`
            : `❌ Erreur : ${result.message}`,
          "error"
        );
      }
    } catch (err) {
      notify(
        mode === "auto"
          ? "❌ Échec du scraping : Ce site est probablement protégé (Cloudflare) ou vide. Veuillez utiliser le Mode Manuel."
          : `❌ Erreur réseau : ${err instanceof Error ? err.message : "inconnue"}`,
        "error"
      );
    } finally {
      setLaunching(false);
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const nonEmptySalons = data.salons.filter((s) => s.leads.length > 0);
  const allLeads    = nonEmptySalons.flatMap((s) => s.leads);
  const totalLeads  = allLeads.length;
  const qualifiedLeads = allLeads.filter((l) => l.interet === "Très Fort" || l.interet === "Fort").length;
  const highPrio    = allLeads.filter((l) => l.interet === "Très Fort").length;
  const budgetEleve = allLeads.filter((l) => l.budget === "Élevé").length;
  const withEmail   = allLeads.filter((l) => l.email).length;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Scraping form ─────────────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Globe size={13} className="text-violet-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-[13px] font-bold text-slate-900">Lancer un nouveau scraping</h2>
            <p className="text-[11px] text-slate-400">Apify scrape les exposants → GPT-4o qualifie → résultats ici</p>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Mode toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              type="button"
              onClick={() => setMode("auto")}
              disabled={launching}
              className={clsx(
                "px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50",
                mode === "auto"
                  ? "bg-white text-violet-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Mode Automatique (URL)
            </button>
            <button
              type="button"
              onClick={() => setMode("manuel")}
              disabled={launching}
              className={clsx(
                "px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50",
                mode === "manuel"
                  ? "bg-white text-violet-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Mode Manuel (Copier-coller)
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {/* Nom du salon */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Nom du salon
              </label>
              <input
                type="text"
                value={nomSalon}
                onChange={(e) => setNomSalon(e.target.value)}
                onKeyDown={(e) => mode === "auto" && e.key === "Enter" && handleLaunch()}
                placeholder="Ex : Eurosatory 2026"
                disabled={launching}
                className="w-full rounded-lg px-3 py-2 text-[12px] bg-white border border-gray-200 text-slate-900 placeholder-slate-400 outline-none focus:border-violet-300 transition-colors disabled:opacity-50"
              />
            </div>

            {/* URL des exposants — Mode Auto */}
            {mode === "auto" && (
              <div className="flex-[2] min-w-[260px]">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  URL des exposants (lien du site web)
                </label>
                <input
                  type="url"
                  value={urlSource}
                  onChange={(e) => setUrlSource(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLaunch()}
                  placeholder="https://www.eurosatory.com/exposants"
                  disabled={launching}
                  className="w-full rounded-lg px-3 py-2 text-[12px] bg-white border border-gray-200 text-slate-900 placeholder-slate-400 outline-none focus:border-violet-300 transition-colors disabled:opacity-50"
                />
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleLaunch}
              disabled={
                launching ||
                !nomSalon.trim() ||
                (mode === "auto" ? !urlSource.trim() : !exposantsBruts.trim())
              }
              className={clsx(
                "flex-shrink-0 flex items-center gap-2 px-5 py-2 rounded-full text-[12px] font-bold transition-all",
                launching ||
                  !nomSalon.trim() ||
                  (mode === "auto" ? !urlSource.trim() : !exposantsBruts.trim())
                  ? "opacity-50 cursor-not-allowed bg-gray-100 text-slate-400"
                  : "text-white hover:brightness-110"
              )}
              style={
                launching ||
                !nomSalon.trim() ||
                (mode === "auto" ? !urlSource.trim() : !exposantsBruts.trim())
                  ? undefined
                  : { background: "var(--blue)" }
              }
            >
              {launching ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Play size={13} />
              )}
              {launching ? "Lancement…" : "Lancer le Scraping"}
            </button>
          </div>

          {/* Textarea — Mode Manuel */}
          {mode === "manuel" && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Liste des exposants
              </label>
              <textarea
                value={exposantsBruts}
                onChange={(e) => setExposantsBruts(e.target.value)}
                rows={8}
                placeholder="Collez ici le texte ou la liste des exposants copiée depuis le site web…"
                disabled={launching}
                className="w-full rounded-lg px-3 py-2 text-[12px] bg-white border border-gray-200 text-slate-900 placeholder-slate-400 outline-none focus:border-violet-300 transition-colors disabled:opacity-50 resize-y font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Astuce : utilisez ce mode si le site est protégé (Cloudflare, etc.) et que le scraping automatique échoue.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress tracker ───────────────────────────────────────────────── */}
      {activeScraping && (() => {
        const isDone   = scrapingJob?.status === "done";
        const isFailed = scrapingJob?.status === "failed";
        const displayStep = scrapingJob
          ? { step: scrapingJob.current_step, label: scrapingJob.step_label, total: scrapingJob.total_steps }
          : { ...getElapsedStep(activeScraping.startTime), total: 5 };
        // progressTick used to force re-render for time-based labels
        void progressTick;
        const pct = isDone ? 100 : Math.round((displayStep.step / displayStep.total) * 100);

        return (
          <div className={clsx(
            "rounded-xl border p-4 transition-all",
            isDone   ? "border-emerald-200 bg-emerald-50" :
            isFailed ? "border-red-200 bg-red-50" :
                       "border-violet-200 bg-violet-50"
          )}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {isDone ? (
                    <CheckCircle2 size={14} className="text-emerald-700 flex-shrink-0" />
                  ) : isFailed ? (
                    <Loader2 size={14} className="text-red-500 flex-shrink-0" />
                  ) : (
                    <Loader2 size={14} className="text-violet-600 animate-spin flex-shrink-0" />
                  )}
                  <p className="text-[12px] font-bold text-slate-900 truncate">
                    {isDone ? "Scraping terminé" : isFailed ? "Scraping échoué" : `Scraping en cours — ${activeScraping.nom}`}
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 pl-5">
                  Étape {displayStep.step}/{displayStep.total} : {displayStep.label}
                  {(scrapingJob?.leads_found ?? 0) > 0 && (
                    <span className="ml-2 font-semibold text-violet-600">· {scrapingJob!.leads_found} leads trouvés</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => { setActiveScraping(null); setScrapingJob(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50 transition-colors flex-shrink-0"
                title="Ignorer"
              >
                <X size={13} />
              </button>
            </div>

            {/* Step dots */}
            <div className="flex items-center gap-1.5 mt-3 pl-5">
              {Array.from({ length: displayStep.total }).map((_, i) => (
                <div
                  key={i}
                  className={clsx(
                    "h-1.5 flex-1 rounded-full transition-all duration-500",
                    i < displayStep.step
                      ? isDone ? "bg-emerald-500" : "bg-violet-500"
                      : "bg-white/60"
                  )}
                />
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 pl-5 text-right">{pct}%</p>

            {isFailed && scrapingJob?.error_msg && (
              <p className="text-[11px] text-red-600 mt-2 pl-5">{scrapingJob.error_msg}</p>
            )}
          </div>
        );
      })()}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Salons Identifiés",  value: nonEmptySalons.length, icon: <Calendar size={14} />,   color: "text-blue-600"    },
          { label: "Leads Qualifiés",    value: qualifiedLeads,     icon: <Users size={14} />,       color: "text-violet-600"  },
          { label: "Haute Priorité",     value: highPrio,           icon: <Target size={14} />,      color: "text-emerald-700" },
          { label: "Emails Enrichis",    value: withEmail,          icon: <Mail size={14} />,        color: "text-amber-600"   },
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

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {([
          { id: "qualified" as const, label: "Leads Qualifiés", count: qualifiedCount, color: "text-emerald-700", dot: "bg-emerald-500" },
          { id: "rejected"  as const, label: "Rejetés par l'IA", count: rejectedCount,  color: "text-slate-500",   dot: "bg-gray-400" },
        ]).map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                setInteretFilter("all");
                setSelectedKeys(new Set());
              }}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold transition-colors border-b-2 -mb-px",
                active
                  ? "border-violet-500 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <span className={clsx("w-1.5 h-1.5 rounded-full", t.dot)} />
              {t.label}
              <span className={clsx(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                active ? "bg-violet-50 text-violet-600" : "bg-gray-100 text-slate-500"
              )}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        {!isRejectedTab && (
          <button
            onClick={handleExport}
            disabled={exporting || selectionCount === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-violet-200 text-violet-600 text-[12px] font-semibold hover:border-violet-500/60 hover:bg-violet-50 transition-colors disabled:opacity-50"
            title={selectionCount === 0 ? "Sélectionnez des leads d'abord" : `Exporter ${selectionCount} lead(s) vers Lemlist`}
          >
            <Send size={13} />
            {exporting
              ? "Export…"
              : selectionCount > 0
              ? `Exporter Lemlist (${selectionCount})`
              : "Exporter Lemlist"}
          </button>
        )}
        {isRejectedTab && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkQualify}
              disabled={bulkBusy !== null || selectionCount === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-emerald-200 text-emerald-700 text-[12px] font-semibold hover:border-emerald-500/60 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              {bulkBusy === "qualify" ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              {bulkBusy === "qualify" ? "Qualification…" : selectionCount > 0 ? `Qualifier (${selectionCount})` : "Qualifier"}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkBusy !== null || selectionCount === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-red-200 text-red-600 text-[12px] font-semibold hover:border-red-500/60 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {bulkBusy === "delete" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {bulkBusy === "delete" ? "Suppression…" : selectionCount > 0 ? `Supprimer (${selectionCount})` : "Supprimer"}
            </button>
            {selectionCount === 0 && (
              <p className="text-[11px] text-slate-400 italic ml-2">
                Sélectionnez des leads pour les qualifier ou les supprimer.
              </p>
            )}
          </div>
        )}

        {/* Intérêt filter — scoped to current tab */}
        <div className="relative ml-auto">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-slate-500 text-[12px] hover:border-gray-300 transition-colors"
          >
            <Filter size={12} />
            <span>{interetFilter === "all" ? "Filtrer par intérêt" : interetFilter}</span>
            <ChevronDown size={11} />
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden min-w-[160px]">
                {((isRejectedTab
                  ? ["all", "Moyen", "Faible"]
                  : ["all", "Très Fort", "Fort"]) as ReadonlyArray<InteretLevel | "all">).map((v) => (
                  <button
                    key={v}
                    onClick={() => { setInteretFilter(v); setFilterOpen(false); }}
                    className={clsx(
                      "w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50 transition-colors",
                      interetFilter === v ? "text-violet-600" : "text-slate-500"
                    )}
                  >
                    {v === "all" ? "Tous les niveaux" : v}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Selection banner */}
      {selectionCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-violet-50 border border-violet-200">
          <CheckCircle2 size={13} className="text-violet-600 flex-shrink-0" />
          <p className="text-[12px] text-violet-600">
            <strong>{selectionCount}</strong> lead{selectionCount > 1 ? "s" : ""} sélectionné{selectionCount > 1 ? "s" : ""}
            {flatLeads.filter((f) => selectedKeys.has(f.key) && getEmail(f)).length > 0 && (
              <> · <strong>{flatLeads.filter((f) => selectedKeys.has(f.key) && getEmail(f)).length}</strong> avec email</>
            )}
          </p>
          <button
            onClick={() => setSelectedKeys(new Set())}
            className="ml-auto text-[11px] text-violet-600 hover:text-violet-600 transition-colors"
          >
            Tout désélectionner
          </button>
        </div>
      )}

      {/* Empty state */}
      {flatLeads.length === 0 && (
        <div className="glass-card px-5 py-14 text-center">
          <Calendar size={28} className="text-slate-500 mx-auto mb-3" />
          <p className="text-[13px] text-slate-400 font-medium">
            {nonEmptySalons.length === 0
              ? "Aucun résultat — renseignez le formulaire ci-dessus pour lancer un scraping"
              : "Aucun lead pour ce filtre"}
          </p>
          {nonEmptySalons.length === 0 && (
            <p className="text-[11px] text-slate-400 mt-1">
              Les exposants qualifiés apparaîtront ici après l&apos;exécution du workflow n8n
            </p>
          )}
        </div>
      )}

      {/* Table */}
      {flatLeads.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
              <Building2 size={14} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-slate-900">
                {isRejectedTab ? "Leads Rejetés par l'IA" : "Leads Salons — Validation Humaine"}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isRejectedTab
                  ? "Consultez le raisonnement IA — ces leads ne sont pas exportables vers Lemlist"
                  : "Complétez les emails · Éditez le brouillon IA · Sélectionnez et exportez vers Lemlist"}
              </p>
            </div>
            <span className="ml-auto text-[11px] text-slate-400">{flatLeads.length} leads</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pl-5 pr-2 py-3 w-8">
                    <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                  </th>
                  {["Entreprise", "Salon", "Secteur", "Email", "LinkedIn", "Brouillon IA", "Intérêt", "Budget", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {flatLeads.map((f) => {
                  const isSelected = selectedKeys.has(f.key);
                  const interet    = interetConfig[f.lead.interet];
                  const budget     = budgetConfig[f.lead.budget];
                  const arg        = getArg(f);
                  const email      = getEmail(f);

                  return (
                    <tr
                      key={f.key}
                      className={clsx(
                        "transition-colors",
                        isRejectedTab
                          ? "bg-gray-50/50 opacity-60 hover:opacity-80"
                          : isSelected
                            ? "bg-violet-50 hover:bg-violet-500/8"
                            : "hover:bg-gray-50"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="pl-5 pr-2 py-3.5">
                        <Checkbox checked={isSelected} onChange={() => toggleRow(f.key)} />
                      </td>

                      {/* Entreprise */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={clsx(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            isSelected ? "bg-violet-500" : "bg-gradient-to-br from-slate-600 to-slate-800 border border-gray-200"
                          )}>
                            <Building2 size={13} className="text-slate-900" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-slate-900 truncate max-w-[120px]">{f.lead.entreprise}</p>
                            {f.lead.employees && (
                              <p className="text-[10px] text-slate-400">{f.lead.employees}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Salon */}
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-[11px] font-semibold text-violet-600 truncate max-w-[120px]">{f.salonNom}</p>
                          {f.salonDates && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar size={9} />{f.salonDates}
                            </p>
                          )}
                          {f.salonLieu && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <MapPin size={9} />{f.salonLieu}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Secteur */}
                      <td className="px-4 py-3.5">
                        <p className="text-[11px] text-slate-500 max-w-[100px] truncate">{f.lead.sector || "—"}</p>
                      </td>

                      {/* Email — editable */}
                      <td className="px-4 py-3 min-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <Mail size={10} className={email ? "text-emerald-700 flex-shrink-0" : "text-slate-400 flex-shrink-0"} />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) =>
                              setLocalEmails((prev) => ({ ...prev, [f.key]: e.target.value }))
                            }
                            placeholder="email@entreprise.com"
                            className={clsx(
                              "w-full rounded-lg px-2 py-1.5 text-[11px] bg-white border outline-none transition-colors",
                              "text-slate-600 placeholder-gray-700",
                              email
                                ? "border-emerald-200 focus:border-emerald-500/50"
                                : "border-gray-200 focus:border-gray-300"
                            )}
                          />
                        </div>
                        {localEmails[f.key] !== undefined && localEmails[f.key] !== (f.lead.email ?? "") && (
                          <span className="text-[9px] text-amber-600 mt-0.5 block pl-4">Modifié</span>
                        )}
                      </td>

                      {/* LinkedIn */}
                      <td className="px-4 py-3.5">
                        {f.lead.linkedin ? (
                          <a
                            href={f.lead.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-600 transition-colors"
                          >
                            <Linkedin size={11} />
                            <span className="truncate max-w-[80px]">Profil</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Brouillon IA — editable */}
                      <td className="px-4 py-3 min-w-[220px]">
                        <div className="flex items-start gap-1.5">
                          <Sparkles size={10} className={clsx("mt-1.5 flex-shrink-0", arg ? "text-violet-600" : "text-slate-400")} />
                          <textarea
                            value={arg}
                            onChange={(e) =>
                              setLocalArgs((prev) => ({ ...prev, [f.key]: e.target.value }))
                            }
                            rows={2}
                            placeholder="Argument commercial IA…"
                            className={clsx(
                              "w-full resize-none rounded-lg px-2.5 py-1.5 text-[11px] leading-snug",
                              "bg-white border outline-none transition-colors",
                              "text-slate-600 placeholder-gray-700",
                              arg
                                ? "border-violet-200 focus:border-violet-500/50"
                                : "border-gray-200 focus:border-gray-300"
                            )}
                          />
                        </div>
                        {localArgs[f.key] !== undefined && localArgs[f.key] !== f.lead.argumentIA && (
                          <span className="text-[9px] text-amber-600 mt-0.5 block pl-5">Modifié</span>
                        )}
                      </td>

                      {/* Intérêt */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span className={clsx(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap",
                            interet.color, interet.bg, interet.border
                          )}>
                            <TrendingUp size={9} />
                            {f.lead.interet}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <Star
                                key={i}
                                size={8}
                                className={i < interet.stars ? "text-amber-600 fill-amber-400" : "text-slate-500"}
                              />
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Budget */}
                      <td className="px-4 py-3.5">
                        <span className={clsx("text-[11px] font-medium", budget.color)}>{budget.label}</span>
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => handleDeleteLead(f.salonId, f.lead.id, f.key)}
                          disabled={deletingKey === f.key}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                          title="Supprimer ce lead"
                        >
                          {deletingKey === f.key
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Trash2 size={13} />
                          }
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget summary */}
      {totalLeads > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-[13px] font-bold text-slate-900 mb-4">Distribution des Leads</h3>
          <div className="space-y-2.5">
            {([
              { label: "Très Fort",  count: allLeads.filter((l) => l.interet === "Très Fort").length,  color: "from-emerald-500 to-emerald-600" },
              { label: "Fort",       count: allLeads.filter((l) => l.interet === "Fort").length,       color: "from-blue-500 to-blue-600"    },
              { label: "Moyen",      count: allLeads.filter((l) => l.interet === "Moyen").length,      color: "from-amber-500 to-amber-600"  },
              { label: "Faible",     count: allLeads.filter((l) => l.interet === "Faible").length,     color: "from-gray-500 to-gray-600"    },
              { label: "Avec email", count: withEmail,                                                  color: "from-violet-500 to-violet-600" },
              { label: "Budget Élevé", count: budgetEleve,                                             color: "from-emerald-600 to-teal-600"  },
            ] as const).map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <p className="text-[11px] text-slate-500 w-28 flex-shrink-0">{step.label}</p>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={clsx("h-full rounded-full bg-gradient-to-r transition-all duration-500", step.color)}
                    style={{ width: totalLeads > 0 ? `${Math.round((step.count / totalLeads) * 100)}%` : "0%" }}
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
