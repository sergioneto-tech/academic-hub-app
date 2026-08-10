import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "@/lib/AppStore";
import { exam, getRegulationOutcome, needsResit, resit } from "@/lib/calculations";
import type { Assessment, EvaluationModel } from "@/lib/types";

export const UAB_ASSESSMENT_YEAR = "2026/2027";

export type OfficialExamSlot = {
  status: "scheduled" | "unavailable";
  dateTime: string | null;
};

export type OfficialExamEntry = {
  code: string;
  name: string;
  continuousNormal: OfficialExamSlot;
  continuousResit: OfficialExamSlot;
  examNormal: OfficialExamSlot;
  examResit: OfficialExamSlot;
};

type RegulationRow = {
  academic_year: string;
  source_url: string;
  uc_codes: string[];
  checked_at: string;
};

type ScheduleRow = {
  academic_year: string;
  semester: number;
  source_url: string;
  checked_at: string;
  payload: {
    entries?: OfficialExamEntry[];
  };
};

type ApiResponse = {
  regulation?: RegulationRow | null;
  schedules?: ScheduleRow[];
};

type OfficialAssessmentData = {
  regulationCodes: Set<string>;
  regulationSource: string | null;
  regulationCheckedAt: string | null;
  schedules: Map<number, { entries: Map<string, OfficialExamEntry>; sourceUrl: string; checkedAt: string }>;
};

const CACHE_KEY = `academicHub:uabAssessment:${UAB_ASSESSMENT_YEAR}`;

function normalizeCode(value: string) {
  return (value ?? "").trim();
}

function validSlot(value: unknown): value is OfficialExamSlot {
  if (!value || typeof value !== "object") return false;
  const slot = value as Partial<OfficialExamSlot>;
  return (slot.status === "scheduled" || slot.status === "unavailable")
    && (slot.dateTime === null || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slot.dateTime ?? ""));
}

function validEntry(value: unknown): value is OfficialExamEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<OfficialExamEntry>;
  return typeof entry.code === "string"
    && typeof entry.name === "string"
    && validSlot(entry.continuousNormal)
    && validSlot(entry.continuousResit)
    && validSlot(entry.examNormal)
    && validSlot(entry.examResit);
}

function parseApi(body: ApiResponse): OfficialAssessmentData | null {
  const codes = body.regulation?.uc_codes;
  if (!body.regulation || !Array.isArray(codes) || codes.length === 0) return null;

  const schedules = new Map<number, { entries: Map<string, OfficialExamEntry>; sourceUrl: string; checkedAt: string }>();
  for (const row of body.schedules ?? []) {
    const entries = row.payload?.entries;
    if ((row.semester !== 1 && row.semester !== 2) || !Array.isArray(entries) || !entries.every(validEntry)) continue;
    schedules.set(row.semester, {
      entries: new Map(entries.map((entry) => [normalizeCode(entry.code), entry])),
      sourceUrl: row.source_url,
      checkedAt: row.checked_at,
    });
  }

  return {
    regulationCodes: new Set(codes.map(normalizeCode).filter(Boolean)),
    regulationSource: body.regulation.source_url,
    regulationCheckedAt: body.regulation.checked_at,
    schedules,
  };
}

function serialize(data: OfficialAssessmentData) {
  return {
    regulationCodes: [...data.regulationCodes],
    regulationSource: data.regulationSource,
    regulationCheckedAt: data.regulationCheckedAt,
    schedules: [...data.schedules.entries()].map(([semester, value]) => ({
      semester,
      sourceUrl: value.sourceUrl,
      checkedAt: value.checkedAt,
      entries: [...value.entries.values()],
    })),
  };
}

function readCache(): OfficialAssessmentData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as {
      regulationCodes?: string[];
      regulationSource?: string | null;
      regulationCheckedAt?: string | null;
      schedules?: Array<{ semester: number; sourceUrl: string; checkedAt: string; entries: OfficialExamEntry[] }>;
    };
    if (!Array.isArray(cached.regulationCodes) || cached.regulationCodes.length === 0) return null;
    const schedules = new Map<number, { entries: Map<string, OfficialExamEntry>; sourceUrl: string; checkedAt: string }>();
    for (const row of cached.schedules ?? []) {
      if ((row.semester !== 1 && row.semester !== 2) || !Array.isArray(row.entries) || !row.entries.every(validEntry)) continue;
      schedules.set(row.semester, {
        entries: new Map(row.entries.map((entry) => [normalizeCode(entry.code), entry])),
        sourceUrl: row.sourceUrl,
        checkedAt: row.checkedAt,
      });
    }
    return {
      regulationCodes: new Set(cached.regulationCodes.map(normalizeCode).filter(Boolean)),
      regulationSource: cached.regulationSource ?? null,
      regulationCheckedAt: cached.regulationCheckedAt ?? null,
      schedules,
    };
  } catch {
    return null;
  }
}

