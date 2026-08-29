import { expect, test } from "@playwright/test";
import { DEVICE, mockApi, PHONE, signIn } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await mockApi(page);
});

test.describe("auth", () => {
  test("a refresh does not bounce through /login", async ({ page }) => {
    // The regression this suite exists for: the guard read a server-snapshot
    // false during hydration and redirected, and the login page sent the user
    // straight back. Visible as a flash; invisible to a unit test.
    const seen: string[] = [];
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) seen.push(new URL(f.url()).pathname);
    });

    await page.goto("/overview");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Xush kelibsiz");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Xush kelibsiz");

    expect(seen, `navigations: ${seen.join(" -> ")}`).not.toContain("/login");
  });

  test("a visitor with no token is sent to /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("navigation", () => {
  test("switching pages keeps the shell mounted", async ({ page }) => {
    // AppShell used to live inside each page, so navigating rebuilt the
    // sidebar and replayed its entry animation on every click.
    await page.goto("/overview");
    const sidebar = page.locator(".sidebar");
    await expect(sidebar).toBeVisible();

    // Tag the live node; if the shell remounts, the tag is lost.
    await sidebar.evaluate((el) => el.setAttribute("data-e2e-mounted", "1"));
    await page.getByRole("link", { name: "Qurilmalar" }).click();
    await expect(page).toHaveURL(/\/devices$/);

    await expect(page.locator(".sidebar")).toHaveAttribute("data-e2e-mounted", "1");
  });
});

