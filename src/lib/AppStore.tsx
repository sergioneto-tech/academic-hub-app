import React, { createContext, useContext, useMemo, useState } from "react";
import type { AppState, AssessmentType } from "./types";
import { loadState, saveState } from "./storage";

type Store = {
  state: AppState;
  setDegreeName: (name: string) => void;

  setAssessmentGrade: (assessmentId: string, grade: number | null) => void;
  setAssessmentDate: (assessmentId: string, fields: { startDate?: string; endDate?: string; date?: string }) => void;

  ensureAssessment: (courseId: string, type: AssessmentType, name: string) => string;

  markCourseCompleted: (courseId: string) => void;
};

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());

  const api = useMemo<Store>(() => {
    const commit = (next: AppState) => {
      setState(next);
      saveState(next);
    };

    return {
      state,

      setDegreeName(name) {
        const next = { ...state, degree: state.degree ? { ...state.degree, name } : { id: "deg1", name } };
        commit(next);
      },

      setAssessmentGrade(assessmentId, grade) {
        const next = {
          ...state,
          assessments: state.assessments.map(a => (a.id === assessmentId ? { ...a, grade } : a)),
        };
        commit(next);
      },

      setAssessmentDate(assessmentId, fields) {
        const next = {
          ...state,
          assessments: state.assessments.map(a => (a.id === assessmentId ? { ...a, ...fields } : a)),
        };
        commit(next);
      },

      ensureAssessment(courseId, type, name) {
        const existing = state.assessments.find(a => a.courseId === courseId && a.type === type);
        if (existing) return existing.id;

        const id = crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
        const next = {
          ...state,
          assessments: [
            ...state.assessments,
            { id, courseId, type, name, grade: null, maxGrade: type === "exame" ? 16 : type === "recurso" ? 20 : 2 },
          ],
        };
        commit(next);
        return id;
      },

      markCourseCompleted(courseId) {
        const next = {
          ...state,
          courses: state.courses.map(c =>
            c.id === courseId
              ? { ...c, isCompleted: true, isActive: false, completedAt: new Date().toISOString() }
              : c
          ),
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
