import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/Calendar";
import HistoryPage from "./pages/History";
import CoursesPage from "./pages/Courses";
import CourseDetailPremium from "./pages/CourseDetailPremium";
import SettingsPremium from "./pages/SettingsPremium";
import ResetPasswordPage from "./pages/ResetPassword";
import StudyPlan from "./pages/StudyPlan";
import PersonalStudyPlan from "./pages/PersonalStudyPlan";
import HelpPage from "./pages/Help";
import { useAutoSync } from "./hooks/useAutoSync";

export default function App() {
  useAutoSync();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cadeiras" element={<CoursesPage />} />
        <Route path="/cadeiras/:id" element={<CourseDetailPremium />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/historico" element={<HistoryPage />} />
        <Route path="/plano" element={<StudyPlan />} />
        <Route path="/plano/estudo" element={<PersonalStudyPlan />} />
        <Route path="/definicoes" element={<SettingsPremium />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/ajuda" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
