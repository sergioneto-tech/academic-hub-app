import { Outlet, NavLink } from "react-router-dom";

function linkClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-md px-3 py-2 text-sm transition",
    isActive ? "bg-muted font-medium" : "hover:bg-muted/60",
  ].join(" ");
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="font-semibold">Academic Hub</div>

          <nav className="flex items-center gap-2">
            <NavLink to="/" end className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/cadeiras" className={linkClass}>
              Cadeiras
            </NavLink>
            <NavLink to="/calendario" className={linkClass}>
              Calendário
            </NavLink>
            <NavLink to="/historico" className={linkClass}>
              Histórico
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
