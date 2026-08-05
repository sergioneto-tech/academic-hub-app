from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Insertion point not found: {label}")
    return text.replace(old, new, 1)


# Dashboard: centre every metric card in both axes, independently of its icon.
path = Path("src/pages/Dashboard.tsx")
text = path.read_text(encoding="utf-8")
old = '''            <Card key={metric.label} className="premium-card">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">{metric.label}</div>
                  <div className="mt-0.5 text-2xl font-semibold tracking-tight">{metric.value}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{metric.detail}</div>
                </div>
              </CardContent>
            </Card>'''
new = '''            <Card key={metric.label} className="premium-card">
              <CardContent className="dashboard-metric-card flex min-h-36 flex-col items-center justify-center gap-2 p-4 text-center">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 text-center">
                  <div className="text-xs font-medium text-muted-foreground">{metric.label}</div>
                  <div className="mt-0.5 text-2xl font-semibold tracking-tight">{metric.value}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{metric.detail}</div>
                </div>
              </CardContent>
            </Card>'''
text = replace_once(text, old, new, "dashboard metric cards")
path.write_text(text, encoding="utf-8")


# Flexible course detail: centre the three summary cards.
path = Path("src/pages/FlexibleCourseDetail.tsx")
text = path.read_text(encoding="utf-8")
start = text.index('      <section className="grid gap-3 sm:grid-cols-3">')
end = text.index('      </section>', start) + len('      </section>')
block = text[start:end]
if block.count('<CardContent className="p-4">') != 3:
    raise SystemExit("Unexpected flexible summary card structure")
block = block.replace(
    '<CardContent className="p-4">',
    '<CardContent className="flex min-h-36 flex-col items-center justify-center p-4 text-center">',
)
text = text[:start] + block + text[end:]
path.write_text(text, encoding="utf-8")


# Evaluation settings: explain Models 1-4, align selectors and make invalid scales explicit.
path = Path("src/components/CourseEvaluationSettings.tsx")
text = path.read_text(encoding="utf-8")

model_pattern = re.compile(
    r'const MODEL_OPTIONS: Array<\{.*?\n\];\n\nconst TYPE_OPTIONS:',
    re.S,
)
model_replacement = '''const MODEL_OPTIONS: Array<{
  value: EvaluationModel;
  label: string;
  description: string;
  whenToUse: string;
}> = [
  {
    value: "type1",
    label: "Modelo 1",
    description: "Combina elementos assíncronos e síncronos, com mínimos definidos em ambas as componentes e classificação global mínima de 10/20.",
    whenToUse: "Seleciona quando o PUC indicar Modelo 1.",
  },
  {
    value: "type2",
    label: "Modelo 2",
    description: "Usa atividades obrigatórias. Pelo menos N−1 atividades devem cumprir a percentagem mínima e a soma final deve atingir 10/20.",
    whenToUse: "Seleciona quando o PUC indicar Modelo 2.",
  },
  {
    value: "type3",
    label: "Modelo 3",
    description: "Também verifica as atividades obrigatórias pela regra N−1; o número, formato e ponderação concretos são os definidos no PUC.",
    whenToUse: "Seleciona quando o PUC indicar Modelo 3.",
  },
  {
    value: "type4",
    label: "Modelo 4",
    description: "Combina componentes assíncrona e síncrona, com mínimos em ambas; as ponderações concretas são as indicadas no PUC.",
    whenToUse: "Seleciona quando o PUC indicar Modelo 4.",
  },
  {
    value: "exam-only",
    label: "Avaliação final",
    description: "Classificação obtida exclusivamente numa prova final de 20 valores.",
    whenToUse: "Seleciona quando a avaliação for exclusivamente por prova final.",
  },
  {
    value: "custom",
    label: "Personalizado",
    description: "Elementos obrigatórios configurados manualmente, totalizando 20 valores.",
    whenToUse: "Usa apenas quando o PUC não corresponder aos modelos predefinidos.",
  },
];

const TYPE_OPTIONS:'''
text, count = model_pattern.subn(model_replacement, text, count=1)
if count != 1:
    raise SystemExit("MODEL_OPTIONS block not found")

old = '''          <div className="grid gap-2">
            <Label>Regime aplicável</Label>
            <Select value={regime} onValueChange={(value) => setRegime(value as EvaluationRegime)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="legacy">Regime anterior — e-fólios + g-fólio</SelectItem>
                <SelectItem value="regulation-2026">Regulamento de avaliação 2026</SelectItem>
              </SelectContent>
            </Select>
          </div>'''
new = '''          <div className="grid content-start gap-2">
            <Label>Regime aplicável</Label>
            <Select value={regime} onValueChange={(value) => setRegime(value as EvaluationRegime)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="legacy">Regime anterior — e-fólios + g-fólio</SelectItem>
                <SelectItem value="regulation-2026">Regulamento de avaliação 2026</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Seleciona o regime indicado no PUC da cadeira.
            </p>
          </div>'''
text = replace_once(text, old, new, "regime selector alignment")
text = replace_once(
    text,
    '<div className="grid gap-2">\n            <Label>Modelo</Label>',
    '<div className="grid content-start gap-2">\n            <Label>Modelo</Label>',
    "model selector alignment",
)

