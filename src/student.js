import {
  decodeSetPayload,
  formatDueAt,
  getPracticeConfig,
  isDueExpired,
  pickQuestion,
  resolveVocabSet,
  saveReport,
  saveStudentReport,
  sendClassReportIfDue,
} from "./shared.js";

const missingPanel = document.querySelector("#missing-panel");
const loadingPanel = document.querySelector("#loading-panel");
const closedPanel = document.querySelector("#closed-panel");
const gatePanel = document.querySelector("#gate-panel");
const practicePanel = document.querySelector("#practice-panel");
const resultPanel = document.querySelector("#result-panel");
const gateForm = document.querySelector("#gate-form");
const setLabel = document.querySelector("#set-label");
const gateTitle = document.querySelector("#gate-title");
const gateLede = document.querySelector("#gate-lede");
const timerEl = document.querySelector("#timer");
const correctCountEl = document.querySelector("#correct-count");
const accuracyEl = document.querySelector("#accuracy");
const stageLabel = document.querySelector("#stage-label");
const definitionBox = document.querySelector("#definition-box");
const feedbackEl = document.querySelector("#feedback");
const optionsEl = document.querySelector("#options");
const tryAgainButton = document.querySelector("#try-again");

const params = new URLSearchParams(window.location.search);
const config = getPracticeConfig();
let vocabSet = null;

const state = {
  studentName: "",
  correct: 0,
  attempted: 0,
  recentIndex: -1,
  current: null,
  running: false,
  ended: false,
  endsAt: 0,
  timers: [],
  tickId: null,
};

function clearTimers() {
  state.timers.forEach((id) => window.clearTimeout(id));
  state.timers = [];
}

function clearTick() {
  if (state.tickId !== null) {
    window.clearInterval(state.tickId);
    state.tickId = null;
  }
}

function later(fn, ms) {
  const id = window.setTimeout(fn, ms);
  state.timers.push(id);
  return id;
}

function showPanel(panel) {
  [missingPanel, loadingPanel, closedPanel, gatePanel, practicePanel, resultPanel].forEach(
    (el) => {
      if (!el) return;
      el.hidden = el !== panel;
    },
  );
}

function setFieldError(message) {
  const error = document.querySelector('[data-error-for="studentName"]');
  const input = gateForm.studentName;
  if (!message) {
    error.hidden = true;
    error.textContent = "";
    input.classList.remove("invalid");
    return;
  }
  error.hidden = false;
  error.textContent = message;
  input.classList.add("invalid");
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function accuracyPercent() {
  if (state.attempted === 0) return null;
  return Math.round((state.correct / state.attempted) * 100);
}

function updateHud() {
  correctCountEl.textContent = String(state.correct);
  const percent = accuracyPercent();
  accuracyEl.textContent = percent === null ? "—" : `${percent}%`;
}

function updateTimerDisplay() {
  const remaining = state.endsAt - Date.now();
  timerEl.textContent = formatTime(remaining);
  if (remaining <= 0 && state.running) {
    endPractice();
  }
}

function disableOptions() {
  optionsEl.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });
}

function renderOptions(question) {
  optionsEl.innerHTML = "";
  question.options.forEach((term) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-btn";
    button.textContent = term;
    button.dataset.term = term;
    optionsEl.appendChild(button);
  });
  optionsEl.hidden = false;
}

function showFeedback(message, kind) {
  feedbackEl.hidden = false;
  feedbackEl.textContent = message;
  feedbackEl.dataset.kind = kind;
}

function clearFeedback() {
  feedbackEl.hidden = true;
  feedbackEl.textContent = "";
  delete feedbackEl.dataset.kind;
}

function startRound() {
  if (!state.running || state.ended) return;

  clearTimers();
  clearFeedback();
  optionsEl.hidden = true;
  optionsEl.innerHTML = "";
  stageLabel.textContent = "Read the definition";

  const question = pickQuestion(vocabSet.terms, state.recentIndex);
  state.current = question;
  state.recentIndex = question.answerIndex;
  definitionBox.textContent = question.definition;
  definitionBox.classList.remove("is-answered");
  definitionBox.classList.add("is-revealing");

  later(() => {
    if (!state.running || state.ended) return;
    definitionBox.classList.remove("is-revealing");
    stageLabel.textContent = "Choose the matching term";
    renderOptions(question);
  }, config.definitionMs);
}

function handleAnswer(selectedTerm) {
  if (!state.running || state.ended || !state.current) return;
  if (!optionsEl || optionsEl.hidden) return;

  const { correctTerm } = state.current;
  const isCorrect = selectedTerm === correctTerm;

  state.attempted += 1;
  if (isCorrect) state.correct += 1;
  updateHud();
  disableOptions();

  optionsEl.querySelectorAll("button").forEach((button) => {
    if (button.dataset.term === correctTerm) {
      button.classList.add("is-correct");
    } else if (button.dataset.term === selectedTerm && !isCorrect) {
      button.classList.add("is-wrong");
    }
  });

  definitionBox.classList.add("is-answered");

  if (isCorrect) {
    stageLabel.textContent = "Correct!";
    showFeedback("Correct!", "correct");
  } else {
    stageLabel.textContent = "Not quite";
    showFeedback(`The correct term was “${correctTerm}”.`, "wrong");
  }

  state.current = null;
  later(() => {
    if (!state.running || state.ended) return;
    startRound();
  }, config.feedbackMs);
}

