import { describe, expect, it } from "vitest";

import {
  APP_SURVEY_DEFERRAL_DAYS,
  APP_SURVEY_INITIAL_DELAY_DAYS,
  APP_SURVEY_MAX_DEFERRALS,
  calculateAppSurveyTiming,
} from "@/lib/appSurveySchedule";

describe("app satisfaction survey schedule", () => {
  it("does not show before seven days from account creation", () => {
    const createdAt = "2026-09-01T10:00:00.000Z";
    const before = calculateAppSurveyTiming(createdAt, [], Date.parse("2026-09-08T09:59:59.999Z"));
    const atSevenDays = calculateAppSurveyTiming(createdAt, [], Date.parse("2026-09-08T10:00:00.000Z"));

    expect(APP_SURVEY_INITIAL_DELAY_DAYS).toBe(7);
    expect(before.shouldShow).toBe(false);
    expect(atSevenDays.shouldShow).toBe(true);
    expect(atSevenDays.canDefer).toBe(true);
    expect(atSevenDays.deferralCount).toBe(0);
  });

  it("allows a first deferral and waits another seven days", () => {
    const state = calculateAppSurveyTiming(
      "2026-09-01T10:00:00.000Z",
      [{ deferred_at: "2026-09-08T10:00:00.000Z" }],
      Date.parse("2026-09-15T10:00:00.000Z"),
    );

    expect(APP_SURVEY_DEFERRAL_DAYS).toBe(7);
    expect(state.shouldShow).toBe(true);
    expect(state.canDefer).toBe(true);
    expect(state.deferralCount).toBe(1);
    expect(state.nextPromptAt).toBe("2026-09-15T10:00:00.000Z");
  });

  it("allows only two deferrals and makes the third presentation non-deferrable", () => {
    const state = calculateAppSurveyTiming(
      "2026-09-01T10:00:00.000Z",
      [
        { deferred_at: "2026-09-08T10:00:00.000Z" },
        { deferred_at: "2026-09-15T10:00:00.000Z" },
      ],
      Date.parse("2026-09-22T10:00:00.000Z"),
    );

    expect(APP_SURVEY_MAX_DEFERRALS).toBe(2);
    expect(state.shouldShow).toBe(true);
    expect(state.canDefer).toBe(false);
    expect(state.deferralCount).toBe(2);
    expect(state.nextPromptAt).toBe("2026-09-22T10:00:00.000Z");
  });

  it("uses the most recent deferral even if rows arrive out of order", () => {
    const state = calculateAppSurveyTiming(
      "2026-09-01T10:00:00.000Z",
      [
        { deferred_at: "2026-09-15T10:00:00.000Z" },
        { deferred_at: "2026-09-08T10:00:00.000Z" },
      ].reverse(),
      Date.parse("2026-09-21T23:59:59.000Z"),
    );

    expect(state.shouldShow).toBe(false);
    expect(state.nextPromptAt).toBe("2026-09-22T10:00:00.000Z");
  });
});
