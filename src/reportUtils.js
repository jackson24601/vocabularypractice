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
    dueDate: set.dueDate,
    dueTime: set.dueTime,
    dueAt: set.dueAt,
    terms: Array.isArray(set.terms) ? set.terms : [],
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

export function studentLabel(report) {
  const name = String(report?.studentName || "").trim();
  if (name) return name;
  return String(report?.studentEmail || "").trim();
}

export function summarizeReports(reports) {
  const byName = new Map();
  for (const report of reports || []) {
    const name = studentLabel(report);
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { name, attempts: [report] });
      continue;
    }
    existing.attempts.push(report);
  }

  const groups = [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  for (const group of groups) {
    group.attempts.sort(
      (a, b) =>
        new Date(a.completedAt || 0).getTime() -
        new Date(b.completedAt || 0).getTime(),
    );
  }
  return groups;
}

export function buildClassReportEmail(set, reports) {
  const summary = summarizeReports(reports);
  const attemptCount = summary.reduce(
    (total, item) => total + item.attempts.length,
    0,
  );
  const setName = set?.setName || "Vocabulary practice";
  const dueLabel = formatDueAt(set) || "the due time";
  const lines = [
    `Class report for “${setName}”.`,
    `Practice window ended ${dueLabel}.`,
    "",
    `Students who practiced: ${summary.length}`,
    `Total attempts: ${attemptCount}`,
    "",
  ];

  if (summary.length === 0) {
    lines.push("No students completed practice before this report was sent.");
  } else {
    lines.push("Student scores (every attempt):");
    lines.push("");
    for (const item of summary) {
      lines.push(item.name);
      item.attempts.forEach((attempt, index) => {
        lines.push(
          [
            `  ${index + 1}.`,
            `${attempt.accuracy ?? 0}%`,
            `(${attempt.correct ?? 0}/${attempt.attempted ?? 0} correct)`,
            attempt.completedAt
              ? formatCompletedAt(attempt.completedAt)
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        );
      });
      lines.push("");
    }
  }

  return {
    subject: `WordNest class report: ${setName}`,
    message: lines.join("\n").trim(),
    studentCount: summary.length,
    attemptCount,
    summary,
  };
}
