import { expect, Page, test } from "@playwright/test";
import { mockApi, NOW, signIn } from "./fixtures";

/**
 * Visual baselines for the CSS work.
 *
 * The functional suite proves flows still work; it cannot see that a card
 * turned grey or a button grew a border. Both regressions this session were
 * exactly that shape, so splitting a 7,900-line stylesheet without these
 * would be flying blind.
 *
 * Update deliberately after an intended design change:
 *   npx playwright test e2e/visual.spec.ts --update-snapshots
 */

const PAGES = [
  { path: "/overview", name: "overview" },
  { path: "/devices", name: "devices" },
  { path: "/activity", name: "activity" },
  { path: "/alerts", name: "alerts" },
  { path: "/rules", name: "rules" },
  // Device detail owns a cluster of classes nothing else uses (edit mode,
  // sync card, info grid); without it here, deleting dead CSS is guesswork.
  { path: "/devices/d1", name: "device-detail" },
];

/** Freeze anything that would differ between runs and produce false diffs. */
async function stabilise(page: Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }`,
  });
  await page.waitForLoadState("networkidle");
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      // Freeze the clock: pages render relative times ("2 daqiqa oldin") from
      // the real now, so without this a baseline decays into a failure just by
      // sitting there.
      await page.clock.setFixedTime(NOW);
      await signIn(page);
      await mockApi(page);
      await page.addInitScript((t) => localStorage.setItem("chaqimchi_theme", t), theme);
    });

    for (const { path, name } of PAGES) {
      test(`${name} renders as expected`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(path);
        await stabilise(page);
        await expect(page).toHaveScreenshot(`${name}-${theme}.png`, {
          fullPage: true,
          // An absolute count, not a ratio: on a tall fullPage shot a real
          // change (four card corners re-rounded ~= 1300px) still lands under
          // any sane ratio, so a ratio threshold silently passes it. 100px
          // tolerates antialiasing and nothing more.
          maxDiffPixels: 100,
          // Playwright's default per-pixel threshold is 0.2 (YIQ). On a
          // pastel, 62%-opacity glass design that is loose enough to miss a
          // whole card changing colour — measured: white -> pink passed. 0.05
          // still absorbs antialiasing but sees a real repaint.
          threshold: 0.05,
        });
      });
    }

    test("login renders as expected", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript(() => localStorage.removeItem("chaqimchi_access_token"));
      await page.goto("/login");
      await stabilise(page);
      await expect(page).toHaveScreenshot(`login-${theme}.png`, {
        fullPage: true,
        maxDiffPixels: 100,
        threshold: 0.05,
      });
    });

    // Merging duplicate rules touches hover/active state that a static page
    // screenshot never exercises — .menu-item:hover alone was declared ten
    // times, with four competing transforms.
    test("sidebar hover and active state render as expected", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/overview");
      // Hover first, then kill transitions: under parallel workers the
      // screenshot could otherwise land on an in-between frame and the test
      // flaked. Disabling transitions while already hovered pins the end state.
      await page.getByRole("link", { name: "Qurilmalar" }).hover();
      await stabilise(page);
      await expect(page.locator(".sidebar")).toHaveScreenshot(`sidebar-hover-${theme}.png`, {
        maxDiffPixels: 100,
        threshold: 0.05,
      });
    });

    test("child dropdown renders as expected", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/overview");
      await page.getByRole("button", { name: /Farzand:/ }).click();
      await stabilise(page);
      await expect(page.locator(".child-dropdown")).toHaveScreenshot(`child-dropdown-${theme}.png`, {
        maxDiffPixels: 100,
        threshold: 0.05,
      });
    });

    test("device link modal renders as expected", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/devices");
      await page.getByRole("button", { name: /Qurilma qo'shish/ }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await stabilise(page);
      await expect(page.getByRole("dialog")).toHaveScreenshot(`modal-${theme}.png`, {
        maxDiffPixels: 100,
        threshold: 0.05,
      });
    });
  });
}
