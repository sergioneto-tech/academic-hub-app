export type PushNavigationDecision =
  | { kind: "hash"; hash: string }
  | { kind: "assign"; href: string }
  | { kind: "ignore" };

export function resolvePushNavigation(currentHref: string, targetHref: string): PushNavigationDecision {
  try {
    const current = new URL(currentHref);
    const target = new URL(targetHref, currentHref);

    if (target.origin !== current.origin) return { kind: "ignore" };

    // Os destinos Push do Academic Hub vivem no HashRouter. Quando a app já está
    // aberta, mudar apenas o hash mantém o bundle atual em execução e evita uma
    // navegação completa que possa misturar ficheiros de releases diferentes.
    if (target.pathname === current.pathname && !target.search && target.hash.startsWith("#/")) {
      return { kind: "hash", hash: target.hash };
    }

    return { kind: "assign", href: target.href };
  } catch {
    return { kind: "ignore" };
  }
}

export function applyPushNavigation(targetHref: string) {
  const decision = resolvePushNavigation(window.location.href, targetHref);
  if (decision.kind === "ignore") return;

  if (decision.kind === "hash") {
    if (window.location.hash !== decision.hash) {
      window.location.hash = decision.hash;
    } else {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    return;
  }

  window.location.assign(decision.href);
}
