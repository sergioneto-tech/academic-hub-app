import { getStoredSession, refreshSession, storeSession, type AuthSession, type CloudConfig } from "@/lib/cloudSync";
import { FEEDBACK_BETA_MANAGER_USER_ID } from "@/lib/feedbackBeta";
import { APP_VERSION } from "@/lib/version";

export const APP_SATISFACTION_SURVEY_ID = "satisfaction-2026-09";
export const APP_SURVEY_CHANGED_EVENT = "academic-hub-app-survey-changed";
export const APP_SURVEY_INITIAL_DELAY_DAYS = 7;
export const APP_SURVEY_DEFERRAL_DAYS = 7;
export const APP_SURVEY_MAX_DEFERRALS = 2;

export type AppSurveyAnswer = {
  likesApp: boolean;
  recommendsApp: boolean;
  rating: number;
};

export type AppSurveyResponse = AppSurveyAnswer & {
  createdAt: string;
  appVersion: string;
};

export type AppSurveySummary = {
  total: number;
  likesYes: number;
  likesNo: number;
  recommendsYes: number;
  recommendsNo: number;
  averageRating: number | null;
  ratings: Record<1 | 2 | 3 | 4 | 5, number>;
};

export type AppSurveyState = {
  authenticated: boolean;
  answered: boolean;
  shouldShow: boolean;
  canDefer: boolean;
  deferralCount: number;
  userId?: string;
  nextPromptAt?: string;
};

type SurveyRow = {
  likes_app: boolean;
  recommends_app: boolean;
  rating: number;
  app_version: string;
  created_at: string;
};

type SurveyDeferralRow = {
  deferral_no: number;
  deferred_at: string;
};

function cloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

function answeredCacheKey(userId: string) {
  return `academic_hub_survey_answered:${APP_SATISFACTION_SURVEY_ID}:${userId}`;
}

export function hasLocalSurveyAnswer(userId: string): boolean {
  try {
    return localStorage.getItem(answeredCacheKey(userId)) === "1";
  } catch {
    return false;
  }
}

function cacheSurveyAnswer(userId: string) {
  try {
    localStorage.setItem(answeredCacheKey(userId), "1");
  } catch {
    // A resposta confirmada no servidor continua válida mesmo sem cache local.
  }
}

async function freshSession(config: CloudConfig): Promise<AuthSession | null> {
  let session = getStoredSession(config);
  if (!session) return null;
  const expiresAt = Number(session.expires_at ?? 0) * 1000;
  if (expiresAt && expiresAt <= Date.now() + 60_000) {
    try {
      session = await refreshSession(config, session);
      storeSession(config, session);
    } catch {
      return null;
    }
  }
  return session;
}

