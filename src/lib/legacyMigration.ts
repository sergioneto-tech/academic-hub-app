import type { AppState } from "@/lib/types";

export type LocalMigrationSummary = {
  courses: number;
  assessments: number;
  studyBlocks: number;
  completedCourses: number;
  hasDegree: boolean;
  hasProfile: boolean;
};

export function getLocalMigrationSummary(state: AppState): LocalMigrationSummary {
  const courses = state.courses?.length ?? 0;
  const assessments = state.assessments?.length ?? 0;
  const studyBlocks = state.studyBlocks?.length ?? 0;
  const completedCourses = state.courses?.filter((course) => course.isCompleted).length ?? 0;
  const hasDegree = Boolean(state.degree);
  const hasProfile = Boolean(
    state.profile?.displayName?.trim() ||
      state.profile?.avatarUrl?.trim() ||
      state.profile?.avatarPath?.trim(),
  );

  return {
    courses,
    assessments,
    studyBlocks,
    completedCourses,
    hasDegree,
    hasProfile,
  };
}

export function hasMeaningfulLocalMigrationData(state: AppState): boolean {
  const summary = getLocalMigrationSummary(state);
  return Boolean(
    summary.courses > 0 ||
      summary.assessments > 0 ||
      summary.studyBlocks > 0 ||
      (state.rules?.length ?? 0) > 0 ||
      summary.hasDegree ||
      summary.hasProfile,
  );
}
