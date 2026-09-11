import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cloudMocks = vi.hoisted(() => ({
  getStoredSession: vi.fn(),
  refreshSession: vi.fn(),
  storeSession: vi.fn(),
}));

vi.mock("@/lib/cloudSync", () => ({
  getStoredSession: cloudMocks.getStoredSession,
  refreshSession: cloudMocks.refreshSession,
  storeSession: cloudMocks.storeSession,
}));

vi.mock("@/lib/feedbackBeta", () => ({ FEEDBACK_BETA_MANAGER_USER_ID: "manager" }));
vi.mock("@/lib/version", () => ({ APP_VERSION: "test-version" }));

import { getCurrentSurveyState } from "@/lib/appSurvey";

type Fixtures = {
  responses?: Array<{ survey_id: string }>;
  deferrals?: Array<{ deferral_no: number; deferred_at: string }>;
};

function mockSession(createdAt: string) {
  cloudMocks.getStoredSession.mockReturnValue({
    access_token: "test",
    refresh_token: "test",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "test-user", created_at: createdAt },
  });
}

function mockApi(fixtures: Fixtures = {}) {
  const responses = fixtures.responses ?? [];
  const deferrals = fixtures.deferrals ?? [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("app_survey_responses")) {
      return new Response(JSON.stringify(responses), { status: 200 });
    }
    if (url.includes("app_survey_deferrals")) {
      return new Response(JSON.stringify(deferrals), { status: 200 });
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
}

describe("live app survey state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.invalid");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test");
    localStorage.clear();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    cloudMocks.getStoredSession.mockReset();
    cloudMocks.refreshSession.mockReset();
    cloudMocks.storeSession.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("does not show during the first seven days", async () => {
    vi.setSystemTime(new Date("2026-09-08T09:59:59.999Z"));
    mockSession("2026-09-01T10:00:00.000Z");
    mockApi();
    const state = await getCurrentSurveyState();
    expect(state.shouldShow).toBe(false);
    expect(state.deferralCount).toBe(0);
    expect(state.canDefer).toBe(true);
  });

  it("shows at seven days and allows the first deferral", async () => {
    vi.setSystemTime(new Date("2026-09-08T10:00:00.000Z"));
    mockSession("2026-09-01T10:00:00.000Z");
    mockApi();
    const state = await getCurrentSurveyState();
    expect(state.shouldShow).toBe(true);
    expect(state.canDefer).toBe(true);
    expect(state.deferralCount).toBe(0);
  });

  it("shows seven days after the first deferral and allows the second", async () => {
    vi.setSystemTime(new Date("2026-09-15T10:00:00.000Z"));
    mockSession("2026-09-01T10:00:00.000Z");
    mockApi({ deferrals: [{ deferral_no: 1, deferred_at: "2026-09-08T10:00:00.000Z" }] });
    const state = await getCurrentSurveyState();
    expect(state.shouldShow).toBe(true);
    expect(state.canDefer).toBe(true);
    expect(state.deferralCount).toBe(1);
  });

  it("makes the third presentation non-deferrable", async () => {
    vi.setSystemTime(new Date("2026-09-22T10:00:00.000Z"));
    mockSession("2026-09-01T10:00:00.000Z");
    mockApi({ deferrals: [
      { deferral_no: 2, deferred_at: "2026-09-15T10:00:00.000Z" },
      { deferral_no: 1, deferred_at: "2026-09-08T10:00:00.000Z" },
    ] });
    const state = await getCurrentSurveyState();
    expect(state.shouldShow).toBe(true);
    expect(state.canDefer).toBe(false);
    expect(state.deferralCount).toBe(2);
  });

  it("does not show after a response exists", async () => {
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
    mockSession("2026-09-01T10:00:00.000Z");
    mockApi({ responses: [{ survey_id: "satisfaction-2026-09" }] });
    const state = await getCurrentSurveyState();
    expect(state.answered).toBe(true);
    expect(state.shouldShow).toBe(false);
    expect(state.canDefer).toBe(false);
  });
});
