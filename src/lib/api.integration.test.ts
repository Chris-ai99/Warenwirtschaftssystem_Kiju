import { describe, expect, it } from "vitest";

const runIntegration = process.env.RUN_INTEGRATION === "true";

describe.skipIf(!runIntegration)("integration environment", () => {
  it("is enabled only when RUN_INTEGRATION=true", () => {
    expect(process.env.DATABASE_URL).toBeTruthy();
  });
});

describe.skipIf(runIntegration)("integration environment skipped", () => {
  it("documents how to enable database-backed tests", () => {
    expect(runIntegration).toBe(false);
  });
});
