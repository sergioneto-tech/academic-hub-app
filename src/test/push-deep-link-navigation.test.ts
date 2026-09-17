import { describe, expect, it } from "vitest";

import { resolvePushNavigation } from "@/lib/pushDeepLinkNavigation";

describe("navegação a partir de notificações Push", () => {
  it("mantém o documento atual e muda apenas o hash dentro da PWA", () => {
    const decision = resolvePushNavigation(
      "https://academichub.sergioneto.pt/?ah_update_restart=123#/cadeiras",
      "https://academichub.sergioneto.pt/#/?release=1.6.5&_push=1",
    );

    expect(decision).toEqual({
      kind: "hash",
      hash: "#/?release=1.6.5&_push=1",
    });
  });

  it("usa navegação completa apenas quando o destino necessita de query fora do HashRouter", () => {
    const decision = resolvePushNavigation(
      "https://academichub.sergioneto.pt/#/",
      "https://academichub.sergioneto.pt/?modo=externo#/",
    );

    expect(decision.kind).toBe("assign");
  });

  it("ignora destinos de outra origem", () => {
    expect(
      resolvePushNavigation(
        "https://academichub.sergioneto.pt/#/",
        "https://example.com/#/",
      ),
    ).toEqual({ kind: "ignore" });
  });

  it("ignora destinos inválidos", () => {
    expect(resolvePushNavigation("not-a-url", "also-not-a-url")).toEqual({ kind: "ignore" });
  });
});
