import { describe, expect, it } from "vitest";
import { parseImplicitAuthCallback } from "@/lib/authCallback";

describe("parseImplicitAuthCallback", () => {
  it("recognizes a Supabase signup confirmation callback", () => {
    expect(
      parseImplicitAuthCallback("#access_token=access-1&refresh_token=refresh-1&type=signup"),
    ).toEqual({
      kind: "account-confirmation",
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
  });

  it("recognizes confirmation callbacks identified as email", () => {
    expect(
      parseImplicitAuthCallback("#access_token=access-2&refresh_token=refresh-2&type=email"),
    ).toEqual({
      kind: "account-confirmation",
      accessToken: "access-2",
      refreshToken: "refresh-2",
    });
  });

  it("keeps password recovery callbacks separate", () => {
    expect(
      parseImplicitAuthCallback("#access_token=access-3&refresh_token=refresh-3&type=recovery"),
    ).toEqual({
      kind: "recovery",
      accessToken: "access-3",
      refreshToken: "refresh-3",
    });
  });

  it("ignores normal HashRouter routes and incomplete auth fragments", () => {
    expect(parseImplicitAuthCallback("#/definicoes")).toBeNull();
    expect(parseImplicitAuthCallback("#access_token=access-only&type=signup")).toBeNull();
  });
});
