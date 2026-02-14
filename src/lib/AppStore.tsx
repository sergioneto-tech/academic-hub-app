import React, { createContext, useContext, useMemo, useState } from "react";
import type { AppState, AssessmentType, Course, Degree, StudyBlock, SyncSettings } from "@/lib/types";
import { defaultState, loadState, migrate, saveState, storage as storageApi } from "@/lib/storage";
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

  // Blocos de estudo
  addStudyBlock: (block: Omit<StudyBlock, "id">) => string;
  updateStudyBlock: (blockId: string, patch: Partial<StudyBlock>) => void;
  removeStudyBlock: (blockId: string) => void;

  // Sincronização (opcional)
  setSync: (patch: Partial<SyncSettings>) => void;

  // Backup/restore
  exportData: () => string;
  importData: (jsonText: string) => { ok: true } | { ok: false; error: string };
  replaceState: (raw: unknown) => void;
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

  const commitFn = (next: AppState) => {
    setState(next);
    saveState(next);
  };

  // Use a ref to always have access to current state inside callbacks
  const stateRef = React.useRef(state);
  stateRef.current = state;

  const api: Store = useMemo(() => {
    const commit = commitFn;
    const getState = () => stateRef.current;

    return {
      state,

      setDegree(degree) {
        const next: AppState = { ...getState(), degree };
        commit(next);
      },

      setDegreeName(name) {
        const s = getState();
        const next: AppState = {
          ...s,
          degree: s.degree ? { ...s.degree, name } : { id: uuid(), name },
        };
        commit(next);
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
        };

        const next: AppState = { ...s, courses: [...s.courses, nextCourse] };
        commit(next);
        return id;
      },

      updateCourse(courseId, patch) {
        const s = getState();
        const next: AppState = {
          ...s,
          courses: s.courses.map((c) => (c.id === courseId ? { ...c, ...patch } : c)),
        };

        // Auto-create assessments when course is activated
        if (patch.isActive === true) {
          const hasAssessments = next.assessments.some((a) => a.courseId === courseId);
          if (!hasAssessments) {
            const newAssessments = [
              { id: uuid(), courseId, type: "efolio" as const, name: "e-fólio A", maxPoints: 4, grade: null },
              { id: uuid(), courseId, type: "efolio" as const, name: "e-fólio B", maxPoints: 4, grade: null },
              { id: uuid(), courseId, type: "exam" as const, name: "g-fólio", maxPoints: 12, grade: null },
              { id: uuid(), courseId, type: "resit" as const, name: "recurso", maxPoints: 20, grade: null },
            ];
            next.assessments = [...next.assessments, ...newAssessments];
          }
        }

        commit(next);
      },

      removeCourse(courseId) {
        const s = getState();
        const next: AppState = {
          ...s,
          courses: s.courses.filter((c) => c.id !== courseId),
          assessments: s.assessments.filter((a) => a.courseId !== courseId),
          rules: s.rules.filter((r) => r.courseId !== courseId),
        };
        commit(next);
      },

      mergePlanCourses(seeds) {
        if (!seeds || seeds.length === 0) return;

        const s = getState();
        const seedCodes = new Set(seeds.map((seed) => normCode(seed.code)));

        // Remove inactive/uncompleted courses that are NOT in the new plan
        // (keeps active and completed courses from any degree)
        const keepCourses = s.courses.filter(
          (c) => c.isActive || c.isCompleted || seedCodes.has(normCode(c.code))
        );

        const byCode = new Map(keepCourses.map((c) => [normCode(c.code), c]));
        const toAdd: Course[] = [];

        for (const seed of seeds) {
          const code = normCode(seed.code);
          if (!code) continue;
          if (byCode.has(code)) continue;

          toAdd.push({
            id: uuid(),
            code,
            name: (seed.name ?? "").trim(),
            year: Number(seed.year) || 1,
            semester: Number(seed.semester) || 1,
            isActive: false,
            isCompleted: false,
          });
        }

        const newCourses = [...keepCourses, ...toAdd];
        // Also clean up orphaned assessments/rules
        const courseIds = new Set(newCourses.map((c) => c.id));
        const next: AppState = {
          ...s,
          courses: newCourses,
          assessments: s.assessments.filter((a) => courseIds.has(a.courseId)),
          rules: s.rules.filter((r) => courseIds.has(r.courseId)),
        };
        commit(next);
      },

      setAssessmentGrade(assessmentId, grade) {
        const s = getState();
        const next: AppState = {
          ...s,
          assessments: s.assessments.map((a) => {
            if (a.id !== assessmentId) return a;
            const max = Number(a.maxPoints) || 0;
            const v = grade === null ? null : clamp(grade, 0, max);
            return { ...a, grade: v };
          }),
        };
        commit(next);
      },

      setAssessmentMaxPoints(assessmentId, maxPoints) {
        const s = getState();
        const mp = Math.max(0, Number(maxPoints) || 0);
        const next: AppState = {
          ...s,
          assessments: s.assessments.map((a) => {
            if (a.id !== assessmentId) return a;
            const g = a.grade === null ? null : clamp(a.grade, 0, mp);
            return { ...a, maxPoints: mp, grade: g };
          }),
        };
        commit(next);
      },

      setAssessmentDate(assessmentId, fields) {
        const s = getState();
        const next: AppState = {
          ...s,
          assessments: s.assessments.map((a) => (a.id === assessmentId ? { ...a, ...fields } : a)),
        };
        commit(next);
      },

      ensureAssessment(courseId, type, name) {
        const s = getState();
        const existing = s.assessments.find((a) => a.courseId === courseId && a.type === type && a.name === name);
        if (existing) return existing.id;

        const id = uuid();
        const next: AppState = {
          ...s,
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
        const s = getState();
        const now = new Date().toISOString();
        const next: AppState = {
          ...s,
          courses: s.courses.map((c) =>
            c.id === courseId ? { ...c, isCompleted: true, isActive: false, completedAt: now } : c,
          ),
        };
        commit(next);
      },

      addStudyBlock(block) {
        const s = getState();
        const id = uuid();
        const newBlock: StudyBlock = { ...block, id };
        const next: AppState = { ...s, studyBlocks: [...(s.studyBlocks ?? []), newBlock] };
        commit(next);
        return id;
      },

      updateStudyBlock(blockId, patch) {
        const s = getState();
        const next: AppState = {
          ...s,
          studyBlocks: (s.studyBlocks ?? []).map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
        };
        commit(next);
      },

      removeStudyBlock(blockId) {
        const s = getState();
        const next: AppState = {
          ...s,
          studyBlocks: (s.studyBlocks ?? []).filter((b) => b.id !== blockId),
        };
        commit(next);
      },

      setSync(patch) {
        const s = getState();
        const prev = s.sync ?? { enabled: false };
        const next: AppState = { ...s, sync: { ...prev, ...patch } };
        commit(next);
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
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Falha ao importar.";
          return { ok: false, error: msg } as const;
        }
      },

      replaceState(raw: unknown) {
        try {
          const migrated = migrate(raw);
          commit(migrated);
        } catch (e) {
          console.error("[AppStore] replaceState failed:", e);
          throw e;
        }
      },

      resetData() {
        const next = defaultState();
        commit(next);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
