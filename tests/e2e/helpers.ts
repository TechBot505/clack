import type { Page } from "@playwright/test";

/** Type the currently active word (correctly) and its separator. Returns false when done. */
export async function typeActiveWord(page: Page, opts: { delay?: number; typo?: boolean } = {}): Promise<boolean> {
  const info = await page
    .$eval(".tw-word.active", (el) => {
      const text = [...el.children].filter((c) => !c.classList.contains("x")).map((c) => c.textContent).join("");
      const typed = [...el.children].filter((c) => c.classList.contains("ok")).length;
      const next = el.nextElementSibling;
      return { text, typed, newline: !!next?.classList.contains("tw-break") };
    })
    .catch(() => null);
  if (!info) return false;
  if (opts.typo) {
    await page.keyboard.type("#");
    await page.keyboard.press("Backspace");
  }
  for (const ch of info.text.slice(info.typed)) {
    await page.keyboard.type(ch);
    if (opts.delay) await page.waitForTimeout(opts.delay);
  }
  if (await page.$("[aria-label='Test results']")) return false;
  await page.keyboard.press(info.newline ? "Enter" : "Space");
  return true;
}

export async function typeUntilResults(page: Page, maxWords = 400, delay = 25) {
  for (let i = 0; i < maxWords; i++) {
    if (await page.$("[aria-label='Test results']")) return;
    const more = await typeActiveWord(page, { delay, typo: i === 2 });
    if (!more) break;
  }
  await page.waitForSelector("[aria-label='Test results']", { timeout: 40_000 });
}
