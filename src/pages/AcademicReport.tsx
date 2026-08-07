import { useMemo, useState, type CSSProperties } from "react";
import "@/report-print.css";
import "@/report-orientation.css";
import { ArrowLeft, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/AppStore";
import { finalGradeRounded, getAssessments } from "@/lib/calculations";
import type { Assessment, Course } from "@/lib/types";
import { getCourseArea, getPlanCoursesForDegree } from "@/lib/uabPlan";
import { formatPtNumber } from "@/lib/utils";

const REPORT_LOGO = "/academic-hub-icon-current-v8.svg";
type PrintOrientation = "portrait" | "landscape";

type ReportDensity = "comfortable" | "balanced" | "compact";

function sortCourses(a: Course, b: Course): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.semester !== b.semester) return a.semester - b.semester;
  return a.code.localeCompare(b.code, "pt-PT");
}

function yearSemester(course: Course): string {
  return `${course.year}º ano · ${course.semester}º semestre`;
}

function assessmentScore(assessment?: Assessment | null): string {
  if (!assessment || assessment.grade === null) return "—";
  return `${formatPtNumber(assessment.grade)} / ${formatPtNumber(assessment.maxPoints)}`;
}

function finalGradeLabel(value: number | null): string {
  return value === null ? "—" : `${formatPtNumber(value)} valores`;
}

function compactAssessmentLabel(assessment: Assessment, index: number): string {
  const fallback = `E${String.fromCharCode(65 + index)}`;
  const raw = assessment.name?.trim() || fallback;
  if (/e-?fólio\s*[a-z]/i.test(raw)) {
    const match = raw.match(/([a-z])\s*$/i);
    return match ? `E-${match[1].toUpperCase()}` : fallback;
  }
  return raw.length > 10 ? fallback : raw;
}

