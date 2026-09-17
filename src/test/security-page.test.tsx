import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SecurityPrivacyPage from "@/pages/SecurityPrivacy";
import SecurityStatusCard from "@/components/SecurityStatusCard";
import * as securitySelfCheck from "@/lib/securitySelfCheck";

describe("Segurança e Transparência", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("abre a página e expõe a verificação manual", () => {
    render(
      <MemoryRouter>
        <SecurityPrivacyPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Segurança e Transparência" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verificar agora/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar a Os meus dados/i })).toHaveAttribute("href", "/dados-privacidade");
  });

  it("conclui automaticamente os seis controlos quando aberto com verificar=1", async () => {
    vi.spyOn(securitySelfCheck, "runSecuritySelfCheck").mockImplementation(async (id) => {
      const definition = securitySelfCheck.SECURITY_SELF_CHECKS.find((item) => item.id === id)!;
      return {
        ...definition,
        status: "pass",
        detail: "controlo validado",
      };
    });

    render(
      <MemoryRouter initialEntries={["/seguranca-privacidade?verificar=1"]}>
        <SecurityPrivacyPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Proteção verificada")).toBeInTheDocument();
      expect(screen.getByText("6/6")).toBeInTheDocument();
    });
  });

  it("mantém os atalhos do cartão de estado apontados para a área de segurança", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      schemaVersion: 1,
      product: "Academic Hub",
      securityLevel: "2026.09",
      lastAudit: new Date().toISOString(),
      status: "protected",
      summary: "Proteção validada.",
      checks: [],
      source: "test",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(
      <MemoryRouter>
        <SecurityStatusCard />
      </MemoryRouter>,
    );

    await screen.findByText("Proteção atualizada");
    expect(screen.getByRole("link", { name: /Verificar agora/i })).toHaveAttribute("href", "/seguranca-privacidade?verificar=1");
    expect(screen.getByRole("link", { name: /Segurança e Privacidade/i })).toHaveAttribute("href", "/seguranca-privacidade");
  });
});
