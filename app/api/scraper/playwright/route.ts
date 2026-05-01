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
  'infos pratiques', 'subscribe', 'rgpd', 'back to top',
];

function isJunk(s: string): boolean {
  const t = s.toLowerCase().trim();
  if (t.length < 3 || t.length > 80) return true;
  return BLOCKLIST.some(b => t === b || (t.length < 35 && t.includes(b)));
}

export async function POST(req: NextRequest) {
  let body: { url?: string; nom_salon?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, nom_salon } = body;
  if (!url || !url.startsWith('http')) {
    return NextResponse.json(
      { error: 'url is required and must start with http' },
      { status: 400 }
    );
  }

  try {
    let browser: import('playwright-core').Browser;

    if (process.env.VERCEL) {
      // --- Vercel: serverless Chromium via @sparticuz/chromium ---
      const chromium = (await import('@sparticuz/chromium')).default;
      const { chromium: pwChromium } = await import('playwright-core');
      browser = await pwChromium.launch({
        args: [
          ...chromium.args,
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // --- Local: system Chrome first, fallback to default playwright-core Chromium ---
      const { chromium: pwChromium } = await import('playwright-core');
      try {
        browser = await pwChromium.launch({
          channel: 'chrome',
          args: ['--disable-blink-features=AutomationControlled'],
          headless: true,
        });
      } catch {
        browser = await pwChromium.launch({
          args: ['--disable-blink-features=AutomationControlled'],
          headless: true,
        });
      }
    }

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      viewport: { width: 1280, height: 900 },
      extraHTTPHeaders: {
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    });

    // Stealth renforcé: masquer webdriver, plugins, window.chrome
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // @ts-ignore
      delete navigator.__proto__.webdriver;
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    const page = await context.newPage();

    // Bloquer les ressources lourdes pour la vitesse
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,mp4,webm}', r =>
      r.abort()
    );

    // Timeout global 50s pour rester dans les limites Vercel 60s
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Attendre un sélecteur connu ou continuer quand même
    try {
      await page.waitForSelector(
        'table tr td, [class*="exhibitor"], [class*="exposant"], [class*="stand"], li[class*="company"], .card-title, [class*="participant"]',
        { timeout: 12000 }
      );
    } catch {
      // Aucun sélecteur trouvé — extraction quand même
    }

    // Auto-scroll progressif jusqu'en bas, max 15s
    await page.evaluate(async () => {
      await new Promise<void>(resolve => {
        let h = 0;
        const d = 400;
        const t = setInterval(() => {
          window.scrollBy(0, d);
          h += d;
          if (h >= document.body.scrollHeight) {
            clearInterval(t);
            resolve();
          }
        }, 300);
        setTimeout(() => {
          clearInterval(t);
          resolve();
        }, 15000);
      });
    });

    // Détection "Load More" — max 3 clics, 2s entre chaque
    for (let click = 0; click < 3; click++) {
      const loadMoreBtn = page.locator(
        '[class*="load-more"], [class*="loadmore"], button:has-text("Voir plus"), button:has-text("Load more"), button:has-text("Afficher plus")'
      ).first();
      const visible = await loadMoreBtn.isVisible().catch(() => false);
      if (!visible) break;
      await loadMoreBtn.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    // ---- 3 stratégies d'extraction, résultat = union dédupliquée ----
    const rawRows: Exposant[] = await page.evaluate(() => {
      const out: { nom: string; secteur: string; site: string; stand: string }[] = [];

      // Stratégie A : lignes de tables
      document.querySelectorAll<HTMLTableRowElement>('table tr').forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length < 2) return;
        const nom = (cells[0].innerText || '').trim();
        const stand = (cells[1].innerText || '').trim();
        const secteur = cells.length > 2 ? (cells[2].innerText || '').trim() : '';
        const anchor = cells[0].querySelector<HTMLAnchorElement>('a[href]');
        let site = anchor ? anchor.getAttribute('href') || '' : '';
        if (site.startsWith('/')) site = new URL(site, location.origin).href;
        out.push({ nom, secteur, site, stand });
      });

      // Stratégie B : sélecteurs CSS exhibiteurs/exposants classiques
      document.querySelectorAll<HTMLElement>(
        '.mys-exhibitor-name, [class*="exhibitor"], [class*="exposant"], [class*="stand"], [class*="company-name"], .card-title, [class*="participant"]'
      ).forEach(el => {
        const card = el.closest<HTMLElement>('li, article, div, tr') || el;
        const nom = (el.innerText || '').trim();
        if (!nom) return;
        const anchor = card.querySelector<HTMLAnchorElement>('a[href^="http"], a[href^="/"]');
        let site = anchor ? anchor.getAttribute('href') || '' : '';
        if (site.startsWith('/')) site = new URL(site, location.origin).href;
        const standEl = card.querySelector<HTMLElement>(
          '[class*="booth"], [class*="stand"], [class*="location"]'
        );
        const stand = standEl ? (standEl.innerText || '').trim() : '';
        out.push({ nom, secteur: '', site, stand });
      });

      return out;
    });

    // Déduplication après stratégies A+B
    const seenAB = new Set<string>();
    const partialResults: Exposant[] = [];
    for (const r of rawRows) {
      const nom = r.nom.trim();
      if (!nom) continue;
      const key = nom.toLowerCase();
      if (seenAB.has(key)) continue;
      seenAB.add(key);
      partialResults.push({
        nom,
        secteur: r.secteur.trim(),
        site: r.site.trim(),
        stand: r.stand.trim(),
      });
    }

    // Stratégie C : fallback texte brut via liens <a> si A+B < 5 résultats
    let stratCRows: Exposant[] = [];
    if (partialResults.length < 5) {
      stratCRows = await page.evaluate(() => {
        const out: { nom: string; secteur: string; site: string; stand: string }[] = [];
        document.querySelectorAll<HTMLAnchorElement>('a').forEach(a => {
          const text = (a.innerText || a.textContent || '').trim();
          const href = a.getAttribute('href') || '';
          // Texte entre 3 et 80 chars, pas une URL, pas nav
          if (text.length < 3 || text.length > 80) return;
          if (text.startsWith('http') || text.startsWith('www.')) return;
          out.push({ nom: text, secteur: '', site: '', stand: '' });
        });
        return out;
      });
    }

    // Fusion finale A+B+C avec déduplication globale
    const seen = new Set<string>(seenAB);
    const exposants: Exposant[] = [...partialResults];

    for (const r of stratCRows) {
      const nom = r.nom.trim();
      if (!nom) continue;
      const key = nom.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      exposants.push({ nom, secteur: '', site: '', stand: '' });
    }

    await browser.close();

    // Filtrage blocklist sur le résultat final
    const filtered = exposants.filter(e => !isJunk(e.nom));

    return NextResponse.json({
      success: true,
      nom_salon: nom_salon || '',
      url,
      count: filtered.length,
      exposants: filtered,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[scraper/playwright] error:', message);
    return NextResponse.json(
      { success: false, error: message, exposants: [] },
      { status: 500 }
    );
  }
}
