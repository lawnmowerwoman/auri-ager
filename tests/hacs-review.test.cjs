const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test, before, after } = require("node:test");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = resolve(__dirname, "..");
const fragments = ["base", "markdown", "finance", "container", "load_breakdown"];
const bundle = process.env.AURI_BUNDLE || (!existsSync(resolve(root, "Fragments")) && resolve(root, "auri-ager.js"));
const source = bundle
  ? readFileSync(resolve(bundle), "utf8")
  : fragments.map((name) => readFileSync(resolve(root, `Fragments/auri_ager_${name}.js`), "utf8")).join("\n");
let browser;

before(async () => {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: true });
});
after(async () => { await browser?.close(); });

async function withPage(run) {
  const page = await browser.newPage();
  try {
    await page.addScriptTag({ content: source });
    await run(page);
  } finally {
    await page.close();
  }
}

test("Load Breakdown treats integration names, icons and entity IDs as text", async () => {
  await withPage(async (page) => {
    const result = await page.evaluate(() => {
      const card = document.createElement("auri-ager-load-breakdown-card");
      const entity = 'sensor.load\" data-injected=\"yes';
      const name = '<img src=x onerror="window.injected=true"> & Lighting';
      const icon = 'mdi:flash\" onmouseover=\"window.injected=true';
      card.setConfig({ source: "sensor.total", entities: [entity] });
      card.hass = { states: {
        "sensor.total": { state: "100" },
        [entity]: { state: "25", attributes: { friendly_name: name, icon } },
      } };
      document.body.appendChild(card);
      const row = card.shadowRoot.querySelector("[data-entity]");
      return {
        name: row.querySelector(".name").textContent,
        icon: row.querySelector("ha-icon").getAttribute("icon"),
        entity: row.dataset.entity,
        images: row.querySelectorAll("img").length,
        injectedAttribute: row.hasAttribute("data-injected"),
        iconHandler: row.querySelector("ha-icon").hasAttribute("onmouseover"),
        expected: { name, icon, entity },
      };
    });
    assert.equal(result.name, result.expected.name);
    assert.equal(result.icon, result.expected.icon);
    assert.equal(result.entity, result.expected.entity);
    assert.equal(result.images, 0);
    assert.equal(result.injectedAttribute, false);
    assert.equal(result.iconHandler, false);
  });
});

test("Markdown only permits HTTP(S) and relative link destinations", async () => {
  await withPage(async (page) => {
    const result = await page.evaluate(() => {
      const card = document.createElement("auri-ager-markdown-card");
      const allowed = ["https://example.com/a?x=1&y=2", "http://example.com", "/lovelace/home", "../home", "#section", "?view=1"];
      const blocked = ["javascript:alert(1)", "JaVaScRiPt:evil", "java\tscript:evil", "data:text/html,evil", "vbscript:evil", "file:///tmp/test"];
      const links = [...allowed, ...blocked].map((url, i) => `[Link ${i}](${url})`).join("\n");
      card.setConfig({ content: links + '\n[Quoted](https://example.com/\" onmouseover=\"evil)\n[Encoded](javascript&#58;evil)\n**bold** *italic* `code`' });
      card.hass = { states: {} };
      const content = card.shadowRoot.querySelector("#markdown-content");
      return {
        allowed,
        links: [...content.querySelectorAll("a")].map((a) => a.getAttribute("href")),
        protocols: [...content.querySelectorAll("a")].map((a) => new URL(a.getAttribute("href"), "https://home-assistant.invalid/").protocol),
        handlers: content.querySelectorAll("[onmouseover]").length,
        bold: content.querySelector("strong")?.textContent,
        italic: content.querySelector("em")?.textContent,
        code: content.querySelector("code")?.textContent,
      };
    });
    assert.deepEqual(result.links.slice(0, result.allowed.length), result.allowed);
    assert.equal(result.links.length, result.allowed.length + 2);
    assert.ok(result.protocols.every((protocol) => ["http:", "https:"].includes(protocol)));
    assert.equal(result.handlers, 0);
    assert.equal(result.bold, "bold");
    assert.equal(result.italic, "italic");
    assert.equal(result.code, "code");
  });
});

