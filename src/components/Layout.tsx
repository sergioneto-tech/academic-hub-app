import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GraduationCap, Menu } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-full items-center gap-4 px-4 md:px-6">
              <SidebarTrigger className="md:hidden">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <div className="flex items-center gap-3 md:hidden">
                <GraduationCap className="h-6 w-6 text-primary" />
                <span className="font-semibold">UAb</span>
              </div>
              {title && (
                <h1 className="hidden md:block text-xl font-semibold text-foreground">
                  {title}
                </h1>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="container max-w-6xl py-6 px-4 md:px-6 animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
