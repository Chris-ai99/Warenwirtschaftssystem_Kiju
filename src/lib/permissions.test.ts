import { describe, expect, it } from "vitest";
import { RoleCode } from "@/generated/prisma/enums";
import { hasPermission } from "./permissions";

describe("role permissions", () => {
  it("allows admins to manage users and settings", () => {
    expect(hasPermission(RoleCode.ADMIN, "user:write")).toBe(true);
    expect(hasPermission(RoleCode.ADMIN, "settings:write")).toBe(true);
  });

  it("keeps employees away from price and user administration", () => {
    expect(hasPermission(RoleCode.MITARBEITER, "stock:book")).toBe(true);
    expect(hasPermission(RoleCode.MITARBEITER, "price:write")).toBe(false);
    expect(hasPermission(RoleCode.MITARBEITER, "user:write")).toBe(false);
  });
});
