"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppDataStore, EMPTY_STORE, Salon, VeilleLead } from "@/lib/dataTypes";

interface CampagnesStats {
  total: number;
  imported: number;
  draft: number;
  exported: number;
  suspicious: number;
}

const EMPTY_STATS: CampagnesStats = {
  total: 0,
  imported: 0,
  draft: 0,
  exported: 0,
  suspicious: 0,
};

interface AppDataCtx {
  data: AppDataStore;
  campagnesStats: CampagnesStats;
  loading: boolean;
  refresh: () => Promise<void>;
  lastFetch: Date | null;
}

const AppDataContext = createContext<AppDataCtx>({
  data: EMPTY_STORE,
  campagnesStats: EMPTY_STATS,
  loading: true,
  refresh: async () => {},
  lastFetch: null,
});

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppDataStore>(EMPTY_STORE);
  const [campagnesStats, setCampagnesStats] = useState<CampagnesStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [mainRes, salonsRes, veilleRes, statsRes] = await Promise.allSettled([
        fetch("/api/data"),
        fetch("/api/data/salons"),
        fetch("/api/data/veille?limit=300"),
        fetch("/api/data/campagnes/stats"),
      ]);

      let mainJson: Partial<AppDataStore> = {};
      let salonsJson: { salons?: Salon[] } = {};
      let veilleJson: { items?: VeilleLead[] } = {};
      let statsJson: Partial<CampagnesStats> = {};

      if (mainRes.status === "fulfilled" && mainRes.value.ok) {
        mainJson = (await mainRes.value.json()) as Partial<AppDataStore>;
      }
      if (salonsRes.status === "fulfilled" && salonsRes.value.ok) {
        salonsJson = (await salonsRes.value.json()) as { salons?: Salon[] };
      }
      if (veilleRes.status === "fulfilled" && veilleRes.value.ok) {
        veilleJson = (await veilleRes.value.json()) as { items?: VeilleLead[] };
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        statsJson = (await statsRes.value.json()) as Partial<CampagnesStats>;
      }

      setData((prev) => ({
        veille:    Array.isArray(veilleJson.items)   ? veilleJson.items   : prev.veille,
        salons:    Array.isArray(salonsJson.salons)  ? salonsJson.salons  : prev.salons,
        lastSync:  mainJson.lastSync ?? prev.lastSync,
        campagnes: [],
      }));
      setCampagnesStats((prev) => ({
        total:      statsJson.total      ?? prev.total,
        imported:   statsJson.imported   ?? prev.imported,
        draft:      statsJson.draft      ?? prev.draft,
        exported:   statsJson.exported   ?? prev.exported,
        suspicious: statsJson.suspicious ?? prev.suspicious,
      }));
      setLastFetch(new Date());
    } catch (err) {
      console.error("[AppDataProvider] network error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <AppDataContext.Provider value={{ data, campagnesStats, loading, refresh, lastFetch }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  return useContext(AppDataContext);
}
