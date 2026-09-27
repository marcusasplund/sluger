import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1728, height: 1117 },
  deviceScaleFactor: 2,
});
await page.goto("http://127.0.0.1:5173/?test");
await page.locator("#loading").waitFor({ state: "hidden" });
await page.getByRole("button", { name: "Into the garden" }).click();
await page.keyboard.press("Escape");
await page.evaluate(() => (document.getElementById("result").hidden = true));
const results = [];
for (const [name, flags] of [
  ["balanced", {}],
  ["bloom enabled", { bloom: true }],
  ["no shadows", { bloom: false, shadows: false }],
  ["no grass", { shadows: true, grass: false }],
  ["DPR 1", { grass: true, ratio: 1 }],
  ["DPR 1.5", { ratio: 1.5 }],
]) {
  await page.evaluate((flags) => window.__sluger.profile(flags), flags);
  await page.waitForTimeout(1500);
  const result = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let start = performance.now(),
          last = start;
        const times = [];
        function frame(now) {
          times.push(now - last);
          last = now;
          if (now - start > 3000) {
            times.sort((a, b) => a - b);
            resolve({
              fps: Math.round((times.length * 1000) / (now - start)),
              p95: times[Math.floor(times.length * 0.95)],
              ...window.__sluger.state(),
            });
          } else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }),
  );
  results.push({ name, ...result });
  console.log(JSON.stringify({ name, ...result }));
}
await browser.close();
