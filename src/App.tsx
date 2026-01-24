import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/Calendar";
import HistoryPage from "./pages/History";
import CoursesPage from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import SettingsPage from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cadeiras" element={<CoursesPage />} />
        <Route path="/cadeiras/:id" element={<CourseDetail />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/historico" element={<HistoryPage />} />
        <Route path="/definicoes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
