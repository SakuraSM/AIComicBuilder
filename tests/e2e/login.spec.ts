import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("private deployment login renders an accessible form", async ({ page }) => {
  await page.goto("/en/login");

  await expect(page.getByRole("heading", { name: "AIComicBuilder" })).toBeVisible();
  await expect(page.getByLabel("Email or username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();

  const accessibilityResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blockingViolations = accessibilityResults.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blockingViolations).toEqual([]);
});
