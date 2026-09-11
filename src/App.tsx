import { Suspense, lazy, useEffect, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import MigrationNotice from "./components/MigrationNotice";
import LegacyMigrationAssistant from "./components/LegacyMigrationAssistant";
import CloudSyncNotice from "./components/CloudSyncNotice";
import CloudSyncStatusBadge from "./components/CloudSyncStatusBadge";
import CloudConflictPanel from "./components/CloudConflictPanel";
import GuestReadOnly from "./components/GuestReadOnly";
import AdminUserMonitor from "./components/AdminUserMonitor";
import AdminFeedbackMonitor from "./components/AdminFeedbackMonitor";
import FeedbackCloudBridge from "./components/FeedbackCloudBridge";
import FeedbackBetaEnhancements from "./components/FeedbackBetaEnhancements";
import FeedbackGlobalSyncPulse from "./components/FeedbackGlobalSyncPulse";
import AppSatisfactionSurvey from "./components/AppSatisfactionSurvey";
import AdminSurveyResults from "./components/AdminSurveyResults";
import PushDeepLinkNotice from "./components/PushDeepLinkNotice";
import DesktopPushPrompt from "./components/DesktopPushPrompt";
import SecurityStatusBadge from "./components/SecurityStatusBadge";
import UpdateProgressModal from "./components/UpdateProgressModal";
import Dashboard from "./pages/Dashboard";
import MaintenancePage from "./pages/Maintenance";
import { useAutoSync } from "./hooks/useAutoSync";
import { useRealtimeSync } from "./hooks/useRealtimeSync";
import { useUabOfficialAssessmentSync } from "./hooks/useUabOfficialAssessmentSync";
import { reconcilePushOnThisDevice } from "./lib/pushNotifications";

const CalendarPage = lazy(() => import("./pages/Calendar"));
const HistoryPage = lazy(() => import("./pages/History"));
const CoursesPage = lazy(() => import("./pages/Courses"));
const CourseDetailPremium = lazy(() => import("./pages/CourseDetailPremium"));
const SettingsPremium = lazy(() => import("./pages/SettingsPremium"));
const AccountProfilePage = lazy(() => import("./pages/AccountProfile"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword"));
const StudyPlan = lazy(() => import("./pages/StudyPlan"));
const PersonalStudyPlan = lazy(() => import("./pages/PersonalStudyPlan"));
const HelpPage = lazy(() => import("./pages/Help"));
const FeedbackPage = lazy(() => import("./pages/Feedback"));
const LegalPage = lazy(() => import("./pages/Legal"));
const AcademicReportPage = lazy(() => import("./pages/AcademicReport"));
const AcademicProgressReport = lazy(() => import("./pages/AcademicProgressReport"));

const maintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === "true";

function RouteFallback() {
  return <div className="grid min-h-[42vh] place-items-center" role="status" aria-live="polite"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary motion-reduce:animate-none" /><span className="sr-only">A carregar…</span></div>;
}
function LazyPage({ children }: { children: ReactNode }) { return <Suspense fallback={<RouteFallback />}>{children}</Suspense>; }
function ExplorePage({ children }: { children: ReactNode }) { return <GuestReadOnly>{children}</GuestReadOnly>; }

function AcademicHubApp() {
  useAutoSync();
  useRealtimeSync();
  useUabOfficialAssessmentSync();

  useEffect(() => {
    // Não pede permissões nem mostra diálogos. Se o utilizador já autorizou Push
    // neste dispositivo, revalida silenciosamente a subscrição e garante que a
    // conta também tem push_preferences no servidor. Assim uma instalação antiga
    // ou recuperada deixa de ficar com "alertas ativos" apenas no estado local.
    void reconcilePushOnThisDevice().catch(() => {});
  }, []);

  return (
    <>
      <MigrationNotice />
      <LegacyMigrationAssistant />
      <CloudSyncNotice />
      <CloudSyncStatusBadge />
      <PushDeepLinkNotice />
      <DesktopPushPrompt />
      <AdminUserMonitor />
      <FeedbackCloudBridge />
      <FeedbackGlobalSyncPulse />
      <FeedbackBetaEnhancements />
      <AdminFeedbackMonitor />
      <AppSatisfactionSurvey />
      <AdminSurveyResults />
      <UpdateProgressModal />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ExplorePage><><SecurityStatusBadge /><Dashboard /></></ExplorePage>} />
          <Route path="/cadeiras" element={<LazyPage><ExplorePage><CoursesPage /></ExplorePage></LazyPage>} />
          <Route path="/cadeiras/:id" element={<LazyPage><ExplorePage><CourseDetailPremium /></ExplorePage></LazyPage>} />
          <Route path="/calendario" element={<LazyPage><ExplorePage><CalendarPage /></ExplorePage></LazyPage>} />
          <Route path="/historico" element={<LazyPage><ExplorePage><HistoryPage /></ExplorePage></LazyPage>} />
          <Route path="/historico/relatorio" element={<LazyPage><ExplorePage><AcademicReportPage /></ExplorePage></LazyPage>} />
          <Route path="/historico/relatorio-completo" element={<LazyPage><ExplorePage><AcademicProgressReport /></ExplorePage></LazyPage>} />
          <Route path="/plano" element={<LazyPage><ExplorePage><StudyPlan /></ExplorePage></LazyPage>} />
          <Route path="/plano/estudo" element={<LazyPage><ExplorePage><PersonalStudyPlan /></ExplorePage></LazyPage>} />
          <Route path="/conta" element={<LazyPage><AccountProfilePage /></LazyPage>} />
          <Route path="/definicoes" element={<LazyPage><><CloudConflictPanel /><SettingsPremium /></></LazyPage>} />
          <Route path="/reset-password" element={<LazyPage><ResetPasswordPage /></LazyPage>} />
          <Route path="/ajuda" element={<LazyPage><HelpPage /></LazyPage>} />
          <Route path="/feedback" element={<LazyPage><FeedbackPage /></LazyPage>} />
          <Route path="/legal" element={<LazyPage><LegalPage /></LazyPage>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() { if (maintenanceMode) return <MaintenancePage />; return <AcademicHubApp />; }
