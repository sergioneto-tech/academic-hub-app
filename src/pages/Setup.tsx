import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppState } from "@/hooks/useAppState";
import { storage } from "@/lib/storage";
import { Course } from "@/types";
import { GraduationCap, BookOpen, Check, Plus, Minus } from "lucide-react";

export default function Setup() {
  const { state, setDegree, addActiveCourse, removeActiveCourse } = useAppState();
  const degrees = storage.getDegrees();

  const isActive = (courseId: string) => 
    state.activeCourses.some((c) => c.id === courseId);

  const handleToggleCourse = (course: Course) => {
    if (isActive(course.id)) {
      removeActiveCourse(course.id);
    } else {
      addActiveCourse(course);
    }
  };

  const groupedCatalog = state.catalog.reduce((acc, course) => {
    const key = `${course.ano}º Ano - ${course.semestre}º Semestre`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(course);
    return acc;
  }, {} as Record<string, Course[]>);

  return (
    <Layout title="Setup">
      <div className="space-y-6">
        {/* Degree Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Licenciatura
            </CardTitle>
            <CardDescription>
              Selecione a sua licenciatura para personalizar o catálogo de cadeiras.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={state.degree?.id || ""}
              onValueChange={(id) => {
                const degree = degrees.find((d) => d.id === id);
                if (degree) setDegree(degree);
              }}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Escolha uma licenciatura" />
              </SelectTrigger>
              <SelectContent>
                {degrees.map((degree) => (
                  <SelectItem key={degree.id} value={degree.id}>
                    {degree.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Course Catalog */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Catálogo de Cadeiras
            </CardTitle>
            <CardDescription>
              Selecione as cadeiras que pretende frequentar. Escolhidas: {state.activeCourses.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedCatalog).map(([group, courses]) => (
              <div key={group}>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  {group}
                </h4>
                <div className="grid gap-2">
                  {courses.map((course) => {
                    const active = isActive(course.id);
                    return (
                      <div
                        key={course.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                          active 
                            ? "bg-primary/5 border-primary/20" 
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => handleToggleCourse(course)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={active} 
                            onCheckedChange={() => handleToggleCourse(course)}
                          />
                          <div>
                            <p className="font-medium">{course.nome}</p>
                            <p className="text-sm text-muted-foreground">{course.codigo}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={active ? "destructive" : "default"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCourse(course);
                          }}
                        >
                          {active ? (
                            <>
                              <Minus className="h-4 w-4 mr-1" /> Remover
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" /> Adicionar
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
