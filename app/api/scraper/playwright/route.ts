export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';

interface Exposant {
  nom: string;
  secteur: string;
  site: string;
  stand: string;
}

const BLOCKLIST = [
  'cookie', 'newsletter', 'privacy', 'subscribe', 'terms', 'policy',
  'menu', 'login', 'register', 'home', 'contact', 'about', 'faq',
  'press', '404', 'not found', 'le salon', 'programme', 'gdpr', 'rgpd',
  'back to top', 'accueil', 'exposants', 'exposant', 'visiteurs',
  'plan', 'partenaires', 'médias', 'actualités', 'search',
  'infos pratiques', 'lire la suite', 'voir plus', 'load more',
  'plan du site', 'mentions légales', 'cgu', 'cgv',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function isJunk(s: string): boolean {
  const t = s.toLowerCase().trim();
  if (t.length < 3 || t.length > 80) return true;
  return BLOCKLIST.some(b => t === b || (t.length < 35 && t.includes(b)));
}

function dedupe(rows: Exposant[]): Exposant[] {
  const seen = new Set<string>();
  const out: Exposant[] = [];
  for (const r of rows) {
    const nom = r.nom.trim();
    if (!nom || isJunk(nom)) continue;
    const key = nom.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ nom, secteur: r.secteur.trim(), site: r.site.trim(), stand: r.stand.trim() });
  }
  return out;
}