async function maybeSendClassReport() {
  if (!vocabSet?.storeId) return null;
  try {
    return await sendClassReportIfDue(vocabSet);
  } catch {
    return null;
  }
}

async function endPractice() {
  if (state.ended) return;
  state.ended = true;
  state.running = false;
  clearTimers();
  clearTick();

  const percent = accuracyPercent() ?? 0;
  const resultReport = document.querySelector("#result-report");

  const report = {
    id: crypto.randomUUID(),
    setId: vocabSet.id,
    setName: vocabSet.setName,
    teacherEmail: vocabSet.teacherEmail,
    studentName: state.studentName,
    correct: state.correct,
    attempted: state.attempted,
    accuracy: percent,
    durationMs: config.practiceMs,
    completedAt: new Date().toISOString(),
  };
  saveReport(report);

  showPanel(resultPanel);
  document.querySelector("#result-title").textContent = "Practice complete";
  document.querySelector("#result-message").textContent =
    `You practiced for ${config.fast ? "the full session" : "ten minutes"}, scored ${percent}%, and got ${state.correct} correct matches. You can practice again as many times as you want before ${formatDueAt(vocabSet)}.`;
  document.querySelector("#result-correct").textContent =
    `${state.correct} / ${state.attempted}`;
  document.querySelector("#result-accuracy").textContent = `${percent}%`;
  document.querySelector("#result-time").textContent = formatTime(
    config.practiceMs,
  );

  resultReport.textContent = "Saving your results…";
  if (!vocabSet.storeId || !vocabSet.storeEditKey) {
    resultReport.textContent =
      "Results saved on this device. This practice link cannot send a class report. Ask your teacher for a new link.";
    return;
  }
  try {
    await saveStudentReport(vocabSet, report);
    if (isDueExpired(vocabSet)) {
      const emailResult = await maybeSendClassReport();
      resultReport.textContent = emailResult?.message
        || `Results saved. Practice closed ${formatDueAt(vocabSet)}.`;
    } else {
      resultReport.textContent =
        `Results saved. Your teacher will get a class report after ${formatDueAt(vocabSet)}.`;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    resultReport.textContent =
      `Could not save your results for the class report. ${detail}`;
  }
}

function startPractice(studentName) {
  if (isDueExpired(vocabSet)) {
    setupClosed();
    return;
  }

  state.studentName = studentName;
  state.correct = 0;
  state.attempted = 0;
  state.recentIndex = -1;
  state.current = null;
  state.running = true;
  state.ended = false;
  state.endsAt = Date.now() + config.practiceMs;

  showPanel(practicePanel);
  updateHud();
  updateTimerDisplay();
  startRound();

  clearTick();
  state.tickId = window.setInterval(() => {
    if (!state.running) {
      clearTick();
      return;
    }
    updateTimerDisplay();
  }, 250);
}

function setupGate() {
  setLabel.textContent = vocabSet.setName;
  gateTitle.textContent = vocabSet.setName;
  gateLede.textContent =
    `Practice is due ${formatDueAt(vocabSet)}. Enter your name to begin. You’ll have ten minutes to match definitions to terms, and you can practice as many times as you want.`;
  showPanel(gatePanel);
  if (state.studentName) {
    gateForm.studentName.value = state.studentName;
  }
  gateForm.studentName.focus();
}

function setupClosed() {
  setLabel.textContent = vocabSet.setName;
  document.querySelector("#closed-lede").textContent =
    `Practice for “${vocabSet.setName}” closed ${formatDueAt(vocabSet)}. Your teacher will receive one class report for everyone who practiced.`;
  showPanel(closedPanel);
  const closedReport = document.querySelector("#closed-report");
  closedReport.textContent = "Checking the class report…";
  maybeSendClassReport().then((result) => {
    closedReport.textContent = result?.message || "";
  });
}

if (!params.get("set")) {
  showPanel(missingPanel);
} else {
  showPanel(loadingPanel);
  resolveVocabSet(decodeSetPayload(params.get("set")))
    .then((set) => {
      vocabSet = set;
      if (!vocabSet) {
        showPanel(missingPanel);
      } else if (isDueExpired(vocabSet)) {
        setupClosed();
      } else {
        setupGate();
      }
    })
    .catch(() => {
      showPanel(missingPanel);
    });
}

gateForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = gateForm.studentName.value.trim();
  setFieldError("");

  if (!name) {
    setFieldError("Enter your name to begin.");
    gateForm.studentName.focus();
    return;
  }

  startPractice(name);
});

optionsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-term]");
  if (!button || button.disabled) return;
  handleAnswer(button.dataset.term);
});

tryAgainButton.addEventListener("click", () => {
  clearTimers();
  clearTick();
  state.running = false;
  state.ended = false;
  setFieldError("");
  if (isDueExpired(vocabSet)) {
    setupClosed();
    return;
  }
  startPractice(state.studentName);
});
