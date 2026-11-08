// Browser QA: onboarding → every screen at phone size; console errors, overflow, screenshots.
// Run: node scripts/qa.mjs   (dev server on :3000)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const OUT = "scripts/out/qa";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  permissions: ["microphone"],
  args: [],
});
const page = await ctx.newPage();
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text().slice(0, 200)}`));
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
page.on("requestfailed", (r) => problems.push(`reqfail: ${r.url()} ${r.failure()?.errorText}`));

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const overflow = async (name) => {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (o > 1) problems.push(`overflow-x ${o}px on ${name}`);
};

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForURL("**/onboarding");
await shot("01-onboarding-language");
await overflow("onboarding");

await page.getByRole("button", { name: /ಕನ್ನಡ/ }).click();
await page.getByRole("button", { name: /Hindi|हिन्दी/ }).first().click();
await page.getByRole("button", { name: /Aage/ }).click();
await shot("02-onboarding-names");
await page.getByRole("button", { name: /Aage/ }).click();
await shot("03-onboarding-clone");
await page.getByRole("button", { name: "Skip" }).click();
await page.getByRole("button", { name: /Demo dukaan/ }).click();
await page.waitForURL(BASE + "/");
await page.waitForTimeout(1200);
await shot("04-home");
await overflow("home");

for (const [path, name] of [
  ["/khata", "05-khata"],
  ["/stock", "07-stock"],
  ["/stock/reorder", "08-reorder"],
  ["/orders", "09-orders"],
  ["/hisaab", "10-hisaab"],
  ["/more", "11-more"],
  ["/settings", "12-settings"],
]) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot(name);
  await overflow(path);
}

// customer detail
await page.goto(BASE + "/khata", { waitUntil: "networkidle" });
await page.locator("ul a").first().click();
await page.waitForTimeout(800);
await shot("06-customer");
await overflow("customer");

// voice sheet with text fallback (fake mic device may be absent) — type a command
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Tap & speak|दबाएँ और बोलें/ }).last().click();
await page.waitForTimeout(1200);
await shot("13-voice-sheet");
const typeBtn = page.getByRole("button", { name: /Type instead|लिखकर बताएँ/ });
if (await typeBtn.count()) await typeBtn.click();
await page.getByRole("textbox").fill("Sharma ji ne 2 kilo chawal aur ek Maggi liya, udhaar likh do");
await page.keyboard.press("Enter");
await page.waitForSelector('[data-testid="action-card"]', { timeout: 20000 }).catch(() => problems.push("no action card appeared"));
await page.waitForTimeout(500);
await shot("14-action-card");

console.log(problems.length ? "PROBLEMS:\n" + [...new Set(problems)].join("\n") : "No problems found");
await browser.close();
