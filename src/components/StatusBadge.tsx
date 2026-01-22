import { Badge } from "@/components/ui/badge";
import { CourseStatus } from "@/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: CourseStatus;
  className?: string;
}

const statusConfig: Record<CourseStatus, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  "Aprovado": { variant: "default", className: "bg-success text-success-foreground hover:bg-success/90" },
  "Apto a Exame": { variant: "default", className: "bg-info text-info-foreground hover:bg-info/90" },
  "Em Curso": { variant: "secondary", className: "bg-secondary text-secondary-foreground" },
  "Não Apto": { variant: "destructive", className: "bg-destructive/80 text-destructive-foreground" },
  "Recurso": { variant: "default", className: "bg-warning text-warning-foreground hover:bg-warning/90" },
  "Reprovado": { variant: "destructive", className: "bg-destructive text-destructive-foreground" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge 
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {status}
    </Badge>
  );
}
