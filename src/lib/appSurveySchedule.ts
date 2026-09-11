export const APP_SURVEY_INITIAL_DELAY_DAYS = 7;
export const APP_SURVEY_DEFERRAL_DAYS = 7;
export const APP_SURVEY_MAX_DEFERRALS = 2;

export type SurveyDeferralTimestamp = {
  deferred_at: string;
};

export type AppSurveyTiming = {
  shouldShow: boolean;
  canDefer: boolean;
  deferralCount: number;
  nextPromptAt: string;
};

function addDaysIso(value: string, days: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Data de referência do inquérito inválida.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function calculateAppSurveyTiming(
  accountCreatedAt: string,
  deferrals: SurveyDeferralTimestamp[],
  nowMs = Date.now(),
): AppSurveyTiming {
  const validDeferrals = [...deferrals].sort(
    (a, b) => new Date(b.deferred_at).getTime() - new Date(a.deferred_at).getTime(),
  );
  const deferralCount = Math.min(APP_SURVEY_MAX_DEFERRALS, validDeferrals.length);
  const latestDeferral = validDeferrals[0]?.deferred_at;
  const nextPromptAt = latestDeferral
    ? addDaysIso(latestDeferral, APP_SURVEY_DEFERRAL_DAYS)
    : addDaysIso(accountCreatedAt, APP_SURVEY_INITIAL_DELAY_DAYS);

  return {
    shouldShow: nowMs >= new Date(nextPromptAt).getTime(),
    canDefer: deferralCount < APP_SURVEY_MAX_DEFERRALS,
    deferralCount,
    nextPromptAt,
  };
}
