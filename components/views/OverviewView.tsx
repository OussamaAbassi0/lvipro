"use client";

import N8nControlPanel from "@/components/N8nControlPanel";
import type { ActiveView } from "@/components/Sidebar";
import {
  Users, Monitor, TrendingUp, Zap, Activity, Target,
  BarChart3, CheckCircle2, Clock, AlertCircle, Calendar, Mail, Linkedin,
} from "lucide-react";
import { useAppData } from "@/providers/AppDataProvider";

/* ─── helpers ────────────────────────────────────────────────────────────── */

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h`;
  return `Il y a ${Math.floor(hrs / 24)}j`;
}

/* ─── KPI Card (glass) ───────────────────────────────────────────────────── */

function KpiCard({
  icon, label, value, sub, accent = "var(--blue)", large = false,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; accent?: string; large?: boolean;
}) {
  return (
    <div
      className="glass-card"
      style={{ flex: 1, minWidth: 0, padding: large ? "28px 30px" : "20px 22px" }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${accent}14`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 14, color: accent, fontSize: 16,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: large ? 38 : 28, fontWeight: 700,
          color: "var(--navy)",
          fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: "-0.025em", lineHeight: 1.05,
        }}
      >
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-sec)", marginTop: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ─── Overview ───────────────────────────────────────────────────────────── */

