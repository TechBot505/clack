import { expect, test } from "@playwright/test";

for (const path of ["/", "/type", "/stats", "/history", "/records", "/settings", "/practice", "/daily", "/profile"]) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
