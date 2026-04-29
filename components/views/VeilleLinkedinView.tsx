"use client";

import {
  Linkedin,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Filter,
  RefreshCw,
  Wifi,
  TrendingUp,
  ChevronDown,
  Zap,
  Eye,
  Plus,
  Trash2,
  Users,
  Loader2,
  Play,
} from "lucide-react";
import clsx from "clsx";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";
import { VeilleLead, VeilleStatut } from "@/lib/dataTypes";
import type { Competitor } from "@/app/api/competitors/route";
import { triggerAuto1 } from "@/lib/n8nService";

interface Props {
  searchQuery: string;
}

const statutConfig: Record<
  VeilleStatut,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  "🔴 Nouveau": {
    label: "Nouveau",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: <AlertTriangle size={11} />,
  },
  "🟡 En cours": {
    label: "En cours",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: <TrendingUp size={11} />,
  },
  "🟢 Traité": {
    label: "Traité",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: <CheckCircle2 size={11} />,
  },
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  // Try parsing as JSON object with a fullDate key
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (parsed && typeof parsed === "object" && parsed.fullDate) {
      // fullDate looks like "2026-04-02 05:14:13.00 +0000 UTC"
      const datePart = String(parsed.fullDate).split(" ")[0]; // "2026-04-02"
      const [y, m, d] = datePart.split("-");
      if (y && m && d) return `${d}/${m}/${y}`;
      return parsed.fullDate;
    }
  } catch {
    // Not JSON — fall through
  }
  return value;
}

function ScoreBadge({ score, scoreNum }: { score: string; scoreNum: number }) {
  const cls =
    scoreNum >= 70
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : scoreNum >= 40
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-slate-500 bg-slate-100 border-slate-200";
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold", cls)}>
      {score}
    </span>
  );
}

