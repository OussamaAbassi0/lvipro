import { CampagneLead } from "./dataTypes";

/**
 * Free / generic email providers — the domain of these addresses is NEVER
 * a company name. Anything not in this set is treated as a pro domain
 * and used to derive a company name.
 */
const PERSONAL_EMAIL_DOMAINS = new Set<string>([
  // International
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.fr", "yahoo.co.uk", "yahoo.es", "yahoo.it", "yahoo.de",
  "ymail.com", "rocketmail.com",
  "hotmail.com", "hotmail.fr", "hotmail.co.uk", "hotmail.es", "hotmail.it", "hotmail.de",
  "live.com", "live.fr", "msn.com",
  "outlook.com", "outlook.fr",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "aol.fr",
  "protonmail.com", "proton.me", "pm.me",
  "gmx.com", "gmx.fr", "gmx.de",
  "mail.com", "zoho.com", "yandex.com", "yandex.ru",
  // FR ISPs
  "free.fr", "orange.fr", "sfr.fr", "laposte.net", "wanadoo.fr",
  "bbox.fr", "neuf.fr", "numericable.fr", "club-internet.fr",
  "voila.fr", "noos.fr", "cegetel.net", "alice.fr", "dartybox.com",
  "9online.fr", "tiscali.fr", "aliceadsl.fr",
  // BE / CH ISPs
  "skynet.be", "telenet.be", "scarlet.be", "belgacom.be",
  "bluewin.ch", "sunrise.ch", "swissonline.ch",
]);

/** Small word-list we never want to re-capitalise as a company name. */
const DOMAIN_NOISE = new Set<string>(["www", "mail", "email", "contact", "hello", "info", "support"]);

/**
 * Strip diacritics and non-word chars, lowercase — used for robust header
 * matching regardless of accents / punctuation.
 */
export function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Title-case a slug: "garage-dupont" → "Garage Dupont". */
function humanise(slug: string): string {
  return slug
    .replace(/[-_.]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !DOMAIN_NOISE.has(w.toLowerCase()))
    .map((w) =>
      w.length <= 3
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
}

/**
 * Derive a company name from an email's domain. Returns null for personal
 * providers, empty input, or visibly generic addresses (contact@, info@).
 */
export function guessCompanyFromEmail(
  email: string | null | undefined
): { entite: string; confidence: "high" } | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at < 0) return null;
  const domain = trimmed.slice(at + 1);
  if (!domain || !domain.includes(".")) return null;
  if (PERSONAL_EMAIL_DOMAINS.has(domain)) return null;

  // Strip known TLDs — keep the middle portion as the company name.
  // Example: "sub.garage-dupont.fr" → "garage-dupont"
  const parts = domain.split(".");
  if (parts.length < 2) return null;
  // Drop TLD + any 2-letter secondary (e.g. .co.uk)
  let slug = parts.length >= 3 && parts[parts.length - 2].length <= 3
    ? parts.slice(0, -2).join(".")
    : parts.slice(0, -1).join(".");
  // If slug is a subdomain chain, keep the longest segment
  if (slug.includes(".")) {
    const segs = slug.split(".").filter((s) => !DOMAIN_NOISE.has(s));
    slug = segs.sort((a, b) => b.length - a.length)[0] || slug;
  }

  const name = humanise(slug);
  if (!name || name.length < 2) return null;
  return { entite: name, confidence: "high" };
}

/**
 * Heuristic: does this lead need company enrichment? Fires when the entite
 * is empty OR visibly wrong (a slug, a form label, a single-word lowercase
 * blob with no spaces — which is how the FORMULAIRE-leak bug manifests).
 */
export function isEntiteSuspicious(lead: CampagneLead): boolean {
  const e = (lead.entite || "").trim();
  if (!e) return true;
  if (e.length < 4) return true;
  if (lead.entiteConfidence === "low") return true;
  // Looks like a slug / form id: no spaces, no uppercase, no punctuation
  if (/^[a-z0-9]{4,}$/.test(e)) return true;
  // Common LVI form labels (catch legacy imports without enumerating them all)
  const normalized = normalizeKey(e);
  const formPatterns = [
    "ecrangeant", "murled", "ecranled", "ledoutdoor", "ledindoor",
    "formulaire", "form", "demande", "contact",
  ];
  if (formPatterns.some((p) => normalized.startsWith(p))) return true;
  return false;
}

