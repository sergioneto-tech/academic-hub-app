import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
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
  return `${result.stderr || result.stdout || `exit ${result.status}`}`.trim().replace(/\s+/g, " ").slice(0, 320);
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

  const secretPatterns = [/SUPABASE_SERVICE_ROLE_KEY/g, /sb_secret_[A-Za-z0-9_-]+/g];
  const executionPatterns = [/dangerouslySetInnerHTML\s*=/g, /\beval\s*\(/g, /new\s+Function\s*\(/g];
  const secretHits = [];
  const executionHits = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (secretPatterns.some((pattern) => { pattern.lastIndex = 0; return pattern.test(text); })) secretHits.push(relative(root, file));
    if (executionPatterns.some((pattern) => { pattern.lastIndex = 0; return pattern.test(text); })) executionHits.push(relative(root, file));
  }

  return { secretHits, executionHits };
}

async function checkDependencies() {
  const audit = run("npm", ["audit", "--audit-level=high", "--json"]);
  try {
    const parsed = JSON.parse(audit.stdout || "{}");
    const high = Number(parsed?.metadata?.vulnerabilities?.high || 0);
    const critical = Number(parsed?.metadata?.vulnerabilities?.critical || 0);
    const ok = high === 0 && critical === 0;
    results.dependencies = { ok, severity: ok ? "pass" : "fail", detail: ok ? "0 vulnerabilidades high/critical detetadas pelo npm audit." : `${high} high e ${critical} critical detetadas pelo npm audit.` };
    if (!ok) securityFailure = true;
  } catch {
    auditIncomplete = true;
    results.dependencies = { ok: false, severity: "warning", detail: "Não foi possível interpretar o resultado do npm audit." };
  }
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
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;

  if (!token || !projectRef) {
    auditIncomplete = true;
    results.database = { ok: false, severity: "warning", detail: "Credenciais read-only da vistoria não estão disponíveis." };
    return;
  }

  const dbSecuritySql = `
with allowed(table_name, privilege_type) as (
  values
    ('account_email_migration','INSERT'),('account_email_migration','SELECT'),
    ('app_survey_responses','INSERT'),('app_survey_responses','SELECT'),
    ('feedback_attachments','INSERT'),('feedback_attachments','SELECT'),
    ('feedback_history','SELECT'),
    ('feedback_messages','INSERT'),('feedback_messages','SELECT'),
    ('feedback_requests','INSERT'),('feedback_requests','SELECT'),('feedback_requests','UPDATE'),
    ('push_preferences','INSERT'),('push_preferences','SELECT'),('push_preferences','UPDATE'),
    ('push_subscriptions','DELETE'),('push_subscriptions','INSERT'),('push_subscriptions','SELECT'),('push_subscriptions','UPDATE'),
    ('user_state','DELETE'),('user_state','INSERT'),('user_state','SELECT'),('user_state','UPDATE'),
    ('user_state_history','SELECT')
),
actual_authenticated as (
  select c.relname::text as table_name, x.privilege_type::text as privilege_type
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) x
  left join pg_catalog.pg_roles r on r.oid=x.grantee
  where n.nspname='public' and c.relkind='r' and r.rolname='authenticated'
),
violations as (
  select 'public table without RLS/FORCE RLS'::text as issue
  where exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity)
  )

  union all
  select 'anon has direct public-table privileges'
  where exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) x
    left join pg_catalog.pg_roles r on r.oid=x.grantee
    where n.nspname='public' and c.relkind='r' and r.rolname='anon'
  )

  union all
  select 'unexpected authenticated table privilege'
  where exists (
    select 1 from actual_authenticated g
    where not exists (
      select 1 from allowed a
      where a.table_name=g.table_name and a.privilege_type=g.privilege_type
    )
  )

  union all
  select 'expected authenticated table privilege missing'
  where exists (
    select 1 from allowed a
    where not exists (
      select 1 from actual_authenticated g
      where g.table_name=a.table_name and g.privilege_type=a.privilege_type
    )
  )

  union all
  select 'anon has sequence privilege'
  where exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('S', c.relowner))) x
    left join pg_catalog.pg_roles r on r.oid=x.grantee
    where n.nspname='public' and c.relkind='S' and r.rolname='anon'
  )

  union all
  select 'unexpected authenticated sequence privilege'
  where exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('S', c.relowner))) x
    left join pg_catalog.pg_roles r on r.oid=x.grantee
    where n.nspname='public' and c.relkind='S' and r.rolname='authenticated'
      and not (c.relname='feedback_reference_seq' and x.privilege_type='USAGE')
  )

  union all
  select 'feedback reference sequence privilege missing'
  where not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('S', c.relowner))) x
    left join pg_catalog.pg_roles r on r.oid=x.grantee
    where n.nspname='public' and c.relkind='S' and r.rolname='authenticated'
      and c.relname='feedback_reference_seq' and x.privilege_type='USAGE'
  )

  union all
  select 'SECURITY DEFINER executable by client role'
  where exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where p.prosecdef and n.nspname in ('public','private')
      and (
        pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
        or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      )
  )

  union all
  select 'client-readable public view/materialized view'
  where exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('v','m')
      and (
        pg_catalog.has_table_privilege('anon',c.oid,'SELECT')
        or pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT')
      )
  )

  union all
  select 'public storage bucket detected'
  where exists (
    select 1 from storage.buckets b where b.public=true
  )

  union all
  select 'insecure postgres default privileges restored'
  where exists (
    select 1
    from pg_catalog.pg_default_acl d
    join pg_catalog.pg_roles owner on owner.oid=d.defaclrole
    left join pg_catalog.pg_namespace ns on ns.oid=d.defaclnamespace
    cross join lateral pg_catalog.aclexplode(d.defaclacl) x
    left join pg_catalog.pg_roles grantee on grantee.oid=x.grantee
    where owner.rolname='postgres'
      and ns.nspname='public'
      and grantee.rolname in ('anon','authenticated')
  )
)
select v.issue from violations v order by v.issue;
`;

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: dbSecuritySql }),
    });

    const raw = await response.text();
    if (!response.ok) {
      auditIncomplete = true;
      results.database = {
        ok: false,
        severity: "warning",
        detail: `A consulta read-only da baseline não concluiu (HTTP ${response.status}: ${raw.replace(/\\s+/g, " ").slice(0, 240)}).`,
      };
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw || "[]");
    } catch {
      auditIncomplete = true;
      results.database = { ok: false, severity: "warning", detail: "A resposta da baseline read-only não pôde ser interpretada." };
      return;
    }

    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.result)
        ? parsed.result
        : Array.isArray(parsed?.data)
          ? parsed.data
          : [];

    if (rows.length > 0) {
      securityFailure = true;
      const issues = rows.map((row) => row?.issue).filter(Boolean);
      results.database = {
        ok: false,
        severity: "fail",
        detail: `Baseline live detetou desvios: ${issues.join("; ") || "resultado inesperado"}.`,
      };
      return;
    }

    results.database = {
      ok: true,
      severity: "pass",
      detail: "RLS/FORCE RLS, ACLs de tabelas e sequências, SECURITY DEFINER, views, Storage e default privileges passaram a baseline live através da API read-only.",
    };
  } catch (error) {
    auditIncomplete = true;
    results.database = {
      ok: false,
      severity: "warning",
      detail: `Não foi possível executar a baseline read-only (${error instanceof Error ? error.message : "erro"}).`,
    };
  }
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
    ? "Sem vulnerabilidades críticas ou altas ou desvios à baseline de segurança detetados na última vistoria automática."
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
