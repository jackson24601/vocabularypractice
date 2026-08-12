import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendReport,
  buildClassReportEmail,
  dueAtFromInputs,
  getDueAt,
  isDueExpired,
  summarizeReports,
} from "./reportUtils.js";

describe("dueAtFromInputs", () => {
  it("builds a local datetime from date and time fields", () => {
    const date = dueAtFromInputs("2026-08-12", "15:30");
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 7);
    assert.equal(date.getDate(), 12);
    assert.equal(date.getHours(), 15);
    assert.equal(date.getMinutes(), 30);
  });

  it("returns null for missing values", () => {
    assert.equal(dueAtFromInputs("", "15:30"), null);
    assert.equal(dueAtFromInputs("2026-08-12", ""), null);
  });
});

describe("getDueAt and isDueExpired", () => {
  it("prefers the stored dueAt instant", () => {
    const dueAt = getDueAt({ dueAt: "2026-08-12T19:00:00.000Z", dueDate: "2026-01-01" });
    assert.equal(dueAt.toISOString(), "2026-08-12T19:00:00.000Z");
  });

  it("falls back to end of the due date", () => {
    const dueAt = getDueAt({ dueDate: "2026-08-12" });
    assert.equal(dueAt.getHours(), 23);
    assert.equal(dueAt.getMinutes(), 59);
  });

  it("is expired at or after the due instant", () => {
    const set = { dueAt: "2026-08-12T19:00:00.000Z" };
    assert.equal(isDueExpired(set, new Date("2026-08-12T18:59:59.000Z")), false);
    assert.equal(isDueExpired(set, new Date("2026-08-12T19:00:00.000Z")), true);
    assert.equal(isDueExpired(set, new Date("2026-08-12T19:00:01.000Z")), true);
  });
});

describe("appendReport", () => {
  it("appends a new report and ignores duplicate ids", () => {
    const first = appendReport({ reports: [] }, { id: "a", studentEmail: "a@school.edu" });
    const second = appendReport(first, { id: "a", studentEmail: "a@school.edu" });
    const third = appendReport(second, { id: "b", studentEmail: "b@school.edu" });
    assert.equal(first.reports.length, 1);
    assert.equal(second.reports.length, 1);
    assert.equal(third.reports.length, 2);
  });
});

describe("summarizeReports", () => {
  it("groups every attempt by student name and keeps all scores", () => {
    const summary = summarizeReports([
      {
        studentName: "Sam",
        correct: 20,
        accuracy: 50,
        attempted: 40,
        completedAt: "2026-08-12T11:00:00.000Z",
      },
      {
        studentName: "sam",
        correct: 55,
        accuracy: 80,
        attempted: 70,
        completedAt: "2026-08-12T10:00:00.000Z",
      },
      {
        studentEmail: "ada@school.edu",
        correct: 10,
        accuracy: 40,
        attempted: 25,
        completedAt: "2026-08-12T09:00:00.000Z",
      },
    ]);

    assert.equal(summary.length, 2);
    assert.equal(summary[0].name, "ada@school.edu");
    assert.equal(summary[0].attempts.length, 1);
    assert.equal(summary[1].name, "Sam");
    assert.equal(summary[1].attempts.length, 2);
    assert.equal(summary[1].attempts[0].accuracy, 80);
    assert.equal(summary[1].attempts[1].accuracy, 50);
  });
});

describe("buildClassReportEmail", () => {
  it("lists every score for each student", () => {
    const email = buildClassReportEmail(
      { setName: "Ecosystems", dueAt: "2026-08-12T19:00:00.000Z" },
      [
        {
          studentName: "Ada",
          correct: 55,
          attempted: 70,
          accuracy: 79,
          completedAt: "2026-08-12T18:00:00.000Z",
        },
        {
          studentName: "Sam",
          correct: 12,
          attempted: 40,
          accuracy: 30,
          completedAt: "2026-08-12T18:10:00.000Z",
        },
        {
          studentName: "Sam",
          correct: 40,
          attempted: 50,
          accuracy: 80,
          completedAt: "2026-08-12T18:40:00.000Z",
        },
      ],
    );

    assert.match(email.subject, /Ecosystems/);
    assert.equal(email.studentCount, 2);
    assert.equal(email.attemptCount, 3);
    assert.match(email.message, /Ada/);
    assert.match(email.message, /Sam/);
    assert.match(email.message, /79%/);
    assert.match(email.message, /30%/);
    assert.match(email.message, /80%/);
    assert.match(email.message, /Total attempts: 3/);
    assert.doesNotMatch(email.message, /Passed:/);
  });

  it("explains when nobody practiced", () => {
    const email = buildClassReportEmail({ setName: "Empty set" }, []);
    assert.equal(email.studentCount, 0);
    assert.match(email.message, /No students completed practice/);
  });
});
