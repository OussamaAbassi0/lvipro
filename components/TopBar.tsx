"use client";

import { Bell, RefreshCw, Search, X, CheckCircle2, Trash2, AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import { useAppData } from "@/providers/AppDataProvider";
import { useToast } from "@/components/ToastProvider";

interface TopBarProps {
  title: string;
  subtitle: string;
  onSearch: (q: string) => void;
  onSync: () => Promise<void>;
  syncing: boolean;
}

export default function TopBar({ title, subtitle, onSearch, onSync, syncing }: TopBarProps) {
  const { data, lastFetch, refresh } = useAppData();
  const { notify } = useToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/data", { method: "DELETE" });
      if (res.ok) {
        await refresh();
        setResetOpen(false);
        notify("Dashboard réinitialisé — toutes les données ont été supprimées.", "success");
      } else {
        notify("Erreur lors de la réinitialisation. Réessayez.", "error");
      }
    } catch {
      notify("Erreur réseau. Réessayez.", "error");
    } finally {
      setResetting(false);
    }
  };

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchVal("");
    onSearch("");
  };

  const handleSearchChange = (v: string) => {
    setSearchVal(v);
    onSearch(v);
  };

  const syncMins = lastFetch
    ? Math.round((Date.now() - lastFetch.getTime()) / 60000)
    : null;
  const syncLabel = syncMins === null ? "jamais" : syncMins === 0 ? "il y a 0 min" : `il y a ${syncMins} min`;

  const recentAlerts = (data?.veille ?? []).filter((v) => v.scoreNum >= 70).slice(0, 6);

  const iconBtn = {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-sec)",
    display: "flex",
    alignItems: "center",
    padding: "6px",
    borderRadius: 8,
    transition: "all .15s",
  } as const;

  return (
    <header
      style={{
        height: 58,
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 20,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            color: "var(--navy)",
            fontFamily: "'Space Grotesk', sans-serif",
            margin: 0,
            letterSpacing: "-.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </h1>
        <p style={{ fontSize: 10.5, color: "var(--text-sec)", margin: 0, marginTop: 1 }}>{subtitle}</p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Search */}
        {searchOpen ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#f3f5fb",
              borderRadius: 8,
              padding: "7px 11px",
              border: "1px solid rgba(43,92,230,.2)",
              width: 200,
            }}
          >
            <Search size={13} style={{ color: "var(--text-sec)", flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={searchVal}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && closeSearch()}
              placeholder="Rechercher…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 12,
                color: "var(--navy)",
                fontFamily: "inherit",
              }}
            />
            <button onClick={closeSearch} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={openSearch}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#f3f5fb",
              borderRadius: 8,
              padding: "7px 11px",
              border: "1px solid var(--border-solid)",
              cursor: "pointer",
              width: 200,
            }}
          >
            <Search size={13} style={{ color: "var(--text-sec)" }} />
            <span style={{ flex: 1, textAlign: "left", fontSize: 12, color: "var(--text-sec)" }}>Rechercher…</span>
            <span
              style={{
                fontSize: 9.5,
                color: "var(--text-muted)",
                background: "var(--border-solid)",
                padding: "2px 5px",
                borderRadius: 4,
                fontWeight: 600,
                fontFamily: "monospace",
              }}
            >
              ⌘K
            </span>
          </button>
        )}

        {/* Sync */}
        <button
          onClick={onSync}
          disabled={syncing}
          style={{
            ...iconBtn,
            gap: 5,
            fontSize: 11.5,
            color: syncing ? "var(--blue)" : "var(--text-sec)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f5fb")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <RefreshCw size={11} className={syncing ? "animate-spin" : ""} style={{ color: "var(--blue)" }} />
          <span>{syncing ? "Sync en cours…" : `Sync: ${syncLabel}`}</span>
        </button>

        {/* Reset */}
        <button
          onClick={() => setResetOpen(true)}
          style={{ ...iconBtn, gap: 5, fontSize: 11.5 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f3f5fb"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-sec)"; }}
        >
          <Trash2 size={12} />
          <span>Reset</span>
        </button>

        {/* Notifications */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            style={{ ...iconBtn, position: "relative" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f5fb")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Bell size={16} />
            {recentAlerts.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  width: 5.5,
                  height: 5.5,
                  borderRadius: "50%",
                  background: "#ef4444",
                }}
              />
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  width: 320,
                  borderRadius: 16,
                  border: "1px solid var(--border-solid)",
                  background: "var(--surf)",
                  boxShadow: "0 20px 60px rgba(12,20,40,.12)",
                  zIndex: 20,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--border-solid)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", fontFamily: "'Space Grotesk', sans-serif" }}>
                    Alertes récentes
                  </p>
                  <button
                    onClick={() => setNotifOpen(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-sec)" }}
                  >
                    <X size={13} />
                  </button>
                </div>

                {recentAlerts.length === 0 ? (
                  <p style={{ padding: "24px 16px", fontSize: 12, color: "var(--text-sec)", textAlign: "center" }}>
                    Aucune alerte — lancez Auto 1 pour détecter des leads
                  </p>
                ) : (
                  <div style={{ maxHeight: 288, overflowY: "auto" }}>
                    {recentAlerts.map((v) => (
                      <div
                        key={v.id}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          cursor: "default",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8faff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <CheckCircle2 size={12} style={{ color: "#10b981", marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 11, color: "var(--navy)", fontWeight: 500 }} className="truncate">
                            {v.concurrent}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--text-sec)" }}>
                            {v.clientFinal || "Client non identifié"} · {v.typeProjet || v.technologie || "LED"}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{v.dateDetection}</p>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 99,
                            background: "var(--blue-light)",
                            color: "var(--blue)",
                            flexShrink: 0,
                          }}
                        >
                          {v.scoreIA}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Reset confirmation ──────────────────────────────────────────────── */}
      {resetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.3)", backdropFilter: "blur(4px)" }}
          onClick={() => !resetting && setResetOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: "var(--surf)",
              border: "1px solid rgba(239,68,68,.2)",
              boxShadow: "0 20px 60px rgba(12,20,40,.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "24px 24px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "rgba(239,68,68,.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertTriangle size={18} style={{ color: "#ef4444" }} />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  Réinitialiser le Dashboard
                </h2>
                <p style={{ fontSize: 12, color: "var(--text-sec)", marginTop: 6, lineHeight: 1.6 }}>
                  Attention ! Cette action va supprimer définitivement toutes les données affichées. Es-tu sûr de vouloir continuer ?
                </p>
              </div>
            </div>

            <div
              style={{
                margin: "0 24px 20px",
                padding: "12px 16px",
                borderRadius: 10,
                background: "rgba(239,68,68,.08)",
                border: "1px solid rgba(239,68,68,.15)",
              }}
            >
              <p style={{ fontSize: 11, color: "#ef4444", lineHeight: 1.6 }}>
                Seront supprimés : tous les leads Veille LinkedIn, toutes les Campagnes Lemlist et tous les Salons scrapés.
                Cette action est <strong>irréversible</strong>.
              </p>
            </div>

            <div style={{ padding: "0 24px 24px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setResetOpen(false)}
                disabled={resetting}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--border-solid)",
                  background: "transparent",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-sec)",
                  cursor: "pointer",
                  opacity: resetting ? 0.4 : 1,
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: resetting ? 0.6 : 1,
                }}
              >
                {resetting ? (
                  <><RefreshCw size={12} className="animate-spin" /> Réinitialisation…</>
                ) : (
                  <><Trash2 size={12} /> Oui, tout supprimer</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
