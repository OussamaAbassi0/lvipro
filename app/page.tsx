"use client";

import { useCallback, useState } from "react";
import Sidebar, { type ActiveView } from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ToastProvider from "@/components/ToastProvider";
import { AppDataProvider } from "@/providers/AppDataProvider";
import OverviewView from "@/components/views/OverviewView";
import VeilleLinkedinView from "@/components/views/VeilleLinkedinView";
import CampagnesLemlistView from "@/components/views/CampagnesLemlistView";
import OpportunitesSalonsView from "@/components/views/OpportunitesSalonsView";
import { triggerAuto1, triggerAuto2, triggerAuto3 } from "@/lib/n8nService";

const viewConfig: Record<ActiveView, { title: string; subtitle: string }> = {
  overview: {
    title: "Overview — KPIs & Métriques",
    subtitle: "Vue consolidée de toutes vos automations commerciales",
  },
  "veille-linkedin": {
    title: "Auto 1 — Veille Concurrentielle LinkedIn",
    subtitle: "Scraping LinkedIn · Détection murs LED · Alertes automatiques",
  },
  "campagnes-lemlist": {
    title: "Auto 2 — Campagnes Emailing Lemlist",
    subtitle: "Base contacts CSV · Icebreakers IA · Visuels assignés · Pipeline envoi",
  },
  "opportunites-salons": {
    title: "Auto 3 — Opportunités Salons & Événements",
    subtitle: "Scraping salons professionnels · Qualification leads · Arguments IA",
  },
};

export default function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const config = viewConfig[activeView];

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await Promise.allSettled([triggerAuto1(), triggerAuto2(), triggerAuto3()]);
    } finally {
      setSyncing(false);
    }
  }, []);

  return (
    <ToastProvider>
      <AppDataProvider>
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
          <Sidebar active={activeView} onChange={setActiveView} />

          <div
            className="main-scroll"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              marginLeft: "var(--sw)",
              overflow: "hidden",
            }}
          >
            <TopBar
              title={config.title}
              subtitle={config.subtitle}
              onSearch={setSearchQuery}
              onSync={handleSync}
              syncing={syncing}
            />

            <main
              style={{
                flex: 1,
                padding: "24px 28px",
                overflowY: "auto",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "var(--text-sec)",
                  marginBottom: 22,
                }}
              >
                <span>LED Visual Innovation</span>
                <span style={{ opacity: 0.5 }}>›</span>
                <span style={{ color: "var(--navy)", fontWeight: 600 }}>
                  {config.title.split("—")[0].trim()}
                </span>
              </div>

              {activeView === "overview" && <OverviewView onNavigate={setActiveView} />}
              {activeView === "veille-linkedin" && (
                <VeilleLinkedinView searchQuery={searchQuery} />
              )}
              {activeView === "campagnes-lemlist" && (
                <CampagnesLemlistView searchQuery={searchQuery} />
              )}
              {activeView === "opportunites-salons" && (
                <OpportunitesSalonsView searchQuery={searchQuery} />
              )}
            </main>

            <footer
              style={{
                padding: "13px 28px",
                fontSize: 10.5,
                color: "var(--text-muted)",
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>LED Visual Innovation — Control Center V2</span>
              <span>Flux en temps réel — actualisation auto toutes les 30s</span>
            </footer>
          </div>
        </div>
      </AppDataProvider>
    </ToastProvider>
  );
}