test.describe("theme", () => {
  test("dark mode survives a reload", async ({ page }) => {
    await page.goto("/overview");
    await page.getByRole("button", { name: /Tungi rejimga/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("modal", () => {
  test("Escape closes it and focus returns to the trigger", async ({ page }) => {
    await page.goto("/devices");
    const trigger = page.getByRole("button", { name: /Qurilma qo'shish/ }).first();
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("Tab stays inside the dialog", async ({ page }) => {
    await page.goto("/devices");
    await page.getByRole("button", { name: /Qurilma qo'shish/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() =>
        !!document.activeElement?.closest('[role="dialog"]'),
      );
      expect(inside, `focus escaped the dialog after ${i + 1} tabs`).toBe(true);
    }
  });
});

test.describe("lists", () => {
  test("alerts paginate at 10 per page", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.locator("article")).toHaveCount(10);
    await expect(page.getByText("1 / 2")).toBeVisible();

    await page.getByRole("button", { name: /Keyingi/ }).click();
    await expect(page.locator("article")).toHaveCount(4);
    await expect(page.getByRole("button", { name: /Keyingi/ })).toBeDisabled();
  });
});

test.describe("resilience", () => {
  test("a failing endpoint shows an error, not a blank page", async ({ page }) => {
    await page.route("**/api/tracking/summary/**", (r) =>
      r.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"Server xatosi"}' }),
    );
    await page.goto("/activity");
    // The page must still render its shell and tabs rather than dying.
    await expect(page.getByRole("button", { name: /Ekran vaqti/ })).toBeVisible();
  });
});

test.describe("multiple devices per child", () => {
  test("both devices are listed and neither replaces the other", async ({ page }) => {
    await mockApi(page, { "/api/devices/": [DEVICE, PHONE] });
    await page.goto("/devices");

    const rows = page.locator(".device-table tbody tr");
    await expect(rows).toHaveCount(2);
    // Named by platform, not by the child — otherwise both rows read "Alijon".
    await expect(rows.nth(0)).toContainText("Windows");
    await expect(rows.nth(1)).toContainText("Android");
  });

  test("activity asks which device instead of inventing a total", async ({ page }) => {
    // Summing two devices would double-count any hour the child spent on
    // both, so "all devices" must not produce a screen-time number.
    await mockApi(page, { "/api/devices/": [DEVICE, PHONE] });
    await page.goto("/activity");

    await expect(page.getByText(/Qaysi qurilmani ko'rmoqchisiz/)).toBeVisible();
    await expect(page.getByText("2 soat 41 min")).toHaveCount(0);
  });

  test("choosing a device scopes the page and survives a reload", async ({ page }) => {
    await mockApi(page, { "/api/devices/": [DEVICE, PHONE] });
    await page.goto("/activity");

    await page.getByRole("button", { name: "Android" }).click();
    await expect(page).toHaveURL(/device=d2/);
    await expect(page.getByText(/Qaysi qurilmani ko'rmoqchisiz/)).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("button", { name: "Android" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the selector is hidden when there is only one device", async ({ page }) => {
    await mockApi(page);
    await page.goto("/activity");
    await expect(page.locator(".device-selector")).toHaveCount(0);
    // ...and the single device is used directly, with no prompt.
    await expect(page.getByText(/Qaysi qurilmani ko'rmoqchisiz/)).toHaveCount(0);
  });
});

test.describe("web sites tab", () => {
  test("shows the selected device's sites, not a pooled list", async ({ page }) => {
    await mockApi(page, { "/api/devices/": [DEVICE, PHONE] });
    await page.goto("/activity?device=d1");
    await page.getByRole("button", { name: "Web-saytlar" }).click();

    await expect(page.getByText("youtube.com")).toBeVisible();
    await expect(page.getByText("instagram.com")).toHaveCount(0);

    await page.getByRole("button", { name: "Android" }).click();
    await expect(page.getByText("instagram.com")).toBeVisible();
    // The laptop's browsing must disappear rather than accumulate.
    await expect(page.getByText("youtube.com")).toHaveCount(0);
  });

  test("asks which device instead of pooling browsing", async ({ page }) => {
    await mockApi(page, { "/api/devices/": [DEVICE, PHONE] });
    await page.goto("/activity");
    await page.getByRole("button", { name: "Web-saytlar" }).click();

    await expect(page.getByText(/Qaysi qurilmani ko'rmoqchisiz/)).toBeVisible();
    await expect(page.getByText("youtube.com")).toHaveCount(0);
  });

  test("an empty result reads as empty, not as a missing feature", async ({ page }) => {
    await mockApi(page, {
      "/api/tracking/sites/": { device_id: "d1", date: "2026-08-29", total_minutes: 0, results: [], count: 0 },
    });
    await page.goto("/activity");
    await page.getByRole("button", { name: "Web-saytlar" }).click();

    await expect(page.getByText(/sayt tashrifi qayd etilmagan/)).toBeVisible();
  });
});

test.describe("activity layout", () => {
  test("one period control serves the whole section", async ({ page }) => {
    await page.goto("/activity");

    // The bug this locks down: the period used to be a dropdown inside the
    // chart card, a day stepper inside the timeline and a chip row inside
    // the sites card — three shapes for one idea. There is now exactly one.
    await expect(page.locator(".range-switch")).toHaveCount(1);
    await expect(page.locator(".day-nav")).toHaveCount(0);

    await page.getByRole("button", { name: "Web-saytlar" }).click();
    await expect(page.locator(".range-switch")).toHaveCount(1);

    // The history tab is a single day, so the same slot becomes a stepper.
    await page.getByRole("button", { name: "Faoliyat tarixi" }).click();
    await expect(page.locator(".range-switch")).toHaveCount(0);
    await expect(page.locator(".day-nav")).toHaveCount(1);
  });

  test("the apps list sits under the chart and states its period", async ({ page }) => {
    await page.goto("/activity");

    // No longer a tab of its own.
    await expect(page.getByRole("button", { name: "Ilovalar" })).toHaveCount(0);

    const apps = page.locator(".card", { hasText: "Ilovalar bo'yicha foydalanish" });
    await expect(apps).toBeVisible();
    // Minutes here are a 7-day total; unlabelled they read as today's.
    await expect(apps).toContainText("7 kun");
    await expect(apps).toContainText("Google Chrome");

    await page.getByRole("button", { name: "30 kun" }).click();
    await expect(apps).toContainText("30 kun");
    await expect(page.getByRole("heading", { name: /30 kunlik ekran vaqti/ })).toBeVisible();
  });
});

