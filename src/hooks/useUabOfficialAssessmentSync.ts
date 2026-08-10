import { useEffect } from "react";

import { useAppStore } from "@/lib/AppStore";
import type { AppState, Assessment, Course } from "@/lib/types";

const ACADEMIC_YEAR = "2026/2027";
const CACHE_KEY = `academicHub:uabAssessment:${ACADEMIC_YEAR}`;

type OfficialSlot = {
  status: "scheduled" | "unavailable";
  dateTime: string | null;
};

type OfficialExamEntry = {
  code: string;
  name: string;
  continuousNormal: OfficialSlot;
  continuousResit: OfficialSlot;
  examNormal: OfficialSlot;
  examResit: OfficialSlot;
};

type ScheduleRow = {
  semester: 1 | 2;
  checked_at?: string;
  payload?: { entries?: OfficialExamEntry[] };
};

type OfficialSnapshot = {
  regulation?: {
    uc_codes?: string[];
    checked_at?: string;
    source_url?: string;
  } | null;
  schedules?: ScheduleRow[];
};

function readCache(): OfficialSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfficialSnapshot;
  } catch {
    return null;
  }
}

function writeCache(snapshot: OfficialSnapshot) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot)); } catch { /* cache opcional */ }
}

function normalizedCode(value: string) {
  return String(value ?? "").trim();
}

function scheduleMap(snapshot: OfficialSnapshot) {
  const map = new Map<string, { entry: OfficialExamEntry; checkedAt?: string }>();
  for (const row of snapshot.schedules ?? []) {
    for (const entry of row.payload?.entries ?? []) {
      map.set(`${row.semester}:${normalizedCode(entry.code)}`, { entry, checkedAt: row.checked_at });
    }
  }
  return map;
}

function sameAssessment(a: Assessment, b: Assessment) {
  return a.date === b.date
    && a.dateSource === b.dateSource
    && a.officialCheckedAt === b.officialCheckedAt;
}

function applyOfficialDate(
  assessment: Assessment,
  slot: OfficialSlot | undefined,
  checkedAt: string | undefined,
): Assessment {
  if (!slot) return assessment;
  if (slot.status === "scheduled" && slot.dateTime) {
    const next = {
      ...assessment,
      date: slot.dateTime,
      dateSource: "official" as const,
      officialCheckedAt: checkedAt,
    };
    return sameAssessment(assessment, next) ? assessment : next;
  }
  if (assessment.dateSource === "official") {
    const next = { ...assessment, date: undefined, officialCheckedAt: checkedAt };
    return sameAssessment(assessment, next) ? assessment : next;
  }
  return assessment;
}

function officialSlots(course: Course, entry: OfficialExamEntry) {
  const examPath = course.evaluationModel === "exam-only"
    || (course.evaluationRegime === "legacy" && course.legacyEvaluationMode === "exam-only");
  return examPath
    ? { normal: entry.examNormal, resit: entry.examResit }
    : { normal: entry.continuousNormal, resit: entry.continuousResit };
}

function applySnapshot(state: AppState, snapshot: OfficialSnapshot): AppState {
  const regulationCodes = new Set((snapshot.regulation?.uc_codes ?? []).map(normalizedCode));
  const schedules = scheduleMap(snapshot);
  let changed = false;

  const courses = state.courses.map((course) => {
    if (!course.isActive || course.isCompleted) return course;
    const covered = regulationCodes.has(normalizedCode(course.code));
    if (covered && (course.evaluationRegime !== "regulation-2026" || course.evaluationRegimeSource !== "official")) {
      changed = true;
      return {
        ...course,
        evaluationRegime: "regulation-2026" as const,
        evaluationRegimeSource: "official" as const,
        evaluationModel: course.evaluationModel ?? "custom",
      };
    }
    if (!covered && course.evaluationRegimeSource === "official") {
      changed = true;
      return {
        ...course,
        evaluationRegime: "legacy" as const,
        evaluationRegimeSource: undefined,
      };
    }
    return course;
  });

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const assessments = state.assessments.map((assessment) => {
    if (assessment.type !== "exam" && assessment.type !== "resit") return assessment;
    const course = courseById.get(assessment.courseId);
    if (!course || !course.isActive || course.isCompleted) return assessment;
    const scheduled = schedules.get(`${course.semester}:${normalizedCode(course.code)}`);
    if (!scheduled) return assessment;
    const slots = officialSlots(course, scheduled.entry);
    const next = applyOfficialDate(
      assessment,
      assessment.type === "exam" ? slots.normal : slots.resit,
      scheduled.checkedAt,
    );
    if (next !== assessment) changed = true;
    return next;
  });

  return changed ? { ...state, courses, assessments } : state;
}

export function useUabOfficialAssessmentSync() {
  const { state, replaceState } = useAppStore();

  useEffect(() => {
    let cancelled = false;
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");

    const apply = (snapshot: OfficialSnapshot | null) => {
      if (!snapshot || cancelled) return;
      const next = applySnapshot(state, snapshot);
      if (next !== state) replaceState(next);
    };

    apply(readCache());
    if (!supabaseUrl) return () => { cancelled = true; };

    const controller = new AbortController();
    void fetch(`${supabaseUrl}/functions/v1/uab-assessment-sync?year=${encodeURIComponent(ACADEMIC_YEAR)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`assessment ${response.status}`);
        return response.json() as Promise<OfficialSnapshot>;
      })
      .then((snapshot) => {
        if (cancelled) return;
        writeCache(snapshot);
        apply(snapshot);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Mantém silenciosamente a última fonte oficial válida em cache.
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [replaceState, state]);
}
