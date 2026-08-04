import React, { createContext, useContext, useMemo, useState } from "react";
import type {
  AppState,
  AppearanceSettings,
  Assessment,
  AssessmentType,
  Course,
  Degree,
  NotificationSettings,
  ProfileSettings,
  StudyBlock,
  SyncSettings,
} from "@/lib/types";
import { defaultState, loadState, migrate, saveState, storage as storageApi } from "@/lib/storage";
import { clamp } from "@/lib/utils";
import type { PlanCourseSeed } from "@/lib/uabPlan";

type Store = {
  state: AppState;

  setDegree: (degree: Degree | null) => void;
  setDegreeName: (name: string) => void;
  setProfile: (patch: Partial<ProfileSettings>) => void;
  setAppearance: (patch: Partial<AppearanceSettings>) => void;
  setNotifications: (patch: Partial<NotificationSettings>) => void;
  setLastSeenRelease: (version: string) => void;

  addCourse: (seed: { code: string; name: string; year: number; semester: number }) => string;
  updateCourse: (courseId: string, patch: Partial<Course>) => void;
  removeCourse: (courseId: string) => void;
  mergePlanCourses: (seeds: PlanCourseSeed[]) => void;

  setAssessmentGrade: (assessmentId: string, grade: number | null) => void;
  setAssessmentMaxPoints: (assessmentId: string, maxPoints: number) => void;
  setAssessmentDate: (assessmentId: string, fields: { startDate?: string; endDate?: string; gradeReleaseDate?: string; date?: string }) => void;
  updateAssessment: (assessmentId: string, patch: Partial<Assessment>) => void;
  addAssessment: (courseId: string, seed?: Partial<Omit<Assessment, "id" | "courseId">>) => string;
  addEFolio: (courseId: string) => string;
  removeAssessment: (assessmentId: string) => void;
  ensureAssessment: (courseId: string, type: AssessmentType, name: string) => string;

  markCourseCompleted: (courseId: string) => void;

  addStudyBlock: (block: Omit<StudyBlock, "id">) => string;
  updateStudyBlock: (blockId: string, patch: Partial<StudyBlock>) => void;
  removeStudyBlock: (blockId: string) => void;

  setSync: (patch: Partial<SyncSettings>) => void;

  exportData: () => string;
  importData: (jsonText: string) => { ok: true } | { ok: false; error: string };
  replaceState: (raw: unknown) => void;
  resetData: () => void;
};

const Ctx = createContext<Store | null>(null);

