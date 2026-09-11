import { beforeEach, describe, expect, it } from "vitest";
import {
  LOCAL_LAST_SEEN_VERSION_KEY,
  UPDATE_COMPLETED_VERSION_KEY,
  UPDATE_TARGET_VERSION_KEY,
  markCompletedReleaseSeen,
  markUpdateTarget,
  registerUpdateStartup,
  shouldShowCompletedRelease,
} from "@/lib/updateLifecycle";

describe("update lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not mark a normal startup as a completed update", () => {
    expect(registerUpdateStartup("1.5.7", "https://example.test/#/")).toBe(false);
    expect(localStorage.getItem(UPDATE_COMPLETED_VERSION_KEY)).toBeNull();
    expect(shouldShowCompletedRelease("1.5.7")).toBe(false);
  });

  it("recognises the updater restart query as an explicit completion", () => {
    expect(registerUpdateStartup("1.5.7", "https://example.test/?ah_update=123#/")) .toBe(true);
    expect(localStorage.getItem(UPDATE_COMPLETED_VERSION_KEY)).toBe("1.5.7");
    expect(shouldShowCompletedRelease("1.5.7")).toBe(true);
  });

  it("recognises a matching target version after restart", () => {
    markUpdateTarget("1.5.7");
    expect(localStorage.getItem(UPDATE_TARGET_VERSION_KEY)).toBe("1.5.7");
    expect(registerUpdateStartup("1.5.7", "https://example.test/#/")).toBe(true);
    expect(localStorage.getItem(UPDATE_TARGET_VERSION_KEY)).toBeNull();
    expect(shouldShowCompletedRelease("1.5.7")).toBe(true);
  });

  it("stops showing release notes after they are acknowledged on this device", () => {
    registerUpdateStartup("1.5.7", "https://example.test/?ah_update=123#/");
    markCompletedReleaseSeen("1.5.7");
    expect(localStorage.getItem(LOCAL_LAST_SEEN_VERSION_KEY)).toBe("1.5.7");
    expect(localStorage.getItem(UPDATE_COMPLETED_VERSION_KEY)).toBeNull();
    expect(shouldShowCompletedRelease("1.5.7")).toBe(false);
  });
});
