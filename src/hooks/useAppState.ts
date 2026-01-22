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
      if (prev.activeCourses.find((c) => c.id === course.id)) {
        return prev;
      }
      const newCourse = { ...course, ativa: true, concluida: false };
      const defaultRule: Rules = {
        courseId: course.id,
        minAptoExame: 3.5,
        minExame: 5.5,
        formulaFinal: "somaSimples",
      };
      const defaultAssessments: Assessment[] = [
        { id: `${course.id}-ef-a`, courseId: course.id, tipo: "efolio", nome: "e-fólio A", maxNota: 2 },
        { id: `${course.id}-ef-b`, courseId: course.id, tipo: "efolio", nome: "e-fólio B", maxNota: 2 },
        { id: `${course.id}-pf`, courseId: course.id, tipo: "exame", nome: "p-fólio", maxNota: 16 },
      ];
      return {
        ...prev,
        activeCourses: [...prev.activeCourses, newCourse],
        rules: [...prev.rules, defaultRule],
        assessments: [...prev.assessments, ...defaultAssessments],
      };
    });
  }, []);

  const removeActiveCourse = useCallback((courseId: string) => {
    setState((prev) => ({
      ...prev,
      activeCourses: prev.activeCourses.filter((c) => c.id !== courseId),
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
      activeCourses: prev.activeCourses.map((c) =>
        c.id === courseId ? { ...c, concluida: true, ativa: false, notaFinal } : c
      ),
    }));
  }, []);

  const addCatalogCourse = useCallback((course: Omit<Course, "id" | "ativa" | "concluida">) => {
    const newCourse: Course = {
      ...course,
      id: Date.now().toString(),
      ativa: false,
      concluida: false,
    };
    setState((prev) => ({
      ...prev,
      catalog: [...prev.catalog, newCourse],
    }));
  }, []);

  const updateCatalogCourse = useCallback((courseId: string, updates: Partial<Course>) => {
    setState((prev) => ({
      ...prev,
      catalog: prev.catalog.map((c) =>
        c.id === courseId ? { ...c, ...updates } : c
      ),
    }));
  }, []);

  const removeCatalogCourse = useCallback((courseId: string) => {
    setState((prev) => ({
      ...prev,
      catalog: prev.catalog.filter((c) => c.id !== courseId),
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
