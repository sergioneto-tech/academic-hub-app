import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AppStoreProvider } from "@/lib/AppStore";
import type { AppState } from "@/lib/types";
import CourseDetail from "@/pages/CourseDetail";

function makeState(): AppState {
  return {
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
      { id: "ef-a", courseId: "course-1", type: "efolio", name: "e-fólio A", maxPoints: 4, grade: 3 },
      { id: "ef-b", courseId: "course-1", type: "efolio", name: "e-fólio B", maxPoints: 4, grade: 3 },
      { id: "exam", courseId: "course-1", type: "exam", name: "g-fólio", maxPoints: 12, grade: null },
      { id: "resit", courseId: "course-1", type: "resit", name: "recurso", maxPoints: 20, grade: null },
    ],
    rules: [],
    studyBlocks: [],
    sync: { enabled: false },
  };
}

function renderCourse() {
  render(
    <AppStoreProvider>
      <MemoryRouter initialEntries={["/cadeiras/course-1"]}>
        <Routes>
          <Route path="/cadeiras/:id" element={<CourseDetail />} />
          <Route path="/" element={<div>Página inicial</div>} />
        </Routes>
      </MemoryRouter>
    </AppStoreProvider>,
  );
}

function examGradeInput(): HTMLInputElement {
  const heading = screen.getByText("g‑Fólio (Exame)");
  const card = heading.closest(".rounded-xl");
  if (!card) throw new Error("Cartão do exame não encontrado");
  return within(card as HTMLElement).getByPlaceholderText("0,00") as HTMLInputElement;
}

describe("cartão de resultado no detalhe da cadeira", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("academic_hub_state", JSON.stringify(makeState()));
  });

  it("mostra a nota final e permite concluir após aprovação", async () => {
    renderCourse();

    fireEvent.change(examGradeInput(), { target: { value: "8" } });
    fireEvent.blur(examGradeInput());

    const title = await screen.findByText("Cadeira concluída com sucesso");
    const resultCard = title.closest('[role="status"]');
    expect(resultCard).not.toBeNull();
    expect(within(resultCard as HTMLElement).getByText("14", { selector: "div" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Concluir cadeira" }));
    expect(await screen.findByText("Página inicial")).toBeInTheDocument();
  });

  it("encaminha para recurso quando o resultado não permite aprovação", async () => {
    const state = makeState();
    state.assessments = state.assessments.map((item) =>
      item.type === "efolio" ? { ...item, grade: item.name === "e-fólio A" ? 2 : 1.5 } : item,
    );
    localStorage.setItem("academic_hub_state", JSON.stringify(state));

    renderCourse();

    fireEvent.change(examGradeInput(), { target: { value: "5,5" } });
    fireEvent.blur(examGradeInput());

    expect(await screen.findByText("Ainda não foi desta — prepara o recurso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registar nota de recurso" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Concluir cadeira" })).not.toBeInTheDocument();
  });

  it("não apresenta uma nota definitiva quando faltam classificações", async () => {
    const state = makeState();
    state.assessments = state.assessments.map((item) =>
      item.id === "ef-b" ? { ...item, grade: null } : item,
    );
    localStorage.setItem("academic_hub_state", JSON.stringify(state));

    renderCourse();

    fireEvent.change(examGradeInput(), { target: { value: "8" } });
    fireEvent.blur(examGradeInput());

    expect(await screen.findByText("Confirma os dados da avaliação")).toBeInTheDocument();
    expect(screen.getByText(/Faltam as notas de: e-fólio B/)).toBeInTheDocument();
  });
});
