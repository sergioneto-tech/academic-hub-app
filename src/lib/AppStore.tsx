import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AppState, AssessmentType, Course, Degree, Rules } from "./types";
import { defaultState, loadState, saveState, storage } from "./storage";

type Store = {
  state: AppState;

  // Degree / catalog
  setDegree: (degree: Degree | null) => void;
  setDegreeName: (name: string) => void;
  initializeFromWizard: (degree: Degree, courses: Course[]) => void;

  addCatalogCourse: (course: Omit<Course, "id" | "isActive" | "isCompleted" | "completedAt">) => void;
  updateCatalogCourse: (courseId: string, updates: Partial<Omit<Course, "id">>) => void;
  removeCatalogCourse: (courseId: string) => void;

  setCourseActive: (courseId: string, active: boolean) => void;

  // Assessments / rules
  setAssessmentGrade: (courseId: string, assessmentId: string, grade: number | null) => void;
  setAssessmentMaxPoints: (courseId: string, assessmentId: string, maxPoints: number) => void;
  setRules: (courseId: string, rules: Partial<Rules>) => void;
  ensureAssessment: (courseId: string, type: AssessmentType, name: string, maxPoints: number) => void;

  // Completion
  markCourseCompleted: (courseId: string, completed: boolean) => void;

  // Import / export / reset
  exportData: () => string;
  importData: (json: string) => boolean;
  resetData: () => void;
};

const Ctx = createContext<Store | null>(null);

function uuid(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function ensureDefaultsForCourse(state: AppState, courseId: string): AppState {
  let next = state;

  // rules
  if (!next.rules.find((r) => r.courseId === courseId)) {
    next = {
      ...next,
      rules: [
        ...next.rules,
        {
          courseId,
          minAptoExame: 3.5,
          minExame: 5.5,
        },
      ],
    };
  }

  // minimal assessments (created only if missing)
  const want = [
    { type: "efolio" as const, name: "e-fólio A", maxPoints: 2, suffix: "ef-a" },
    { type: "efolio" as const, name: "e-fólio B", maxPoints: 2, suffix: "ef-b" },
    { type: "exam" as const, name: "p-fólio", maxPoints: 16, suffix: "pf" },
  ];

  const have = new Set(next.assessments.filter((a) => a.courseId === courseId).map((a) => a.name));
  const missing = want.filter((w) => !have.has(w.name));
  if (missing.length) {
    next = {
      ...next,
      assessments: [
        ...next.assessments,
        ...missing.map((w) => ({
          id: `${courseId}-${w.suffix}`,
          courseId,
          type: w.type,
          name: w.name,
          maxPoints: w.maxPoints,
          grade: null,
        })),
      ],
    };
  }

  return next;
}

export function AppStoreProvider({
  children,
  storageKey,
}: {
  children: React.ReactNode;
  storageKey: string;
}) {
  const [state, setState] = useState<AppState>(() => loadState(storageKey));

  const commit = useCallback(
    (fn: (prev: AppState) => AppState) => {
      setState((prev) => {
        const next = fn(prev);
        saveState(next, storageKey);
        return next;
      });
    },
    [storageKey]
  );

  const api = useMemo<Store>(() => {
    return {
      state,

      setDegree: (degree) =>
        commit((prev) => ({
          ...prev,
          degree,
        })),

      setDegreeName: (name) =>
        commit((prev) => ({
          ...prev,
          degree: prev.degree ? { ...prev.degree, name } : { id: uuid(), name },
        })),

      initializeFromWizard: (degree, courses) =>
        commit(() => ({
          ...defaultState(),
          degree,
          courses,
        })),

      addCatalogCourse: (course) =>
        commit((prev) => {
          const id = uuid();
          return {
            ...prev,
            courses: [
              ...prev.courses,
              {
                id,
                code: course.code,
                name: course.name,
                year: course.year,
                semester: course.semester,
                isActive: false,
                isCompleted: false,
              },
            ],
          };
        }),

      updateCatalogCourse: (courseId, updates) =>
        commit((prev) => ({
          ...prev,
          courses: prev.courses.map((c) => (c.id === courseId ? { ...c, ...updates } : c)),
        })),

      removeCatalogCourse: (courseId) =>
        commit((prev) => ({
          ...prev,
          courses: prev.courses.filter((c) => c.id !== courseId),
          assessments: prev.assessments.filter((a) => a.courseId !== courseId),
          rules: prev.rules.filter((r) => r.courseId !== courseId),
        })),

      setCourseActive: (courseId, active) =>
        commit((prev) => {
          let next: AppState = {
            ...prev,
            courses: prev.courses.map((c) => (c.id === courseId ? { ...c, isActive: active } : c)),
          };
          if (active) next = ensureDefaultsForCourse(next, courseId);
          return next;
        }),

      setAssessmentGrade: (_courseId, assessmentId, grade) =>
        commit((prev) => ({
          ...prev,
          assessments: prev.assessments.map((a) => (a.id === assessmentId ? { ...a, grade } : a)),
        })),

      setAssessmentMaxPoints: (_courseId, assessmentId, maxPoints) =>
        commit((prev) => ({
          ...prev,
          assessments: prev.assessments.map((a) =>
            a.id === assessmentId ? { ...a, maxPoints } : a
          ),
        })),

      setRules: (courseId, rules) =>
        commit((prev) => {
          const existing = prev.rules.find((r) => r.courseId === courseId);
          if (!existing) {
            return {
              ...prev,
              rules: [
                ...prev.rules,
                {
                  courseId,
                  minAptoExame: rules.minAptoExame ?? 3.5,
                  minExame: rules.minExame ?? 5.5,
                },
              ],
            };
          }
          return {
            ...prev,
            rules: prev.rules.map((r) => (r.courseId === courseId ? { ...r, ...rules } : r)),
          };
        }),

      ensureAssessment: (courseId, type, name, maxPoints) =>
        commit((prev) => {
          const exists = prev.assessments.find(
            (a) => a.courseId === courseId && a.type === type && a.name === name
          );
          if (exists) return prev;
          return {
            ...prev,
            assessments: [
              ...prev.assessments,
              { id: uuid(), courseId, type, name, maxPoints, grade: null },
            ],
          };
        }),

      markCourseCompleted: (courseId, completed) =>
        commit((prev) => ({
          ...prev,
          courses: prev.courses.map((c) =>
            c.id === courseId
              ? {
                  ...c,
                  isCompleted: completed,
                  isActive: completed ? false : c.isActive,
                  completedAt: completed ? new Date().toISOString() : undefined,
                }
              : c
          ),
        })),

      exportData: () => storage.export(storageKey),
      importData: (json: string) => storage.import(json, storageKey),
      resetData: () => storage.reset(storageKey),
    };
  }, [state, commit, storageKey]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