test("Markdown expands sensor states and units only into rendered text nodes", async () => {
  await withPage(async (page) => {
    const result = await page.evaluate(() => {
      const card = document.createElement("auri-ager-markdown-card");
      const state = '[Open](javascript:evil) **bold** <img src=x onerror="evil">';
      const unit = '<svg onload="evil">';
      card.setConfig({ content: "# Status\n**{{ sensor.test }}**\n{{ sensor.missing }}\n[Static](/{{ sensor.test }})" });
      card.hass = { states: { "sensor.test": { state, attributes: { unit_of_measurement: unit } } } };
      const content = card.shadowRoot.querySelector("#markdown-content");
      const firstText = content.querySelector("strong").textContent;
      const href = content.querySelector("a").getAttribute("href");
      const elements = content.querySelectorAll("img, svg").length;
      const anchors = content.querySelectorAll("a").length;
      const missing = content.textContent.includes("—");
      card.hass = { states: { "sensor.test": { state: "42", attributes: { unit_of_measurement: "W" } } } };
      return { firstText, expected: `${state} ${unit}`, href, elements, anchors, missing,
        updated: content.querySelector("strong").textContent };
    });
    assert.equal(result.firstText, result.expected);
    assert.equal(result.href, "/{{ sensor.test }}");
    assert.equal(result.elements, 0);
    assert.equal(result.anchors, 1);
    assert.equal(result.missing, true);
    assert.equal(result.updated, "42 W");
  });
});

test("Finance updates for every configured finance sensor after initial render", async () => {
  await withPage(async (page) => {
    const result = await page.evaluate(() => {
      const card = document.createElement("auri-ager-finance-card");
      const keys = ["direct_saving", "battery_saving", "feed_in_revenue", "grid_import_cost", "fictional_total"];
      const entities = Object.fromEntries(keys.map((key) => [key, `sensor.${key}`]));
      let states = Object.fromEntries(Object.values(entities).map((entity) => [entity, { state: "10" }]));
      card.setConfig({ entities });
      card.hass = { states };
      const updates = [];
      for (const key of keys) {
        const id = key.replaceAll("_", "-");
        const selector = `#${id}-value`;
        const before = card.shadowRoot.querySelector(selector).textContent;
        states = { ...states, [entities[key]]: { state: "20" } };
        card.hass = { states };
        updates.push(before !== card.shadowRoot.querySelector(selector).textContent);
      }
      return { updates, tracked: card.trackedEntities(), expected: Object.values(entities) };
    });
    assert.deepEqual(result.tracked, result.expected);
    assert.deepEqual(result.updates, [true, true, true, true, true]);
  });
});

test("Container forwards current hass through async creation and subsequent updates", async () => {
  await withPage(async (page) => {
    const result = await page.evaluate(async () => {
      class TestChild extends HTMLElement {
        set hass(value) { this.currentHass = value; this.textContent = value.states["sensor.test"].state; }
      }
      customElements.define("hacs-test-child", TestChild);
      let resolveHelpers;
      window.loadCardHelpers = () => new Promise((resolve) => { resolveHelpers = resolve; });
      const card = document.createElement("auri-ager-container-card");
      card.setConfig({ cards: [{}] });
      card.hass = { states: { "sensor.test": { state: "1" } } };
      card.hass = { states: { "sensor.test": { state: "2" } } };
      resolveHelpers({ createCardElement: () => document.createElement("hacs-test-child") });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const child = card.shadowRoot.querySelector("hacs-test-child");
      const initial = child.textContent;
      const next = { states: { "sensor.test": { state: "3" } }, themes: { darkMode: true } };
      card.hass = next;
      return { initial, updated: child.textContent, sameHass: child.currentHass === next };
    });
    assert.equal(result.initial, "2");
    assert.equal(result.updated, "3");
    assert.equal(result.sameHass, true);
  });
});
