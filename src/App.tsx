import { Suspense, lazy, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import MigrationNotice from "./components/MigrationNotice";
import CloudSyncNotice from "./components/CloudSyncNotice";
import CloudConflictPanel from "./components/CloudConflictPanel";
import Dashboard from "./pages/Dashboard";
import MaintenancePage from "./pages/Maintenance";
import { useAutoSync } from "./hooks/useAutoSync";

const CalendarPage = lazy(() => import("./pages/Calendar"));
const HistoryPage = lazy(() => import("./pages/History"));
const CoursesPage = lazy(() => import("./pages/Courses"));
const CourseDetailPremium = lazy(() => import("./pages/CourseDetailPremium"));
const SettingsPremium = lazy(() => import("./pages/SettingsPremium"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword"));
const StudyPlan = lazy(() => import("./pages/StudyPlan"));
const PersonalStudyPlan = lazy(() => import("./pages/PersonalStudyPlan"));
const HelpPage = lazy(() => import("./pages/Help"));
const LegalPage = lazy(() => import("./pages/Legal"));
const AcademicReportPage = lazy(() => import("./pages/AcademicReport"));

const maintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === "true";

function RouteFallback() {
  return <div className="grid min-h-[42vh] place-items-center" role="status" aria-live="polite"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary motion-reduce:animate-none" /><span className="sr-only">A carregar…</span></div>;
}
function LazyPage({ children }: { children: ReactNode }) { return <Suspense fallback={<RouteFallback />}>{children}</Suspense>; }

function AcademicHubApp() {
  useAutoSync();
  return (
    <>
      <MigrationNotice />
      <CloudSyncNotice />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cadeiras" element={<LazyPage><CoursesPage /></LazyPage>} />
          <Route path="/cadeiras/:id" element={<LazyPage><CourseDetailPremium /></LazyPage>} />
          <Route path="/calendario" element={<LazyPage><CalendarPage /></LazyPage>} />
          <Route path="/historico" element={<LazyPage><HistoryPage /></LazyPage>} />
          <Route path="/historico/relatorio" element={<LazyPage><AcademicReportPage /></LazyPage>} />
          <Route path="/plano" element={<LazyPage><StudyPlan /></LazyPage>} />
          <Route path="/plano/estudo" element={<LazyPage><PersonalStudyPlan /></LazyPage>} />
          <Route path="/definicoes" element={<LazyPage><><CloudConflictPanel /><SettingsPremium /></></LazyPage>} />
          <Route path="/reset-password" element={<LazyPage><ResetPasswordPage /></LazyPage>} />
          <Route path="/ajuda" element={<LazyPage><HelpPage /></LazyPage>} />
          <Route path="/legal" element={<LazyPage><LegalPage /></LazyPage>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() { if (maintenanceMode) return <MaintenancePage />; return <AcademicHubApp />; }
