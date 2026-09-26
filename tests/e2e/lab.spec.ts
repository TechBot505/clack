import { expect, test } from "@playwright/test";

async function typeWords(page: import("@playwright/test").Page, ms: number, stop: () => Promise<boolean>) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await stop()) return;
    const w = await page.$eval(".tw-word.active", (e) => [...e.children].map((c) => c.textContent).join("")).catch(() => null);
    if (!w) return;
    await page.keyboard.type(w, { delay: 25 });
    if (await stop()) return;
    await page.keyboard.press("Space");
  }
}

test("speed burst runs a countdown and reports windows", async ({ page }) => {
  await page.goto("/burst");
  await page.getByRole("radio", { name: "5s" }).click();
  await page.getByRole("button", { name: /launch/ }).click();
  await page.waitForSelector(".tw-word.active", { timeout: 6000 });
  await typeWords(page, 12_000, async () => !!(await page.$("text=best 5s")));
  await expect(page.getByText("best 1s")).toBeVisible({ timeout: 8000 });
  // a trailing space must not skip the results
  await page.keyboard.press("Space");
  await expect(page.getByText("best 5s")).toBeVisible();
});

test("focus mode free-write finishes with shift+enter", async ({ page }) => {
  await page.goto("/focus");
  await page.waitForTimeout(800);
  await page.keyboard.type("quiet rain on a quiet window ", { delay: 40 });
  await page.keyboard.press("Shift+Enter");
  await expect(page.getByText(/wpm ·/)).toBeVisible();
});

test("type the internet launches a pack", async ({ page }) => {
  await page.goto("/internet");
  await page.getByRole("button", { name: /tongue twisters/ }).click();
  await page.waitForURL("**/type");
  const text = await page.$$eval(".tw-word", (els) => els.map((e) => e.textContent).join(" "));
  expect(text.length).toBeGreaterThan(20);
});

test("adaptive training renders and starts a session", async ({ page }) => {
  await page.goto("/practice");
  await page.getByRole("button", { name: "train now" }).click();
  await page.waitForURL("**/type");
  await expect(page.locator(".tw-word").first()).toBeVisible();
});
