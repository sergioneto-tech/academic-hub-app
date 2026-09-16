import { describe, expect, it } from "vitest";
import { parsePucText } from "@/lib/pucParser";

function event(result: ReturnType<typeof parsePucText>, name: string) {
  return result.events.find((item) => item.name === name);
}

describe("PUC deterministic parser", () => {
  it("reads Álgebra Linear I without inventing a missing numeric code", () => {
    const result = parsePucText(`
Plano da Unidade Curricular (PUC)
Unidade curricular: Álgebra Linear I 2026 01
Álgebra Linear I
Código da Unidade Curricular (UC): Álgebra Linear I
Ano letivo: 2026/2027
A avaliação contínua nesta UC segue a tipologia 4.
9.2 Calendarização
Atividades Sumativas Atividade Sumativa 1 Atividade de Avaliação por Exame
Cotação 6 valores 14 valores
Disponibilização do enunciado e critérios de avaliação 13/11/2026 às 13h 13/01/2027 às 13h
Data e hora limites de entrega 23/11/2026 às 23:59 13/1/2027 às 14h45
Disponibilização da classificação e feedback Até 18/12/2026 Até 12/2/2027
Atividade Sumativa 2
Época Normal: 13/01/2027
Época Recurso: 16/02/2027
`);

    expect(result.courseName).toBe("Álgebra Linear I");
    expect(result.courseCode).toBeNull();
    expect(result.academicYear).toBe("2026/2027");
    expect(result.edition).toBe("01");
    expect(result.evaluationModel).toBe("type4");
    expect(event(result, "Atividade Sumativa 1")).toMatchObject({
      startDate: "2026-11-13",
      endDate: "2026-11-23",
      startTime: "13:00",
      endTime: "23:59",
    });
    expect(event(result, "Prova final — Época Normal")?.startDate).toBe("2027-01-13");
    expect(event(result, "Prova final — Época de Recurso")?.startDate).toBe("2027-02-16");
    expect(result.requiresUserConfirmation).toBe(true);
  });

  it("reads the 2026 Análise Infinitesimal sumative calendar", () => {
    const result = parsePucText(`
Plano da Unidade Curricular (PUC)
Unidade curricular: Análise Infinitesimal 2026 01
Identificação da Unidade Curricular
Código da Unidade Curricular (UC): 21175
Ano letivo: 2026-2027
A avaliação contínua nesta UC segue a tipologia 1.
9.1 Calendário da Avaliação Sumativa Contínua
Atividades Sumativas Atividade Sumativa 1 Atividade Sumativa 2 Atividade Sumativa 3 Atividade Sumativa 4
Cotação 3 valores 3 valores 2 valores 12 valores
Disponibilização do enunciado e critérios de avaliação 19/10/2026 23/11/2026 14/12/2026 Consultar o calendário de provas
Data e hora limites de entrega 01/11/2026 23:59 07/12/2026 23:59 04/01/2027 23:59 N/A
Disponibilização da classificação e feedback 02/11/2026 08/12/2026 09/01/2027 A definir
`);

    expect(result.courseName).toBe("Análise Infinitesimal");
    expect(result.courseCode).toBe("21175");
    expect(result.academicYear).toBe("2026/2027");
    expect(result.evaluationModel).toBe("type1");
    expect(event(result, "Atividade Sumativa 1")).toMatchObject({
      startDate: "2026-10-19",
      endDate: "2026-11-01",
    });
    expect(event(result, "Atividade Sumativa 3")?.endDate).toBe("2027-01-04");
    expect(result.warnings.some((warning) => warning.includes("calendário oficial"))).toBe(true);
  });

  it("reads Segurança em Redes e Computadores e leaves the global date for confirmation", () => {
    const result = parsePucText(`
Unidade curricular: Segurança em Redes e Computadores 2026 03
UNIDADE CURRICULAR 21181
Docente(s): José Henrique S. Mamede
Ano Letivo: 2026/2027
6.2. Calendário de avaliação contínua
Outubro Novembro Dezembro Janeiro
E-fólio A [4 valores]
Data da especificação do trabalho a realizar no E-fólio A e dos respetivos critérios de avaliação Data: 16/10
Envio do E-fólio A ao professor Data: 27/10
Indicação da classificação do E-fólio A Data: 09/11
E-fólio B [4 valores]
Data da especificação do trabalho a realizar no E-fólio B e dos respetivos critérios de avaliação Data: 16/11
Envio do E-fólio B ao professor Data: 09/12
Indicação da classificação do E-fólio B Data: 18/12
e-fólio Global [12 valores] Realização Data: [consultar datas oficiais das provas]
`);

    expect(result.courseName).toBe("Segurança em Redes e Computadores");
    expect(result.courseCode).toBe("21181");
    expect(result.edition).toBe("03");
    expect(event(result, "E-fólio A")).toMatchObject({
      startDate: "2026-10-16",
      endDate: "2026-10-27",
      gradeReleaseDate: "2026-11-09",
      confidence: "high",
    });
    expect(event(result, "E-fólio B")?.endDate).toBe("2026-12-09");
    expect(result.warnings.some((warning) => warning.includes("calendário oficial"))).toBe(true);
  });

  it("reads Matemática Finita dates written with Portuguese month names", () => {
    const result = parsePucText(`
Unidade curricular: Matemática Finita 2025 04
Matemática Finita - 21082
Docente: Clarence Protin
Ano Letivo: 2025/26
6.2. Calendário de avaliação contínua
março abril maio junho
E-fólio A (4 valores)
Data da especificação do trabalho a realizar no E-fólio A e dos respetivos critérios de avaliação Data: 6 de abril
Envio do E-fólio A ao professor Data: 13 de abril
Indicação da classificação do E-fólio A Data: 5 de maio
E-fólio B (4 valores)
Data da especificação do trabalho a realizar no E-fólio B e dos respetivos critérios de avaliação Data: 8 de maio
Envio do E-fólio B ao professor Data: 17 de maio
Indicação da classificação do E-fólio B Data: 9 de junho
E-fólio Global (12 valores) Consultar datas nas páginas oficiais da Universidade Aberta
`);

    expect(result.courseName).toBe("Matemática Finita");
    expect(result.courseCode).toBe("21082");
    expect(result.academicYear).toBe("2025/2026");
    expect(event(result, "E-fólio A")).toMatchObject({
      startDate: "2026-04-06",
      endDate: "2026-04-13",
      gradeReleaseDate: "2026-05-05",
    });
    expect(event(result, "E-fólio B")?.endDate).toBe("2026-05-17");
  });

  it("uses medium confidence for a legacy table whose month is recovered from the work plan", () => {
    const result = parsePucText(`
Unidade curricular: Raciocínio e Representação do Conhecimento 2025 03
UNIDADE CURRICULAR 21097
Docente(s): Joaquim Neto
Ano Lectivo: 2025/2026
6.2. Calendário de avaliação contínua
Março Abril Maio Junho
E-fólio A [4 valores]
Data da especificação do trabalho a realizar no E-fólio A e dos respetivos critérios de avaliação
10
Envio do E-fólio A ao professor 20
Indicação da classificação do E-fólio A até dia 2
E-fólio B [4 valores]
Data da especificação do trabalho a realizar no E-fólio B e dos respetivos critérios de avaliação
8
Envio do E-fólio B ao professor 18
Indicação da classificação do E-fólio B até dia 2
E-fólio Global Realização na Wiseflow Data: Ver calendário de exames no site da UAb
7. Plano de Trabalho
Sessão síncrona antes do e-fólio A, na 4.ª-feira, dia 8 de abril, às 21 horas.
7.ª Semana - 13 de abril Semana do e-fólio A
Sessão síncrona antes do e-fólio B, na 4.ª-feira, dia 6 de maio, às 21 horas.
11.ª Semana - 11 de maio Semana do e-fólio B
`);

    expect(result.courseName).toBe("Raciocínio e Representação do Conhecimento");
    expect(result.courseCode).toBe("21097");
    expect(event(result, "E-fólio A")).toMatchObject({
      startDate: "2026-04-10",
      endDate: "2026-04-20",
      confidence: "medium",
    });
    expect(event(result, "E-fólio B")).toMatchObject({
      startDate: "2026-05-08",
      endDate: "2026-05-18",
      confidence: "medium",
    });
  });

  it("reads Sistemas Distribuídos including two explicitly listed final-prova dates without assuming the second is recurso", () => {
    const result = parsePucText(`
Unidade curricular: Sistemas Distribuídos - Espaço Central
UNIDADE CURRICULAR 21108
21108 - Sistemas Distribuídos
Docente: Nelson Russo
Ano Letivo: 2025/2026
6.2. Calendário de avaliação contínua
Março Abril Maio Junho Setembro
E-Fólio A [4 valores]
Data da especificação do trabalho a realizar no E-Fólio A e dos respetivos critérios de avaliação 06 de abril
Envio do E-Fólio A no espaço de turma 12 de abril
Indicação da classificação do E-Fólio A 20 de abril
E-Fólio B [4 valores]
Data da especificação do trabalho a realizar no E-Fólio B e dos respetivos critérios de avaliação 11 de maio
Envio do E-Fólio B no espaço de turma 17 de maio
Indicação da classificação do E-Fólio B 25 de maio
E-Fólio Global 12 valores
Exame 20 valores
09-06-2026 Provas agendadas para o período da manhã Início às 10.00 horas de Portugal continental
29-09-2026 Provas agendadas para o período da tarde Início às 15.00 horas de Portugal continental
`);

    expect(result.courseName).toBe("Sistemas Distribuídos");
    expect(result.courseCode).toBe("21108");
    expect(event(result, "E-fólio A")?.endDate).toBe("2026-04-12");
    expect(event(result, "E-fólio B")?.endDate).toBe("2026-05-17");
    expect(event(result, "E-fólio Global / Exame")?.startDate).toBe("2026-06-09");
    expect(event(result, "Segunda data de prova encontrada no PUC")).toMatchObject({
      startDate: "2026-09-29",
      kind: "second-exam-date",
      confidence: "medium",
    });
  });

  it("keeps Física Geral usable without inventing an absent academic year", () => {
    const result = parsePucText(`
FÍSICA GERAL
21048
Lic. em Eng.ª Informática
Docente(s): Nuno Miguel Marques de Sousa
6. Avaliação
No regime de avaliação contínua os estudantes realizam dois trabalhos digitais (efolios A e B) e uma prova online no final do semestre.
A data de realização dos efolios A e B está indicada no plano de trabalhos da UC.
O gfolio e o exame são realizados na plataforma wiseflow. A data e hora destas provas pode ser consultada no portal da UAb.
7. Plano de Trabalho
9 28 nov Efolio A Efolio A
13 9 jan Efolio B Efolio B
14 19 jan Efolio B Efolio B Continuação do efolio B
`);

    expect(result.courseName).toBe("FÍSICA GERAL");
    expect(result.courseCode).toBe("21048");
    expect(result.academicYear).toBeNull();
    expect(result.evaluationModel).toBeNull();
    expect(event(result, "E-fólio A")).toMatchObject({
      rawStartDate: "28 nov",
      confidence: "low",
    });
    expect(event(result, "E-fólio A")?.startDate).toBeUndefined();
    expect(result.warnings.some((warning) => warning.includes("Ano letivo não identificado"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("não será inferida"))).toBe(true);
  });
});
