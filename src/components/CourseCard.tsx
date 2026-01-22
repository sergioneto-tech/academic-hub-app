import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Course, Assessment, Rules, CourseStatus } from "@/types";
import { getCourseStatus, totalEFolios, calculateNotaFinal } from "@/lib/calculations";
import { ChevronRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

interface CourseCardProps {
  course: Course;
  assessments: Assessment[];
  rules: Rules;
}

export function CourseCard({ course, assessments, rules }: CourseCardProps) {
  const status = getCourseStatus(assessments, rules, course.concluida);
  const totalEF = totalEFolios(assessments);
  const notaFinal = calculateNotaFinal(assessments, rules);
  
  return (
    <Link to={`/cadeiras/${course.id}`}>
      <Card className="group hover:shadow-card transition-all duration-200 hover:border-primary/20 cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {course.nome}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {course.codigo} • {course.ano}º ano • {course.semestre}º sem
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <StatusBadge status={status} />
            <div className="flex items-center gap-4 text-sm">
              <div className="text-right">
                <p className="text-muted-foreground">e-fólios</p>
                <p className="font-medium">{totalEF.toFixed(1)} / 4</p>
              </div>
              {notaFinal !== undefined && (
                <div className="text-right">
                  <p className="text-muted-foreground">Final</p>
                  <p className="font-semibold text-primary">{notaFinal}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
