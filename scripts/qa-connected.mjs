// Browser QA for the connected flows: CSV import → product memory → udhaar takes stock off the shelf
// → order delivery → khata, plus Home insights and the Memory timeline.
// Run: node scripts/qa-connected.mjs   (dev server on :3000; makes 1 Gemini call + 1 short TTS call)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const OUT = "scripts/out/qa-connected";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(30000);
const problems = [];
const ok = [];
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text().slice(0, 200)}`));
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const overflow = async (name) => {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (o > 1) problems.push(`overflow-x ${o}px on ${name}`);
};
const check = (cond, msg) => (cond ? ok.push(msg) : problems.push(`FAIL: ${msg}`));
const stockOf = (id) =>
  page.evaluate(
    (pid) =>
      new Promise((res) => {
        const r = indexedDB.open("dukaan-dost");
        r.onsuccess = () => {
          const g = r.result.transaction("products").objectStore("products").get(pid);
          g.onsuccess = () => res(g.result?.stockQty ?? null);
        };
      }),
    id,
  );

// Onboard with the demo shop (English UI)
await page.goto(BASE, { waitUntil: "load" });
await page.waitForURL("**/onboarding", { timeout: 60000 });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /English/ }).first().click();
await page.waitForTimeout(500);
await page.locator("button.bg-ink").click();
await page.locator("button.bg-ink").click();
await page.getByRole("button", { name: /^Skip$/ }).click();
await page.getByRole("button", { name: /demo/i }).first().click();
await page.waitForURL(BASE + "/", { timeout: 30000 });
await page.waitForTimeout(2500);

// Home: insights + linked activity
check(await page.getByRole("region", { name: "Dost remembers" }).isVisible().catch(() => false), "home shows 'Dost remembers' insights");
await shot("01-home");
await overflow("home");

// Stock: CSV import with the bundled sample
const maggiBefore = await stockOf("prod-maggi");
await page.goto(BASE + "/stock", { waitUntil: "load" });
await page.getByTestId("import-csv").click();
await page.getByTestId("csv-try-sample").click();
await page.waitForTimeout(400);
await shot("02-csv-preview");
await page.getByTestId("csv-import").click();
await page.waitForTimeout(800);
check((await stockOf("prod-maggi")) === 48, `CSV sample updates Maggi stock (${maggiBefore} → 48)`);
check(await page.getByText("Paneer 200g").first().isVisible().catch(() => false), "CSV sample creates new product (Paneer)");
await shot("03-stock-after-import");
await overflow("stock");

// Upload the public sample file too (idempotent: only updates)
await page.getByTestId("import-csv").click();
await page.locator('input[type="file"]').setInputFiles("public/samples/stock-sample.csv");
await page.waitForTimeout(400);
check(await page.getByText(/0 new · 12 updated/).isVisible().catch(() => false), "re-uploading the sample file plans 12 updates, 0 new");
await page.keyboard.press("Escape");

// Product memory page
await page.goto(BASE + "/stock/prod-chawal", { waitUntil: "load" });
await page.waitForTimeout(600);
check(await page.getByText("Who buys it").isVisible().catch(() => false), "product page shows who buys it");
await shot("04-product-memory");
await overflow("product");

// Customer memory → "same as last time" → confirm card shows khata + stock effects → confirm reduces stock
await page.goto(BASE + "/khata/cust-ramesh", { waitUntil: "load" });
await page.waitForTimeout(600);
await shot("05-customer-memory");
const same = page.getByTestId("same-again");
if (await same.isVisible().catch(() => false)) {
  await same.click();
  const card = page.getByTestId("action-card");
  await card.waitFor({ timeout: 30000 }).catch(() => {});
  if (await card.isVisible().catch(() => false)) {
    const effects = page.getByTestId("connected-effects");
    check(await effects.isVisible().catch(() => false), "confirm card previews khata/stock effects");
    await shot("06-confirm-card");
    const firstProduct = await page.evaluate(() =>
      new Promise((res) => {
        const r = indexedDB.open("dukaan-dost");
        r.onsuccess = () => {
          const g = r.result.transaction("products").objectStore("products").getAll();
          g.onsuccess = () => res(Object.fromEntries(g.result.map((p) => [p.id, p.stockQty])));
        };
      }),
    );
    await card.locator("button.bg-leaf").click();
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() =>
      new Promise((res) => {
        const r = indexedDB.open("dukaan-dost");
        r.onsuccess = () => {
          const g = r.result.transaction("stockEvents").objectStore("stockEvents").getAll();
          g.onsuccess = () => res(g.result.filter((e) => e.source === "ledger").map((e) => ({ id: e.productId, delta: e.delta })));
        };
      }),
    );
    check(after.length > 0, `udhaar took items off the shelf: ${JSON.stringify(after)} (before ${JSON.stringify(after.map((a) => firstProduct[a.id]))})`);
    await shot("07-after-confirm");
    await page.keyboard.press("Escape");
  } else problems.push("FAIL: voice understand did not produce an action card (API keys / network?)");
} else problems.push("FAIL: 'same as last time' button not shown for Ramesh");

// Order: deliver → stock drawn once → add to khata once
await page.goto(BASE + "/orders", { waitUntil: "load" });
const newOrder = page.locator('a[href^="/orders/"]').filter({ hasText: "Lakshmi" }).first();
await newOrder.click();
await page.waitForTimeout(600);
for (let i = 0; i < 10 && (await page.locator("button[aria-pressed=false]").count()) > 0; i++) {
  await page.locator("button[aria-pressed=false]").first().click();
  await page.waitForTimeout(250);
}
await page.locator("button.bg-leaf").first().click(); // packed
await page.waitForTimeout(400);
await page.locator("button.bg-leaf").first().click(); // delivered
await page.waitForTimeout(800);
check(await page.getByText("Delivered items were taken out of stock").isVisible().catch(() => false), "delivered order reduced stock");
const addBtn = page.getByRole("button", { name: /Add to khata/ });
if (await addBtn.isVisible().catch(() => false)) {
  await addBtn.click();
  await page.waitForTimeout(600);
  check(await page.getByText("Added to khata").first().isVisible().catch(() => false), "order added to khata once (button replaced)");
}
await shot("08-order-delivered");
await overflow("order");

// Memory timeline
await page.goto(BASE + "/memory", { waitUntil: "load" });
await page.waitForTimeout(800);
await page.getByLabel("Search a name or item…").fill("Ramesh");
await page.waitForTimeout(400);
check((await page.locator('ul a[href="/khata/cust-ramesh"]').count()) > 0, "memory search finds Ramesh's entries");
await shot("09-memory");
await overflow("memory");

await browser.close();
console.log("PASS:\n  " + ok.join("\n  "));
console.log(problems.length ? "PROBLEMS:\n  " + problems.join("\n  ") : "No problems.");
process.exit(problems.some((p) => p.startsWith("FAIL")) ? 1 : 0);
