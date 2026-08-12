import {
  decodeSetPayload,
  formatDueAt,
  getDueAt,
  isDueExpired,
  readReportStore,
  sendClassReportIfDue,
  summarizeReports,
} from "./shared.js";

const missingPanel = document.querySelector("#missing-panel");
const reportPanel = document.querySelector("#report-panel");
const countdownEl = document.querySelector("#report-countdown");
const statusEl = document.querySelector("#report-status");
const countsEl = document.querySelector("#report-counts");
const rowsEl = document.querySelector("#report-rows");
const sendButton = document.querySelector("#send-report");
const refreshButton = document.querySelector("#refresh-report");

const params = new URLSearchParams(window.location.search);
const vocabSet = decodeSetPayload(params.get("set"));

let sending = false;
let tickId = null;
let pollId = null;

function showPanel(panel) {
  [missingPanel, reportPanel].forEach((el) => {
    el.hidden = el !== panel;
  });
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderRows(summary) {
  if (summary.length === 0) {
    rowsEl.innerHTML =
      "<tr><td colspan=\"5\">Waiting for students to practice…</td></tr>";
    countsEl.textContent = "No students yet.";
    return;
  }

  const passed = summary.filter((item) => item.best?.passed).length;
  countsEl.textContent =
    `${summary.length} student${summary.length === 1 ? "" : "s"} practiced · ${passed} passed · ${summary.length - passed} not yet passed`;

  rowsEl.innerHTML = "";
  summary.forEach((item) => {
    const row = document.createElement("tr");
    const status = item.best?.passed ? "Passed" : "Not passed";
    row.innerHTML = `
      <td>${escapeHtml(item.studentEmail)}</td>
      <td>${status}</td>
      <td>${item.best?.accuracy ?? 0}%</td>
      <td>${item.best?.correct ?? 0} / ${item.best?.attempted ?? 0}</td>
      <td>${item.attempts}</td>
    `;
    rowsEl.appendChild(row);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function updateCountdown() {
  const dueAt = getDueAt(vocabSet);
  if (!dueAt) {
    countdownEl.textContent = "—";
    return { expired: false, remaining: Infinity };
  }
  const remaining = dueAt.getTime() - Date.now();
  const expired = remaining <= 0;
  countdownEl.textContent = expired ? "Due time reached" : formatRemaining(remaining);
  sendButton.disabled = sending || !expired;
  sendButton.title = expired
    ? "Email the current class results now"
    : "Available after the due time";
  return { expired, remaining };
}

async function refreshResults() {
  if (!vocabSet?.storeId) return null;
  const store = await readReportStore(vocabSet.storeId);
  renderRows(summarizeReports(store.reports || []));
  if (store.summarySent) {
    statusEl.textContent = store.summarySentAt
      ? `Class report emailed ${formatDueAt(store.summarySentAt)}`
      : `Class report emailed to ${vocabSet.teacherEmail}`;
  }
  return store;
}

async function sendReport({ force = false } = {}) {
  if (sending) return;
  sending = true;
  sendButton.disabled = true;
  statusEl.textContent = "Sending class report…";
  try {
    const result = await sendClassReportIfDue(vocabSet, { force });
    statusEl.textContent = result.message;
    await refreshResults();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    statusEl.textContent = `Could not email the class report. ${detail}`;
  } finally {
    sending = false;
    updateCountdown();
  }
}

async function setup() {
  document.querySelector("#report-title").textContent = vocabSet.setName;
  document.querySelector("#report-lede").textContent =
    `Results are collected until ${formatDueAt(vocabSet)}. One class report will be emailed to ${vocabSet.teacherEmail} when that time is reached.`;
  document.querySelector("#report-due").textContent = formatDueAt(vocabSet);
  document.querySelector("#report-email").textContent = vocabSet.teacherEmail;
  showPanel(reportPanel);
  updateCountdown();

  try {
    const store = await refreshResults();
    if (isDueExpired(vocabSet) && !store?.summarySent) {
      await sendReport();
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    statusEl.textContent = `Could not load student results. ${detail}`;
  }

  tickId = window.setInterval(async () => {
    const { expired } = updateCountdown();
    if (expired && !sending) {
      try {
        const store = await readReportStore(vocabSet.storeId);
        if (!store.summarySent) {
          await sendReport();
        }
      } catch {
        // Keep the countdown running; the next tick retries.
      }
    }
  }, 1000);

  pollId = window.setInterval(() => {
    refreshResults().catch(() => {});
  }, 8000);
}

refreshButton.addEventListener("click", () => {
  refreshResults().catch((error) => {
    const detail = error instanceof Error ? error.message : "Unknown error";
    statusEl.textContent = `Could not load student results. ${detail}`;
  });
});

sendButton.addEventListener("click", () => {
  sendReport({ force: true });
});

window.addEventListener("beforeunload", () => {
  if (tickId) window.clearInterval(tickId);
  if (pollId) window.clearInterval(pollId);
});

if (!vocabSet) {
  showPanel(missingPanel);
} else if (!vocabSet.storeId || !vocabSet.storeEditKey) {
  showPanel(reportPanel);
  document.querySelector("#report-title").textContent =
    vocabSet.setName || "Class report";
  document.querySelector("#report-lede").textContent =
    "This practice link was created before class reports were available. Create a new set to collect student results and email one report after the due time.";
  sendButton.disabled = true;
  refreshButton.disabled = true;
} else {
  setup();
}
