import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AppStoreProvider, useAppStore } from "@/lib/AppStore";

function AssessmentProbe() {
  const { state, addEFolio, ensureAssessment } = useAppStore();

  useEffect(() => {
    ensureAssessment("course-1", "efolio", "e-fólio A");
    ensureAssessment("course-1", "efolio", "e-fólio B");
    ensureAssessment("course-1", "exam", "g-fólio");
    ensureAssessment("course-1", "resit", "recurso");
    // Este efeito simula a criação sequencial feita ao abrir uma cadeira.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assessments = state.assessments.filter((a) => a.courseId === "course-1");

  return (
    <div>
      <button type="button" onClick={() => addEFolio("course-1")}>Adicionar</button>
      <div data-testid="assessments">
        {assessments.map((a) => `${a.name}:${a.maxPoints}`).join("|")}
      </div>
    </div>
  );
}

function CourseActivationProbe() {
  const { state, updateCourse } = useAppStore();
  const course = state.courses.find((item) => item.id === "course-1");
  const assessments = state.assessments.filter((item) => item.courseId === "course-1");

  return (
    <div>
      <div data-testid="active-state">{course?.isActive ? "ativa" : "inativa"}</div>
      <div data-testid="assessment-count">{assessments.length}</div>
      <button type="button" onClick={() => updateCourse("course-1", { isActive: false })}>Desativar</button>
    </div>
  );
}

describe("gestão dinâmica de e-fólios", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("preserva todos os itens criados em sequência", async () => {
    render(
      <AppStoreProvider>
        <AssessmentProbe />
      </AppStoreProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("assessments").textContent).toContain("e-fólio A:4");
      expect(screen.getByTestId("assessments").textContent).toContain("e-fólio B:4");
      expect(screen.getByTestId("assessments").textContent).toContain("g-fólio:12");
      expect(screen.getByTestId("assessments").textContent).toContain("recurso:20");
    });
  });

  it("cria e-fólios adicionais com nomes sucessivos e peso inicial zero", async () => {
    render(
      <AppStoreProvider>
        <AssessmentProbe />
      </AppStoreProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("assessments").textContent).toContain("e-fólio B:4");
    });

    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() => {
      expect(screen.getByTestId("assessments").textContent).toContain("e-fólio C:0");
      expect(screen.getByTestId("assessments").textContent).toContain("e-fólio D:0");
    });
  });
});

describe("ativação de cadeiras", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("academic_hub_state", JSON.stringify({
      degree: null,
      courses: [
        {
          id: "course-1",
          code: "21000",
          name: "Cadeira de teste",
          year: 1,
          semester: 1,
          isActive: true,
          isCompleted: false,
        },
      ],
      assessments: [
        {
          id: "assessment-1",
          courseId: "course-1",
          type: "efolio",
          name: "e-fólio A",
          maxPoints: 4,
          grade: 3,
          startDate: "2026-08-20",
        },
      ],
      rules: [],
      studyBlocks: [],
      sync: { enabled: false },
    }));
  });

  it("permite desativar uma cadeira sem apagar avaliações nem datas", async () => {
    render(
      <AppStoreProvider>
        <CourseActivationProbe />
      </AppStoreProvider>,
    );

    expect(screen.getByTestId("active-state")).toHaveTextContent("ativa");
    expect(screen.getByTestId("assessment-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await waitFor(() => {
      expect(screen.getByTestId("active-state")).toHaveTextContent("inativa");
      expect(screen.getByTestId("assessment-count")).toHaveTextContent("1");
    });

    const persisted = JSON.parse(localStorage.getItem("academic_hub_state") ?? "{}") as {
      courses?: Array<{ id: string; isActive: boolean }>;
      assessments?: Array<{ id: string; startDate?: string }>;
    };
    expect(persisted.courses?.find((item) => item.id === "course-1")?.isActive).toBe(false);
    expect(persisted.assessments?.find((item) => item.id === "assessment-1")?.startDate).toBe("2026-08-20");
  });
});