function isExamOnly(model: EvaluationModel | undefined) {
  return model === "exam-only";
}

function sameOfficialDate(item: Assessment | null, dateTime: string | null, checkedAt: string) {
  return Boolean(item)
    && (item?.date ?? "") === (dateTime ?? "")
    && item?.dateSource === "official"
    && item?.officialCheckedAt === checkedAt;
}

export function useUabOfficialAssessmentSync() {
  const { state, updateCourse, ensureAssessment, updateAssessment } = useAppStore();
  const [official, setOfficial] = useState<OfficialAssessmentData | null>(() => {
    if (typeof window === "undefined") return null;
    return readCache();
  });

  useEffect(() => {
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
    if (!supabaseUrl) return;
    const controller = new AbortController();
    const url = `${supabaseUrl}/functions/v1/uab-assessment-sync?year=${encodeURIComponent(UAB_ASSESSMENT_YEAR)}`;

    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`uab assessment ${response.status}`);
        return response.json() as Promise<ApiResponse>;
      })
      .then((body) => {
        const parsed = parseApi(body);
        if (!parsed) return;
        setOfficial(parsed);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(serialize(parsed))); } catch { /* cache opcional */ }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Mantém silenciosamente a última versão oficial válida guardada localmente.
      });

    return () => controller.abort();
  }, []);

  const activeCourses = useMemo(
    () => state.courses.filter((course) => course.isActive && !course.isCompleted),
    [state.courses],
  );

  useEffect(() => {
    if (!official) return;

    for (const course of activeCourses) {
      const code = normalizeCode(course.code);
      if (!code) continue;
      const coveredByRegulation = official.regulationCodes.has(code);

      if (coveredByRegulation && (course.evaluationRegime !== "regulation-2026" || course.evaluationRegimeSource !== "official")) {
        updateCourse(course.id, {
          evaluationRegime: "regulation-2026",
          evaluationRegimeSource: "official",
          evaluationModel: course.evaluationModel ?? "custom",
        });
        continue;
      }
      if (!coveredByRegulation && course.evaluationRegimeSource === "official" && course.evaluationRegime !== "legacy") {
        updateCourse(course.id, { evaluationRegime: "legacy", evaluationRegimeSource: "official" });
        continue;
      }

      const schedule = official.schedules.get(course.semester);
      const entry = schedule?.entries.get(code);
      if (!schedule || !entry) continue;

      const normalSlot = isExamOnly(course.evaluationModel) ? entry.examNormal : entry.continuousNormal;
      const existingExam = exam(state, course.id);
      if (normalSlot.status === "scheduled" && normalSlot.dateTime) {
        if (!existingExam) {
          ensureAssessment(course.id, "exam", isExamOnly(course.evaluationModel) ? "Exame" : "Prova síncrona");
          continue;
        }
        if (!sameOfficialDate(existingExam, normalSlot.dateTime, schedule.checkedAt)) {
          updateAssessment(existingExam.id, {
            date: normalSlot.dateTime,
            dateSource: "official",
            officialCheckedAt: schedule.checkedAt,
          });
          continue;
        }
      } else if (existingExam?.dateSource === "official" && existingExam.date) {
        updateAssessment(existingExam.id, { date: undefined, officialCheckedAt: schedule.checkedAt });
        continue;
      }

      const regulationOutcome = coveredByRegulation ? getRegulationOutcome(state, course.id) : null;
      const legacyExam = exam(state, course.id);
      const shouldExposeResit = coveredByRegulation
        ? regulationOutcome?.kind === "resit" || regulationOutcome?.kind === "failed" || resit(state, course.id)?.grade !== null
        : legacyExam?.grade !== null && needsResit(state, course.id);
      const existingResit = resit(state, course.id);

      if (!shouldExposeResit) {
        if (existingResit?.dateSource === "official" && existingResit.date) {
          updateAssessment(existingResit.id, { date: undefined, officialCheckedAt: schedule.checkedAt });
        }
        continue;
      }

      const resitSlot = isExamOnly(course.evaluationModel) ? entry.examResit : entry.continuousResit;
      if (resitSlot.status === "scheduled" && resitSlot.dateTime) {
        if (!existingResit) {
          ensureAssessment(course.id, "resit", "Recurso");
          continue;
        }
        if (!sameOfficialDate(existingResit, resitSlot.dateTime, schedule.checkedAt)) {
          updateAssessment(existingResit.id, {
            date: resitSlot.dateTime,
            dateSource: "official",
            officialCheckedAt: schedule.checkedAt,
          });
        }
      } else if (existingResit?.dateSource === "official" && existingResit.date) {
        updateAssessment(existingResit.id, { date: undefined, officialCheckedAt: schedule.checkedAt });
      }
    }
  }, [activeCourses, ensureAssessment, official, state, updateAssessment, updateCourse]);

  return official;
}
