// Browser checks for the compiled app (run `npm run build` first):
//  1. axe-core accessibility scan of every page, light and dark
//  2. a keyboard-only walkthrough of the main flows
//  3. no CSP violations or console errors
//  4. light/dark screenshots of each page -> docs/screens/ (git-ignored, local only)
// Uses the fake Google backend in test/e2e/fake-server.js: no real Google calls.
//
// Needs a Chromium build. Set CHROMIUM_PATH, or it tries common locations.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const { chromium } = require(path.join(root, "web/node_modules/playwright-core"));
const axeSource = fs.readFileSync(path.join(root, "web/node_modules/axe-core/axe.min.js"), "utf8");
const { startFakeServer } = require(path.join(root, "test/e2e/fake-server.js"));

if (!fs.existsSync(path.join(root, "web/dist/index.html"))) { console.error("Build first: npm run build"); process.exit(1); }
const candidates = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) { console.error("No Chromium/Chrome found. Set CHROMIUM_PATH to your Chrome executable."); process.exit(1); }

const PORT = Number(process.env.E2E_PORT || 4391);
const BASE = `http://127.0.0.1:${PORT}/`;
const PAGES = [["today", "#/today"], ["agencies", "#/agencies"], ["agency", "#/agency/1"], ["agency-google", "#/agency/4"],
  ["agency-calls", "#/agency/1?tab=calls"], ["agency-tasks", "#/agency/1?tab=tasks"], ["agency-research", "#/agency/1?tab=research"],
  ["pipeline", "#/pipeline"], ["followups", "#/followups"], ["search", "#/search"], ["new-agency", "#/agencies/new"]];

const results = { a11y: [], keyboard: [], console: [] };
const fail = (area, msg) => { results[area].push(msg); console.log(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);

const server = await startFakeServer(PORT);
const browser = await chromium.launch({ executablePath });
const shotsDir = path.join(root, "docs/screens");
fs.mkdirSync(shotsDir, { recursive: true });

async function newPage(scheme) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") results.console.push(`${scheme}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => results.console.push(`${scheme}: ${e.message}`));
  return page;
}

