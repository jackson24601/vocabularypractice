export const STORAGE_KEY = "wordnest.vocabularySets";
export const REPORTS_KEY = "wordnest.practiceReports";
export const MAX_TERMS = 10;
export const MIN_TERMS = 4;
export const PRACTICE_DURATION_MS = 10 * 60 * 1000;
export const DEFINITION_REVEAL_MS = 3000;
export const FEEDBACK_MS = 1800;
export const PASSING_SCORE = 75;
export const MIN_CORRECT = 50;

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
    teacherEmail: set.teacherEmail,
    terms: set.terms,
  };
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
      typeof payload.setName !== "string" ||
      !Array.isArray(payload.terms) ||
      payload.terms.length < MIN_TERMS
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function buildStudentLink(set) {
  // Resolve relative to the current page so GitHub Pages project URLs work
  // (e.g. https://user.github.io/vocabularypractice/).
  const url = new URL("student.html", window.location.href);
  url.searchParams.set("set", encodeSetPayload(set));
  return url.toString();
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
    feedbackMs: fast ? 1200 : FEEDBACK_MS,
    minCorrect: fast ? 3 : MIN_CORRECT,
    passingScore: PASSING_SCORE,
    fast,
  };
}
