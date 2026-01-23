import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/AppStore";
import { courseStatusLabel, totalEFolios } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";

export default function CoursesPage() {
  const { state } = useAppStore();
  const courses = state.courses.filter(c => c.isActive && !c.isCompleted);

  return (
    <div className="space-y-6">
      <div className="text-2xl font-semibold">Cadeiras</div>

      <Card>
        <CardHeader>
          <CardTitle>Ativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {courses.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem cadeiras ativas.</div>
          ) : (
            courses.map(c => {
              const st = courseStatusLabel(state, c.id);
              const ef = totalEFolios(state, c.id);
              return (
                <Link key={c.id} to={`/cadeiras/${c.id}`} className="block rounded-lg border p-4 hover:bg-muted/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-sm text-muted-foreground">{c.code} • e-fólios: {ef.toFixed(1)} / 4</div>
                    </div>
                    <Badge
                      variant={st.variant === "success" ? "default" : st.variant === "warning" ? "secondary" : "destructive"}
                    >
                      {st.label}
                    </Badge>
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
