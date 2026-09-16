import { describe, expect, it } from "vitest";

import {
  assessmentTypeLabel,
  getAssessmentCalendarEvents,
} from "@/lib/assessmentCalendar";
import { buildIcsForActiveCourses } from "@/lib/ics";
import type { AppState, Assessment, AssessmentType } from "@/lib/types";

const assessmentTypes: AssessmentType[] = [
  "efolio",
  "exam",
  "resit",
  "special",
  "activity",
  "project",
  "presentation",
  "discussion",
  "other",
];

function assessment(type: AssessmentType, patch: Partial<Assessment> = {}): Assessment {
  return {
    id: `assessment-${type}`,
    courseId: "course-1",
    type,
    name: `Elemento ${type}`,
    maxPoints: 5,
    grade: null,
    ...patch,
  };
}

describe("assessment calendar events", () => {
  it("reflects every assessment type when it has a dated event", () => {
    for (const type of assessmentTypes) {
      const [event] = getAssessmentCalendarEvents(
        assessment(type, { date: "2027-01-20T14:30" }),
      );

      expect(event).toBeDefined();
      expect(event.kind).toBe("date");
      expect(event.when).toBe("2027-01-20T14:30");
      expect(event.title).toContain(assessmentTypeLabel(type));
      expect(event.tag).toContain("14:30");
    }
  });

  it("adds start, end and grade publication dates for non e-folio assessments", () => {
    const events = getAssessmentCalendarEvents(
      assessment("activity", {
        name: "AS1",
        startDate: "2026-10-05",
        endDate: "2026-10-18",
        gradeReleaseDate: "2026-10-25",
      }),
    );

    expect(events.map((event) => [event.kind, event.when, event.tag])).toEqual([
      ["start", "2026-10-05", "Início"],
      ["end", "2026-10-18", "Entrega"],
      ["grade", "2026-10-25", "Nota"],
    ]);
  });

  it("keeps the .ics export aligned with the in-app calendar", () => {
    const state: AppState = {
      degree: null,
      courses: [
        {
          id: "course-1",
          code: "21053",
          name: "Bases de Dados",
          year: 1,
          semester: 1,
          isActive: true,
          isCompleted: false,
        },
      ],
      assessments: [
        assessment("activity", {
          name: "AS1",
          startDate: "2026-10-05",
          endDate: "2026-10-18",
          gradeReleaseDate: "2026-10-25",
        }),
      ],
      rules: [],
    };

    const ics = buildIcsForActiveCourses(state, { includePast: true });

    expect(ics).toContain("AS1 - Início");
    expect(ics).toContain("AS1 - Fim");
    expect(ics).toContain("AS1 - Nota");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261005");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261018");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261025");
  });
});
