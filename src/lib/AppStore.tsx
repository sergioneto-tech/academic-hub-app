import React, { createContext, useContext, useMemo, useState } from "react";
import type { AppState, AssessmentType, Course, Degree } from "@/lib/types";
import { defaultState, loadState, saveState, storage as storageApi } from "@/lib/storage";
import { clamp } from "@/lib/utils";
import type { PlanCourseSeed } from "@/lib/uabPlan";

type Store = {
  state: AppState;

  // Licenciatura
  setDegree: (degree: Degree | null) => void;
  setDegreeName: (name: string) => void;

  // Cadeiras (catálogo)
  addCourse: (seed: { code: string; name: string; year: number; semester: number }) => string;
  updateCourse: (courseId: string, patch: Partial<Pick<Course, "code" | "name" | "year" | "semester" | "isActive" | "isCompleted" | "completedAt">>) => void;
  removeCourse: (courseId: string) => void;

  // Importação “seed” do plano de estudos
  mergePlanCourses: (seeds: PlanCourseSeed[]) => void;

  // Avaliação
  setAssessmentGrade: (assessmentId: string, grade: number | null) => void;
  setAssessmentMaxPoints: (assessmentId: string, maxPoints: number) => void;
  setAssessmentDate: (assessmentId: string, fields: { startDate?: string; endDate?: string; date?: string }) => void;
  ensureAssessment: (courseId: string, type: AssessmentType, name: string) => string;

  // Conclusão
  markCourseCompleted: (courseId: string) => void;

  // Backup/restore
  exportData: () => string;
  importData: (jsonText: string) => { ok: true } | { ok: false; error: string };
  resetData: () => void;
};

const Ctx = createContext<Store | null>(null);

function uuid(): string {
  // Preferir UUID real quando disponível.
  // (Em alguns browsers antigos, crypto.randomUUID pode não existir.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyCrypto: any = typeof crypto !== "undefined" ? crypto : null;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function defaultMaxPoints(type: AssessmentType) {
  if (type === "exam") return 12;
  if (type === "resit") return 20;
  return 4;
}

function normCode(code: string): string {
  return (code ?? "").trim();
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());

  const api: Store = useMemo(() => {
    const commit = (next: AppState) => {
      setState(next);
      saveState(next);
    };

    return {
      state,

      setDegree(degree) {
        const next: AppState = { ...state, degree };
        commit(next);
      },

      setDegreeName(name) {
        const next: AppState = {
          ...state,
          degree: state.degree ? { ...state.degree, name } : { id: uuid(), name },
        };
        commit(next);
      },

      addCourse(seed) {
        const id = uuid();
        const nextCourse: Course = {
          id,
          code: normCode(seed.code),
          name: (seed.name ?? "").trim(),
          year: Number(seed.year) || 1,
          semester: Number(seed.semester) || 1,
          isActive: false,
          isCompleted: false,
        };

        const next: AppState = { ...state, courses: [...state.courses, nextCourse] };
        commit(next);
        return id;
      },

      updateCourse(courseId, patch) {
        const next: AppState = {
          ...state,
          courses: state.courses.map((c) => (c.id === courseId ? { ...c, ...patch } : c)),
        };
        commit(next);
      },

      removeCourse(courseId) {
        const next: AppState = {
          ...state,
          courses: state.courses.filter((c) => c.id !== courseId),
          assessments: state.assessments.filter((a) => a.courseId !== courseId),
          rules: state.rules.filter((r) => r.courseId !== courseId),
        };
        commit(next);
      },

      mergePlanCourses(seeds) {
        if (!seeds || seeds.length === 0) return;

        const byCode = new Map(state.courses.map((c) => [normCode(c.code), c]));
        const toAdd: Course[] = [];

        for (const s of seeds) {
          const code = normCode(s.code);
          if (!code) continue;
          if (byCode.has(code)) continue;

          toAdd.push({
            id: uuid(),
            code,
            name: (s.name ?? "").trim(),
            year: Number(s.year) || 1,
            semester: Number(s.semester) || 1,
            isActive: false,
            isCompleted: false,
          });
        }

        if (toAdd.length === 0) return;
        const next: AppState = { ...state, courses: [...state.courses, ...toAdd] };
        commit(next);
      },

      setAssessmentGrade(assessmentId, grade) {
        const next: AppState = {
          ...state,
          assessments: state.assessments.map((a) => {
            if (a.id !== assessmentId) return a;
            const max = Number(a.maxPoints) || 0;
            const v = grade === null ? null : clamp(grade, 0, max);
            return { ...a, grade: v };
          }),
        };
        commit(next);
      },

      setAssessmentMaxPoints(assessmentId, maxPoints) {
        const mp = Math.max(0, Number(maxPoints) || 0);
        const next: AppState = {
          ...state,
          assessments: state.assessments.map((a) => {
            if (a.id !== assessmentId) return a;
            const g = a.grade === null ? null : clamp(a.grade, 0, mp);
            return { ...a, maxPoints: mp, grade: g };
          }),
        };
        commit(next);
      },

      setAssessmentDate(assessmentId, fields) {
        const next: AppState = {
          ...state,
          assessments: state.assessments.map((a) => (a.id === assessmentId ? { ...a, ...fields } : a)),
        };
        commit(next);
      },

      ensureAssessment(courseId, type, name) {
        const existing = state.assessments.find((a) => a.courseId === courseId && a.type === type && a.name === name);
        if (existing) return existing.id;

        const id = uuid();
        const next: AppState = {
          ...state,
          assessments: [
            ...state.assessments,
            {
              id,
              courseId,
              type,
              name,
              maxPoints: defaultMaxPoints(type),
              grade: null,
            },
          ],
        };
        commit(next);
        return id;
      },

      markCourseCompleted(courseId) {
        const now = new Date().toISOString();
        const next: AppState = {
          ...state,
          courses: state.courses.map((c) =>
            c.id === courseId ? { ...c, isCompleted: true, isActive: false, completedAt: now } : c,
          ),
        };
        commit(next);
      },

      exportData() {
        return JSON.stringify(state, null, 2);
      },

      importData(jsonText) {
        try {
          // Usar o migrador existente para manter compatibilidade.
          storageApi.import(jsonText);
          const next = loadState();
          commit(next);
          return { ok: true } as const;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Falha ao importar.";
          return { ok: false, error: msg } as const;
        }
      },

      resetData() {
        const next = defaultState();
        commit(next);
      },
    };
  }, [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
