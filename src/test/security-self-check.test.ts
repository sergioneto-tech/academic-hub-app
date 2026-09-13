import { describe, expect, it } from "vitest";
import {
  hasFixableSecurityIssue,
  securityOverallStatus,
  type SecuritySelfCheckResult,
} from "@/lib/securitySelfCheck";

function check(overrides: Partial<SecuritySelfCheckResult>): SecuritySelfCheckResult {
  return {
    id: "secure-context",
    label: "Teste",
    status: "pass",
    detail: "ok",
    critical: true,
    ...overrides,
  };
}

describe("security self-check summary", () => {
  it("keeps the global state green when only a complementary recommendation exists", () => {
    const results = [
      check({ status: "pass", critical: true }),
      check({ id: "security-alerts", status: "warning", critical: false }),
    ];
    expect(securityOverallStatus(results)).toBe("pass");
  });

  it("returns warning when an essential check cannot be confirmed", () => {
    expect(securityOverallStatus([check({ status: "warning", critical: true })])).toBe("warning");
  });

  it("returns fail when an essential check fails", () => {
    expect(securityOverallStatus([check({ status: "fail", critical: true })])).toBe("fail");
  });

  it("only offers repair when a non-passing result is explicitly fixable", () => {
    expect(hasFixableSecurityIssue([check({ status: "warning", fixable: true })])).toBe(true);
    expect(hasFixableSecurityIssue([check({ status: "warning", fixable: false })])).toBe(false);
  });
});
