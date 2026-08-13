import {
  buildClassReportEmail,
  formatDueAt,
  isDueExpired,
} from "./reportUtils.js";
import {
  readReportStore,
  updateStoreFlags,
} from "./store.js";

export const STORAGE_KEY = "wordnest.vocabularySets";
export const REPORTS_KEY = "wordnest.practiceReports";
export const MAX_TERMS = 50;
export const MIN_TERMS = 4;
export const PRACTICE_DURATION_MS = 10 * 60 * 1000;
export const DEFINITION_REVEAL_MS = 3000;
export const ANSWER_TIMEOUT_MS = 15_000;
export const FEEDBACK_MS = 1800;

export {
  dueAtFromInputs,
  formatDueAt,
  getDueAt,
  isDueExpired,
  summarizeReports,
} from "./reportUtils.js";
export { createReportStore, readReportStore, saveStudentReport } from "./store.js";

export function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function formatDueDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function loadSets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSet(set) {
  const sets = loadSets().filter((item) => item.id !== set.id);
  sets.unshift(set);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

export function encodeSetPayload(set) {
  const payload = {
    id: set.id,
    setName: set.setName,
    dueDate: set.dueDate,
    dueTime: set.dueTime,
    dueAt: set.dueAt,
    teacherEmail: set.teacherEmail,
    storeId: set.storeId,
    storeEditKey: set.storeEditKey,
  };
  if (Array.isArray(set.terms) && set.terms.length && !set.storeId) {
    payload.terms = set.terms;
  }
  const json = JSON.stringify(payload);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeSetPayload(encoded) {
  if (!encoded) return null;
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (padded.length % 4)) % 4;
    const base64 = padded + "=".repeat(padLength);
    const json = decodeURIComponent(escape(atob(base64)));
    const payload = JSON.parse(json);
    if (
      !payload ||
      typeof payload.setName !== "string"
    ) {
      return null;
    }
    const hasTerms =
      Array.isArray(payload.terms) && payload.terms.length >= MIN_TERMS;
    const hasStore = typeof payload.storeId === "string" && payload.storeId;
    if (!hasTerms && !hasStore) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function buildAppLink(page, set) {
  // Resolve relative to the current page so GitHub Pages project URLs work
  // (e.g. https://user.github.io/vocabularypractice/).
  const url = new URL(page, window.location.href);
  url.searchParams.set("set", encodeSetPayload(set));
  return url.toString();
}

export function buildStudentLink(set) {
  return buildAppLink("student.html", set);
}

export function buildReportLink(set) {
  return buildAppLink("report.html", set);
}

export async function resolveVocabSet(payload) {
  if (!payload) return null;

  let set = { ...payload };
  if (payload.storeId) {
    try {
      const store = await readReportStore(payload.storeId);
      set = {
        ...payload,
        setName: store.setName || payload.setName,
        dueDate: store.dueDate || payload.dueDate,
        dueTime: store.dueTime || payload.dueTime,
        dueAt: store.dueAt || payload.dueAt,
        teacherEmail: store.teacherEmail || payload.teacherEmail,
        terms:
          Array.isArray(store.terms) && store.terms.length > 0
            ? store.terms
            : payload.terms,
      };
    } catch {
      // Use the link payload if the store cannot be read.
    }
  }

  if (
    typeof set.setName !== "string" ||
    !Array.isArray(set.terms) ||
    set.terms.length < MIN_TERMS
  ) {
    return null;
  }
  return set;
}

export function saveReport(report) {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    const reports = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(reports) ? reports : [];
    list.unshift(report);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage failures; practice completion still shows locally.
  }
}

/**
 * Email one class report to the teacher via FormSubmit after the due time.
 * The first report to a new address may require the teacher to click an
 * activation link FormSubmit sends them.
 */
export async function sendClassReportEmail(set, reports) {
  const teacherEmail = set.teacherEmail?.trim();
  if (!teacherEmail) {
    throw new Error("Missing teacher email address.");
  }

  const email = buildClassReportEmail(set, reports);
  const response = await fetch(
    `https://formsubmit.co/ajax/${encodeURIComponent(teacherEmail)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        _subject: email.subject,
        _template: "box",
        _captcha: "false",
        name: "WordNest class report",
        email: teacherEmail,
        setName: set.setName,
        dueAt: formatDueAt(set),
        studentsPracticed: email.studentCount,
        attempts: email.attemptCount,
        message: email.message,
      }),
    },
  );

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  const payloadMessage = String(data?.message || "");
  const successFlag = String(data?.success ?? "").toLowerCase();
  const needsActivation = /activat/i.test(payloadMessage);

  if (needsActivation) {
    return {
      status: "activation_required",
      message:
        `Almost there: check ${teacherEmail} for a FormSubmit “Activate Form” email, click the link, then open the class report page again so the report can send.`,
    };
  }

  if (successFlag === "false") {
    throw new Error(payloadMessage || "Email service rejected the report.");
  }

  return {
    status: "sent",
    message: `Class report emailed to ${teacherEmail}`,
    studentCount: email.studentCount,
  };
}

export async function sendClassReportIfDue(set, { force = false } = {}) {
  if (!set?.storeId || !set?.storeEditKey) {
    throw new Error("This practice set is missing class report storage.");
  }
  if (!force && !isDueExpired(set)) {
    return {
      status: "waiting",
      message: `Class report will email after ${formatDueAt(set)}.`,
    };
  }

  const store = await readReportStore(set.storeId);
  if (!force && store.summarySent) {
    return {
      status: "already_sent",
      message: `Class report already emailed to ${set.teacherEmail}.`,
      sentAt: store.summarySentAt,
    };
  }

  await updateStoreFlags(set, {
    summarySent: true,
    summarySentAt: new Date().toISOString(),
  });

  try {
    const result = await sendClassReportEmail(set, store.reports || []);
    if (result.status === "activation_required") {
      await updateStoreFlags(set, {
        summarySent: false,
        summarySentAt: null,
      });
    }
    return result;
  } catch (error) {
    await updateStoreFlags(set, {
      summarySent: false,
      summarySentAt: null,
    });
    throw error;
  }
}

export function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickQuestion(terms, recentIndex = -1) {
  if (terms.length === 0) return null;

  let answerIndex = Math.floor(Math.random() * terms.length);
  if (terms.length > 1) {
    let guard = 0;
    while (answerIndex === recentIndex && guard < 8) {
      answerIndex = Math.floor(Math.random() * terms.length);
      guard += 1;
    }
  }

  const answer = terms[answerIndex];
  const distractors = shuffle(
    terms.filter((_, index) => index !== answerIndex),
  ).slice(0, 3);
  const options = shuffle([answer.term, ...distractors.map((item) => item.term)]);

  return {
    answerIndex,
    definition: answer.definition,
    correctTerm: answer.term,
    options,
  };
}

export function getPracticeConfig() {
  const params = new URLSearchParams(window.location.search);
  const fast = params.get("fast") === "1";
  return {
    practiceMs: fast ? 20_000 : PRACTICE_DURATION_MS,
    definitionMs: fast ? 800 : DEFINITION_REVEAL_MS,
    answerMs: fast ? 4_000 : ANSWER_TIMEOUT_MS,
    feedbackMs: fast ? 1200 : FEEDBACK_MS,
    fast,
  };
}
