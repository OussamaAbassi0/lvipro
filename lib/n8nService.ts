/**
 * n8nService.ts
 * Couche d'abstraction pour communiquer avec les webhooks n8n.
 *
 * CONFIGURATION:
 * Créer un fichier .env.local à la racine du projet avec :
 *   NEXT_PUBLIC_N8N_BASE_URL=https://votre-instance.n8n.cloud/webhook
 *   NEXT_PUBLIC_N8N_WEBHOOK_AUTO1=auto1-veille-linkedin
 *   NEXT_PUBLIC_N8N_WEBHOOK_AUTO2=auto2-prospection-lemlist
 *   NEXT_PUBLIC_N8N_WEBHOOK_AUTO3=auto3-salons-professionnels
 */

const BASE_URL = (process.env.NEXT_PUBLIC_N8N_BASE_URL || "https://REMPLACER.n8n.cloud/webhook").replace(/\/$/, "");

export const N8N_WEBHOOKS = {
  auto1: `${BASE_URL}/${process.env.NEXT_PUBLIC_N8N_WEBHOOK_AUTO1 || "auto1-veille-linkedin"}`,
  auto2: `${BASE_URL}/${process.env.NEXT_PUBLIC_N8N_WEBHOOK_AUTO2 || "auto2-prospection-lemlist"}`,
  auto3: `${BASE_URL}/${process.env.NEXT_PUBLIC_N8N_WEBHOOK_AUTO3 || "auto3-salons-professionnels"}`,
} as const;

export type WorkflowId = keyof typeof N8N_WEBHOOKS;

export interface TriggerResult {
  success: boolean;
  message: string;
  executionId?: string;
  triggeredAt: string;
  /** Nom exact du nœud n8n ayant planté (extrait de la réponse 500) */
  failedNode?: string;
}

export interface Auto1Payload extends Record<string, unknown> {
  competitors?: Array<{ name: string; linkedin_url: string }>;
}

export interface Auto2Payload extends Record<string, unknown> {
  minScore?: number;
}

export interface Auto3Payload extends Record<string, unknown> {
  nom_salon?: string;
  date_salon?: string;
  lieu_salon?: string;
  url_source?: string;
  type_source?: "manuel" | "html" | "pdf";
  exposants_bruts?: string;
}

// ─── Low-level caller ──────────────────────────────────────────────────────────

async function callWebhook(
  url: string,
  payload: Record<string, unknown>
): Promise<TriggerResult> {
  const triggeredAt = new Date().toISOString();

  if (!url || url.includes("REMPLACER")) {
    return {
      success: false,
      message: "URL n8n non configurée — renseigner NEXT_PUBLIC_N8N_BASE_URL dans .env.local",
      triggeredAt,
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "lvi-dashboard", ...payload, triggeredAt }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as Record<string, string>;
      const failedNode: string | undefined = errBody.failed_node || undefined;
      const errorDetails: string = errBody.error_details || `HTTP ${res.status} ${res.statusText}`;
      return {
        success: false,
        message: failedNode ? `Échec à l'étape : ${failedNode} — ${errorDetails}` : errorDetails,
        failedNode,
        triggeredAt,
      };
    }

    // Lecture brute puis parse — on veut voir le corps exact en debug
    // quand n8n renvoie un body générique au lieu de notre Respond-node.
    const rawText = await res.text();
    let data: Record<string, string> = {};
    try { data = rawText ? (JSON.parse(rawText) as Record<string, string>) : {}; }
    catch { data = {}; }

    if (typeof console !== "undefined") {
      console.debug("[n8n] webhook response", { status: res.status, body: rawText });
    }

    // Faux-succès #1 : l'Error Trigger de n8n s'exécute dans une
    // exécution séparée — son "Respond to Webhook" ne répond jamais
    // au fetch d'origine. Le dashboard reçoit alors la réponse par
    // défaut de n8n ("Workflow was started", body vide, etc.), qui
    // est HTTP 200 mais ne contient PAS status:"success".
    //
    // Faux-succès #2 : un Respond node configuré pour renvoyer
    // status:"error" sur HTTP 200.
    //
    // Règle stricte : on n'accepte comme succès que les réponses qui
    // affirment explicitement status === "success".
    if (data.status === "error" || data.error_details) {
      return {
        success: false,
        message: data.error_details || data.message || "Erreur renvoyée par n8n",
        failedNode: data.failed_node,
        triggeredAt,
      };
    }

    // Signaux de succès acceptés : status:"success" OU success:true.
    // Les deux sont utilisés dans les workflows LVI (Auto 1/3 : status,
    // Auto 2 export : success boolean).
    const isExplicitSuccess =
      data.status === "success" ||
      (data as unknown as { success?: boolean }).success === true;

    if (!isExplicitSuccess) {
      return {
        success: false,
        message:
          data.message ||
          "Réponse ambiguë de n8n — le workflow a probablement échoué avant d'atteindre le noeud Respond-Succès. Vérifiez les logs n8n.",
        triggeredAt,
      };
    }

    return {
      success: true,
      message: data.message || "Workflow déclenché avec succès",
      executionId: data.executionId,
      triggeredAt,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Erreur réseau inconnue",
      triggeredAt,
    };
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Déclenche Auto 1 — Veille Concurrentielle LinkedIn */
export function triggerAuto1(payload: Auto1Payload = {}): Promise<TriggerResult> {
  return callWebhook(N8N_WEBHOOKS.auto1, payload);
}

/** Déclenche Auto 2 — Prospection Lemlist */
export function triggerAuto2(payload: Auto2Payload = {}): Promise<TriggerResult> {
  return callWebhook(N8N_WEBHOOKS.auto2, payload);
}

/** Déclenche Auto 3 — Opportunités Salons */
export function triggerAuto3(payload: Auto3Payload = {}): Promise<TriggerResult> {
  return callWebhook(N8N_WEBHOOKS.auto3, payload);
}

/** Map des fonctions de trigger par ID */
export const TRIGGERS: Record<WorkflowId, (p?: Record<string, unknown>) => Promise<TriggerResult>> = {
  auto1: (p) => triggerAuto1(p as Auto1Payload),
  auto2: (p) => triggerAuto2(p as Auto2Payload),
  auto3: (p) => triggerAuto3(p as Auto3Payload),
};
