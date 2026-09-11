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
    expect(registerUpdateStartup("1.5.7", "https://example.test/#/")).toBe("normal");
    expect(localStorage.getItem(UPDATE_COMPLETED_VERSION_KEY)).toBeNull();
    expect(shouldShowCompletedRelease("1.5.7")).toBe(false);
  });

  it("does not treat a restart query without a target version as success", () => {
    expect(registerUpdateStartup("1.5.7", "https://example.test/?ah_update=123#/")).toBe("normal");
    expect(localStorage.getItem(UPDATE_COMPLETED_VERSION_KEY)).toBeNull();
  });

  it("requests repair when the updater restarts in the wrong version", () => {
    markUpdateTarget("1.5.7");
    expect(registerUpdateStartup("1.5.6", "https://example.test/?ah_update=123#/")).toBe("repair-needed");
    expect(localStorage.getItem(UPDATE_TARGET_VERSION_KEY)).toBe("1.5.7");
    expect(localStorage.getItem(UPDATE_COMPLETED_VERSION_KEY)).toBeNull();
  });

  it("recognises a matching target version after restart", () => {
    markUpdateTarget("1.5.7");
    expect(localStorage.getItem(UPDATE_TARGET_VERSION_KEY)).toBe("1.5.7");
    expect(registerUpdateStartup("1.5.7", "https://example.test/?ah_update=123#/")).toBe("completed");
    expect(localStorage.getItem(UPDATE_TARGET_VERSION_KEY)).toBeNull();
    expect(shouldShowCompletedRelease("1.5.7")).toBe(true);
  });

  it("also recognises a matching target after a repair reload", () => {
    markUpdateTarget("1.5.7");
    expect(registerUpdateStartup("1.5.7", "https://example.test/?ah_repair=123#/")).toBe("completed");
    expect(shouldShowCompletedRelease("1.5.7")).toBe(true);
  });

  it("stops showing release notes after they are acknowledged on this device", () => {
    markUpdateTarget("1.5.7");
    registerUpdateStartup("1.5.7", "https://example.test/?ah_update=123#/");
    markCompletedReleaseSeen("1.5.7");
    expect(localStorage.getItem(LOCAL_LAST_SEEN_VERSION_KEY)).toBe("1.5.7");
    expect(localStorage.getItem(UPDATE_COMPLETED_VERSION_KEY)).toBeNull();
    expect(shouldShowCompletedRelease("1.5.7")).toBe(false);
  });
});