/**
 * Classify a raw "NOM" cell from a messy client CSV into one of three
 * buckets: person, company, or domain. LVI's Auto-2 source file has a
 * single NOM column that mixes "Baillet mathieu" (person), "KS Motorcycles"
 * (company), and "dgchrono.com" (domain) — routing them into the right
 * field prevents the IA from mistaking a company name for a first name.
 */
export type NomKind = "person" | "company" | "domain" | "unknown";

const COMPANY_KEYWORDS =
  /\b(SARL|SASU|SAS|SA|EURL|SCI|SCOP|SNC|SCP|SCM|ASSOC|ASBL|LTD|LLC|INC|GMBH|CORP|GROUP|GROUPE|HOLDING|INVEST(?:MENT)?S?|PRODUCTION[S]?|AVIATION|MOTOR(?:S|CYCLES?)?|SPORT(?:S)?|STUDIO|AGENCY|AGENCE|IMMOBILIER|IMMO|MAIRIE|GARAGE|ENTREPRISE|SOCI[EÉ]T[EÉ]|FOUNDATION|FONDATION|FC|OLYMPIQUE|COMIT[EÉ]|CLUB|TEAM|ANIM|SCHOOL|ECOLE|TRANSPORT|BOULANGERIE|PHARMACIE|RESTAURANT|HOTEL|CENTRE|CABINET|CONSEIL|TWIRLING|FFA)\b/i;

const DOMAIN_RE = /^(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/.*)?$/i;

/** Title-case a raw phrase while preserving ALL-CAPS short tokens (SARL, FC, KS). */
function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => {
      if (/^[A-Z]{1,4}$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function classifyNom(raw: string): {
  kind: NomKind;
  nom: string;
  entite: string;
} {
  const s = (raw || "").trim();
  if (!s) return { kind: "unknown", nom: "", entite: "" };

  // 1) Looks like a domain / URL → derive a company name from the slug
  if (DOMAIN_RE.test(s) && !s.includes(" ")) {
    const host = s.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const parts = host.split(".").filter((p) => !DOMAIN_NOISE.has(p));
    const slug = parts.length >= 2 ? parts[0] : host;
    const entite = humanise(slug);
    return { kind: "domain", nom: "", entite: entite || s };
  }

  // 2) Contains an explicit company keyword → company
  if (COMPANY_KEYWORDS.test(s)) {
    return { kind: "company", nom: "", entite: titleCase(s) };
  }

  const words = s.split(/\s+/).filter((w) => w.length > 0);

  // 3) Single token
  if (words.length === 1) {
    const w = words[0];
    if (w.length <= 2) return { kind: "unknown", nom: "", entite: "" };
    if (/^[A-Z]{2,5}$/.test(w)) return { kind: "company", nom: "", entite: w };
    return { kind: "person", nom: titleCase(s), entite: "" };
  }

  // 4) Two ALL-CAPS tokens → person (surname + prénom)
  if (words.length === 2 && words.every((w) => /^[A-Z][A-Z'.-]+$/.test(w))) {
    return { kind: "person", nom: titleCase(s), entite: "" };
  }

  // 5) Two mixed-case tokens → person
  if (words.length === 2) {
    return { kind: "person", nom: titleCase(s), entite: "" };
  }

  // 6) Three or more tokens → default to company
  return { kind: "company", nom: "", entite: titleCase(s) };
}

export function suspicionReason(lead: CampagneLead): string | null {
  if (!lead.entite || !lead.entite.trim()) return "Entreprise manquante";
  if (lead.entiteConfidence === "low") return "Confiance IA faible";
  if (/^[a-z0-9]{4,}$/.test(lead.entite.trim())) return "Ressemble à un identifiant de formulaire";
  return null;
}
