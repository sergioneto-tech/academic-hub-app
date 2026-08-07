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

const REQUIREMENTS: RequirementDefinition[] = [
  {
    degreeId: "lei",
    courseCode: "21184",
    sourceUrl: "https://guiadoscursos.uab.pt/ucs/projeto-de-engenharia-informatica/",
    sourceLabel: "Guia dos Cursos UAb — Projeto de Engenharia Informática",
    note: "A UAb indica também que esta UC deve ser realizada no semestre em que o estudante termina a licenciatura.",
    evaluate: (state, plan) => {
      const completedCodes = new Set(state.courses.filter((course) => course.isCompleted).map((course) => course.code));
      const firstYear = plan.filter((course) => course.year === 1);
      const missingFirstYear = firstYear
        .filter((course) => !completedCodes.has(course.code))
        .map((course) => ({ code: course.code, name: course.name }));

      const eligibleAreas = new Set(["Engenharia Informática", "Tecnologias de Informação e Comunicação"]);
      const areaEcts = plan.reduce((total, course) => {
        if (!completedCodes.has(course.code) || !course.area || !eligibleAreas.has(course.area)) return total;
        return total + getCourseEcts(plan, course.code);
      }, 0);

      return [
        {
          id: "first-year-complete",
          label: "Todas as UC do 1.º ano concluídas",
          met: missingFirstYear.length === 0,
          detail: missingFirstYear.length === 0
            ? `${firstYear.length}/${firstYear.length} UC concluídas`
            : `${firstYear.length - missingFirstYear.length}/${firstYear.length} UC concluídas`,
          current: firstYear.length - missingFirstYear.length,
          target: firstYear.length,
          missingCourses: missingFirstYear,
        },
        {
          id: "ei-tic-ects",
          label: "90 ECTS em Engenharia Informática + TIC",
          met: areaEcts >= 90,
          detail: `${areaEcts}/90 ECTS concluídos nestas áreas`,
          current: areaEcts,
          target: 90,
        },
      ];
    },
  },
];

export function getCourseRequirementStatuses(state: AppState): CourseRequirementStatus[] {
  const degree = resolveDegreeOption(state.degree);
  if (!degree) return [];
  const plan = getPlanCoursesForDegree(state.degree);

  return REQUIREMENTS
    .filter((definition) => definition.degreeId === degree.id)
    .map((definition) => {
      const course = plan.find((item) => item.code === definition.courseCode);
      if (!course) return null;
      const stored = state.courses.find((item) => item.code === definition.courseCode);
      const requirements = definition.evaluate(state, plan);
      return {
        courseCode: definition.courseCode,
        courseName: course.name,
        eligible: requirements.every((requirement) => requirement.met),
        completed: Boolean(stored?.isCompleted),
        active: Boolean(stored?.isActive),
        sourceUrl: definition.sourceUrl,
        sourceLabel: definition.sourceLabel,
        requirements,
        note: definition.note,
      } satisfies CourseRequirementStatus;
    })
    .filter((status): status is CourseRequirementStatus => Boolean(status));
}