try {
  console.log("\n1. Accessibility (axe-core, WCAG 2.1 A/AA) + screenshots");
  for (const scheme of ["light", "dark"]) {
    const page = await newPage(scheme);
    for (const [name, hash] of PAGES) {
      await page.goto(BASE + hash);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(shotsDir, `${name}-${scheme}.png`), fullPage: true });
      await page.evaluate(`${axeSource}\n;undefined`); // evaluate() is not subject to the page CSP; return nothing
      const r = await page.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }));
      const serious = r.violations.filter((v) => ["serious", "critical"].includes(v.impact));
      const minor = r.violations.filter((v) => !["serious", "critical"].includes(v.impact));
      if (serious.length) for (const v of serious) fail("a11y", `${name} (${scheme}): ${v.id} [${v.impact}] ${v.help} → ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
      else pass(`${name} (${scheme}) no serious/critical issues${minor.length ? `; minor: ${minor.map((v) => v.id).join(", ")}` : ""}`);
    }
    await page.context().close();
  }

  console.log("\n2. Keyboard-only walkthrough");
  const page = await newPage("light");
  const k = (key) => page.keyboard.press(key);
  let stepNo = 0;
  const step = async (label, fn) => {
    stepNo++;
    try { await fn(); pass(label); } catch (e) {
      fail("keyboard", `${label}: ${e.message.split("\n")[0]}`);
      await page.screenshot({ path: path.join(shotsDir, `failed-step-${stepNo}.png`) }).catch(() => {});
      await k("Escape").catch(() => {}); // don't let one stuck dialog fail every later step
    }
  };
  const focused = () => page.evaluate(() => { const el = document.activeElement; return { tag: el?.tagName, text: (el?.getAttribute("aria-label") || el?.textContent || "").trim().slice(0, 60), outline: el ? getComputedStyle(el).outlineStyle + "|" + getComputedStyle(el).boxShadow : "" }; });
  await page.goto(BASE + "#/today");
  await page.waitForLoadState("networkidle");

  await step("Tab reaches the skip link first, Enter moves focus to the page", async () => {
    await k("Tab");
    const f = await focused();
    if (!/skip to content/i.test(f.text)) throw new Error(`first focus was ${f.tag} "${f.text}"`);
    await k("Enter");
    const id = await page.evaluate(() => document.activeElement?.id);
    if (id !== "main") throw new Error(`focus on ${id}`);
  });
  await step("Visible focus ring on keyboard focus", async () => {
    await k("Tab");
    const f = await focused();
    if (!/solid|rgb/.test(f.outline)) throw new Error(`no visible focus style on ${f.tag} "${f.text}" (${f.outline})`);
  });
  await step("g a goes to Agencies; / focuses search", async () => {
    await page.locator("#main").focus();
    await k("g"); await k("a");
    await page.waitForURL(/#\/agencies/);
    await page.waitForSelector("tr[data-row]");
    await k("/");
    if (!(await page.evaluate(() => document.activeElement?.hasAttribute("data-search")))) throw new Error("search not focused");
  });
  await step("Type to filter, ↓ to the grid, Enter opens the agency", async () => {
    await page.keyboard.type("lehigh");
    await k("ArrowDown");
    await k("Enter");
    await page.waitForURL(/#\/agency\/3/);
  });
  await step("L opens the quick-log drawer instantly; ⌘/Ctrl+Enter saves", async () => {
    await page.locator("#main").focus();
    await k("l");
    await page.waitForSelector('[data-slot="sheet-popup"]', { timeout: 1000 });
    await page.keyboard.type("Spoke with the office manager; send demo invite.");
    await k("Control+Enter");
    await page.waitForSelector('[data-slot="sheet-popup"]', { state: "detached", timeout: 3000 });
    await page.waitForSelector("text=Call logged", { timeout: 3000 });
  });
  await step("Arrow keys switch agency tabs", async () => {
    await page.getByRole("tab", { name: "Overview" }).focus();
    await k("ArrowRight"); await k("ArrowRight"); await k("Enter");
    await page.waitForSelector("text=Call log");
  });
  await step("⌘/Ctrl+K palette: type and Enter navigates", async () => {
    await page.locator("#main").focus();
    await k("Control+k");
    await page.waitForSelector('[role="dialog"] input');
    await page.keyboard.type("Pipeline");
    await k("Enter");
    await page.waitForURL(/#\/pipeline/);
  });
  await step("Pipeline: keyboard drag (Space, →, Space) moves a card", async () => {
    await page.waitForSelector('[data-slot="kanban-item-handle"]');
    await page.locator('[data-slot="kanban-item-handle"]').first().focus();
    await k("Space"); await page.waitForTimeout(150);
    await k("ArrowRight"); await page.waitForTimeout(200);
    await k("Space"); await page.waitForTimeout(500);
    const stage = server.db.prepare("SELECT pipeline_stage FROM agencies WHERE id = 2").get().pipeline_stage;
    if (stage === "researched") throw new Error("stage did not change");
  });
  await step("Pipeline: 'Move to…' menu with keyboard; Declined asks for a reason", async () => {
    const btn = page.getByRole("button", { name: /Move .* to…/ }).first();
    await btn.focus();
    await k("Enter");
    await page.getByRole("menuitem", { name: "Declined" }).focus();
    await k("Enter");
    await page.waitForSelector("text=Why did they decline?");
    await page.waitForFunction(() => document.activeElement?.getAttribute("name") === "decline_reason", null, { timeout: 2000 });
    await page.keyboard.type("Already uses a renewal tool");
    await page.getByRole("button", { name: "Mark declined" }).focus();
    await k("Enter");
    await page.waitForSelector("text=Why did they decline?", { state: "detached" });
    await page.waitForTimeout(300);
    const n = server.db.prepare("SELECT COUNT(*) n FROM agencies WHERE pipeline_stage = 'declined' AND decline_reason LIKE '%renewal tool%'").get().n;
    if (n !== 1) throw new Error("declined with reason not saved");
  });
  await step("? opens shortcut help; Esc closes", async () => {
    await page.locator("#main").focus();
    await k("?");
    await page.waitForSelector("text=Keyboard shortcuts");
    await k("Escape");
    await page.waitForSelector("text=Keyboard shortcuts", { state: "detached" });
  });
  await step("[ collapses the sidebar", async () => {
    await page.locator("#main").focus();
    await k("[");
    await page.waitForSelector('button[aria-label="Expand sidebar"]');
    await k("[");
  });
  await page.context().close();

  console.log("\n3. Console / CSP");
  const consoleErrors = [...new Set(results.console)];
  results.console = consoleErrors;
  if (consoleErrors.length) for (const c of consoleErrors) console.log(`  ✗ ${c}`);
  else pass("no console errors or CSP violations");
} finally {
  await browser.close();
  await server.close();
}

const total = results.a11y.length + results.keyboard.length + results.console.length;
console.log(`\nScreenshots: docs/screens/ (${fs.readdirSync(shotsDir).length} files)`);
console.log(total ? `\n${total} problem(s) found.` : "\nAll browser checks passed.");
process.exit(total ? 1 : 0);
