import type { AppState } from "@/lib/types";
import { getCourseEcts, getPlanCoursesForDegree, resolveDegreeOption, type PlanCourseSeed } from "@/lib/uabPlan";

export type CourseRequirementStatus = {
  courseCode: string;
  courseName: string;
  eligible: boolean;
  completed: boolean;
  active: boolean;
  sourceUrl: string;
  sourceLabel: string;
  requirements: Array<{
    id: string;
    label: string;
    met: boolean;
    detail: string;
    current?: number;
    target?: number;
    missingCourses?: Array<{ code: string; name: string }>;
  }>;
  note?: string;
};

type RequirementDefinition = {
  degreeId: string;
  courseCode: string;
  sourceUrl: string;
  sourceLabel: string;
  note?: string;
  evaluate: (state: AppState, plan: PlanCourseSeed[]) => CourseRequirementStatus["requirements"];
};

function completedCodes(state: AppState) {
  return new Set(state.courses.filter((course) => course.isCompleted).map((course) => course.code));
}

function completedCourseRequirement(state: AppState, plan: PlanCourseSeed[], id: string, label: string, requiredCodes: string[]): CourseRequirementStatus["requirements"][number] {
  const completed = completedCodes(state);
  const requiredCourses = requiredCodes.map((code) => plan.find((course) => course.code === code)).filter((course): course is PlanCourseSeed => Boolean(course));
  const missingCourses = requiredCourses.filter((course) => !completed.has(course.code)).map((course) => ({ code: course.code, name: course.name }));
  return { id, label, met: missingCourses.length === 0 && requiredCourses.length === requiredCodes.length, detail: `${requiredCourses.length - missingCourses.length}/${requiredCourses.length} UC concluídas`, current: requiredCourses.length - missingCourses.length, target: requiredCourses.length, missingCourses };
}

const REQUIREMENTS: RequirementDefinition[] = [
  {
    degreeId: "lei", courseCode: "21184", sourceUrl: "https://guiadoscursos.uab.pt/ucs/projeto-de-engenharia-informatica/", sourceLabel: "Guia dos Cursos UAb — Projeto de Engenharia Informática", note: "A UAb indica também que esta UC deve ser realizada no semestre em que o estudante termina a licenciatura.",
    evaluate: (state, plan) => {
      const completed = completedCodes(state);
      const firstYear = plan.filter((course) => course.year === 1);
      const missingFirstYear = firstYear.filter((course) => !completed.has(course.code)).map((course) => ({ code: course.code, name: course.name }));
      const eligibleAreas = new Set(["Engenharia Informática", "Tecnologias de Informação e Comunicação"]);
      const areaEcts = plan.reduce((total, course) => !completed.has(course.code) || !course.area || !eligibleAreas.has(course.area) ? total : total + getCourseEcts(plan, course.code), 0);
      return [
        { id: "first-year-complete", label: "Todas as UC do 1.º ano concluídas", met: missingFirstYear.length === 0, detail: `${firstYear.length - missingFirstYear.length}/${firstYear.length} UC concluídas`, current: firstYear.length - missingFirstYear.length, target: firstYear.length, missingCourses: missingFirstYear },
        { id: "ei-tic-ects", label: "90 ECTS em Engenharia Informática + TIC", met: areaEcts >= 90, detail: `${areaEcts}/90 ECTS concluídos nestas áreas`, current: areaEcts, target: 90 },
      ];
    },
  },
  {
    degreeId: "uab-lca", courseCode: "21118", sourceUrl: "https://guiadoscursos.uab.pt/ucs/trabalhos-de-campo-i/", sourceLabel: "Guia dos Cursos UAb — Trabalhos de Campo I", note: "A UAb indica expressamente que a inscrição nesta UC está sujeita à aprovação prévia nas quatro UC indicadas.",
    evaluate: (state, plan) => [completedCourseRequirement(state, plan, "tc1-foundations", "Biologia Geral I e II + Geologia Geral I e II concluídas", ["21012", "21013", "21056", "21057"])],
  },
  {
    degreeId: "uab-lca", courseCode: "21119", sourceUrl: "https://guiadoscursos.uab.pt/ucs/trabalhos-de-campo-ii/", sourceLabel: "Guia dos Cursos UAb — Trabalhos de Campo II", note: "A UAb refere que apenas se podem inscrever estudantes em posição de concluir o curso no respetivo ano letivo e indica, como referência, não ter mais de 5 a 8 UC por concluir. Situações especiais podem ser analisadas pela UAb.",
    evaluate: (state, plan) => {
      const completed = completedCodes(state);
      const remaining = plan.filter((course) => course.code !== "21119" && !completed.has(course.code));
      return [{ id: "tc2-course-completion-window", label: "Em posição de concluir a licenciatura neste ano letivo", met: remaining.length <= 8, detail: remaining.length === 0 ? "Sem outras UC por concluir" : `${remaining.length} UC por concluir além de Trabalhos de Campo II`, current: remaining.length, target: 8, missingCourses: remaining.slice(0, 8).map((course) => ({ code: course.code, name: course.name })) }];
    },
  },
];

export function getCourseRequirementStatuses(state: AppState): CourseRequirementStatus[] {
  const degree = resolveDegreeOption(state.degree);
  if (!degree) return [];
  const plan = getPlanCoursesForDegree(state.degree);
  const statuses: CourseRequirementStatus[] = [];

  for (const definition of REQUIREMENTS.filter((item) => item.degreeId === degree.id)) {
    const course = plan.find((item) => item.code === definition.courseCode);
    if (!course) continue;
    const stored = state.courses.find((item) => item.code === definition.courseCode);
    const requirements = definition.evaluate(state, plan);
    const status: CourseRequirementStatus = {
      courseCode: definition.courseCode,
      courseName: course.name,
      eligible: requirements.every((requirement) => requirement.met),
      completed: Boolean(stored?.isCompleted),
      active: Boolean(stored?.isActive),
      sourceUrl: definition.sourceUrl,
      sourceLabel: definition.sourceLabel,
      requirements,
    };
    if (definition.note) status.note = definition.note;
    statuses.push(status);
  }
  return statuses;
}