export default function OverviewView({ onNavigate }: { onNavigate?: (view: ActiveView) => void }) {
  const { data, campagnesStats } = useAppData();

  const totalLeads = data.veille.length + campagnesStats.total + data.salons.reduce((a, s) => a + s.leads.length, 0);
  const highPriority = data.veille.filter((v) => v.scoreNum >= 70).length;
  const exportedLemlist = campagnesStats.exported;
  const exportRate = campagnesStats.total > 0 ? Math.round((exportedLemlist / campagnesStats.total) * 100) : 0;

  const recentActivity = [
    ...data.veille.slice(0, 2).map((v) => ({
      icon: <CheckCircle2 size={14} />,
      accent: "#10b981",
      text: `Lead LinkedIn détecté: ${v.concurrent}${v.clientFinal ? ` — ${v.clientFinal}` : ""}${v.typeProjet ? ` (${v.typeProjet})` : ""}`,
      time: v.dateDetection,
    })),
    ...(campagnesStats.exported > 0 ? [{
      icon: <Activity size={14} />,
      accent: "#10b981",
      text: `${campagnesStats.exported} contact${campagnesStats.exported > 1 ? "s" : ""} exporté${campagnesStats.exported > 1 ? "s" : ""} vers Lemlist`,
      time: "",
    }] : []),
    ...data.salons.slice(0, 1).map((s) => ({
      icon: <Clock size={14} />,
      accent: "#7c3aed",
      text: `Salon scrapé: ${s.nom} — ${s.leads.length} leads qualifiés`,
      time: s.updatedAt ? new Date(s.updatedAt).toLocaleDateString("fr-FR") : "",
    })),
  ].slice(0, 4);

  const automations = [
    {
      name: "Veille LinkedIn", icon: <Linkedin size={12} />, color: "var(--blue)",
      count: data.veille.length, unit: "leads", lastSync: data.lastSync.auto1,
      progress: Math.min(100, Math.round((data.veille.length / 50) * 100)),
    },
    {
      name: "Campagnes Lemlist", icon: <Mail size={12} />, color: "#10b981",
      count: campagnesStats.total, unit: "contacts", lastSync: data.lastSync.auto2,
      progress: campagnesStats.total > 0 ? Math.min(100, Math.round((campagnesStats.exported / campagnesStats.total) * 100)) : 0,
    },
    {
      name: "Opportunités Salons", icon: <Calendar size={12} />, color: "#7c3aed",
      count: data.salons.length, unit: "salons", lastSync: data.lastSync.auto3,
      progress: Math.min(100, data.salons.length * 12),
    },
  ];

  const secKpis = [
    { label: "Salons Scrapés",        value: data.salons.length,          icon: <Target size={14} />,    accent: "#f59e0b" },
    { label: "Alertes Haute Priorité", value: highPriority,               icon: <Zap size={14} />,       accent: "#ef4444" },
    { label: "Brouillons IA prêts",    value: campagnesStats.draft,       icon: <BarChart3 size={14} />, accent: "#7c3aed" },
    { label: "Leads Salons Fort+",     value: data.salons.flatMap((s) => s.leads).filter((l) => l.interet === "Très Fort" || l.interet === "Fort").length, icon: <Activity size={14} />, accent: "#10b981" },
  ];

  const miniBar = [
    data.veille.length, campagnesStats.total,
    data.salons.reduce((a, s) => a + s.leads.length, 0),
    data.veille.filter((v) => v.scoreNum >= 70).length,
    campagnesStats.exported, campagnesStats.draft, campagnesStats.imported,
  ];
  const miniBarMax = Math.max(1, ...miniBar);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Hero KPIs */}
      <div style={{ display: "flex", gap: 14 }}>
        <KpiCard large icon={<Users size={18} />}     label="Total Leads Identifiés" value={totalLeads}       sub="Toutes sources confondues"      accent="var(--blue)" />
        <KpiCard large icon={<Monitor size={18} />}   label="Murs LED Haute Priorité" value={highPriority}    sub="Via scraping LinkedIn"          accent="#7c3aed" />
        <KpiCard large icon={<TrendingUp size={18} />} label="Taux d'Export Lemlist"  value={`${exportRate}%`} sub={campagnesStats.total > 0 ? `${exportedLemlist} sur ${campagnesStats.total}` : "Aucune campagne"} accent="#10b981" />
      </div>

      {/* Secondary KPIs */}
      <div style={{ display: "flex", gap: 14 }}>
        {secKpis.map((k) => (
          <div
            key={k.label}
            className="glass-card"
            style={{ flex: 1, padding: "18px 20px" }}
          >
            <div style={{ color: k.accent, marginBottom: 8 }}>{k.icon}</div>
            <p style={{ fontSize: 26, fontWeight: 800, color: "var(--navy)", fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
              {k.value}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-sec)", marginTop: 4 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* n8n Control Panel */}
      <N8nControlPanel onNavigate={onNavigate} />

      {/* Activity + Automation status */}
      <div style={{ display: "flex", gap: 16 }}>

        {/* Recent activity */}
        <div className="glass-card" style={{ flex: 2, overflow: "hidden" }}>
          <div
            style={{
              padding: "18px 22px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", fontFamily: "'Space Grotesk', sans-serif" }}>
                Activité Récente
              </h2>
              <p style={{ fontSize: 11, color: "var(--text-sec)", marginTop: 2 }}>Derniers événements de toutes les automations</p>
            </div>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em",
                color: "#10b981", padding: "3px 8px", borderRadius: 20,
                background: "rgba(16,185,129,.18)",
              }}
            >
              <span className="lvi-live-dot" style={{ width: 5.5, height: 5.5, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
              LIVE
            </span>
          </div>

          {recentActivity.length === 0 ? (
            <div style={{ padding: "40px 22px", textAlign: "center" }}>
              <AlertCircle size={22} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
              <p style={{ fontSize: 12, color: "var(--text-sec)" }}>
                Aucune activité — lancez vos automations pour voir les données ici
              </p>
            </div>
          ) : (
            recentActivity.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 22px",
                  borderBottom: "1px solid var(--border)",
                  transition: "background .15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8faff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div
                  style={{
                    marginTop: 1, width: 26, height: 26, borderRadius: "50%",
                    background: `${item.accent}14`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: item.accent, flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: "var(--navy)", lineHeight: 1.5 }}>{item.text}</p>
                  {item.time && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.time}</p>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Automation status */}
        <div className="glass-card" style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", fontFamily: "'Space Grotesk', sans-serif" }}>
              État des Automations
            </h2>
            <p style={{ fontSize: 11, color: "var(--text-sec)", marginTop: 2 }}>Santé des 3 pipelines</p>
          </div>

          <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
            {automations.map((auto) => (
              <div key={auto.name}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: auto.color, display: "flex" }}>{auto.icon}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--navy)", flex: 1 }}>{auto.name}</span>
                  <span
                    style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                      color: auto.lastSync ? "#10b981" : "var(--text-muted)",
                      background: auto.lastSync ? "rgba(16,185,129,.12)" : "rgba(148,163,184,.12)",
                    }}
                  >
                    {auto.lastSync ? "Actif" : "En attente"}
                  </span>
                </div>
                <p style={{ fontSize: 10.5, color: "var(--text-sec)", marginBottom: 6 }}>
                  {auto.count} {auto.unit} · Sync: {formatSyncTime(auto.lastSync)}
                </p>
                <div style={{ height: 5, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${auto.progress}%`,
                      background: auto.color,
                      borderRadius: 99,
                      transition: "width 1s ease",
                    }}
                  />
                </div>
                <p style={{ fontSize: 10.5, color: "var(--text-sec)", marginTop: 3, textAlign: "right" }}>
                  {auto.progress}%
                </p>
              </div>
            ))}
          </div>

          {/* Mini bar chart */}
          <div style={{ margin: "0 22px 22px", padding: "12px 14px", borderRadius: 10, background: "#f3f5fb", border: "1px solid var(--border-solid)" }}>
            <p style={{ fontSize: 11, color: "var(--text-sec)", marginBottom: 8 }}>Leads (barres relatives)</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 44 }}>
              {miniBar.map((v, i) => {
                const h = Math.max(4, Math.round((v / miniBarMax) * 100));
                const colors = ["var(--blue)", "#10b981", "#7c3aed", "var(--blue)", "#10b981", "#7c3aed", "#10b981"];
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${h}%`,
                      background: colors[i],
                      borderRadius: "3px 3px 0 0",
                      opacity: 0.8,
                      transition: "height .5s ease",
                    }}
                    title={String(v)}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {["V1", "C2", "S3", "HP", "Exp", "IA", "Imp"].map((d, i) => (
                <span key={i} style={{ fontSize: 9, color: "var(--text-muted)", flex: 1, textAlign: "center" }}>{d}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