// ─── Strategy 1: HTTP fetch + Cheerio (no browser, ~500ms) ──────────────────
async function scrapeWithCheerio(url: string): Promise<Exposant[]> {
  const cheerio = await import('cheerio');
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from target`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const rows: Exposant[] = [];

  // A) Tables
  $('table tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 2) return;
    const nom = $(tds[0]).text().trim();
    const stand = $(tds[1]).text().trim();
    const secteur = tds.length > 2 ? $(tds[2]).text().trim() : '';
    let site = $(tds[0]).find('a[href]').attr('href') || '';
    if (site.startsWith('/')) site = new URL(site, url).href;
    rows.push({ nom, secteur, site, stand });
  });

  // B) Selectors classiques exhibiteurs
  $(
    '.mys-exhibitor-name, [class*="exhibitor"], [class*="exposant"], ' +
    '[class*="company-name"], .card-title, [class*="participant"]'
  ).each((_, el) => {
    const $el = $(el);
    const nom = $el.text().trim();
    if (!nom) return;
    const $card = $el.closest('li, article, div, tr');
    let site = $card.find('a[href^="http"], a[href^="/"]').first().attr('href') || '';
    if (site.startsWith('/')) site = new URL(site, url).href;
    const stand = $card.find('[class*="booth"], [class*="stand"], [class*="location"]').first().text().trim();
    rows.push({ nom, secteur: '', site, stand });
  });

  return dedupe(rows);
}

// ─── Strategy 2: Playwright (heavy, last resort) ────────────────────────────
async function scrapeWithPlaywright(url: string): Promise<Exposant[]> {
  let browser: import('playwright-core').Browser;

  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const { chromium: pw } = await import('playwright-core');

    // Sparticuz canonical configuration:
    // - setGraphicsMode=false: skip swiftshader extraction (faster cold start, fewer libs)
    // - chromium.headless: 'shell' is the optimized mode for serverless
    // - chromium.args: already includes --no-sandbox, --no-zygote, --single-process etc.
    //   Adding our own --no-sandbox flags creates duplicates AND can confuse the launcher.
    chromium.setGraphicsMode = false;

    browser = await pw.launch({
      args: [
        ...chromium.args,
        '--disable-blink-features=AutomationControlled',
      ],
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    const { chromium: pw } = await import('playwright-core');
    try {
      browser = await pw.launch({
        channel: 'chrome',
        headless: true,
        args: ['--disable-blink-features=AutomationControlled'],
      });
    } catch {
      browser = await pw.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled'],
      });
    }
  }

  try {
    const context = await browser.newContext({
      userAgent: UA,
      locale: 'fr-FR',
      viewport: { width: 1280, height: 900 },
      extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    const page = await context.newPage();
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,mp4,webm}', r => r.abort());
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    try {
      await page.waitForSelector(
        'table tr td, [class*="exhibitor"], [class*="exposant"], [class*="participant"], .card-title',
        { timeout: 10000 }
      );
    } catch { /* extract anyway */ }

    // Auto-scroll
    await page.evaluate(async () => {
      await new Promise<void>(resolve => {
        let h = 0;
        const t = setInterval(() => {
          window.scrollBy(0, 400);
          h += 400;
          if (h >= document.body.scrollHeight) { clearInterval(t); resolve(); }
        }, 300);
        setTimeout(() => { clearInterval(t); resolve(); }, 12000);
      });
    });

    // Load more
    for (let i = 0; i < 3; i++) {
      const btn = page.locator(
        '[class*="load-more"], [class*="loadmore"], button:has-text("Voir plus"), button:has-text("Load more")'
      ).first();
      if (!(await btn.isVisible().catch(() => false))) break;
      await btn.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    const rows: Exposant[] = await page.evaluate(() => {
      const out: { nom: string; secteur: string; site: string; stand: string }[] = [];

      document.querySelectorAll<HTMLTableRowElement>('table tr').forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length < 2) return;
        const nom = (cells[0].textContent || '').trim();
        const stand = (cells[1].textContent || '').trim();
        const secteur = cells.length > 2 ? (cells[2].textContent || '').trim() : '';
        const a = cells[0].querySelector<HTMLAnchorElement>('a[href]');
        let site = a?.getAttribute('href') || '';
        if (site.startsWith('/')) site = new URL(site, location.origin).href;
        out.push({ nom, secteur, site, stand });
      });

      document.querySelectorAll<HTMLElement>(
        '.mys-exhibitor-name, [class*="exhibitor"], [class*="exposant"], [class*="company-name"], .card-title, [class*="participant"]'
      ).forEach(el => {
        const card = el.closest<HTMLElement>('li, article, div, tr') || el;
        const nom = (el.textContent || '').trim();
        if (!nom) return;
        const a = card.querySelector<HTMLAnchorElement>('a[href^="http"], a[href^="/"]');
        let site = a?.getAttribute('href') || '';
        if (site.startsWith('/')) site = new URL(site, location.origin).href;
        const standEl = card.querySelector<HTMLElement>('[class*="booth"], [class*="stand"], [class*="location"]');
        const stand = standEl ? (standEl.textContent || '').trim() : '';
        out.push({ nom, secteur: '', site, stand });
      });

      return out;
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

  // Cascade: Cheerio first (fast, no Chromium dependency)
  try {
    exposants = await scrapeWithCheerio(url);
    console.log(`[scraper] cheerio: ${exposants.length} exposants`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`cheerio: ${msg}`);
    console.warn(`[scraper] cheerio failed: ${msg}`);
  }

  // Playwright fallback only if Cheerio gave too few results (likely JS-rendered site)
  if (exposants.length < 5) {
    try {
      const pwResults = await scrapeWithPlaywright(url);
      console.log(`[scraper] playwright: ${pwResults.length} exposants`);
      // Merge results, dedupe globally
      const seen = new Set(exposants.map(e => e.nom.toLowerCase()));
      for (const e of pwResults) {
        if (!seen.has(e.nom.toLowerCase())) {
          exposants.push(e);
          seen.add(e.nom.toLowerCase());
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`playwright: ${msg}`);
      console.error(`[scraper] playwright failed: ${msg}`);
    }
  }

  // Always 200 OK — let n8n decide based on `success` + count
  return NextResponse.json({
    success: exposants.length > 0,
    nom_salon: nom_salon || '',
    url,
    count: exposants.length,
    exposants,
    errors: errors.length ? errors : undefined,
  });
}
