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
];

function isJunk(s: string): boolean {
  const t = s.toLowerCase().trim();
  if (t.length < 2 || t.length > 150) return true;
  return BLOCKLIST.some(b => t === b || (t.length < 30 && t.includes(b)));
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
    return NextResponse.json({ error: 'url is required and must start with http' }, { status: 400 });
  }

  try {
    // Dynamic import so the module is never evaluated at build time
    const { chromium } = await import('playwright-extra');
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    chromium.use(StealthPlugin());

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      viewport: { width: 1280, height: 900 },
    });

    const page = await context.newPage();

    // Block heavy resources — speed + stealth
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,mp4,webm}', r => r.abort());

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for exhibitor content to render
    try {
      await page.waitForSelector(
        'table tr, [class*="exhibitor"], [class*="exposant"], [class*="stand"], li[class*="company"]',
        { timeout: 15000 }
      );
    } catch {
      // Page loaded but no known selector found — attempt extraction anyway
    }

    const rawRows: Exposant[] = await page.evaluate(() => {
      const out: { nom: string; secteur: string; site: string; stand: string }[] = [];

      // Path A: table rows (IPPE-style)
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

      // Path B: MapYourShow / card-based layouts
      document.querySelectorAll<HTMLElement>(
        '.mys-exhibitor-name, [class*="exhibitor-name"], [class*="exhibitor-card"], [class*="company-name"]'
      ).forEach(el => {
        const card = el.closest<HTMLElement>('li, article, div, tr') || el;
        const nom = (el.innerText || '').trim();
        const anchor = card.querySelector<HTMLAnchorElement>('a[href^="http"], a[href^="/"]');
        let site = anchor ? anchor.getAttribute('href') || '' : '';
        if (site.startsWith('/')) site = new URL(site, location.origin).href;
        const standEl = card.querySelector<HTMLElement>('[class*="booth"], [class*="stand"], [class*="location"]');
        const stand = standEl ? (standEl.innerText || '').trim() : '';
        out.push({ nom, secteur: '', site, stand });
      });

      return out;
    });

    await browser.close();

    const seen = new Set<string>();
    const exposants: Exposant[] = [];

    for (const r of rawRows) {
      const nom = r.nom.trim();
      if (!nom || isJunk(nom)) continue;
      const key = nom.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      exposants.push({
        nom,
        secteur: r.secteur.trim(),
        site: r.site.trim(),
        stand: r.stand.trim(),
      });
    }

    return NextResponse.json({
      success: true,
      nom_salon: nom_salon || '',
      url,
      count: exposants.length,
      exposants,
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
