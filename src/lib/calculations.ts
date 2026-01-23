import type { AppState, Assessment, Rules } from "./types";

/**
 * Round half up (>= .5 sobe, < .5 desce)
 * (para notas positivas é suficiente usar Math.floor(x + 0.5))
 */
export function roundHalfUp(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.floor(x + 0.5);
}

export function getRules(state: AppState, courseId: string): Rules {
  return (
    state.rules.find(r => r.courseId === courseId) ?? {
      courseId,
      minAptoExame: 3.5,
      minExame: 5.5,
    }
  );
}

export function getAssessments(state: AppState, courseId: string, type?: Assessment["type"]) {
  const all = state.assessments.filter(a => a.courseId === courseId);
  return type ? all.filter(a => a.type === type) : all;
}

export function totalEFolios(state: AppState, courseId: string): number {
  const efs = getAssessments(state, courseId, "efolio");
  return efs.reduce((acc, a) => acc + (typeof a.grade === "number" ? a.grade : 0), 0);
}

export function examGrade(state: AppState, courseId: string): number | null {
  const ex = getAssessments(state, courseId, "exame")[0];
  return typeof ex?.grade === "number" ? ex.grade : null;
}

export function finalGrade(state: AppState, courseId: string): number | null {
  const ef = totalEFolios(state, courseId);
  const ex = examGrade(state, courseId);
  if (ex === null) return null;
  return roundHalfUp(ef + ex);
}

export function needsResit(state: AppState, courseId: string): boolean {
  const rules = getRules(state, courseId);
  const ef = totalEFolios(state, courseId);
  if (ef < rules.minAptoExame) return true;

  const ex = examGrade(state, courseId);
  if (ex === null) return false; // ainda não fez exame
  return ex < rules.minExame;
}

export function courseStatusLabel(state: AppState, courseId: string): { label: string; variant: "success" | "warning" | "destructive" } {
  const rules = getRules(state, courseId);
  const ef = totalEFolios(state, courseId);
  const ex = examGrade(state, courseId);

  if (ef < rules.minAptoExame) return { label: "Não Apto", variant: "destructive" };
  if (ex === null) return { label: "Apto a Exame", variant: "warning" };
  if (ex < rules.minExame) return { label: "Recurso", variant: "destructive" };

  const fin = finalGrade(state, courseId);
  if (fin !== null && fin >= 10) return { label: "Aprovado", variant: "success" };

  return { label: "Recurso", variant: "destructive" };
}

export function globalStats(state: AppState) {
  const active = state.courses.filter(c => c.isActive && !c.isCompleted).length;
  const completed = state.courses.filter(c => c.isCompleted).length;

  const finals = state.courses
    .filter(c => c.isCompleted)
    .map(c => finalGrade(state, c.id))
    .filter((x): x is number => typeof x === "number");

  const avg = finals.length ? finals.reduce((a, b) => a + b, 0) / finals.length : 0;
  const best = finals.length ? Math.max(...finals) : null;

  // eventos = nº de datas preenchidas (início/fim e-fólios, exame, recurso)
  const eventsCount = state.assessments.reduce((acc, a) => {
    if (a.type === "efolio") {
      return acc + (a.startDate ? 1 : 0) + (a.endDate ? 1 : 0);
    }
    return acc + (a.date ? 1 : 0);
  }, 0);

  return {
    active,
    completed,
    avg: Number(avg.toFixed(1)),
    best,
    eventsCount,
  };
}
