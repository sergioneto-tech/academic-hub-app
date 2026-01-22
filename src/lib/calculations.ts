import { Assessment, Rules, CourseStatus } from "@/types";

export function totalEFolios(assessments: Assessment[]): number {
  return assessments
    .filter((a) => a.tipo === "efolio" && a.nota !== undefined)
    .reduce((sum, a) => sum + (a.nota || 0), 0);
}

export function getExameNota(assessments: Assessment[]): number | undefined {
  const exame = assessments.find((a) => a.tipo === "exame");
  return exame?.nota;
}

export function roundHalfUp(value: number): number {
  return Math.round(value);
}

export function calculateNotaFinal(assessments: Assessment[], rules: Rules): number | undefined {
  const totalEF = totalEFolios(assessments);
  const exameNota = getExameNota(assessments);
  
  if (exameNota === undefined) {
    return undefined;
  }
  
  const raw = totalEF + exameNota;
  return Math.min(20, Math.max(0, roundHalfUp(raw)));
}

export function getCourseStatus(
  assessments: Assessment[],
  rules: Rules,
  concluida: boolean
): CourseStatus {
  const totalEF = totalEFolios(assessments);
  const exameNota = getExameNota(assessments);
  
  if (concluida) {
    const notaFinal = calculateNotaFinal(assessments, rules);
    if (notaFinal !== undefined && notaFinal >= 10) {
      return "Aprovado";
    }
    return "Reprovado";
  }
  
  if (exameNota !== undefined) {
    if (exameNota < rules.minExame) {
      return "Recurso";
    }
    const notaFinal = calculateNotaFinal(assessments, rules);
    if (notaFinal !== undefined && notaFinal >= 10) {
      return "Aprovado";
    }
    return "Reprovado";
  }
  
  if (totalEF >= rules.minAptoExame) {
    return "Apto a Exame";
  }
  
  const hasAllEfolios = assessments
    .filter((a) => a.tipo === "efolio")
    .every((a) => a.nota !== undefined);
  
  if (hasAllEfolios) {
    return "Não Apto";
  }
  
  return "Em Curso";
}

export function validateNota(nota: number): boolean {
  return nota >= 0 && nota <= 20;
}

export function calculateMedia(notas: number[]): number {
  if (notas.length === 0) return 0;
  const sum = notas.reduce((a, b) => a + b, 0);
  return roundHalfUp((sum / notas.length) * 10) / 10;
}
