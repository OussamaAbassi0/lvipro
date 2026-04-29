"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, HelpCircle, ExternalLink, X, Trash2, Wifi, WifiOff, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { useAppData } from "@/providers/AppDataProvider";

export type ActiveView =
  | "overview"
  | "veille-linkedin"
  | "campagnes-lemlist"
  | "opportunites-salons";

/* ─── Neural Mesh Canvas ─────────────────────────────────────────────────── */

function useNetworkMesh(canvasRef: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 20 particles (down from 32): O(n²) pairs drop from 496 → 190 per frame.
    // dist 55 (down from 70): fewer connections qualify, fewer draw calls.
    const opts = { n: 20, color: "100,150,255", dist: 55, speed: 0.25 };
    let raf: number;

    const resize = () => {
      // Cap DPR at 1 — this canvas is purely decorative; retina quality wastes
      // 4× GPU pixels on a 224px sidebar with 35% opacity.
      const d = Math.min(window.devicePixelRatio || 1, 1);
      canvas.width  = canvas.offsetWidth  * d;
      canvas.height = canvas.offsetHeight * d;
      ctx.scale(d, d);
    };

    type Pt = { x: number; y: number; vx: number; vy: number; r: number; pulse: number };
    let pts: Pt[] = [];

    const spawn = () => {
      pts = Array.from({ length: opts.n }, () => ({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * opts.speed,
        vy: (Math.random() - 0.5) * opts.speed,
        r: Math.random() * 1.8 + 0.4,
        pulse: Math.random() * Math.PI * 2,
      }));
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      for (const p of pts) {
        p.pulse += 0.02;
        p.vx *= 0.984; p.vy *= 0.984;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
        if (p.x > W) { p.x = W; p.vx = -Math.abs(p.vx); }
        if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
        if (p.y > H) { p.y = H; p.vy = -Math.abs(p.vy); }
      }

      // Batch all connection lines into 4 alpha buckets with a single
      // beginPath/stroke per bucket instead of one draw call per edge.
      // Cuts GPU state changes from ~190 → 4 per frame.
      const BUCKETS = 4;
      const paths: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < opts.dist) {
            const bucket = Math.min(BUCKETS - 1, Math.floor((1 - d / opts.dist) * BUCKETS));
            paths[bucket].moveTo(pts[i].x, pts[i].y);
            paths[bucket].lineTo(pts[j].x, pts[j].y);
          }
        }
      }
      ctx.lineWidth = 0.9;
      for (let b = 0; b < BUCKETS; b++) {
        ctx.strokeStyle = `rgba(${opts.color},${(0.07 + b * 0.07).toFixed(2)})`;
        ctx.stroke(paths[b]);
      }

      // Draw nodes
      for (const p of pts) {
        const pulse = 0.4 + 0.2 * Math.sin(p.pulse);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${opts.color},${pulse})`;
        ctx.fill();
      }
    };

    const onResize = () => { resize(); spawn(); };

    resize();
    spawn();
    tick();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [canvasRef]);
}

/* ─── SVG Icons ──────────────────────────────────────────────────────────── */

const IconOverview = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="1" y="1" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="9.5" y="1" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="1" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);
const IconLinkedIn = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <polyline points="1,13 5,7.5 8.5,10.5 12.5,4.5 16,6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="12.5,4.5 16,4.5 16,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconCampagnes = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="1" y="3" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    <polyline points="1,5 8.5,10.5 16,5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconSalons = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="2" y="7" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5 7V5.5a3.5 3.5 0 017 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="8.5" cy="11.5" r="1.3" fill="currentColor"/>
  </svg>
);

/* ─── Nav config ─────────────────────────────────────────────────────────── */

const NAV: { id: ActiveView; label: string; sub: string; icon: React.ReactNode; live: boolean }[] = [
  { id: "overview",            label: "Overview",            sub: "KPIs & Métriques",    icon: <IconOverview />,   live: false },
  { id: "veille-linkedin",     label: "LinkedIn Veille",     sub: "Auto 1",              icon: <IconLinkedIn />,   live: true  },
  { id: "campagnes-lemlist",   label: "Campagnes IA",        sub: "Auto 2",              icon: <IconCampagnes />,  live: true  },
  { id: "opportunites-salons", label: "Opportunités Salons", sub: "Auto 3",              icon: <IconSalons />,     live: true  },
];

/* ─── Sidebar component ──────────────────────────────────────────────────── */

interface SidebarProps {
  active: ActiveView;
  onChange: (view: ActiveView) => void;
}

export default function Sidebar({ active, onChange }: SidebarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useNetworkMesh(canvasRef);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { data, lastFetch, refresh } = useAppData();

  const n8nUrl = process.env.NEXT_PUBLIC_N8N_BASE_URL;
  const n8nConfigured = n8nUrl && !n8nUrl.includes("REMPLACER");

  const formatSync = (iso: string | null) => {
    if (!iso) return "Jamais";
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const handleReset = async () => {
    if (!confirm("Réinitialiser toutes les données ? Cette action est irréversible.")) return;
    setResetting(true);
    try {
      await fetch("/api/data", { method: "DELETE" });
      await refresh();
    } finally {
      setResetting(false);
      setSettingsOpen(false);
    }
  };

  return (
    <>
      {/* ─── Sidebar shell ──────────────────────────────────────────────────── */}
      <aside
        style={{
          width: "var(--sw)",
          minWidth: "var(--sw)",
          height: "100vh",
          background: "var(--navy)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 30,
          overflow: "hidden",
        }}
      >
        {/* Neural mesh canvas */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.35,
            pointerEvents: "none",
          }}
        />

        {/* Logo */}
        <div
          style={{
            padding: "22px 18px 18px",
            borderBottom: "1px solid rgba(255,255,255,.06)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg,#ff6b35,#f7c948,#4ecdc4,#45b7d1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 12px rgba(0,0,0,.3)",
              }}
            >
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: "-0.02em" }}>LVI</span>
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: ".01em", fontFamily: "'Space Grotesk', sans-serif" }}>
                LED Visual
              </div>
              <div style={{ color: "rgba(255,255,255,.38)", fontSize: 10 }}>Control Center V2</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14 }}>
            <span
              className="lvi-live-dot"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 7px #10b981",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "rgba(255,255,255,.42)", fontSize: 10.5 }}>
              3 automations actives
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px", overflowY: "auto", position: "relative", zIndex: 1 }}>
          <div
            style={{
              color: "rgba(255,255,255,.22)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: ".12em",
              padding: "6px 10px 4px",
              textTransform: "uppercase",
            }}
          >
            Navigation
          </div>

          {NAV.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "9.5px 11px",
                  borderRadius: 9,
                  marginBottom: 1,
                  background: isActive ? "rgba(43,92,230,.2)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  borderLeft: isActive ? "2.5px solid #6b9fff" : "2.5px solid transparent",
                  transition: "all .18s",
                  color: isActive ? "#fff" : "rgba(255,255,255,.45)",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.07)";
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.8)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.45)";
                  }
                }}
              >
                <span style={{ flexShrink: 0, color: isActive ? "#7aabff" : "inherit", display: "flex" }}>
                  {item.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: isActive ? 600 : 400,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 9.5,
                      color: isActive ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.22)",
                      marginTop: 1,
                    }}
                  >
                    {item.sub}
                  </div>
                </div>
                {item.live && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      color: "#10b981",
                      padding: "3px 8px",
                      borderRadius: 20,
                      background: "rgba(16,185,129,.18)",
                    }}
                  >
                    <span
                      className="lvi-live-dot"
                      style={{ width: 5.5, height: 5.5, borderRadius: "50%", background: "#10b981", flexShrink: 0 }}
                    />
                    LIVE
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: "10px 10px 14px",
            borderTop: "1px solid rgba(255,255,255,.06)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "8px 11px",
              borderRadius: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,.32)",
              fontSize: 12.5,
              transition: "all .18s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.07)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.7)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.32)"; }}
          >
            <Settings size={15} /> Paramètres
          </button>
          <a
            href="mailto:support@lvi.fr"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "8px 11px",
              borderRadius: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,.32)",
              fontSize: 12.5,
              textDecoration: "none",
              transition: "all .18s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,.07)"; (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,.7)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,.32)"; }}
          >
            <HelpCircle size={15} /> Support <ExternalLink size={10} style={{ marginLeft: "auto" }} />
          </a>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "9px 11px",
              marginTop: 6,
              borderRadius: 10,
              background: "rgba(255,255,255,.06)",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "linear-gradient(135deg,var(--blue),#7aabff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              M
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#fff", fontSize: 12.5, fontWeight: 600 }}>Maxim</div>
              <div style={{ color: "rgba(255,255,255,.32)", fontSize: 9.5 }}>Administrateur</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Settings modal ──────────────────────────────────────────────────── */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: "var(--surf)",
              border: "1px solid var(--border-solid)",
              boxShadow: "0 20px 60px rgba(12,20,40,.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border-solid)" }}>
              <div className="flex items-center gap-2.5">
                <Settings size={15} style={{ color: "var(--text-sec)" }} />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  Paramètres
                </h2>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-sec)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f5fb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* n8n */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                  Connexion n8n
                </p>
                <div className="flex items-center gap-2 mb-2">
                  {n8nConfigured
                    ? <Wifi size={12} style={{ color: "#10b981" }} />
                    : <WifiOff size={12} style={{ color: "#f59e0b" }} />}
                  <span style={{ fontSize: 12, fontWeight: 500, color: n8nConfigured ? "#10b981" : "#f59e0b" }}>
                    {n8nConfigured ? "Connecté" : "Non configuré"}
                  </span>
                </div>
                <code
                  style={{
                    display: "block",
                    fontSize: 11,
                    background: "#f3f5fb",
                    color: "var(--text-sec)",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-solid)",
                    wordBreak: "break-all",
                  }}
                >
                  {n8nUrl || "NEXT_PUBLIC_N8N_BASE_URL non définie dans .env.local"}
                </code>
              </div>

              {/* Last sync */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                  Dernière synchronisation
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: "Auto 1 — Veille LinkedIn", key: "auto1" as const, color: "#2B5CE6" },
                    { label: "Auto 2 — Campagnes",       key: "auto2" as const, color: "#10b981" },
                    { label: "Auto 3 — Salons",          key: "auto3" as const, color: "#7c3aed" },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: "#f3f5fb", border: "1px solid var(--border-solid)" }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 500, color: item.color }}>{item.label}</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {formatSync(data.lastSync[item.key])}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { n: data.veille.length, label: "Leads Veille" },
                  { n: data.campagnes.length, label: "Campagnes" },
                  { n: data.salons.length, label: "Salons" },
                ].map(({ n, label }) => (
                  <div key={label} className="rounded-lg p-3" style={{ background: "#f3f5fb", border: "1px solid var(--border-solid)" }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)", fontFamily: "'Space Grotesk', sans-serif" }}>{n}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Info */}
              <div
                className="p-3 rounded-lg"
                style={{ background: "var(--blue-light)", border: "1px solid rgba(43,92,230,.15)" }}
              >
                <p style={{ fontSize: 11, lineHeight: 1.6, color: "var(--blue)" }}>
                  <strong>Endpoint données n8n :</strong>{" "}
                  <code style={{ fontFamily: "monospace", background: "rgba(43,92,230,.12)", padding: "1px 5px", borderRadius: 4 }}>
                    POST /api/data
                  </code>{" "}
                  — Ajoutez un nœud HTTP Request à la fin de chaque workflow n8n pour pousser les résultats ici.
                </p>
              </div>

              {/* Reset */}
              <button
                onClick={handleReset}
                disabled={resetting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                style={{ border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.1)", color: "#ef4444", fontSize: 12, fontWeight: 600 }}
              >
                {resetting ? (
                  <><RefreshCw size={12} className="animate-spin" /> Réinitialisation…</>
                ) : (
                  <><Trash2 size={13} /> Réinitialiser toutes les données</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
