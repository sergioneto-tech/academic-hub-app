import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Bell } from "lucide-react";
import { toast } from "sonner";
import type { AppState } from "@/lib/types";
import { getAssessments } from "@/lib/calculations";

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

    // E-fólios: alertar quando falta 1 dia para o fim (véspera) ou é o último dia
    const efolios = getAssessments(state, course.id, "efolio");
    for (const ef of efolios) {
      if (!ef.endDate) continue;
      const days = daysUntil(ef.endDate);
      if (days !== null && days >= 0 && days <= 1) {
        alerts.push({ id: ef.id, courseId: course.id, courseName: label, label: ef.name, daysLeft: days, type: "efolio" });
      }
    }

    // Exame: alertar 7 dias antes e na véspera (e no dia)
    const ex = getAssessments(state, course.id, "exam")[0];
    if (ex?.date) {
      const days = daysUntil(ex.date);
      if (days !== null && days >= 0 && (days <= 1 || days === 7)) {
        alerts.push({ id: ex.id, courseId: course.id, courseName: label, label: ex.name, daysLeft: days, type: "exam" });
      }
    }

    // Recurso: mesma lógica do exame
    const rc = getAssessments(state, course.id, "resit")[0];
    if (rc?.date) {
      const days = daysUntil(rc.date);
      if (days !== null && days >= 0 && (days <= 1 || days === 7)) {
        alerts.push({ id: rc.id, courseId: course.id, courseName: label, label: rc.name ?? "Recurso", daysLeft: days, type: "resit" });
      }
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

  useEffect(() => {
    if (alerts.length === 0 || !shouldShowToast()) return;
    markToastShown();

    // Pequeno atraso para a app carregar
    const t = setTimeout(() => {
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

  if (alerts.length === 0) return null;

  return (
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
  );
}
