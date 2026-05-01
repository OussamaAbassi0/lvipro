export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';

interface Exposant {
  nom: string;
  secteur: string;
  site: string;
  stand: string;
}

// Architectural decision (2026-05-01):
// Playwright + @sparticuz/chromium on Vercel has been confirmed unreliable
// (libnss3.so missing despite vercel.json includeFiles + outputFileTracingIncludes
// + sparticuz v131). Three deployment iterations failed identically.
//
// Vercel's runtime evolved beyond what sparticuz bundles support. Rather than
// keep iterating against an opaque runtime, we pivot:
//   - Vercel:   Cheerio-only (HTTP + HTML parse). Fast, robust, no browser deps.
//   - Local:    Playwright via system Chrome (channel: 'chrome'). Used for dev/test.
//
// For sites that REQUIRE JS execution (Cloudflare, SPAs), users fall back to
// Mode Manuel in the dashboard — which already works via GPT-4o text extraction.

const BLOCKLIST = [
  'cookie', 'cookies', 'newsletter', 'privacy', 'privacy policy', 'subscribe',
  'terms', 'terms of use', 'policy', 'menu', 'login', 'sign in', 'register',
  'sign up', 'home', 'contact', 'contact us', 'about', 'about us', 'faq',
  'press', 'media', '404', 'not found', 'le salon', 'programme', 'gdpr',
  'rgpd', 'back to top', 'accueil', 'exposants', 'exposant', 'visiteurs',
  'visiteur', 'plan', 'partenaires', 'partenaire', 'médias', 'actualités',
  'search', 'recherche', 'infos pratiques', 'lire la suite', 'voir plus',
  'load more', 'plan du site', 'mentions légales', 'cgu', 'cgv',
  'next', 'previous', 'précédent', 'suivant', 'page', 'all', 'tous',
  'inscription', 'connexion', 'mon compte', 'panier',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function isJunk(s: string): boolean {
  const t = s.toLowerCase().trim();
  if (t.length < 3 || t.length > 100) return true;
  // Pure number or stand code (e.g. "A12", "Hall 5")
  if (/^[a-z]?\d{1,3}$/.test(t)) return true;
  if (/^(hall|stand|booth|salle)\s*\w?\d/.test(t)) return true;
  return BLOCKLIST.some(b => t === b || (t.length < 25 && t.includes(b)));
}

function dedupe(rows: Exposant[]): Exposant[] {
  const seen = new Set<string>();
  const out: Exposant[] = [];
  for (const r of rows) {
    const nom = r.nom.trim().replace(/\s+/g, ' ');
    if (!nom || isJunk(nom)) continue;
    const key = nom.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      nom,
      secteur: r.secteur.trim(),
      site: r.site.trim(),
      stand: r.stand.trim(),
    });
  }
  return out;
}