export default function VeilleLinkedinView({ searchQuery }: Props) {
  const { notify } = useToast();
  const [veille, setVeille]             = useState<VeilleLead[]>([]);
  const [veilleLoading, setVeilleLoading] = useState(true);
  const [statutFilter, setStatutFilter] = useState<VeilleStatut | "all">("all");
  const [filterOpen, setFilterOpen]     = useState(false);
  const [creatingLead, setCreatingLead] = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);

  const fetchVeille = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/data/veille?limit=300");
      if (res.ok) {
        const json = await res.json();
        setVeille(json.items ?? []);
      }
    } catch {
      // keep previous state
    } finally {
      setVeilleLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVeille();
    const id = setInterval(fetchVeille, 30_000);
    return () => clearInterval(id);
  }, [fetchVeille]);

  // ── Auto 1 launch ──────────────────────────────────────────────────────────
  const [launching, setLaunching] = useState(false);

  const handleLaunchAuto1 = async () => {
    setLaunching(true);
    try {
      const result = await triggerAuto1();
      if (result.success) {
        notify(
          "🚀 L'analyse IA a été lancée en arrière-plan. Les nouveaux posts apparaîtront en temps réel d'ici quelques minutes.",
          "success"
        );
        setTimeout(() => fetchVeille(), 3000);
      } else {
        notify(
          result.failedNode
            ? `❌ Échec à l'étape : ${result.failedNode}`
            : `❌ Erreur : ${result.message}`,
          "error"
        );
      }
    } catch {
      notify("❌ Erreur réseau", "error");
    } finally {
      setLaunching(false);
    }
  };

  // ── Competitors state ───────────────────────────────────────────────────────
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [compLoading, setCompLoading] = useState(true);
  const [newName, setNewName]         = useState("");
  const [newUrl, setNewUrl]           = useState("");
  const [adding, setAdding]           = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/competitors")
      .then((r) => r.json())
      .then((d) => setCompetitors(d.competitors ?? []))
      .catch(() => {})
      .finally(() => setCompLoading(false));
  }, []);

  const handleAddCompetitor = async () => {
    const name         = newName.trim();
    const linkedin_url = newUrl.trim();
    if (!name || !linkedin_url) {
      notify("Renseignez le nom et l'URL LinkedIn", "error");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, linkedin_url }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error ?? `Erreur ${res.status}`, "error"); return; }
      setCompetitors(data.competitors);
      setNewName("");
      setNewUrl("");
      notify(`✅ ${name} ajouté à la liste`, "success");
    } catch {
      notify("Erreur réseau", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCompetitor = async (name: string) => {
    setDeletingName(name);
    try {
      const res = await fetch("/api/competitors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error ?? `Erreur ${res.status}`, "error"); return; }
      setCompetitors(data.competitors);
      notify(`${name} supprimé`, "success");
    } catch {
      notify("Erreur réseau", "error");
    } finally {
      setDeletingName(null);
    }
  };

  const filtered = veille.filter((p) => {
    if (statutFilter !== "all" && p.statut !== statutFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.concurrent.toLowerCase().includes(q) ||
      (p.clientFinal?.toLowerCase().includes(q) ?? false) ||
      (p.typeProjet?.toLowerCase().includes(q) ?? false) ||
      (p.technologie?.toLowerCase().includes(q) ?? false) ||
      p.extraitPost.toLowerCase().includes(q)
    );
  });

  const alertCount  = veille.filter((p) => p.scoreNum >= 70).length;
  const ignoreCount = veille.filter((p) => p.scoreNum < 40).length;
  const topLead     = veille.find((p) => p.scoreNum >= 70);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/data/veille/${id}`, { method: "DELETE" });
      setVeille((prev) => prev.filter((p) => p.id !== id));
      notify("Lead supprimé", "success");
    } catch {
      notify("Erreur lors de la suppression", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateLead = async (lead: VeilleLead) => {
    setCreatingLead(lead.id);
    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "auto2",
          leads: [
            {
              id: `veille-${lead.id}`,
              nom: lead.concurrent,
              entite: lead.clientFinal || lead.concurrent,
              email: "",
              segment: lead.typeProjet || lead.technologie || "LED",
              icebreaker: lead.citationCle || lead.extraitPost.slice(0, 150),
              statut: "Importé",
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
      await fetch(`/api/data/veille/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "🟢 Traité" }),
      });
      setVeille((prev) =>
        prev.map((p) => p.id === lead.id ? { ...p, statut: "🟢 Traité" } : p)
      );
      notify("Lead créé dans Campagnes Lemlist", "success");
    } catch {
      notify("Erreur lors de la création du lead", "error");
    } finally {
      setCreatingLead(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Gestion des Concurrents ─────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Users size={13} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-[13px] font-bold text-slate-900">Gestion des Concurrents</h2>
            <p className="text-[11px] text-slate-400">
              Liste lue par n8n via <code className="font-mono text-[10px] bg-gray-100 px-1 rounded">GET /api/competitors</code> avant chaque scraping
            </p>
          </div>
          <span className="text-[11px] text-slate-400">{competitors.length} concurrent{competitors.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="p-4 space-y-3">
          {/* Add form */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Nom du concurrent
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
                placeholder="Ex : Absen"
                disabled={adding}
                className="w-full rounded-lg px-3 py-2 text-[12px] bg-white border border-gray-200 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-300 transition-colors disabled:opacity-50"
              />
            </div>
            <div className="flex-[2] min-w-[220px]">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                URL LinkedIn
              </label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
                placeholder="https://www.linkedin.com/company/absen-led"
                disabled={adding}
                className="w-full rounded-lg px-3 py-2 text-[12px] bg-white border border-gray-200 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-300 transition-colors disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleAddCompetitor}
              disabled={adding || !newName.trim() || !newUrl.trim()}
              className={clsx(
                "flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold transition-all",
                adding || !newName.trim() || !newUrl.trim()
                  ? "opacity-50 cursor-not-allowed bg-gray-100 text-slate-400"
                  : "text-white hover:brightness-110"
              )}
              style={adding || !newName.trim() || !newUrl.trim() ? undefined : { background: "var(--blue)" }}
            >
              {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {adding ? "Ajout…" : "Ajouter"}
            </button>
          </div>

          {/* Competitor list */}
          {compLoading ? (
            <div className="flex items-center gap-2 py-3 text-slate-400">
              <Loader2 size={13} className="animate-spin" />
              <span className="text-[12px]">Chargement…</span>
            </div>
          ) : competitors.length === 0 ? (
            <div className="py-4 text-center border border-dashed border-gray-200 rounded-lg">
              <p className="text-[12px] text-slate-400">
                Aucun concurrent — ajoutez-en un ci-dessus pour démarrer la veille
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {["Nom", "URL LinkedIn", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {competitors.map((c) => (
                    <tr key={c.name} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <Linkedin size={10} className="text-slate-900" />
                          </div>
                          <span className="text-[12px] font-semibold text-slate-900">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <a
                          href={c.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 max-w-[280px] truncate"
                        >
                          <ExternalLink size={10} className="flex-shrink-0" />
                          <span className="truncate">{c.linkedin_url}</span>
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteCompetitor(c.name)}
                          disabled={deletingName === c.name}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                          title={`Supprimer ${c.name}`}
                        >
                          {deletingName === c.name
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Trash2 size={13} />
                          }
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
          <Wifi size={13} className="text-blue-600" />
          <span className="text-[12px] font-medium text-blue-600">
            Scraping actif — LinkedIn Sales Navigator
          </span>
        </div>

        {/* Statut filter */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-slate-500 text-[12px] hover:border-gray-300 transition-colors"
          >
            <Filter size={12} />
            <span>{statutFilter === "all" ? "Tous les statuts" : statutConfig[statutFilter as VeilleStatut]?.label ?? "Tous"}</span>
            <ChevronDown size={11} />
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden min-w-[160px]">
                {(["all", "🔴 Nouveau", "🟡 En cours", "🟢 Traité"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => { setStatutFilter(v); setFilterOpen(false); }}
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

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={fetchVeille}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-slate-500 text-[12px] hover:text-slate-900 hover:border-gray-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Actualisation…" : "Actualiser"}</span>
          </button>
          <button
            onClick={handleLaunchAuto1}
            disabled={launching}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold transition-all",
              launching
                ? "opacity-50 cursor-not-allowed bg-gray-100 text-slate-400"
                : "text-white hover:brightness-110"
            )}
            style={launching ? undefined : { background: "var(--blue)" }}
          >
            {launching ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {launching ? "En cours…" : "Lancer Auto 1"}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-[26px] font-black" style={{ color: "var(--navy)", fontFamily: "'Space Grotesk', sans-serif" }}>
            {veilleLoading ? "…" : veille.length}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-sec)" }}>Posts Détectés</p>
        </div>
        <div className="glass-card p-4 text-center" style={{ border: "1px solid rgba(16,185,129,.2)", background: "rgba(240,253,244,.9)" }}>
          <p className="text-[26px] font-black" style={{ color: "#10b981", fontFamily: "'Space Grotesk', sans-serif" }}>{alertCount}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#10b981" }}>Haute Priorité</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[26px] font-black" style={{ color: "var(--text-sec)", fontFamily: "'Space Grotesk', sans-serif" }}>{ignoreCount}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Faible Priorité</p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Linkedin size={14} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-[13px] font-bold text-slate-900">Flux de Veille Concurrentielle</h2>
            <p className="text-[11px] text-slate-400">
              Posts LinkedIn analysés par IA — mots-clés LED, écran, mur images
            </p>
          </div>
          <span className="ml-auto text-[11px] text-slate-400">{filtered.length} entrées</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Eye size={28} className="text-slate-500 mx-auto mb-3" />
            <p className="text-[13px] text-slate-400 font-medium">
              {veille.length === 0
                ? "Aucun lead — lancez Auto 1 pour détecter des posts LinkedIn"
                : "Aucun résultat pour ce filtre"}
            </p>
            {veille.length === 0 && (
              <p className="text-[11px] text-slate-400 mt-1">
                n8n enverra les données ici une fois l'automation exécutée
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Concurrent", "Client Final", "Type LED", "Score IA", "Date", "Statut", ""].map((h) => (
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
                {filtered.map((post) => {
                  const scfg = statutConfig[post.statut];
                  return (
                    <tr
                      key={post.id}
                      className={clsx(
                        "table-row-hover transition-colors group",
                        post.scoreNum >= 70 && "bg-emerald-50"
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-[11px] font-bold text-slate-900 flex-shrink-0">
                            {post.concurrent[0]}
                          </div>
                          <div>
                            <p className="text-[12px] font-semibold text-slate-900">{post.concurrent}</p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Linkedin size={9} />
                              LinkedIn
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={clsx("text-[12px] font-medium", !post.clientFinal ? "text-slate-400 italic" : "text-slate-900")}>
                          {post.clientFinal || "Non identifié"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[12px] text-slate-600">
                          {post.typeProjet || post.technologie || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <ScoreBadge score={post.scoreIA} scoreNum={post.scoreNum} />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] text-slate-400">{formatDate(post.datePost || post.dateDetection)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium", scfg.color, scfg.bg, scfg.border)}>
                          {scfg.icon}
                          {scfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {post.urlPost && (
                            <a
                              href={post.urlPost}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-gray-50 text-slate-400 hover:text-blue-600 transition-colors"
                              title="Voir le post LinkedIn"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                          <button
                            onClick={() => handleCreateLead(post)}
                            disabled={creatingLead === post.id || post.statut === "🟢 Traité"}
                            className="p-1.5 rounded-lg hover:bg-gray-50 text-slate-400 hover:text-emerald-700 transition-colors disabled:opacity-30"
                            title="Créer lead Lemlist"
                          >
                            <Zap size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(post.id)}
                            disabled={deletingId === post.id}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30"
                            title="Supprimer ce lead"
                          >
                            {deletingId === post.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <Trash2 size={13} />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top priority lead card */}
      {topLead && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={15} className="text-emerald-700" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[13px] font-bold text-emerald-700">Dernière Alerte Haute Priorité</p>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {topLead.scoreIA}
                </span>
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {formatDate(topLead.dateDetection)}
                </span>
              </div>
              <p className="text-[12px] text-emerald-800 mt-1.5 leading-relaxed">
                <strong className="text-emerald-700">{topLead.concurrent}</strong>
                {topLead.clientFinal && (
                  <> — client <strong className="text-emerald-700">{topLead.clientFinal}</strong></>
                )}
                {topLead.typeProjet && <> · {topLead.typeProjet}</>}
              </p>
              {topLead.extraitPost && (
                <p className="text-[11px] text-slate-500 mt-1 italic line-clamp-2">
                  &ldquo;{topLead.extraitPost}&rdquo;
                </p>
              )}
              <div className="mt-3 flex gap-2 flex-wrap">
                {topLead.urlPost ? (
                  <a
                    href={topLead.urlPost}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-1.5 rounded-full text-white text-[11px] font-semibold transition-colors hover:brightness-110"
                    style={{ background: "var(--blue)" }}
                  >
                    Voir le post LinkedIn
                  </a>
                ) : (
                  <button
                    disabled
                    className="px-4 py-1.5 rounded-full bg-gray-200 text-slate-400 text-[11px] font-semibold cursor-not-allowed"
                  >
                    Voir le post LinkedIn
                  </button>
                )}
                <button
                  onClick={() => handleCreateLead(topLead)}
                  disabled={creatingLead === topLead.id || topLead.statut === "🟢 Traité"}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold transition-colors disabled:opacity-50"
                >
                  {creatingLead === topLead.id
                    ? "Création…"
                    : topLead.statut === "🟢 Traité"
                    ? "Lead créé ✓"
                    : "Créer un lead Lemlist"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
