import type { AppState } from "./types";

const KEY = "uab-tracker:v1";

function sampleState(): AppState {
  const course1 = "c1";
  const course2 = "c2";

  return {
    degree: { id: "deg1", name: "Licenciatura em Informática" },
    courses: [
      { id: course1, code: "21001", name: "Introdução à Programação", year: 1, semester: 1, isActive: true, isCompleted: false },
      { id: course2, code: "21002", name: "Matemática Discreta", year: 1, semester: 1, isActive: true, isCompleted: false },
    ],
    rules: [
      { courseId: course1, minAptoExame: 3.5, minExame: 5.5 },
      { courseId: course2, minAptoExame: 3.5, minExame: 5.5 },
    ],
    assessments: [
      // IP
      { id: "a1", courseId: course1, type: "efolio", name: "e-fólio A", endDate: "2025-02-15", grade: 1.3, maxGrade: 2 },
      { id: "a2", courseId: course1, type: "efolio", name: "e-fólio B", endDate: "2025-03-15", grade: 2.0, maxGrade: 2 },
      { id: "a3", courseId: course1, type: "exame", name: "p-fólio", date: "2025-06-20", grade: null, maxGrade: 16 },

      // MD
      { id: "b1", courseId: course2, type: "efolio", name: "e-fólio A", endDate: "2025-02-25", grade: 2.0, maxGrade: 2 },
      { id: "b2", courseId: course2, type: "efolio", name: "e-fólio B", endDate: "2025-03-25", grade: 2.0, maxGrade: 2 },
      { id: "b3", courseId: course2, type: "exame", name: "p-fólio", date: "2025-06-20", grade: null, maxGrade: 16 },
    ],
  };
}

/**
 * Migrações: se o Lovable gerou nomes diferentes (completed/concluida/active/ativa),
 * normalizamos aqui para não “perder” cadeiras concluídas.
 */
function migrate(raw: any): AppState {
  const base = sampleState();

  if (!raw || typeof raw !== "object") return base;

  const degree = raw.degree ?? raw.licenciatura ?? null;

  const coursesRaw = raw.courses ?? raw.cadeiras ?? [];
  const courses = (Array.isArray(coursesRaw) ? coursesRaw : []).map((c: any) => {
    const isCompleted = Boolean(c.isCompleted ?? c.concluida ?? c.completed ?? c.done ?? false);
    const isActive = Boolean(c.isActive ?? c.ativa ?? c.active ?? (!isCompleted));

    return {
      id: String(c.id ?? c.courseId ?? crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
      code: String(c.code ?? c.codigo ?? ""),
      name: String(c.name ?? c.nome ?? ""),
      year: Number(c.year ?? c.ano ?? 1),
      semester: Number(c.semester ?? c.semestre ?? 1),
      isActive,
      isCompleted,
      completedAt: c.completedAt ?? c.dataConclusao ?? c.completed_at ?? undefined,
    };
  });

  const assessmentsRaw = raw.assessments ?? raw.avaliacoes ?? [];
  const assessments = (Array.isArray(assessmentsRaw) ? assessmentsRaw : []).map((a: any) => ({
    id: String(a.id ?? crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    courseId: String(a.courseId ?? a.cadeiraId ?? a.course_id ?? ""),
    type: a.type ?? a.tipo ?? "efolio",
    name: String(a.name ?? a.nome ?? ""),
    startDate: a.startDate ?? a.dataInicio ?? undefined,
    endDate: a.endDate ?? a.dataFim ?? a.dataEntrega ?? undefined,
    date: a.date ?? a.data ?? undefined,
    grade: typeof a.grade === "number" ? a.grade : (typeof a.nota === "number" ? a.nota : null),
    maxGrade: typeof a.maxGrade === "number" ? a.maxGrade : (typeof a.maxNota === "number" ? a.maxNota : undefined),
  }));

  const rulesRaw = raw.rules ?? raw.regras ?? [];
  const rules = (Array.isArray(rulesRaw) ? rulesRaw : []).map((r: any) => ({
    courseId: String(r.courseId ?? r.cadeiraId ?? ""),
    minAptoExame: Number(r.minAptoExame ?? r.minimoApto ?? 3.5),
    minExame: Number(r.minExame ?? r.minimoExame ?? 5.5),
  }));

  return {
    degree: degree
      ? { id: String(degree.id ?? "deg1"), name: String(degree.name ?? degree.nome ?? "Licenciatura") }
      : null,
    courses: courses.length ? courses : base.courses,
    assessments: assessments.length ? assessments : base.assessments,
    rules: rules.length ? rules : base.rules,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return sampleState();
    return migrate(JSON.parse(raw));
  } catch {
    return sampleState();
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
