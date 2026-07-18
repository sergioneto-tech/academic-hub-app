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
