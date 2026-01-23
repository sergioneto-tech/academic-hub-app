import type { AppState, Assessment, AssessmentType, Rules } from "./types";
import { clamp, roundHalfUpInt } from "./utils";

export function getRules(state: AppState, courseId: string): Rules {
  return (
    state.rules.find(r => r.courseId === courseId) ?? {
      courseId,
      minAptoExame: 3.5,
      minExame: 5.5,
    }
  );
}

export function getAssessments(state: AppState, courseId: string, type?: AssessmentType): Assessment[] {
  return state.assessments
    .filter(a => a.courseId === courseId && (!type || a.type === type))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
}

function safeGrade(a: Assessment): number {
  if (a.grade === null || !Number.isFinite(a.grade)) return 0;
  return clamp(a.grade, 0, Number(a.maxPoints) || 0);
}

export function totalEFolios(state: AppState, courseId: string): number {
  const efs = getAssessments(state, courseId, "efolio");
  return efs.reduce((acc, a) => acc + safeGrade(a), 0);
}

export function totalEFoliosMax(state: AppState, courseId: string): number {
  const efs = getAssessments(state, courseId, "efolio");
  return efs.reduce((acc, a) => acc + (Number(a.maxPoints) || 0), 0);
}

export function exam(state: AppState, courseId: string): Assessment | null {
  return getAssessments(state, courseId, "exam")[0] ?? null;
}

export function resit(state: AppState, courseId: string): Assessment | null {
  return getAssessments(state, courseId, "resit")[0] ?? null;
}

export function examGrade(state: AppState, courseId: string): number | null {
  const ex = exam(state, courseId);
  return ex ? ex.grade : null;
}

export function resitGrade(state: AppState, courseId: string): number | null {
  const r = resit(state, courseId);
  return r ? r.grade : null;
}

/**
 * Nota final:
 * - Se houver nota de recurso -> recurso (0..20) (normalmente substitui tudo)
 * - Caso contrário: e-fólios + exame (máx 20)
 */
export function finalGradeRaw(state: AppState, courseId: string): number | null {
  const r = resit(state, courseId);
  if (r && r.grade !== null) return safeGrade(r);

  const ex = exam(state, courseId);
  if (!ex || ex.grade === null) return null;

  return totalEFolios(state, courseId) + safeGrade(ex);
}

export function finalGradeRounded(state: AppState, courseId: string): number | null {
  const raw = finalGradeRaw(state, courseId);
  if (raw === null) return null;
  return roundHalfUpInt(raw);
}

export function needsResit(state: AppState, courseId: string): boolean {
  const rules = getRules(state, courseId);
  const ef = totalEFolios(state, courseId);
  const ex = examGrade(state, courseId);

  if (ef < rules.minAptoExame) return true;
  if (ex === null) return false; // ainda não fez exame
  return ex < rules.minExame;
}

export function courseStatusLabel(state: AppState, courseId: string): { label: string; badge: "success" | "warning" | "danger" | "neutral" } {
  const course = state.courses.find(c => c.id === courseId);
  if (!course) return { label: "—", badge: "neutral" };

  if (course.isCompleted) return { label: "Concluída", badge: "success" };

  const rules = getRules(state, courseId);
  const ef = totalEFolios(state, courseId);
  const ex = examGrade(state, courseId);

  if (ef < rules.minAptoExame) return { label: "Não Apto", badge: "danger" };
  if (ex === null) return { label: "Apto a Exame", badge: "warning" };
  if (ex < rules.minExame) return { label: "Recurso", badge: "danger" };

  const fin = finalGradeRounded(state, courseId);
  if (fin !== null && fin >= 10) return { label: "Aprovado", badge: "success" };
  return { label: "Recurso", badge: "danger" };
}

export function globalStats(state: AppState) {
  const active = state.courses.filter(c => c.isActive && !c.isCompleted).length;
  const completedCourses = state.courses.filter(c => c.isCompleted);

  const finals = completedCourses
    .map(c => finalGradeRounded(state, c.id))
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  const avg = finals.length ? finals.reduce((a, b) => a + b, 0) / finals.length : 0;
  const best = finals.length ? Math.max(...finals) : null;

  // eventos = datas de e-fólios (início+fim) + exame + recurso, só em cadeiras ativas
  const activeCourseIds = new Set(state.courses.filter(c => c.isActive).map(c => c.id));
  const eventsCount = state.assessments.reduce((acc, a) => {
    if (!activeCourseIds.has(a.courseId)) return acc;

    if (a.type === "efolio") {
      return acc + (a.startDate ? 1 : 0) + (a.endDate ? 1 : 0);
    }
    return acc + (a.date ? 1 : 0);
  }, 0);

  return {
    active,
    completed: completedCourses.length,
    avg: Number(avg.toFixed(1)),
    best,
    eventsCount,
  };
}

// Compat: código antigo importava `finalGrade`
export function finalGrade(state: AppState, courseId: string): number | null {
  return finalGradeRounded(state, courseId);
}
