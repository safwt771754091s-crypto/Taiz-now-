import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, roleHasPermission, roleHasAny, ROLES } from "@/lib/rbac";

describe("rbac", () => {
  it("defines permissions for every role", () => {
    for (const role of ROLES) {
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it("gives the owner every capability", () => {
    expect(roleHasPermission("OWNER", "users:manage")).toBe(true);
    expect(roleHasPermission("OWNER", "content:publish")).toBe(true);
    expect(roleHasPermission("OWNER", "audit:view")).toBe(true);
  });

  it("lets viewers only submit reports", () => {
    expect(roleHasPermission("VIEWER", "report:submit")).toBe(true);
    expect(roleHasPermission("VIEWER", "content:publish")).toBe(false);
    expect(roleHasPermission("VIEWER", "users:manage")).toBe(false);
  });

  it("separates media and geo analysts", () => {
    expect(roleHasPermission("MEDIA_ANALYST", "media:analyze")).toBe(true);
    expect(roleHasPermission("MEDIA_ANALYST", "content:publish")).toBe(false);
    expect(roleHasPermission("GEO_ANALYST", "geo:verify")).toBe(true);
    expect(roleHasPermission("GEO_ANALYST", "media:analyze")).toBe(false);
  });

  it("gives fact checkers verification powers", () => {
    expect(roleHasPermission("FACT_CHECKER", "content:verify")).toBe(true);
    expect(roleHasPermission("FACT_CHECKER", "report:triage")).toBe(true);
    expect(roleHasPermission("FACT_CHECKER", "users:manage")).toBe(false);
  });

  it("handles undefined roles safely", () => {
    expect(roleHasPermission(undefined, "report:submit")).toBe(false);
    expect(roleHasAny(undefined, ["report:submit"])).toBe(false);
    expect(roleHasAny("EDITOR", ["users:manage", "content:create"])).toBe(true);
  });
});
