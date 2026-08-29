import { expect, test } from "@playwright/test";
import { mockApi, signIn } from "./fixtures";

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