function uuid(): string {
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

function nextEFolioName(assessments: Assessment[], courseId: string): string {
  const used = new Set(
    assessments
      .filter((a) => a.courseId === courseId && a.type === "efolio")
      .map((a) => a.name.trim().toLocaleLowerCase("pt-PT")),
  );

  for (let index = 0; index < 26; index += 1) {
    const candidate = `e-fólio ${String.fromCharCode(65 + index)}`;
    if (!used.has(candidate.toLocaleLowerCase("pt-PT"))) return candidate;
  }

  let number = 27;
  while (used.has(`e-fólio ${number}`.toLocaleLowerCase("pt-PT"))) number += 1;
  return `e-fólio ${number}`;
}

function nextActivityName(assessments: Assessment[], courseId: string): string {
  const count = assessments.filter((item) => item.courseId === courseId && item.type !== "exam" && item.type !== "resit").length;
  return `Atividade ${count + 1}`;
}

function normCode(code: string): string {
  return (code ?? "").trim();
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const stateRef = React.useRef(state);
  stateRef.current = state;

  const commitFn = (next: AppState) => {
    stateRef.current = next;
    setState(next);
    saveState(next);
  };

  const api: Store = useMemo(() => {
    const commit = commitFn;
    const getState = () => stateRef.current;

    return {
      state,

      setDegree(degree) {
        commit({ ...getState(), degree });
      },

      setDegreeName(name) {
        const s = getState();
        commit({ ...s, degree: s.degree ? { ...s.degree, name } : { id: uuid(), name } });
      },

      setProfile(patch) {
        const s = getState();
        commit({ ...s, profile: { ...(s.profile ?? {}), ...patch } });
      },

      setAppearance(patch) {
        const s = getState();
        commit({ ...s, appearance: { ...(s.appearance ?? { theme: "system" }), ...patch } });
      },

      setNotifications(patch) {
        const s = getState();
        commit({
          ...s,
          notifications: {
            ...(s.notifications ?? { deadlines: true, exams: true, grades: true }),
            ...patch,
          },
        });
      },

      setLastSeenRelease(version) {
        commit({ ...getState(), lastSeenRelease: version });
      },

      addCourse(seed) {
        const s = getState();
        const id = uuid();
        const nextCourse: Course = {
          id,
          code: normCode(seed.code),
          name: (seed.name ?? "").trim(),
          year: Number(seed.year) || 1,
          semester: Number(seed.semester) || 1,
          isActive: false,
          isCompleted: false,
          evaluationRegime: "legacy",
          evaluationModel: "custom",
        };
        commit({ ...s, courses: [...s.courses, nextCourse] });
        return id;
      },

      updateCourse(courseId, patch) {
        const s = getState();
        const next: AppState = {
          ...s,
          courses: s.courses.map((c) => (c.id === courseId ? { ...c, ...patch } : c)),
        };

        if (patch.isActive === true) {
          const hasAssessments = next.assessments.some((a) => a.courseId === courseId);
          if (!hasAssessments) {
            const newAssessments: Assessment[] = [
              { id: uuid(), courseId, type: "efolio", name: "e-fólio A", maxPoints: 4, grade: null, mode: "asynchronous", required: true, order: 1 },
              { id: uuid(), courseId, type: "efolio", name: "e-fólio B", maxPoints: 4, grade: null, mode: "asynchronous", required: true, order: 2 },
              { id: uuid(), courseId, type: "exam", name: "g-fólio", maxPoints: 12, grade: null, mode: "synchronous", required: true, order: 3 },
              { id: uuid(), courseId, type: "resit", name: "recurso", maxPoints: 20, grade: null, mode: "synchronous", required: false, order: 4 },
            ];
            next.assessments = [...next.assessments, ...newAssessments];
          }
        }
        commit(next);
      },

      removeCourse(courseId) {
        const s = getState();
        commit({
          ...s,
          courses: s.courses.filter((c) => c.id !== courseId),
          assessments: s.assessments.filter((a) => a.courseId !== courseId),
          rules: s.rules.filter((r) => r.courseId !== courseId),
        });
      },

      mergePlanCourses(seeds) {
        if (!seeds?.length) return;
        const s = getState();
        const seedCodes = new Set(seeds.map((seed) => normCode(seed.code)));
        const keepCourses = s.courses.filter((c) => c.isActive || c.isCompleted || seedCodes.has(normCode(c.code)));
        const byCode = new Map(keepCourses.map((c) => [normCode(c.code), c]));
        const toAdd: Course[] = [];

        for (const seed of seeds) {
          const code = normCode(seed.code);
          if (!code || byCode.has(code)) continue;
          toAdd.push({
            id: uuid(),
            code,
            name: (seed.name ?? "").trim(),
            year: Number(seed.year) || 1,
            semester: Number(seed.semester) || 1,
            isActive: false,
            isCompleted: false,
            evaluationRegime: "legacy",
            evaluationModel: "custom",
          });
        }

        const newCourses = [...keepCourses, ...toAdd];
        const courseIds = new Set(newCourses.map((c) => c.id));
        commit({
          ...s,
          courses: newCourses,
          assessments: s.assessments.filter((a) => courseIds.has(a.courseId)),
          rules: s.rules.filter((r) => courseIds.has(r.courseId)),
        });
      },

      setAssessmentGrade(assessmentId, grade) {
        const s = getState();
        commit({
          ...s,
          assessments: s.assessments.map((a) => {
            if (a.id !== assessmentId) return a;
            const max = Number(a.maxPoints) || 0;
            const value = grade === null ? null : clamp(grade, 0, max);
            return { ...a, grade: value, status: value === null ? a.status : "graded" };
          }),
        });
      },

      setAssessmentMaxPoints(assessmentId, maxPoints) {
        const s = getState();
        const mp = Math.max(0, Number(maxPoints) || 0);
        commit({
          ...s,
          assessments: s.assessments.map((a) => {
            if (a.id !== assessmentId) return a;
            const grade = a.grade === null ? null : clamp(a.grade, 0, mp);
            return { ...a, maxPoints: mp, grade };
          }),
        });
      },

      setAssessmentDate(assessmentId, fields) {
        const s = getState();
        commit({ ...s, assessments: s.assessments.map((a) => (a.id === assessmentId ? { ...a, ...fields } : a)) });
      },

      updateAssessment(assessmentId, patch) {
        const s = getState();
        commit({
          ...s,
          assessments: s.assessments.map((a) => {
            if (a.id !== assessmentId) return a;
            const next = { ...a, ...patch };
            const max = Math.max(0, Number(next.maxPoints) || 0);
            return { ...next, maxPoints: max, grade: next.grade === null ? null : clamp(next.grade, 0, max) };
          }),
        });
      },

      addAssessment(courseId, seed = {}) {
        const s = getState();
        const id = uuid();
        const type = seed.type ?? "activity";
        const assessment: Assessment = {
          id,
          courseId,
          type,
          name: seed.name?.trim() || nextActivityName(s.assessments, courseId),
          maxPoints: Math.max(0, Number(seed.maxPoints ?? defaultMaxPoints(type))),
          grade: seed.grade ?? null,
          mode: seed.mode ?? (type === "exam" || type === "resit" || type === "discussion" || type === "presentation" ? "synchronous" : "asynchronous"),
          required: seed.required ?? true,
          minimumPercent: seed.minimumPercent,
          status: seed.status ?? "todo",
          order: seed.order ?? s.assessments.filter((item) => item.courseId === courseId).length + 1,
          description: seed.description,
          startDate: seed.startDate,
          endDate: seed.endDate,
          gradeReleaseDate: seed.gradeReleaseDate,
          date: seed.date,
        };
        commit({ ...s, assessments: [...s.assessments, assessment] });
        return id;
      },

      addEFolio(courseId) {
        const s = getState();
        const id = uuid();
        const item: Assessment = {
          id,
          courseId,
          type: "efolio",
          name: nextEFolioName(s.assessments, courseId),
          maxPoints: 0,
          grade: null,
          mode: "asynchronous",
          required: true,
          status: "todo",
          order: s.assessments.filter((a) => a.courseId === courseId).length + 1,
        };
        commit({ ...s, assessments: [...s.assessments, item] });
        return id;
      },

      removeAssessment(assessmentId) {
        const s = getState();
        commit({ ...s, assessments: s.assessments.filter((a) => a.id !== assessmentId) });
      },

      ensureAssessment(courseId, type, name) {
        const s = getState();
        const existing = s.assessments.find((a) => a.courseId === courseId && a.type === type && a.name === name);
        if (existing) return existing.id;
        const id = uuid();
        const item: Assessment = {
          id,
          courseId,
          type,
          name,
          maxPoints: defaultMaxPoints(type),
          grade: null,
          mode: type === "exam" || type === "resit" ? "synchronous" : "asynchronous",
          required: type !== "resit",
          status: "todo",
          order: s.assessments.filter((a) => a.courseId === courseId).length + 1,
        };
        commit({ ...s, assessments: [...s.assessments, item] });
        return id;
      },

      markCourseCompleted(courseId) {
        const s = getState();
        const now = new Date().toISOString();
        commit({
          ...s,
          courses: s.courses.map((c) => c.id === courseId ? { ...c, isCompleted: true, isActive: false, completedAt: now } : c),
        });
      },

      addStudyBlock(block) {
        const s = getState();
        const id = uuid();
        commit({ ...s, studyBlocks: [...(s.studyBlocks ?? []), { ...block, id }] });
        return id;
      },

      updateStudyBlock(blockId, patch) {
        const s = getState();
        commit({ ...s, studyBlocks: (s.studyBlocks ?? []).map((b) => b.id === blockId ? { ...b, ...patch } : b) });
      },

      removeStudyBlock(blockId) {
        const s = getState();
        commit({ ...s, studyBlocks: (s.studyBlocks ?? []).filter((b) => b.id !== blockId) });
      },

      setSync(patch) {
        const s = getState();
        commit({ ...s, sync: { ...(s.sync ?? { enabled: false }), ...patch } });
      },

      exportData() {
        return JSON.stringify(getState(), null, 2);
      },

      importData(jsonText) {
        try {
          const ok = storageApi.import(jsonText);
          if (!ok) return { ok: false, error: "Dados inválidos ou corrompidos." } as const;
          const next = loadState();
          commit(next);
          return { ok: true } as const;
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Falha ao importar." } as const;
        }
      },

      replaceState(raw) {
        const migrated = migrate(raw);
        commit(migrated);
      },

      resetData() {
        commit(defaultState());
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
