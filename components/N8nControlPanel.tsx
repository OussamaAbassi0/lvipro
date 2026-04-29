"use client";

import { Play, Linkedin, Mail, Calendar, Wifi, WifiOff, ExternalLink, ArrowRight } from "lucide-react";
import type { ActiveView } from "@/components/Sidebar";

const ROWS: {
  id: ActiveView; label: string; sub: string; badge: string;
  icon: React.ReactNode; accent: string; bg: string;
}[] = [
  {
    id: "veille-linkedin",
    label: "Auto 1 — Veille LinkedIn",
    sub: "Scrape les posts des 5 concurrents via Proxycurl → GPT-4o → Sheets",
    badge: "Via dashboard Auto 1",
    icon: <Linkedin size={14} />, accent: "var(--blue)", bg: "var(--blue-light)",
  },
  {
    id: "campagnes-lemlist",
    label: "Auto 2 — Campagne Lemlist",
    sub: "Import CSV · Icebreakers IA · Validation humaine · Export Lemlist",
    badge: "Piloté par import CSV",
    icon: <Mail size={14} />, accent: "#10b981", bg: "#f0fdf4",
  },
  {
    id: "opportunites-salons",
    label: "Auto 3 — Salons Professionnels",
    sub: "Formulaire URL · Apify Scraping · GPT-4o → score LED → Sheets",
    badge: "Via formulaire",
    icon: <Calendar size={14} />, accent: "#7c3aed", bg: "#f5f3ff",
  },
];

export default function N8nControlPanel({ onNavigate }: { onNavigate?: (view: ActiveView) => void }) {
  const n8nConfigured = process.env.NEXT_PUBLIC_N8N_BASE_URL &&
    !process.env.NEXT_PUBLIC_N8N_BASE_URL.includes("REMPLACER");

  return (
    <div className="glass-card" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "18px 22px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32, height: 32, borderRadius: 9,
            background: "var(--blue-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--blue)", flexShrink: 0,
          }}
        >
          <Play size={14} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", fontFamily: "'Space Grotesk', sans-serif" }}>
            Contrôle n8n
          </h2>
          <p style={{ fontSize: 11, color: "var(--text-sec)", marginTop: 1 }}>
            Déclenchez les automations depuis le dashboard
          </p>
        </div>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em",
            padding: "3px 10px", borderRadius: 20,
            color: n8nConfigured ? "#10b981" : "#f59e0b",
            background: n8nConfigured ? "rgba(16,185,129,.18)" : "rgba(245,158,11,.18)",
          }}
        >
          {n8nConfigured ? <Wifi size={10} /> : <WifiOff size={10} />}
          {n8nConfigured ? "Connecté" : "Non configuré"}
        </span>
      </div>

      {/* Warning */}
      {!n8nConfigured && (
        <div
          style={{
            margin: "14px 22px 0",
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(245,158,11,.08)",
            border: "1px solid rgba(245,158,11,.2)",
          }}
        >
          <p style={{ fontSize: 11, color: "#d97706", lineHeight: 1.6 }}>
            <strong>Configuration requise :</strong> Renseignez{" "}
            <code style={{ fontFamily: "monospace", background: "rgba(245,158,11,.12)", padding: "1px 4px", borderRadius: 4 }}>
              NEXT_PUBLIC_N8N_BASE_URL
            </code>{" "}
            dans <code style={{ fontFamily: "monospace", background: "rgba(245,158,11,.12)", padding: "1px 4px", borderRadius: 4 }}>.env.local</code>{" "}
            puis redémarrez.
          </p>
        </div>
      )}

      {/* Rows */}
      <div style={{ padding: "14px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        {ROWS.map((row) => (
          <div
            key={row.id}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "13px 16px", borderRadius: 10,
              border: "1px solid var(--border-solid)",
              background: "#fafbff",
              transition: "background .15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4ff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fafbff")}
          >
            <div
              style={{
                width: 28, height: 28, borderRadius: 7,
                background: row.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: row.accent, flexShrink: 0,
              }}
            >
              {row.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{row.label}</p>
              <p style={{ fontSize: 11, color: "var(--text-sec)", marginTop: 2 }}>{row.sub}</p>
            </div>
            <span
              style={{
                fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
                background: row.bg, color: row.accent, whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {row.badge}
            </span>
            <button
              onClick={() => onNavigate?.(row.id)}
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                padding: "7px 14px", borderRadius: 9,
                background: "var(--blue-light)", color: "var(--blue)",
                border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                fontFamily: "inherit", transition: "all .15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--blue)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--blue-light)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--blue)"; }}
            >
              <ArrowRight size={11} />
              Aller vers {row.label.split("—")[0].trim()}
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "10px 22px 14px",
          borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 11, color: "var(--text-muted)",
        }}
      >
        <span>Les workflows s'exécutent aussi automatiquement selon leur planification.</span>
        <a
          href="https://n8n.io"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 4,
            color: "var(--text-muted)", textDecoration: "none",
            transition: "color .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--blue)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <ExternalLink size={10} /> n8n
        </a>
      </div>
    </div>
  );
}
