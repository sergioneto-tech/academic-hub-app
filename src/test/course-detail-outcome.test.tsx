import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  return render(
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

function efolioCard(name: string): HTMLElement {
  const heading = screen.getByText(name, { exact: true });
  const card = heading.closest(".rounded-lg.border");
  if (!card) throw new Error(`Cartão ${name} não encontrado`);
  return card as HTMLElement;
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

  it("permite limpar uma nota já registada num e-fólio", async () => {
    renderCourse();
    const card = efolioCard("e-fólio A");
    const gradeInput = within(card).getByPlaceholderText("0,00") as HTMLInputElement;

    expect(gradeInput.value).toBe("3");
    fireEvent.change(gradeInput, { target: { value: "" } });
    fireEvent.blur(gradeInput);

    await waitFor(() => expect(gradeInput.value).toBe(""));
    const persisted = JSON.parse(localStorage.getItem("academic_hub_state") ?? "{}") as AppState;
    expect(persisted.assessments.find((item) => item.id === "ef-a")?.grade).toBeNull();
  });

  it("permite eliminar e-fólios A/B duplicados e não os recria ao reabrir a cadeira", async () => {
    const state = makeState();
    state.assessments = [
      {
        id: "puc-a",
        courseId: "course-1",
        type: "efolio",
        name: "E-fólio A",
        maxPoints: 4,
        grade: null,
        startDate: "2026-10-16",
        endDate: "2026-10-27",
        gradeReleaseDate: "2026-11-09",
      },
      {
        id: "puc-b",
        courseId: "course-1",
        type: "efolio",
        name: "E-fólio B",
        maxPoints: 4,
        grade: null,
        startDate: "2026-11-16",
        endDate: "2026-12-09",
        gradeReleaseDate: "2026-12-18",
      },
      { id: "ef-a", courseId: "course-1", type: "efolio", name: "e-fólio A", maxPoints: 4, grade: 0 },
      { id: "ef-b", courseId: "course-1", type: "efolio", name: "e-fólio B", maxPoints: 4, grade: 0 },
      { id: "exam", courseId: "course-1", type: "exam", name: "g-fólio", maxPoints: 12, grade: null },
      { id: "resit", courseId: "course-1", type: "resit", name: "recurso", maxPoints: 20, grade: null },
    ];
    localStorage.setItem("academic_hub_state", JSON.stringify(state));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const view = renderCourse();
    expect(screen.getAllByRole("button", { name: /Remover .*fólio [AB]/ })).toHaveLength(8);

    fireEvent.click(screen.getAllByRole("button", { name: "Remover e-fólio A" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Remover e-fólio B" })[0]);

    await waitFor(() => {
      expect(screen.queryByText("e-fólio A", { exact: true })).not.toBeInTheDocument();
      expect(screen.queryByText("e-fólio B", { exact: true })).not.toBeInTheDocument();
      expect(screen.getByText("E-fólio A", { exact: true })).toBeInTheDocument();
      expect(screen.getByText("E-fólio B", { exact: true })).toBeInTheDocument();
    });

    let persisted = JSON.parse(localStorage.getItem("academic_hub_state") ?? "{}") as AppState;
    expect(persisted.assessments.filter((item) => item.courseId === "course-1" && item.type === "efolio")).toHaveLength(2);

    view.unmount();
    renderCourse();

    await waitFor(() => {
      expect(screen.queryByText("e-fólio A", { exact: true })).not.toBeInTheDocument();
      expect(screen.queryByText("e-fólio B", { exact: true })).not.toBeInTheDocument();
    });
    persisted = JSON.parse(localStorage.getItem("academic_hub_state") ?? "{}") as AppState;
    expect(persisted.assessments.filter((item) => item.courseId === "course-1" && item.type === "efolio")).toHaveLength(2);
  });
});
