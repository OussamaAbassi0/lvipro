"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import clsx from "clsx";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastCtx {
  notify: (message?: string, type?: ToastType) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastCtx>({ notify: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// ─── Config ────────────────────────────────────────────────────────────────────

const DURATION = 3500;

const typeConfig: Record<ToastType, { icon: React.ReactNode; color: string; border: string; iconBg: string }> = {
  success: {
    icon: <CheckCircle2 size={13} />,
    color: "text-emerald-400",
    border: "border-emerald-500/20",
    iconBg: "bg-emerald-500/15",
  },
  error: {
    icon: <AlertCircle size={13} />,
    color: "text-red-400",
    border: "border-red-500/20",
    iconBg: "bg-red-500/15",
  },
  info: {
    icon: <Info size={13} />,
    color: "text-blue-400",
    border: "border-blue-500/20",
    iconBg: "bg-blue-500/15",
  },
};

export default function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const notify = useCallback((message = "Action effectuée", type: ToastType = "info") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, DURATION);
  }, []);

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}

      {/* Toast stack — bottom-right */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end pointer-events-none"
      >
        {toasts.map((t) => {
          const cfg = typeConfig[t.type];
          return (
            <div
              key={t.id}
              className={clsx(
                "pointer-events-auto relative flex items-start gap-3 px-4 py-3 rounded-xl",
                "bg-gray-50 border shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                "animate-fade-in max-w-sm w-full",
                cfg.border
              )}
            >
              <div className={clsx("mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0", cfg.iconBg, cfg.color)}>
                {cfg.icon}
              </div>

              <p className={clsx("flex-1 text-[12px] text-gray-200 leading-snug mt-0.5")}>
                {t.message}
              </p>

              <button
                onClick={() => dismiss(t.id)}
                className="flex-shrink-0 mt-0.5 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-gray-50 transition-colors"
              >
                <X size={12} />
              </button>

              <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl overflow-hidden">
                <div
                  className={clsx("h-full origin-left", t.type === "success" ? "bg-emerald-500" : t.type === "error" ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-cyan-500")}
                  style={{ animation: `shrink ${DURATION}ms linear forwards` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
