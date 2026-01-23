import { Outlet } from "react-router-dom";
import { NavLink, Link } from "react-router-dom";
import { Home, BookOpen, Calendar, History } from "lucide-react";

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
          isActive ? "bg-muted font-medium" : "hover:bg-muted/60"
        }`
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      {/* topbar */}
      <div className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Home className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          {/* navegação desktop */}
          <div className="hidden items-center gap-2 md:flex">
            <NavItem to="/" icon={Home} label="Início" />
            <NavItem to="/cadeiras" icon={BookOpen} label="Cadeiras" />
            <NavItem to="/calendario" icon={Calendar} label="Calendário" />
            <NavItem to="/historico" icon={History} label="Histórico" />
          </div>
        </div>
      </div>

      {/* content */}
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* bottom nav mobile */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-4 px-2 py-2">
          <NavLink to="/" end className="flex flex-col items-center gap-1 rounded-md py-2 text-xs">
            <Home className="h-4 w-4" />
            Início
          </NavLink>
          <NavLink to="/cadeiras" className="flex flex-col items-center gap-1 rounded-md py-2 text-xs">
            <BookOpen className="h-4 w-4" />
            Cadeiras
          </NavLink>
          <NavLink to="/calendario" className="flex flex-col items-center gap-1 rounded-md py-2 text-xs">
            <Calendar className="h-4 w-4" />
            Calendário
          </NavLink>
          <NavLink to="/historico" className="flex flex-col items-center gap-1 rounded-md py-2 text-xs">
            <History className="h-4 w-4" />
            Histórico
          </NavLink>
        </div>
      </div>
    </div>
  );
}