marker = '''            <p className="text-[11px] text-muted-foreground">
              {regime === "legacy"
                ? "O cálculo atual permanece exatamente como estava."
                : MODEL_OPTIONS.find((option) => option.value === model)?.description}
            </p>
          </div>
        </div>
'''
enhanced = '''            <p className="text-[11px] text-muted-foreground">
              {regime === "legacy"
                ? "O cálculo atual permanece exatamente como estava."
                : MODEL_OPTIONS.find((option) => option.value === model)?.description}
            </p>
          </div>
        </div>

        {regime === "regulation-2026" && (
          <div className="space-y-3 rounded-2xl border bg-muted/15 p-4">
            <div className="text-center">
              <div className="text-sm font-semibold">Como escolher o modelo</div>
              <p className="mt-1 text-xs text-muted-foreground">
                A escolha não é pessoal: usa o modelo indicado no PUC. Estes resumos explicam a lógica aplicada pela app.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {MODEL_OPTIONS.filter((option) => option.value.startsWith("type")).map((option) => {
                const selected = option.value === model;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setModel(option.value)}
                    className={`flex min-h-40 flex-col items-center justify-center rounded-2xl border p-4 text-center transition-colors ${selected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : "bg-card hover:bg-muted/35"}`}
                    aria-pressed={selected}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="text-base font-semibold">{option.label}</div>
                      {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                    </div>
                    <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">{option.description}</p>
                    <p className="mt-3 text-[11px] font-medium leading-5 text-foreground/80">{option.whenToUse}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Confirma no PUC os elementos, as ponderações e os mínimos antes de registares as avaliações.
            </p>
          </div>
        )}
'''
text = replace_once(text, marker, enhanced, "model guidance")

old = '''            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="rounded-xl border bg-muted/25 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">Escala configurada</span>
                  <span className={requiredMaximum === 20 ? "text-emerald-700 dark:text-emerald-400" : "text-warning"}>
                    {formatPtNumber(requiredMaximum)} / 20 valores
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Apenas os elementos marcados como obrigatórios entram no cálculo principal.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addElement} disabled={model === "exam-only"}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar elemento
              </Button>
            </div>'''
new = '''            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
              <div className={`flex min-h-24 flex-col items-center justify-center rounded-xl border p-4 text-center ${requiredMaximum === 20
                ? "border-emerald-500/35 bg-emerald-500/10"
                : "border-warning/40 bg-warning/10"}`}
              >
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-sm font-semibold">
                    {requiredMaximum === 20 ? "Escala correta" : "Escala inválida"}
                  </span>
                  <span className={requiredMaximum === 20 ? "text-emerald-700 dark:text-emerald-400" : "font-semibold text-warning"}>
                    {formatPtNumber(requiredMaximum)} / 20 valores
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  {requiredMaximum === 20
                    ? "Os elementos obrigatórios totalizam corretamente 20 valores."
                    : `Os elementos obrigatórios somam ${formatPtNumber(requiredMaximum)} valores. Ajusta os valores máximos para totalizarem exatamente 20; os dados antigos foram preservados e não são alterados automaticamente.`}
                </p>
              </div>
              <Button className="h-full min-h-24" type="button" variant="outline" onClick={addElement} disabled={model === "exam-only"}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar elemento
              </Button>
            </div>'''
text = replace_once(text, old, new, "scale validation card")

old = '''                  {outcome.requirements.map((entry) => (
                    <div key={entry.key} className="flex gap-2 rounded-xl border bg-card p-3">
                      {entry.met
                        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0">
                        <div className="text-xs font-medium">{entry.label}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{entry.detail}</div>
                      </div>
                    </div>
                  ))}'''
new = '''                  {outcome.requirements.map((entry) => {
                    const invalidScale = entry.key === "total-scale" && !entry.met;
                    return (
                      <div
                        key={entry.key}
                        className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center ${invalidScale
                          ? "border-warning/40 bg-warning/10"
                          : "bg-card"}`}
                      >
                        {entry.met
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          : invalidScale
                            ? <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                            : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0 text-center">
                          <div className="text-xs font-medium">
                            {invalidScale ? "Escala total inválida" : entry.label}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{entry.detail}</div>
                        </div>
                      </div>
                    );
                  })}'''
text = replace_once(text, old, new, "outcome requirement cards")
path.write_text(text, encoding="utf-8")


# Remove the old icon-dependent centring rules; JSX now centres every metric consistently.
path = Path("src/index.css")
text = path.read_text(encoding="utf-8")
css_pattern = re.compile(
    r'\n  /\* Cartões de métricas do painel: conteúdo centrado nos dois eixos\. \*/.*?\n  /\* Cartões-resumo das Definições ficam alinhados verticalmente\. \*/',
    re.S,
)
css_replacement = '''
  /* Os cartões de métricas são centrados diretamente no componente, sem depender do tipo de ícone. */
  .dashboard-metric-card {
    min-height: 9rem;
  }

  /* Cartões-resumo das Definições ficam alinhados verticalmente. */'''
text, count = css_pattern.subn(css_replacement, text, count=1)
if count != 1:
    raise SystemExit("Old dashboard CSS rules not found")
path.write_text(text, encoding="utf-8")

print("Final UI fixes applied successfully.")
