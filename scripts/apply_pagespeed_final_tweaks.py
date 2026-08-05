from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Insertion point not found: {label}")
    return text.replace(old, new, 1)


# 1) Remove release-notes.json from the critical rendering path and cache it per session.
path = Path("src/components/Layout.tsx")
text = path.read_text(encoding="utf-8")

old = '''type ReleaseNotesData = {
  latest?: string;
  versions?: ReleaseNotesEntry[];
};
'''
new = '''type ReleaseNotesData = {
  latest?: string;
  versions?: ReleaseNotesEntry[];
};

type IdleCapableWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};
'''
text = replace_once(text, old, new, "idle window type")

old = '''  useEffect(() => {
    let cancelled = false;

    fetch(notesUrl, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setReleaseNotes(data as ReleaseNotesData);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [notesUrl, updateAvailable]);
'''
new = '''  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const idleWindow = window as IdleCapableWindow;
    const cacheKey = `academic_hub_release_notes_${APP_VERSION}`;

    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) setReleaseNotes(JSON.parse(cached) as ReleaseNotesData);
    } catch {
      // O carregamento remoto continua disponível quando a cache não pode ser lida.
    }

    const loadReleaseNotes = () => {
      fetch(notesUrl, { cache: "force-cache" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          const parsed = data as ReleaseNotesData;
          setReleaseNotes(parsed);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(parsed));
          } catch {
            // Sem impacto funcional.
          }
        })
        .catch(() => undefined);
    };

    const scheduleLoad = () => {
      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(loadReleaseNotes, { timeout: 2500 });
      } else {
        timerId = setTimeout(loadReleaseNotes, 1200);
      }
    };

    if (document.readyState === "complete") scheduleLoad();
    else window.addEventListener("load", scheduleLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", scheduleLoad);
      if (timerId !== null) clearTimeout(timerId);
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
    };
  }, [notesUrl, updateAvailable]);
'''
text = replace_once(text, old, new, "deferred release notes fetch")

old = '''<span className="rounded-full border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold-soft))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--gold))]">'''
new = '''<span className="rounded-full border border-amber-700/40 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950 dark:border-[hsl(var(--gold)/0.45)] dark:bg-[hsl(var(--gold-soft))] dark:text-amber-200">'''
text = replace_once(text, old, new, "version badge contrast")
path.write_text(text, encoding="utf-8")


# 2) Give agents a valid Markdown index with explicit links.
Path("public/llms.txt").write_text(
    '''# Academic Hub

> Aplicação Web pessoal para organizar o percurso académico de estudantes da Universidade Aberta.

## Ligações principais

- [Abrir o Academic Hub](https://academichub.sergioneto.pt/)
- [Ajuda e guia de utilização](https://academichub.sergioneto.pt/#/ajuda)
- [Informação legal e privacidade](https://academichub.sergioneto.pt/#/legal)
- [Portal oficial da Universidade Aberta](https://portal.uab.pt/)
- [Calendário letivo da Universidade Aberta](https://portal.uab.pt/calendario-letivo/)

## Finalidade

- Gerir cadeiras ativas e concluídas.
- Registar e-fólios, atividades, exames, recursos, notas e datas.
- Calcular progresso, média, ECTS e estado das avaliações.
- Organizar calendário e plano pessoal de estudo.
- Sincronizar dados privados com uma conta autenticada.

## Áreas públicas da aplicação

- [Painel inicial](https://academichub.sergioneto.pt/#/)
- [Ajuda e guia](https://academichub.sergioneto.pt/#/ajuda)
- [Informação legal e privacidade](https://academichub.sergioneto.pt/#/legal)

## Privacidade

Os dados académicos pertencem ao utilizador e não devem ser inferidos, expostos ou indexados. As áreas com dados pessoais funcionam no navegador e, quando ativado, num backend autenticado com políticas de acesso por utilizador.

## Fonte institucional

A aplicação referencia informação pública da [Universidade Aberta](https://portal.uab.pt/), incluindo planos de estudo, calendário letivo e regulamentos. A confirmação final de regras, ponderações e prazos deve ser feita no PUC e nos canais oficiais da Universidade Aberta.
''',
    encoding="utf-8",
)


# 3) Permit short browser caching of release notes; updates remain timely without blocking repeat visits.
path = Path("public/_headers")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '''/release-notes.json
  Cache-Control: no-cache, no-store, must-revalidate
''',
    '''/release-notes.json
  Cache-Control: public, max-age=300, stale-while-revalidate=86400
''',
    "release notes cache header",
)
path.write_text(text, encoding="utf-8")

print("Final PageSpeed tweaks applied.")
