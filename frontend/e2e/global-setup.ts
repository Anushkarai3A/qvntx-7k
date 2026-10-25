import { request } from "@playwright/test";

export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080";
  const context = await request.newContext({ baseURL });
  const response = await context.get("/api/overview?mode=horizon&horizon_hours=24", {
    timeout: 60_000,
  });
  await context.dispose();

  if (!response.ok()) {
    throw new Error(
      `WindSight API warm-up failed with HTTP ${response.status()}. Start the Docker stack first.`,
    );
  }
}
