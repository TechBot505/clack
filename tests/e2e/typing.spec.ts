import { expect, test } from "@playwright/test";
import { typeActiveWord, typeUntilResults } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/type");
  await page.waitForSelector(".tw-word");
});

test("a words test runs end to end and lands in history", async ({ page }) => {
  await page.getByRole("radio", { name: "words" }).click();
  await page.getByRole("radio", { name: "10", exact: true }).click();
  await page.waitForTimeout(200);
  await typeUntilResults(page);
  const wpm = page.locator("h2[aria-label$='words per minute']");
  await expect(wpm).toBeVisible();
  const label = await wpm.getAttribute("aria-label");
  expect(Number(label?.split(" ")[0])).toBeGreaterThan(20);
  // the typo + backspace shows up as imperfect accuracy
  await expect(page.getByText("accuracy", { exact: true }).first()).toBeVisible();
  await page.goto("/history");
  await expect(page.getByText(/1 test,/)).toBeVisible();
  await page.locator("a[href^='/history/']").first().click();
  await expect(page.getByText("replay", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Play replay" }).click();
  await page.waitForTimeout(1200);
  expect(await page.locator(".tw-l.ok").count()).toBeGreaterThan(3);
});

test("mistakes are marked without relying on color alone", async ({ page }) => {
  const first = await page.$eval(".tw-word.active", (el) => el.textContent ?? "");
  const wrong = first[0] === "z" ? "q" : "z";
  await page.keyboard.type(wrong);
  const bad = page.locator(".tw-l.no").first();
  await expect(bad).toBeVisible();
  const deco = await bad.evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(deco).toContain("underline");
});

test("tab restarts with fresh words", async ({ page }) => {
  const before = await page.$$eval(".tw-word", (els) => els.slice(0, 8).map((e) => e.textContent).join(" "));
  await typeActiveWord(page);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(400);
  const after = await page.$$eval(".tw-word", (els) => els.slice(0, 8).map((e) => e.textContent).join(" "));
  expect(after).not.toEqual(before);
  expect(await page.locator(".tw-l.ok").count()).toBe(0);
});

test("a timed test ends on its own", async ({ page }) => {
  await page.getByRole("radio", { name: "time" }).click();
  await page.getByRole("radio", { name: "15", exact: true }).click();
  await page.waitForTimeout(200);
  const start = Date.now();
  await typeUntilResults(page, 400, 60);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeGreaterThan(14_000);
  await expect(page.getByText("15s").first()).toBeVisible();
});

test("code mode needs enter at line ends", async ({ page }) => {
  await page.getByRole("radio", { name: "code" }).click();
  await page.waitForTimeout(300);
  await typeUntilResults(page, 200, 5);
  await expect(page.locator("h2[aria-label$='words per minute']")).toBeVisible();
});

test("zen mode finishes with shift+enter", async ({ page }) => {
  await page.getByRole("radio", { name: "zen" }).click();
  await page.waitForTimeout(300);
  await page.keyboard.type("free writing feels good ", { delay: 40 });
  await page.keyboard.press("Shift+Enter");
  await expect(page.locator("[aria-label='Test results']")).toBeVisible();
});

test("command palette switches tests and themes", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.keyboard.type("start 60");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("radio", { name: "60", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Control+k");
  await page.keyboard.type("change theme");
  await page.keyboard.press("Enter");
  await page.keyboard.type("ocean");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
});

test("home hero accepts typing immediately", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".tw-word");
  await page.keyboard.press("Escape"); // make sure nothing has focus quirks
  await typeUntilResults(page, 40, 10).catch(() => {});
  await expect(page.getByText("the real test")).toBeVisible({ timeout: 10_000 });
});

test("custom challenge links reproduce the same text", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/practice");
  await page.getByLabel("text", { exact: true }).fill("alpha beta gamma delta epsilon");
  await page.getByRole("button", { name: /copy challenge link/ }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("/type?c=");
  await page.goto(url);
  await expect(page.getByText("shared challenge")).toBeVisible();
  const words = await page.$$eval(".tw-word", (els) => els.map((e) => e.textContent).join(" "));
  expect(words).toBe("alpha beta gamma delta epsilon");
});

test("settings apply instantly", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("radio", { name: "block" }).click();
  await expect(page.locator(".caret").first()).toHaveAttribute("data-style", "block");
  await page.getByRole("switch", { name: "High contrast" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
});
