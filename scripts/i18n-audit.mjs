// i18n audit: for each language, onboard with demo data, visit every screen, and report visible
// text that still contains Latin letters (= probably an untranslated string).
// Run: node scripts/i18n-audit.mjs [hi kn ta ...]   (dev server on :3000)
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const NATIVE = { hi: "हिन्दी", mr: "मराठी", kn: "ಕನ್ನಡ", ta: "தமிழ்", te: "తెలుగు", ml: "മലയാളം", bn: "বাংলা", gu: "ગુજરાતી", pa: "ਪੰਜਾਬੀ" };
const ROUTES = ["/", "/khata", "/stock", "/stock/reorder", "/orders", "/more", "/hisaab", "/settings"];
const langs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(NATIVE);

// Data (not UI chrome): product/customer/shop names from the seed, units, brand names, currency.
const ALLOWED = /^(₹[\d,.]+|[\d\s,.:/+\-−·%₹()]+|WhatsApp|Gnani|Prisma|Timbre|Gemini|Voice Clone|v3)$/;

const browser = await chromium.launch();
let total = 0;
for (const lang of langs) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForURL("**/onboarding", { timeout: 20000 });
  await page.getByRole("button", { name: new RegExp(NATIVE[lang]) }).first().click();
  await page.waitForTimeout(600);
  const next = () => page.locator("button.bg-ink").click(); // primary "next" button
  await next();
  await next();
  await page.locator("button", { has: page.locator("svg") }).filter({ hasNotText: /./ }).first().isVisible().catch(() => {});
  // step 2 (voice clone) → skip; step 3 → demo
  await page.locator("button.flex-1").first().click();
  await page.locator("button.bg-brand").first().click();
  await page.waitForURL("**/", { timeout: 20000 });
  await page.waitForTimeout(2500); // splash + catalog

  const leaks = new Map();
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const texts = await page.evaluate(() => {
      const out = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        if (!el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
        const t = n.textContent.replace(/\s+/g, " ").trim();
        if (t) out.push(t);
      }
      for (const el of document.querySelectorAll("[aria-label],[placeholder]")) {
        for (const a of ["aria-label", "placeholder"]) if (el.getAttribute(a)) out.push(`[${a}] ${el.getAttribute(a)}`);
      }
      return out;
    });
    for (const t of texts) {
      if (ALLOWED.test(t)) continue;
      if (/[A-Za-z]{2,}/.test(t)) (leaks.get(route) ?? leaks.set(route, new Set()).get(route)).add(t);
    }
  }
  console.log(`\n=== ${lang} ===`);
  for (const [route, set] of leaks) console.log(`${route}\n  ${[...set].join("\n  ")}`);
  total += [...leaks.values()].reduce((a, s) => a + s.size, 0);
  await ctx.close();
}
await browser.close();
console.log(`\n${total} Latin-script strings found (review: product/customer names are expected).`);
