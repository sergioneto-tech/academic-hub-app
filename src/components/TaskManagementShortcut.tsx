import { ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function TaskManagementShortcut() {
  return (
    <Button asChild variant="outline" className="w-full justify-start">
      <Link to="/plano/estudo">
        <ClipboardList className="mr-2 h-4 w-4" />
        Gestão de tarefas
      </Link>
    </Button>
  );
}
