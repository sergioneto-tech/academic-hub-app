import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const dbPassword = process.env.SUPABASE_DB_PASSWORD || "";
const appUrl = process.env.ACADEMIC_HUB_URL || "https://academichub.sergioneto.pt";

const results = {
  dependencies: { ok: false, severity: "warning", detail: "Não verificado." },
  application: { ok: false, severity: "warning", detail: "Não verificado." },
  database: { ok: false, severity: "warning", detail: "Não verificado." },
  frontend: { ok: false, severity: "warning", detail: "Não verificado." },
  web: { ok: false, severity: "warning", detail: "Não verificado." },
};

let securityFailure = false;
let auditIncomplete = false;
const acceptedFindings = [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: process.env,
    ...options,
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function shortError(result) {
  return `${result.stderr || result.stdout || `exit ${result.status}`}`.trim().replace(/\s+/g, " ").slice(0, 280);
}

function walkFiles(dir, extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".env"]) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", ".git"].includes(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walkFiles(full, extensions));
    else if (extensions.some((ext) => name.endsWith(ext)) || name === ".env") out.push(full);
  }
  return out;
}

function findUnsafeClientPatterns() {
  const files = [join(root, "src"), join(root, "public")]
    .filter((path) => {
      try { return statSync(path).isDirectory(); } catch { return false; }
    })
    .flatMap((path) => walkFiles(path));

  const secretPatterns = [
    /SUPABASE_SERVICE_ROLE_KEY/g,
    /sb_secret_[A-Za-z0-9_-]+/g,
  ];
  const executionPatterns = [
    /dangerouslySetInnerHTML\s*=/g,
    /\beval\s*\(/g,
    /new\s+Function\s*\(/g,
  ];
  const secretHits = [];
  const executionHits = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (secretPatterns.some((pattern) => { pattern.lastIndex = 0; return pattern.test(text); })) secretHits.push(relative(root, file));
    if (executionPatterns.some((pattern) => { pattern.lastIndex = 0; return pattern.test(text); })) executionHits.push(relative(root, file));
  }

  return { secretHits, executionHits };
}

function collectAdvisorFindings(value, output = [], seen = new Set()) {
  if (!value || typeof value !== "object") return output;
  if (seen.has(value)) return output;
  seen.add(value);
  if (!Array.isArray(value) && typeof value.level === "string" && typeof value.name === "string") output.push(value);
  for (const child of Object.values(value)) collectAdvisorFindings(child, output, seen);
  return output;
}

async function checkDependencies() {
  const audit = run("npm", ["audit", "--audit-level=high", "--json"]);
  let high = 0;
  let critical = 0;
  try {
    const parsed = JSON.parse(audit.stdout || "{}");
    high = Number(parsed?.metadata?.vulnerabilities?.high || 0);
    critical = Number(parsed?.metadata?.vulnerabilities?.critical || 0);
  } catch {
    auditIncomplete = true;
    results.dependencies = { ok: false, severity: "warning", detail: "Não foi possível interpretar o resultado do npm audit." };
    return;
  }
  const ok = high === 0 && critical === 0;
  results.dependencies = { ok, severity: ok ? "pass" : "fail", detail: ok ? "0 vulnerabilidades high/critical detetadas pelo npm audit." : `${high} high e ${critical} critical detetadas pelo npm audit.` };
  if (!ok) securityFailure = true;
}

function checkApplication() {
  const tsc = run("npx", ["tsc", "-b", "--pretty", "false"]);
  const build = run("npm", ["run", "build"]);
  const tests = run("npm", ["test"]);
  const ok = tsc.ok && build.ok && tests.ok;
  results.application = {
    ok,
    severity: ok ? "pass" : "warning",
    detail: ok
      ? "TypeScript, build e testes concluídos sem erros bloqueantes; o lint é validado pelo workflow Quality checks."
      : `Falhas de qualidade: ${[!tsc.ok && "TypeScript", !build.ok && "build", !tests.ok && "testes"].filter(Boolean).join(", ")}.`,
  };
  if (!ok) auditIncomplete = true;
}

async function checkDatabase() {
  if (!dbPassword) {
    auditIncomplete = true;
    results.database = { ok: false, severity: "warning", detail: "Password de auditoria Supabase indisponível no workflow." };
    return;
  }

  let advisorOk = false;
  let advisorIncomplete = false;
  let advisorDetail = "Security Advisor indisponível.";
  const advisor = run("supabase", ["db", "advisors", "--linked", "--type", "security", "--output-format", "json"]);
  if (advisor.ok) {
    try {
      const payload = JSON.parse(advisor.stdout || "{}");
      const findings = collectAdvisorFindings(payload);
      const relevant = [];
      for (const finding of findings) {
        const level = String(finding.level || "").toUpperCase();
        if (!new Set(["WARN", "WARNING", "ERROR", "CRITICAL"]).has(level)) continue;
        const detail = String(finding.detail || finding.description || "");
        const metadataName = String(finding?.metadata?.name || "");
        if (finding.name === "extension_in_public" && (detail.includes("pg_net") || metadataName === "pg_net")) {
          acceptedFindings.push({
            id: "extension_in_public:pg_net",
            label: "pg_net no schema public",
            reason: "Aviso conhecido do advisor. A extensão instalada é não relocatable e é mantida para evitar regressões na infraestrutura de notificações.",
          });
          continue;
        }
        relevant.push(finding);
      }
      advisorOk = relevant.length === 0;
      advisorDetail = advisorOk ? "Security Advisor sem findings WARN/ERROR não aceites." : `${relevant.length} finding(s) WARN/ERROR requerem revisão.`;
      if (!advisorOk) securityFailure = true;
    } catch {
      advisorIncomplete = true;
      auditIncomplete = true;
      advisorDetail = "O Security Advisor respondeu, mas o JSON não pôde ser interpretado.";
    }
  } else {
    advisorIncomplete = true;
    auditIncomplete = true;
    advisorDetail = `Security Advisor CLI não concluiu (${shortError(advisor)}).`;
  }

  const lint = run("supabase", ["db", "lint", "--linked", "--level", "warning", "--fail-on", "error"]);
  if (!lint.ok) auditIncomplete = true;

  const dbSecuritySql = `do $audit$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then raise exception 'AH_AUDIT: public table without RLS/FORCE RLS'; end if;

  if not has_table_privilege('authenticated', 'public.app_survey_responses', 'SELECT')
     or not has_table_privilege('authenticated', 'public.app_survey_responses', 'INSERT')
     or has_table_privilege('authenticated', 'public.app_survey_responses', 'UPDATE')
     or has_table_privilege('authenticated', 'public.app_survey_responses', 'DELETE')
     or has_table_privilege('authenticated', 'public.app_survey_responses', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.app_survey_responses', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.app_survey_responses', 'TRIGGER')
  then raise exception 'AH_AUDIT: app_survey_responses privileges are not least-privilege'; end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef and n.nspname in ('public', 'private')
      and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  ) then raise exception 'AH_AUDIT: SECURITY DEFINER executable by client role'; end if;

  if exists (select 1 from storage.buckets where public = true) then
    raise exception 'AH_AUDIT: public storage bucket detected';
  end if;
end
$audit$;`;

  const dbControls = run("supabase", ["db", "query", "--linked", "-p", dbPassword, dbSecuritySql]);
  let controlsOk = dbControls.ok;
  let controlsDetail = "RLS, privilégios críticos, SECURITY DEFINER e Storage passaram os controlos live.";
  if (!dbControls.ok) {
    const errorText = `${dbControls.stderr}\n${dbControls.stdout}`;
    if (errorText.includes("AH_AUDIT:")) {
      securityFailure = true;
      controlsDetail = `Um controlo live falhou: ${shortError(dbControls)}.`;
    } else {
      auditIncomplete = true;
      controlsDetail = `O comando de controlo live não concluiu (${shortError(dbControls)}).`;
    }
  }

  const ok = advisorOk && lint.ok && controlsOk;
  const severity = securityFailure && (!advisorOk && !advisorIncomplete || !controlsOk && `${dbControls.stderr}${dbControls.stdout}`.includes("AH_AUDIT:")) ? "fail" : ok ? "pass" : "warning";
  results.database = {
    ok,
    severity,
    detail: `${advisorDetail} ${controlsDetail}${lint.ok ? " DB lint sem erros." : ` DB lint não concluiu (${shortError(lint)}).`}`,
  };
}

function checkFrontend() {
  try {
    const { secretHits, executionHits } = findUnsafeClientPatterns();
    const ok = secretHits.length === 0 && executionHits.length === 0;
    results.frontend = {
      ok,
      severity: ok ? "pass" : "fail",
      detail: ok
        ? "Sem service-role/secret keys no cliente e sem eval, new Function ou dangerouslySetInnerHTML detetados."
        : `Padrões a rever: ${[...new Set([...secretHits, ...executionHits])].join(", ")}.`,
    };
    if (!ok) securityFailure = true;
  } catch {
    auditIncomplete = true;
    results.frontend = { ok: false, severity: "warning", detail: "A análise estática do frontend não concluiu." };
  }
}

async function checkWebProtection() {
  try {
    const response = await fetch(appUrl, { method: "GET", redirect: "follow", cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const required = [
      ["content-security-policy", "CSP"],
      ["strict-transport-security", "HSTS"],
      ["x-content-type-options", "nosniff"],
      ["x-frame-options", "anti-framing"],
      ["referrer-policy", "Referrer-Policy"],
    ];
    const missing = required.filter(([header]) => !response.headers.get(header)).map(([, label]) => label);
    const ok = missing.length === 0;
    results.web = { ok, severity: ok ? "pass" : "fail", detail: ok ? "CSP, HSTS, nosniff, anti-framing e Referrer-Policy confirmados no site live." : `Headers em falta no site live: ${missing.join(", ")}.` };
    if (!ok) securityFailure = true;
  } catch (error) {
    auditIncomplete = true;
    results.web = { ok: false, severity: "warning", detail: `Não foi possível validar os headers live (${error instanceof Error ? error.message : "erro"}).` };
  }
}

function writeStatus() {
  const status = securityFailure ? "review" : auditIncomplete ? "attention" : "protected";
  const checks = [
    { id: "dependencies", label: "Dependências", status: results.dependencies.severity, detail: results.dependencies.detail },
    { id: "application", label: "Aplicação", status: results.application.severity, detail: results.application.detail },
    { id: "database", label: "Base de dados e acesso", status: results.database.severity, detail: results.database.detail },
    { id: "frontend", label: "Frontend", status: results.frontend.severity, detail: results.frontend.detail },
    { id: "web-protection", label: "Proteção web", status: results.web.severity, detail: results.web.detail },
  ];
  const now = new Date();
  const securityLevel = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const summary = status === "protected"
    ? "Sem vulnerabilidades críticas ou altas detetadas na última vistoria automática de segurança."
    : status === "review"
      ? "A última vistoria detetou um controlo de segurança que requer revisão."
      : "A última vistoria não conseguiu concluir todos os controlos e requer nova validação.";
  const output = {
    schemaVersion: 1,
    product: "Academic Hub",
    securityLevel,
    lastAudit: now.toISOString(),
    status,
    summary,
    checks,
    acceptedFindings,
    source: "automated-weekly-security-audit",
  };
  writeFileSync(join(root, "public", "security-status.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Security status: ${status}`);
  for (const check of checks) console.log(`${String(check.status).toUpperCase()} ${check.label}: ${check.detail}`);
}

try {
  await checkDependencies();
  checkApplication();
  await checkDatabase();
  checkFrontend();
  await checkWebProtection();
} catch (error) {
  auditIncomplete = true;
  console.error(error);
} finally {
  writeStatus();
}

if (securityFailure || auditIncomplete) process.exitCode = 1;
