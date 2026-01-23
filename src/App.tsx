import { Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/Calendar";
import HistoryPage from "./pages/History";
import CoursesPage from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cadeiras" element={<CoursesPage />} />
        <Route path="/cadeiras/:id" element={<CourseDetail />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/historico" element={<HistoryPage />} />
      </Route>
    </Routes>
  );
}
