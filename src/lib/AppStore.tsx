import React, { createContext, useContext, useMemo, useState } from "react";
import type { AppState, AssessmentType } from "@/lib/types";
import { loadState, saveState } from "@/lib/storage";
import { clamp } from "@/lib/utils";

type Store = {
  state: AppState;

  setDegreeName: (name: string) => void;

  setAssessmentGrade: (assessmentId: string, grade: number | null) => void;
  setAssessmentMaxPoints: (assessmentId: string, maxPoints: number) => void;
  setAssessmentDate: (assessmentId: string, fields: { startDate?: string; endDate?: string; date?: string }) => void;

  ensureAssessment: (courseId: string, type: AssessmentType, name: string) => string;

  markCourseCompleted: (courseId: string) => void;
};

const Ctx = createContext<Store | null>(null);

function uuid(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function defaultMaxPoints(type: AssessmentType) {
  if (type === "exam") return 12;
  if (type === "resit") return 20;
  return 4;
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

      setDegreeName(name) {
        const next: AppState = {
          ...state,
          degree: state.degree ? { ...state.degree, name } : { id: uuid(), name },
        };
        commit(next);
      },

      setAssessmentGrade(assessmentId, grade) {
        const next: AppState = {
          ...state,
          assessments: state.assessments.map(a => {
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
          assessments: state.assessments.map(a => {
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
          assessments: state.assessments.map(a => (a.id === assessmentId ? { ...a, ...fields } : a)),
        };
        commit(next);
      },

      ensureAssessment(courseId, type, name) {
        const existing = state.assessments.find(a => a.courseId === courseId && a.type === type && a.name === name);
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
          courses: state.courses.map(c => (c.id === courseId ? { ...c, isCompleted: true, isActive: false, completedAt: now } : c)),
        };
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
