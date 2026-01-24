import { useState, useEffect, useCallback } from "react";
import { AppState, Course, Assessment, Rules, Degree } from "@/types";
import { storage } from "@/lib/storage";

export function useAppState() {
  const [state, setState] = useState<AppState>(storage.get);

  useEffect(() => {
    storage.set(state);
  }, [state]);

  const setDegree = useCallback((degree: Degree) => {
    setState((prev) => ({ ...prev, degree }));
  }, []);

  const addActiveCourse = useCallback((course: Course) => {
    setState((prev) => {
      if (prev.courses.find((c) => c.id === course.id)) {
        return prev;
      }
      const newCourse = { ...course, isActive: true, isCompleted: false };
      const defaultRule: Rules = {
        courseId: course.id,
        minAptoExame: 3.5,
        minExame: 5.5,
      };
      const defaultAssessments: Assessment[] = [
        { id: `${course.id}-ef-a`, courseId: course.id, type: "efolio", name: "e-fólio A", maxPoints: 2, grade: null },
        { id: `${course.id}-ef-b`, courseId: course.id, type: "efolio", name: "e-fólio B", maxPoints: 2, grade: null },
        { id: `${course.id}-pf`, courseId: course.id, type: "exam", name: "p-fólio", maxPoints: 16, grade: null },
      ];
      return {
        ...prev,
        courses: [...prev.courses, newCourse],
        rules: [...prev.rules, defaultRule],
        assessments: [...prev.assessments, ...defaultAssessments],
      };
    });
  }, []);

  const removeActiveCourse = useCallback((courseId: string) => {
    setState((prev) => ({
      ...prev,
      courses: prev.courses.filter((c) => c.id !== courseId),
      assessments: prev.assessments.filter((a) => a.courseId !== courseId),
      rules: prev.rules.filter((r) => r.courseId !== courseId),
    }));
  }, []);

  const updateAssessment = useCallback((assessmentId: string, updates: Partial<Assessment>) => {
    setState((prev) => ({
      ...prev,
      assessments: prev.assessments.map((a) =>
        a.id === assessmentId ? { ...a, ...updates } : a
      ),
    }));
  }, []);

  const markCourseComplete = useCallback((courseId: string, notaFinal: number) => {
    setState((prev) => ({
      ...prev,
      courses: prev.courses.map((c) =>
        c.id === courseId ? { ...c, isCompleted: true, isActive: false } : c
      ),
    }));
  }, []);

  const addCatalogCourse = useCallback((course: Omit<Course, "id" | "isActive" | "isCompleted">) => {
    const newCourse: Course = {
      ...course,
      id: Date.now().toString(),
      isActive: false,
      isCompleted: false,
    };
    setState((prev) => ({
      ...prev,
      courses: [...prev.courses, newCourse],
    }));
  }, []);

  const updateCatalogCourse = useCallback((courseId: string, updates: Partial<Course>) => {
    setState((prev) => ({
      ...prev,
      courses: prev.courses.map((c) =>
        c.id === courseId ? { ...c, ...updates } : c
      ),
    }));
  }, []);

  const removeCatalogCourse = useCallback((courseId: string) => {
    setState((prev) => ({
      ...prev,
      courses: prev.courses.filter((c) => c.id !== courseId),
    }));
  }, []);

  const importData = useCallback((json: string): boolean => {
    const success = storage.import(json);
    if (success) {
      setState(storage.get());
    }
    return success;
  }, []);

  const exportData = useCallback((): string => {
    return storage.export();
  }, []);

  const resetData = useCallback(() => {
    storage.reset();
    setState(storage.get());
  }, []);

  return {
    state,
    setDegree,
    addActiveCourse,
    removeActiveCourse,
    updateAssessment,
    markCourseComplete,
    addCatalogCourse,
    updateCatalogCourse,
    removeCatalogCourse,
    importData,
    exportData,
    resetData,
  };
}
