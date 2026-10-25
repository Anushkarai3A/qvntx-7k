import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const MATCHED_24H = "1,488 matched observations";

test("homepage loads at root with hero, preview, and features", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /See the wind/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the data" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What you can explore" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Forecasts, measured against reality." })).toBeVisible();

  // Wordmark does not contain an icon and links to /
  const wordmark = page.getByRole("link", { name: "WindSight UK home" });
  await expect(wordmark).toBeVisible();
  await expect(wordmark).toContainText("WindSight UK");
  await expect(wordmark).toContainText("WIND GENERATION OBSERVATORY");
  await expect(wordmark.locator("svg")).toHaveCount(0);

  // Click CTA to navigate to /dashboard
  await page.getByRole("link", { name: "Explore the dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Wind forecast overview" })).toBeVisible();
});

test("wordmark navigates back to homepage from dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Wind forecast overview" })).toBeVisible();

  await page.getByRole("link", { name: "WindSight UK home" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: /See the wind/i })).toBeVisible();
});

test("overview renders real production data and charts on /dashboard", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Wind forecast overview" })).toBeVisible();
  await expect(page.getByText(MATCHED_24H).first()).toBeVisible();
  await expect(page.getByText("No look-ahead beyond cutoff")).toBeVisible();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
});

test("all analysis routes render without a load error", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText(MATCHED_24H).first()).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Primary navigation" });

  await nav.getByRole("link", { name: "Forecast accuracy" }).click();
  await expect(page.getByRole("heading", { name: "Forecast accuracy" })).toBeVisible();
  await expect(page.getByText("1,488 matched observations").first()).toBeVisible();

  await nav.getByRole("link", { name: "Forecast evolution" }).click();
  await expect(page.getByRole("heading", { name: "Forecast evolution" })).toBeVisible();
  await expect(page.getByText("Forecast versions").first()).toBeVisible();
  await expect(page.getByText("Selected forecast").first()).toBeVisible();

  await nav.getByRole("link", { name: "Data explorer" }).click();
  await expect(page.getByRole("heading", { name: "Data explorer" })).toBeVisible();
  await expect(page.getByText("1,488 of 1,488 records shown.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to load data" })).toHaveCount(0);
});

test("72h horizon shows null metrics and the Evolution empty state", async ({ page }) => {
  await page.goto("/accuracy");
  await expect(page.getByRole("heading", { name: "Forecast accuracy" })).toBeVisible();

  await page.getByRole("button", { name: "72h", exact: true }).click();
  await expect(page.getByText("0 matched observations").first()).toBeVisible();
  await expect(page.getByText("Partial coverage").first()).toBeVisible();
  await expect(page.getByText("Unavailable").first()).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("link", { name: "Forecast evolution" }).click();
  await expect(
    page.getByRole("heading", { name: "No eligible interval for this horizon" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to load data" })).toHaveCount(0);
});

test("explorer filters records and downloads the complete filtered CSV", async ({ page }) => {
  await page.goto("/explorer");
  await expect(page.getByRole("heading", { name: "Data explorer" })).toBeVisible();

  await page.getByLabel("Availability").selectOption("matched");
  await expect(page.getByText("1,488 of 1,488 records shown.")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export filtered CSV" }).click(),
  ]);

  const path = await download.path();
  expect(path).not.toBeNull();
  const csv = readFileSync(path!, "utf8");
  const lines = csv.split("\r\n");

  expect(download.suggestedFilename()).toMatch(
    /^windsight-records-2026-01-01-to-2026-01-31-24h\.csv$/,
  );
  expect(lines).toHaveLength(1 + 1_488);
  expect(lines[0]).toContain("Delivery timestamp (UTC)");
  expect(lines[0]).toContain("Forecast valid hour (UTC)");
  expect(lines[0]).toContain("Availability");
  expect(lines[1]).toContain("Matched");
});

test("latest mode warns that post-delivery publications are included", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText(MATCHED_24H).first()).toBeVisible();

  await page.getByLabel("Selection mode").selectOption("latest");
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  await expect(
    page.getByText("Latest-available mode can include post-delivery publications"),
  ).toBeVisible();
  await page.getByText("2 data notices").click();
  await expect(page.getByText(/selected forecasts were published after their delivery/)).toBeVisible();
});

test("API failure shows a retryable error and recovers", async ({ page }) => {
  let failedOnce = false;
  await page.route("**/api/overview*", async (route) => {
    if (!failedOnce) {
      failedOnce = true;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "data_unavailable", detail: "Synthetic outage" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Unable to load data" })).toBeVisible();
  await expect(page.getByText("Synthetic outage")).toBeVisible();

  await page.getByRole("button", { name: "Retry" }).click();

  await expect(page.getByRole("heading", { name: "Unable to load data" })).toHaveCount(0);
  await expect(page.getByText(MATCHED_24H).first()).toBeVisible();
});