function restHeaders(config: CloudConfig, session: AuthSession, extra?: Record<string, string>) {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function addDaysIso(value: string, days: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Data de referência do inquérito inválida.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

async function getAccountCreatedAt(config: CloudConfig, session: AuthSession): Promise<string> {
  const sessionValue = (session.user as AuthSession["user"] & { created_at?: string }).created_at;
  if (sessionValue && !Number.isNaN(new Date(sessionValue).getTime())) return sessionValue;

  const base = config.supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/auth/v1/user`, {
    method: "GET",
    cache: "no-store",
    headers: restHeaders(config, session),
  });
  if (!response.ok) throw new Error(`Não foi possível verificar a antiguidade da conta (${response.status}).`);
  const user = await response.json() as { created_at?: string };
  if (!user.created_at || Number.isNaN(new Date(user.created_at).getTime())) {
    throw new Error("Não foi possível determinar a data de criação da conta.");
  }
  return user.created_at;
}

export async function getCurrentSurveyState(): Promise<AppSurveyState> {
  const config = cloudConfig();
  if (!config) return { authenticated: false, answered: false, shouldShow: false, canDefer: false, deferralCount: 0 };
  const session = await freshSession(config);
  if (!session) return { authenticated: false, answered: false, shouldShow: false, canDefer: false, deferralCount: 0 };
  const userId = session.user.id;
  if (hasLocalSurveyAnswer(userId)) {
    return { authenticated: true, answered: true, shouldShow: false, canDefer: false, deferralCount: 0, userId };
  }
  if (!navigator.onLine) {
    return { authenticated: true, answered: false, shouldShow: false, canDefer: false, deferralCount: 0, userId };
  }

  const base = config.supabaseUrl.replace(/\/$/, "");
  const responseQuery = new URLSearchParams({
    select: "survey_id",
    survey_id: `eq.${APP_SATISFACTION_SURVEY_ID}`,
    user_id: `eq.${userId}`,
    limit: "1",
  });
  const deferralQuery = new URLSearchParams({
    select: "deferral_no,deferred_at",
    survey_id: `eq.${APP_SATISFACTION_SURVEY_ID}`,
    user_id: `eq.${userId}`,
    order: "deferred_at.desc",
  });

  const [response, deferralResponse, accountCreatedAt] = await Promise.all([
    fetch(`${base}/rest/v1/app_survey_responses?${responseQuery.toString()}`, {
      method: "GET",
      cache: "no-store",
      headers: restHeaders(config, session),
    }),
    fetch(`${base}/rest/v1/app_survey_deferrals?${deferralQuery.toString()}`, {
      method: "GET",
      cache: "no-store",
      headers: restHeaders(config, session),
    }),
    getAccountCreatedAt(config, session),
  ]);

  if (!response.ok) throw new Error(`Não foi possível verificar o inquérito (${response.status}).`);
  if (!deferralResponse.ok) throw new Error(`Não foi possível verificar os adiamentos do inquérito (${deferralResponse.status}).`);

  const rows = await response.json() as Array<{ survey_id: string }>;
  const answered = rows.length > 0;
  if (answered) {
    cacheSurveyAnswer(userId);
    return { authenticated: true, answered: true, shouldShow: false, canDefer: false, deferralCount: 0, userId };
  }

  const deferrals = await deferralResponse.json() as SurveyDeferralRow[];
  const deferralCount = Math.min(APP_SURVEY_MAX_DEFERRALS, deferrals.length);
  const latestDeferral = deferrals[0]?.deferred_at;
  const nextPromptAt = latestDeferral
    ? addDaysIso(latestDeferral, APP_SURVEY_DEFERRAL_DAYS)
    : addDaysIso(accountCreatedAt, APP_SURVEY_INITIAL_DELAY_DAYS);
  const shouldShow = Date.now() >= new Date(nextPromptAt).getTime();

  return {
    authenticated: true,
    answered: false,
    shouldShow,
    canDefer: deferralCount < APP_SURVEY_MAX_DEFERRALS,
    deferralCount,
    userId,
    nextPromptAt,
  };
}

export async function deferCurrentSurvey(): Promise<void> {
  const config = cloudConfig();
  if (!config) throw new Error("Ligação ao servidor indisponível.");
  const session = await freshSession(config);
  if (!session) throw new Error("A sessão expirou. Volta a entrar na tua conta e tenta novamente.");

  const state = await getCurrentSurveyState();
  if (state.answered) return;
  if (!state.shouldShow) return;
  if (!state.canDefer || state.deferralCount >= APP_SURVEY_MAX_DEFERRALS) {
    throw new Error("Já utilizaste os dois adiamentos disponíveis. Responde às 3 perguntas para continuar.");
  }

  const base = config.supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/rest/v1/app_survey_deferrals`, {
    method: "POST",
    headers: restHeaders(config, session, { Prefer: "return=minimal" }),
    body: JSON.stringify({
      survey_id: APP_SATISFACTION_SURVEY_ID,
      user_id: session.user.id,
      deferral_no: state.deferralCount + 1,
    }),
  });

  if (!response.ok && response.status !== 409) {
    const detail = await response.text().catch(() => "");
    console.warn("[AppSurvey][defer]", response.status, detail);
    throw new Error("Não foi possível adiar o inquérito. Verifica a ligação e tenta novamente.");
  }

  window.dispatchEvent(new Event(APP_SURVEY_CHANGED_EVENT));
}

export async function submitCurrentSurvey(answer: AppSurveyAnswer): Promise<void> {
  if (answer.rating < 1 || answer.rating > 5) throw new Error("Seleciona uma avaliação entre 1 e 5 estrelas.");
  const config = cloudConfig();
  if (!config) throw new Error("Ligação ao servidor indisponível.");
  const session = await freshSession(config);
  if (!session) throw new Error("A sessão expirou. Volta a entrar na tua conta e tenta novamente.");
  const base = config.supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/rest/v1/app_survey_responses`, {
    method: "POST",
    headers: restHeaders(config, session, { Prefer: "return=minimal" }),
    body: JSON.stringify({
      survey_id: APP_SATISFACTION_SURVEY_ID,
      user_id: session.user.id,
      likes_app: answer.likesApp,
      recommends_app: answer.recommendsApp,
      rating: answer.rating,
      app_version: APP_VERSION,
    }),
  });
  if (!response.ok && response.status !== 409) {
    const detail = await response.text().catch(() => "");
    console.warn("[AppSurvey][submit]", response.status, detail);
    throw new Error("Não foi possível guardar a resposta. Verifica a ligação e tenta novamente.");
  }
  cacheSurveyAnswer(session.user.id);
  window.dispatchEvent(new Event(APP_SURVEY_CHANGED_EVENT));
}

export async function loadSurveySummary(): Promise<AppSurveySummary | null> {
  const config = cloudConfig();
  if (!config) return null;
  const session = await freshSession(config);
  if (!session || session.user.id !== FEEDBACK_BETA_MANAGER_USER_ID) return null;
  const base = config.supabaseUrl.replace(/\/$/, "");
  const query = new URLSearchParams({
    select: "likes_app,recommends_app,rating,app_version,created_at",
    survey_id: `eq.${APP_SATISFACTION_SURVEY_ID}`,
    order: "created_at.desc",
  });
  const response = await fetch(`${base}/rest/v1/app_survey_responses?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: restHeaders(config, session),
  });
  if (!response.ok) throw new Error(`Não foi possível carregar os resultados (${response.status}).`);
  const rows = await response.json() as SurveyRow[];
  const ratings: AppSurveySummary["ratings"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingTotal = 0;
  let likesYes = 0;
  let recommendsYes = 0;
  for (const row of rows) {
    if (row.likes_app) likesYes += 1;
    if (row.recommends_app) recommendsYes += 1;
    const rating = Math.min(5, Math.max(1, Number(row.rating))) as 1 | 2 | 3 | 4 | 5;
    ratings[rating] += 1;
    ratingTotal += rating;
  }
  return {
    total: rows.length,
    likesYes,
    likesNo: rows.length - likesYes,
    recommendsYes,
    recommendsNo: rows.length - recommendsYes,
    averageRating: rows.length ? Number((ratingTotal / rows.length).toFixed(2)) : null,
    ratings,
  };
}
