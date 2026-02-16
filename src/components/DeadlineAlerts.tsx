import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Bell, ExternalLink, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import type { AppState } from "@/lib/types";
import { getAssessments } from "@/lib/calculations";
import { getAcademicAlerts, UAB_LINKS, ACADEMIC_YEAR, type CalendarAlert } from "@/lib/uabAcademicCalendar";
import { EXAM_CALENDAR_PDF } from "@/lib/uabExamDates";

type AlertItem = {
  id: string;
  courseId: string;
  courseName: string;
  label: string;
  daysLeft: number;
  type: "efolio" | "exam" | "resit";
};

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(ymd)) return null;
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysUntil(ymd: string): number | null {
  const target = parseYmd(ymd);
  if (!target) return null;
  const today = startOfDay(new Date());
  return Math.round((startOfDay(target).getTime() - today.getTime()) / 86400000);
}

function buildAlerts(state: AppState): AlertItem[] {
  const alerts: AlertItem[] = [];
  const activeCourses = state.courses.filter((c) => c.isActive && !c.isCompleted);

  for (const course of activeCourses) {
    const label = `${course.code} — ${course.name}`;

    // E-fólios: alertar início (véspera/dia) e fim (véspera/dia) do período de entrega
    const efolios = getAssessments(state, course.id, "efolio");
    for (const ef of efolios) {
      if (ef.startDate) {
        const daysStart = daysUntil(ef.startDate);
        if (daysStart !== null && daysStart >= 0 && daysStart <= 1) {
          alerts.push({ id: `${ef.id}-start`, courseId: course.id, courseName: label, label: `${ef.name} (início)`, daysLeft: daysStart, type: "efolio" });
        }
      }
      if (ef.endDate) {
        const daysEnd = daysUntil(ef.endDate);
        if (daysEnd !== null && daysEnd >= 0 && daysEnd <= 1) {
          alerts.push({ id: `${ef.id}-end`, courseId: course.id, courseName: label, label: `${ef.name} (fim)`, daysLeft: daysEnd, type: "efolio" });
        }
      }
    }

    // Exame
    const ex = getAssessments(state, course.id, "exam")[0];
    if (ex?.date) {
      const days = daysUntil(ex.date);
      if (days !== null && days >= 0 && (days <= 1 || days === 7)) {
        alerts.push({ id: ex.id, courseId: course.id, courseName: label, label: ex.name, daysLeft: days, type: "exam" });
      }
    }

    // Recurso
    const rc = getAssessments(state, course.id, "resit")[0];
    if (rc?.date) {
      const days = daysUntil(rc.date);
      if (days !== null && days >= 0 && (days <= 1 || days === 7)) {
        alerts.push({ id: rc.id, courseId: course.id, courseName: label, label: rc.name ?? "Recurso", daysLeft: days, type: "resit" });
      }
    }
  }

  // Blocos de estudo pessoal prestes a iniciar (próximos 3 dias)
  const studyBlocks = state.studyBlocks ?? [];
  for (const block of studyBlocks) {
    if (block.status === "done") continue;
    const days = daysUntil(block.startDate);
    if (days !== null && days >= 0 && days <= 3) {
      const course = state.courses.find((c) => c.id === block.courseId);
      const courseName = course ? `${course.code} — ${course.name}` : "Cadeira desconhecida";
      const activityLabels: Record<string, string> = {
        reading: "📖 Leitura",
        exercises: "✏️ Exercícios",
        revision: "🔄 Revisão",
        efolio: "📝 e-Fólio",
        other: "📌 Outro",
      };
      const actLabel = activityLabels[block.activity] ?? block.activity;
      alerts.push({
        id: `study-${block.id}`,
        courseId: block.courseId,
        courseName: courseName,
        label: `${actLabel}: ${block.title}`,
        daysLeft: days,
        type: "efolio", // reuse type for styling
      });
    }
  }

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

function alertMessage(a: AlertItem): string {
  const what = a.type === "efolio" ? a.label : a.type === "exam" ? "Exame" : "Recurso";
  if (a.daysLeft === 0) return `${what} é hoje!`;
  if (a.daysLeft === 1) return `${what} é amanhã!`;
  return `${what} daqui a ${a.daysLeft} dias`;
}

function alertIcon(daysLeft: number) {
  if (daysLeft === 0) return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
  return <CalendarClock className="h-4 w-4 text-warning shrink-0" />;
}

function alertTone(daysLeft: number): string {
  if (daysLeft === 0) return "border-destructive/40 bg-destructive/10";
  return "border-warning/40 bg-warning/10";
}

const TOAST_STORAGE_KEY = "deadline-toast-date";

function shouldShowToast(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem(TOAST_STORAGE_KEY);
  return last !== today;
}

function markToastShown(): void {
  localStorage.setItem(TOAST_STORAGE_KEY, new Date().toISOString().slice(0, 10));
}

/** Toast diário ao abrir a app */
export function useDeadlineToasts(state: AppState) {
  const alerts = useMemo(() => buildAlerts(state), [state]);
  const academicAlerts = useMemo(() => getAcademicAlerts(), []);

  useEffect(() => {
    const hasAlerts = alerts.length > 0 || academicAlerts.length > 0;
    if (!hasAlerts || !shouldShowToast()) return;
    markToastShown();

    // Pequeno atraso para a app carregar
    const t = setTimeout(() => {
      // Academic alerts first
      for (const a of academicAlerts.slice(0, 3)) {
        const isUrgent = a.category === "enrollment" && a.daysLeft <= 3;
        if (isUrgent) {
          toast.warning(`${a.icon} ${a.label}`, { description: a.description, duration: 10000 });
        } else {
          toast.info(`${a.icon} ${a.label}`, { description: a.description, duration: 6000 });
        }
      }

      const urgent = alerts.filter((a) => a.daysLeft <= 1);
      const upcoming = alerts.filter((a) => a.daysLeft > 1);

      for (const a of urgent) {
        toast.warning(`⚠️ ${a.courseName}`, { description: alertMessage(a), duration: 8000 });
      }
      for (const a of upcoming) {
        toast.info(`📅 ${a.courseName}`, { description: alertMessage(a), duration: 6000 });
      }
    }, 1200);

    return () => clearTimeout(t);
  }, []); // só ao montar
}

/** Bloco fixo de alertas para o Dashboard */
export default function DeadlineAlerts({ state }: { state: AppState }) {
  const alerts = useMemo(() => buildAlerts(state), [state]);
  const academicAlerts = useMemo(() => getAcademicAlerts(), []);

  const hasAny = alerts.length > 0 || academicAlerts.length > 0;

  return (
    <div className="space-y-4">
      {/* Alertas do calendário académico UAb */}
      {academicAlerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="h-4 w-4 text-primary" />
            Calendário Académico {ACADEMIC_YEAR}
          </div>
          {academicAlerts.map((a) => (
            <a
              key={a.id}
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors hover:opacity-80 ${academicTone(a)}`}
            >
              <span className="text-base shrink-0">{a.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{a.label}</div>
                <div className="text-xs text-muted-foreground">{a.description}</div>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
            </a>
          ))}
        </div>
      )}

      {/* Links rápidos UAb */}
      <div className="flex flex-wrap gap-2">
        <a
          href={UAB_LINKS.calendarioLetivo}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          📅 Calendário Letivo
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href={UAB_LINKS.avaliacao}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          📝 Calendário de Provas
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href={UAB_LINKS.candidaturas}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          📋 Candidaturas
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href={EXAM_CALENDAR_PDF}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          📄 Calendário de Provas (PDF)
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Alertas de prazos de cadeiras */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4 text-primary" />
            Alertas de prazos
          </div>
          {alerts.map((a) => (
            <Link
              key={a.id}
              to={`/cadeiras/${a.courseId}`}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors hover:opacity-80 ${alertTone(a.daysLeft)}`}
            >
              {alertIcon(a.daysLeft)}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{a.courseName}</div>
                <div className="text-xs text-muted-foreground">{alertMessage(a)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function academicTone(a: CalendarAlert): string {
  if (a.category === "enrollment" && a.daysLeft <= 3) return "border-destructive/40 bg-destructive/10";
  if (a.isOngoing && a.category === "enrollment") return "border-primary/40 bg-primary/10";
  if (a.category === "exams") return "border-warning/40 bg-warning/10";
  return "border-border bg-muted/30";
}
