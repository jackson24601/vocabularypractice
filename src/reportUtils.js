export function dueAtFromInputs(dueDate, dueTime) {
  if (!dueDate || !dueTime) return null;
  const date = new Date(`${dueDate}T${dueTime}:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function getDueAt(set) {
  if (!set) return null;
  if (set.dueAt) {
    const date = new Date(set.dueAt);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (set.dueDate && set.dueTime) {
    return dueAtFromInputs(set.dueDate, set.dueTime);
  }
  if (set.dueDate) {
    return dueAtFromInputs(set.dueDate, "23:59");
  }
  return null;
}

export function isDueExpired(set, now = new Date()) {
  const dueAt = getDueAt(set);
  if (!dueAt) return false;
  return now.getTime() >= dueAt.getTime();
}

export function formatDueAt(setOrValue) {
  const date =
    setOrValue instanceof Date
      ? setOrValue
      : typeof setOrValue === "string"
        ? new Date(setOrValue)
        : getDueAt(setOrValue);
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatCompletedAt(isoString) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoString));
  } catch {
    return isoString || "";
  }
}

export function emptyStorePayload(set) {
  return {
    setId: set.id,
    setName: set.setName,
    teacherEmail: set.teacherEmail,
    dueAt: set.dueAt,
    reports: [],
    summarySent: false,
    summarySentAt: null,
  };
}

export function appendReport(store, report) {
  const reports = Array.isArray(store?.reports) ? [...store.reports] : [];
  if (report?.id && reports.some((item) => item.id === report.id)) {
    return { ...store, reports };
  }
  reports.push(report);
  return { ...store, reports };
}

function isBetterReport(candidate, current) {
  if (Boolean(candidate.passed) !== Boolean(current.passed)) {
    return Boolean(candidate.passed);
  }
  if ((candidate.correct || 0) !== (current.correct || 0)) {
    return (candidate.correct || 0) > (current.correct || 0);
  }
  if ((candidate.accuracy || 0) !== (current.accuracy || 0)) {
    return (candidate.accuracy || 0) > (current.accuracy || 0);
  }
  return (
    new Date(candidate.completedAt || 0).getTime() >
    new Date(current.completedAt || 0).getTime()
  );
}

export function summarizeReports(reports) {
  const byEmail = new Map();
  for (const report of reports || []) {
    const email = String(report?.studentEmail || "").trim().toLowerCase();
    if (!email) continue;
    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, {
        studentEmail: report.studentEmail,
        attempts: 1,
        best: report,
      });
      continue;
    }
    existing.attempts += 1;
    if (isBetterReport(report, existing.best)) {
      existing.best = report;
    }
  }
  return [...byEmail.values()].sort((a, b) =>
    a.studentEmail.localeCompare(b.studentEmail, undefined, {
      sensitivity: "base",
    }),
  );
}

export function buildClassReportEmail(set, reports) {
  const summary = summarizeReports(reports);
  const passedCount = summary.filter((item) => item.best?.passed).length;
  const setName = set?.setName || "Vocabulary practice";
  const dueLabel = formatDueAt(set) || "the due time";
  const lines = [
    `Class report for “${setName}”.`,
    `Practice window ended ${dueLabel}.`,
    "",
    `Students who practiced: ${summary.length}`,
    `Passed: ${passedCount}`,
    `Not yet passed: ${summary.length - passedCount}`,
    "",
  ];

  if (summary.length === 0) {
    lines.push("No students completed practice before this report was sent.");
  } else {
    lines.push("Student results (best attempt):");
    lines.push("");
    for (const item of summary) {
      const best = item.best;
      const status = best.passed ? "Passed" : "Not passed";
      lines.push(
        [
          item.studentEmail,
          status,
          `Accuracy ${best.accuracy ?? 0}%`,
          `Correct ${best.correct ?? 0}/${best.attempted ?? 0}`,
          `Sessions ${item.attempts}`,
          best.completedAt ? `Last try ${formatCompletedAt(best.completedAt)}` : "",
        ]
          .filter(Boolean)
          .join(" — "),
      );
    }
  }

  return {
    subject: `WordNest class report: ${setName}`,
    message: lines.join("\n"),
    studentCount: summary.length,
    passedCount,
    summary,
  };
}