function compactAssessmentSummary(
  efolios: Assessment[],
  exam: Assessment | null,
  resit: Assessment | null,
): string {
  const parts = efolios.map((item, index) => `${compactAssessmentLabel(item, index)} ${assessmentScore(item)}`);
  const finalAssessment = resit && resit.grade !== null ? resit : exam;
  if (finalAssessment) {
    const label = resit && resit.grade !== null ? "R" : "Final";
    parts.push(`${label} ${assessmentScore(finalAssessment)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function reportDensity(courseCount: number): ReportDensity {
  if (courseCount <= 16) return "comfortable";
  if (courseCount <= 24) return "balanced";
  return "compact";
}

function ReportBrand() {
  return (
    <div className="academic-report-brand" aria-label="Academic Hub">
      <img src={REPORT_LOGO} alt="Academic Hub" />
      <div className="academic-report-brand-name">Academic Hub</div>
      <div className="academic-report-brand-rule" aria-hidden="true"><span /></div>
    </div>
  );
}

function ReportDisclaimer() {
  return (
    <div className="academic-report-disclaimer">
      <span className="academic-report-info" aria-hidden="true">i</span>
      <span>Documento informativo gerado pelo Academic Hub — não é um documento oficial da Universidade Aberta (UAb).</span>
    </div>
  );
}

export default function AcademicReportPage() {
  const navigate = useNavigate();
  const { state } = useAppStore();
  const [orientation, setOrientation] = useState<PrintOrientation>("landscape");

  const planCourses = useMemo(() => getPlanCoursesForDegree(state.degree), [state.degree]);
  const completed = useMemo(
    () => state.courses.filter((course) => course.isCompleted).sort(sortCourses),
    [state.courses],
  );
  const density = reportDensity(completed.length);

  const reportRows = useMemo(
    () => completed.map((course) => {
      const assessments = getAssessments(state, course.id);
      const efolios = assessments
        .filter((item) => item.type === "efolio")
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      const exam = assessments.find((item) => item.type === "exam") ?? null;
      const resit = assessments.find((item) => item.type === "resit") ?? null;
      return {
        course,
        area: getCourseArea(planCourses, course.code) || "—",
        efolios,
        exam,
        resit,
        final: finalGradeRounded(state, course.id),
      };
    }),
    [completed, planCourses, state],
  );

  const maxEfolioCount = useMemo(
    () => Math.max(3, ...reportRows.map((row) => row.efolios.length)),
    [reportRows],
  );
  const efolioColumns = useMemo(
    () => Array.from({ length: maxEfolioCount }, (_, index) => index),
    [maxEfolioCount],
  );

  const grades = reportRows
    .map((row) => row.final)
    .filter((grade): grade is number => grade !== null);
  const average = grades.length > 0
    ? grades.reduce((total, grade) => total + grade, 0) / grades.length
    : null;

  const chooseOrientation = (value: PrintOrientation) => {
    setOrientation(value);
    document.documentElement.dataset.reportOrientation = value;
  };

  const printReport = () => {
    document.documentElement.dataset.reportOrientation = orientation;
    window.setTimeout(() => window.print(), 60);
  };

  return (
    <div className={`academic-report-view academic-report-${orientation} academic-report-density-${density}`}>
      <div className="academic-report-actions print:hidden">
        <Button
          variant="outline"
          className="academic-report-back-button w-fit"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Cancelar e voltar
        </Button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-1 text-sm font-medium text-muted-foreground">Orientação:</span>
          <Button
            type="button"
            variant={orientation === "portrait" ? "default" : "outline"}
            onClick={() => chooseOrientation("portrait")}
          >
            A4 vertical
          </Button>
          <Button
            type="button"
            variant={orientation === "landscape" ? "default" : "outline"}
            onClick={() => chooseOrientation("landscape")}
          >
            A4 horizontal
          </Button>
          <Button onClick={printReport}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir ou guardar em PDF
          </Button>
        </div>
      </div>

      <section className="academic-report-sheet academic-report-page-one">
        <header className="academic-report-compact-header">
          <ReportBrand />
          <div className="academic-report-title-block">
            <h1>Cadeiras Concluídas</h1>
            <span className="academic-report-title-rule" aria-hidden="true" />
            <p>Resumo académico pessoal</p>
          </div>
          <div className="academic-report-header-balance" aria-hidden="true" />
        </header>

        <ReportDisclaimer />

        {completed.length === 0 ? (
          <div className="academic-report-empty">Ainda não existem cadeiras concluídas para incluir no relatório.</div>
        ) : (
          <div className="academic-report-table-wrap academic-report-summary-table-wrap">
            <table className="academic-report-table academic-report-summary-table">
              <colgroup>
                <col className="academic-report-col-period" />
                <col className="academic-report-col-code" />
                <col className="academic-report-col-name" />
                <col className="academic-report-col-final" />
              </colgroup>
              <thead>
                <tr>
                  <th>Ano / Semestre</th>
                  <th>ID da cadeira</th>
                  <th>Nome da cadeira</th>
                  <th>Nota final</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map(({ course, final }) => (
                  <tr key={course.id}>
                    <td>{yearSemester(course)}</td>
                    <td className="academic-report-center">{course.code}</td>
                    <td>{course.name}</td>
                    <td className="academic-report-center academic-report-final-cell">{finalGradeLabel(final)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="academic-report-summary-strip">
          <div className="academic-report-summary-item">
            <span className="academic-report-summary-icon" aria-hidden="true">★</span>
            <span>Total de cadeiras concluídas:</span>
            <strong>{completed.length}</strong>
          </div>
          <span className="academic-report-summary-divider" aria-hidden="true" />
          <div className="academic-report-summary-item">
            <span className="academic-report-summary-icon academic-report-bars" aria-hidden="true">▥</span>
            <span>Média final:</span>
            <strong>{average === null ? "—" : `${formatPtNumber(average, 1)} valores`}</strong>
          </div>
        </div>

        <footer className="academic-report-footer">
          <div className="academic-report-footer-rule"><span /></div>
          <div>Página 1 de 2</div>
          <div className="academic-report-footer-wave" aria-hidden="true" />
        </footer>
      </section>

      <section className="academic-report-sheet academic-report-page-two">
        <header className="academic-report-detail-header">
          <ReportBrand />
          <div className="academic-report-title-block academic-report-detail-title">
            <h1>Detalhe das cadeiras concluídas</h1>
            <p>Verso — avaliações por cadeira</p>
          </div>
        </header>

        <ReportDisclaimer />

        {completed.length === 0 ? (
          <div className="academic-report-empty">Ainda não existem cadeiras concluídas para detalhar.</div>
        ) : orientation === "portrait" ? (
          <div className="academic-report-table-wrap academic-report-portrait-table-wrap">
            <table className="academic-report-table academic-report-portrait-table">
              <thead>
                <tr>
                  <th>N.º</th>
                  <th>Cadeira</th>
                  <th>ID</th>
                  <th>Ano / Sem.</th>
                  <th>Categoria</th>
                  <th>Avaliações</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map(({ course, area, efolios, exam, resit, final }, index) => (
                  <tr key={course.id}>
                    <td className="academic-report-center">{index + 1}</td>
                    <td className="academic-report-course-name">{course.name}</td>
                    <td className="academic-report-center">{course.code}</td>
                    <td>{`${course.year}º · ${course.semester}º`}</td>
                    <td>{area}</td>
                    <td className="academic-report-assessment-summary">{compactAssessmentSummary(efolios, exam, resit)}</td>
                    <td className="academic-report-center academic-report-final-cell">{final === null ? "—" : formatPtNumber(final)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="academic-report-table-wrap academic-report-detail-table-wrap">
            <table
              className="academic-report-table academic-report-detail-table"
              style={{ "--efolio-count": efolioColumns.length } as CSSProperties}
            >
              <thead>
                <tr>
                  <th>N.º</th>
                  <th>Nome da cadeira</th>
                  <th>ID</th>
                  <th>Ano / Semestre</th>
                  <th>Categoria</th>
                  {efolioColumns.map((index) => <th key={index}>E-fólio {String.fromCharCode(65 + index)}</th>)}
                  <th>Avaliação final</th>
                  <th>Nota final</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map(({ course, area, efolios, exam, resit, final }, index) => (
                  <tr key={course.id}>
                    <td className="academic-report-center">{index + 1}</td>
                    <td className="academic-report-course-name">{course.name}</td>
                    <td className="academic-report-center">{course.code}</td>
                    <td>{yearSemester(course)}</td>
                    <td><span className="academic-report-category">{area}</span></td>
                    {efolioColumns.map((efolioIndex) => (
                      <td key={efolioIndex} className="academic-report-center">{assessmentScore(efolios[efolioIndex])}</td>
                    ))}
                    <td className="academic-report-center">{resit && resit.grade !== null ? `R: ${assessmentScore(resit)}` : assessmentScore(exam)}</td>
                    <td className="academic-report-center academic-report-final-cell">{final === null ? "—" : formatPtNumber(final)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="academic-report-detail-total">
          <span className="academic-report-summary-icon" aria-hidden="true">★</span>
          <span>Total de cadeiras concluídas:</span>
          <strong>{completed.length}</strong>
        </div>

        <footer className="academic-report-footer">
          <div className="academic-report-footer-rule"><span /></div>
          <div>Página 2 de 2</div>
          <div className="academic-report-footer-wave" aria-hidden="true" />
        </footer>
      </section>
    </div>
  );
}