// ─── Cheerio scraper: 5 extraction strategies, takes the most productive ────
async function scrapeWithCheerio(url: string): Promise<Exposant[]> {
  const cheerio = await import('cheerio');
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from target`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Inline-resolve relative URLs
  const resolveHref = (href: string): string => {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    if (href.startsWith('//')) return 'https:' + href;
    try { return new URL(href, url).href; } catch { return ''; }
  };

  const all: Exposant[][] = [];

  // ─ Strategy A: classic <table> rows ─────────────────────────────────────
  {
    const rows: Exposant[] = [];
    $('table tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 2) return;
      const nom = $(tds[0]).text().trim();
      if (!nom) return;
      const stand = $(tds[1]).text().trim();
      const secteur = tds.length > 2 ? $(tds[2]).text().trim() : '';
      const site = resolveHref($(tds[0]).find('a[href]').attr('href') || '');
      rows.push({ nom, secteur, site, stand });
    });
    all.push(rows);
  }

  // ─ Strategy B: card/list selectors (MapYourShow, Eventmaker, custom) ───
  {
    const rows: Exposant[] = [];
    const sel = [
      '.mys-exhibitor-name',
      '[class*="exhibitor-name"]',
      '[class*="exhibitor-card"]',
      '[class*="exhibitor-list-item"]',
      '[class*="exhibitor-item"]',
      '[class*="exposant-card"]',
      '[class*="exposant-name"]',
      '[class*="exposant-item"]',
      '[class*="company-name"]',
      '[class*="participant-name"]',
      '[class*="participant-card"]',
      '.card-title',
      'h2 a, h3 a, h4 a',  // common heading-link pattern
      'li[itemtype*="Organization"]',
      '[itemprop="name"]',
    ].join(', ');

    $(sel).each((_, el) => {
      const $el = $(el);
      const nom = $el.text().trim();
      if (!nom) return;
      const $card = $el.closest('li, article, .card, [class*="card"], [class*="item"], tr, div');
      const $a = $card.find('a[href]').first();
      const site = resolveHref($a.attr('href') || '');
      const $stand = $card.find('[class*="booth"], [class*="stand"], [class*="location"], [class*="hall"]').first();
      const stand = $stand.text().trim();
      rows.push({ nom, secteur: '', site, stand });
    });
    all.push(rows);
  }

  // ─ Strategy C: list items <li> with text content (fallback) ─────────────
  {
    const rows: Exposant[] = [];
    $('ul.exhibitor-list li, ul.exposant-list li, ol.exhibitor-list li, .exhibitors-grid > *, .exposants-grid > *').each((_, el) => {
      const $el = $(el);
      const nom = ($el.find('a, h2, h3, h4, .name, [class*="name"]').first().text() || $el.text()).trim();
      if (!nom) return;
      const site = resolveHref($el.find('a[href]').first().attr('href') || '');
      rows.push({ nom, secteur: '', site, stand: '' });
    });
    all.push(rows);
  }

  // ─ Strategy D: anchor-text harvest with heuristics ──────────────────────
  // For sites where exhibitors are just <a> tags inside a "directory" section
  {
    const rows: Exposant[] = [];
    // Look for containers that probably hold a directory
    const $containers = $(
      '[class*="directory"], [class*="listing"], [class*="exposants"], ' +
      '[class*="exhibitors"], [id*="directory"], [id*="exhibitors"], [id*="exposants"]'
    );
    const scope = $containers.length > 0 ? $containers : $('main, #main, [role="main"], body');

    scope.find('a[href]').each((_, a) => {
      const $a = $(a);
      const text = $a.text().trim().replace(/\s+/g, ' ');
      const href = $a.attr('href') || '';
      if (text.length < 3 || text.length > 80) return;
      // Skip nav/social/anchor links
      if (href === '#' || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.includes('javascript:')) return;
      // Skip if text is just a URL
      if (/^(https?:\/\/|www\.)/.test(text)) return;
      const site = resolveHref(href);
      rows.push({ nom: text, secteur: '', site, stand: '' });
    });
    all.push(rows);
  }

  // ─ Strategy E: JSON-LD structured data (high-quality when present) ──────
  {
    const rows: Exposant[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).contents().text());
        const list = Array.isArray(data) ? data : [data];
        for (const item of list) {
          if (!item || typeof item !== 'object') continue;
          // Direct Organization
          if (item['@type'] === 'Organization' || item['@type'] === 'Corporation') {
            rows.push({ nom: String(item.name || ''), secteur: '', site: String(item.url || ''), stand: '' });
          }
          // ItemList of Organizations
          if (item['@type'] === 'ItemList' && Array.isArray(item.itemListElement)) {
            for (const elem of item.itemListElement) {
              const o = elem.item || elem;
              if (o && o.name) {
                rows.push({ nom: String(o.name), secteur: '', site: String(o.url || ''), stand: '' });
              }
            }
          }
        }
      } catch { /* malformed JSON-LD, skip */ }
    });
    all.push(rows);
  }

  // Pick the strategy that yielded the most clean results
  const cleaned = all.map(dedupe);
  cleaned.sort((a, b) => b.length - a.length);

  // Merge top 2 strategies for coverage, dedupe globally
  const merged = dedupe([...(cleaned[0] || []), ...(cleaned[1] || [])]);
  return merged;
}

// ─── Local-only Playwright path (kept for dev parity, never runs on Vercel) ─
async function scrapeWithLocalPlaywright(url: string): Promise<Exposant[]> {
  const { chromium: pw } = await import('playwright-core');
  const browser = await (async () => {
    try {
      return await pw.launch({ channel: 'chrome', headless: true });
    } catch {
      return await pw.launch({ headless: true });
    }
  })();

  try {
    const ctx = await browser.newContext({
      userAgent: UA,
      locale: 'fr-FR',
      viewport: { width: 1280, height: 900 },
    });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await ctx.newPage();
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,mp4}', r => r.abort());
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.evaluate(async () => {
      await new Promise<void>(r => {
        let h = 0;
        const t = setInterval(() => {
          window.scrollBy(0, 400);
          h += 400;
          if (h >= document.body.scrollHeight) { clearInterval(t); r(); }
        }, 250);
        setTimeout(() => { clearInterval(t); r(); }, 10000);
      });
    });
    const html = await page.content();
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);
    const rows: Exposant[] = [];
    $('a[href]').each((_, a) => {
      const text = $(a).text().trim();
      if (text.length >= 3 && text.length <= 80) {
        rows.push({ nom: text, secteur: '', site: $(a).attr('href') || '', stand: '' });
      }
    });
    return dedupe(rows);
  } finally {
    await browser.close().catch(() => {});
  }
}

// ─── Route handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { url?: string; nom_salon?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, nom_salon } = body;
  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'url required (http/https)' }, { status: 400 });
  }

  const errors: string[] = [];
  let exposants: Exposant[] = [];

  // Primary: Cheerio (works on Vercel + locally)
  try {
    exposants = await scrapeWithCheerio(url);
    console.log(`[scraper] cheerio: ${exposants.length} exposants for ${url}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`cheerio: ${msg}`);
    console.error(`[scraper] cheerio failed: ${msg}`);
  }

  // Local-only fallback: try Playwright when running in dev
  if (exposants.length < 5 && !process.env.VERCEL) {
    try {
      const pwResults = await scrapeWithLocalPlaywright(url);
      const seen = new Set(exposants.map(e => e.nom.toLowerCase()));
      for (const e of pwResults) {
        if (!seen.has(e.nom.toLowerCase())) {
          exposants.push(e);
          seen.add(e.nom.toLowerCase());
        }
      }
      console.log(`[scraper] local playwright: ${exposants.length} total exposants`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`playwright: ${msg}`);
      console.warn(`[scraper] local playwright failed: ${msg}`);
    }
  }

  return NextResponse.json({
    success: exposants.length > 0,
    nom_salon: nom_salon || '',
    url,
    count: exposants.length,
    exposants,
    errors: errors.length ? errors : undefined,
    // Surface guidance to the n8n workflow / dashboard
    hint: exposants.length === 0
      ? 'No exhibitors extracted. Site likely requires JS rendering (Cloudflare/SPA). Use Mode Manuel in the dashboard with copy-pasted exhibitor text.'
      : undefined,
  });
}
