import { ArrowLeft, Home } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function PageNavigationActions({ className = "" }: { className?: string }) {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <Button type="button" variant="ghost" size="sm" onClick={goBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar atrás
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link to="/">
          <Home className="mr-2 h-4 w-4" />
          Ir para o início
        </Link>
      </Button>
    </div>
  );
}
