import { describe, expect, it } from "vitest";
import { ADMIN_ROLE, EMPLOYEE_ROLE, hasPermission } from "./permissions";

describe("role permissions", () => {
  it("allows admins to manage users and settings", () => {
    expect(hasPermission(ADMIN_ROLE, "user:write")).toBe(true);
    expect(hasPermission(ADMIN_ROLE, "settings:write")).toBe(true);
  });

  it("keeps employees away from price and user administration", () => {
    expect(hasPermission(EMPLOYEE_ROLE, "stock:book")).toBe(true);
    expect(hasPermission(EMPLOYEE_ROLE, "price:write")).toBe(false);
    expect(hasPermission(EMPLOYEE_ROLE, "user:write")).toBe(false);
  });

  it("honors deliberately empty database permission sets", () => {
    expect(hasPermission({ role: ADMIN_ROLE, permissions: [] }, "settings:write")).toBe(false);
    expect(hasPermission({ role: EMPLOYEE_ROLE, permissions: [] }, "stock:book")).toBe(false);
  });
});
