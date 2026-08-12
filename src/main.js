import {
  MAX_TERMS,
  MIN_TERMS,
  buildReportLink,
  buildStudentLink,
  createReportStore,
  dueAtFromInputs,
  formatDueAt,
  loadSets,
  saveSet,
  todayIsoDate,
} from "./shared.js";
import { parseTermList } from "./termImport.js";

const form = document.querySelector("#vocab-form");
const termsList = document.querySelector("#terms-list");
const addTermButton = document.querySelector("#add-term");
const termCount = document.querySelector("#term-count");
const termRowTemplate = document.querySelector("#term-row-template");
const successPanel = document.querySelector("#success-panel");
const createAnotherButton = document.querySelector("#create-another");
const copyLinkButton = document.querySelector("#copy-link");
const copyReportLinkButton = document.querySelector("#copy-report-link");
const studentLinkInput = document.querySelector("#student-link");
const reportLinkInput = document.querySelector("#report-link");
const dueDateInput = document.querySelector("#due-date");
const dueTimeInput = document.querySelector("#due-time");
const termsFileInput = document.querySelector("#terms-file");
const submitButton = form.querySelector('button[type="submit"]');
const savedSetsSection = document.querySelector("#saved-sets");
const savedSetsList = document.querySelector("#saved-sets-list");

function getTermRows() {
  return [...termsList.querySelectorAll(".term-row")];
}

function updateTermUi() {
  const rows = getTermRows();
  const count = rows.length;

  rows.forEach((row, index) => {
    row.querySelector(".term-index").textContent = String(index + 1);
    row.querySelectorAll("label").forEach((label, labelIndex) => {
      const input = labelIndex === 0
        ? row.querySelector(".term-input")
        : row.querySelector(".definition-input");
      const id = `term-${index}-${labelIndex === 0 ? "word" : "definition"}`;
      input.id = id;
      label.setAttribute("for", id);
    });

    const removeButton = row.querySelector(".remove-term");
    removeButton.disabled = count === 1;
    removeButton.setAttribute("aria-label", `Remove term ${index + 1}`);
  });

  termCount.textContent = `${count} of ${MAX_TERMS} terms`;
  const atMax = count >= MAX_TERMS;
  addTermButton.disabled = atMax;
  if (atMax) {
    addTermButton.setAttribute("aria-disabled", "true");
  } else {
    addTermButton.removeAttribute("aria-disabled");
  }
}

function clearFieldError(name) {
  const error = document.querySelector(`[data-error-for="${name}"]`);
  if (error) {
    error.hidden = true;
    error.textContent = "";
  }
}

function setFieldError(name, message) {
  const error = document.querySelector(`[data-error-for="${name}"]`);
  if (!error) return;
  error.hidden = false;
  error.textContent = message;
}

function clearValidationState() {
  form.querySelectorAll(".invalid").forEach((el) => {
    el.classList.remove("invalid");
  });
  ["setName", "dueDate", "dueTime", "teacherEmail", "terms"].forEach(
    clearFieldError,
  );
}

function addTermRow(focus = false) {
  if (getTermRows().length >= MAX_TERMS) return;

  const row = termRowTemplate.content.firstElementChild.cloneNode(true);
  termsList.appendChild(row);
  updateTermUi();

  if (focus) {
    row.classList.add("term-row-flash");
    row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const input = row.querySelector(".term-input");
    input?.focus({ preventScroll: true });
    window.setTimeout(() => {
      row.classList.remove("term-row-flash");
    }, 900);
  }

  return row;
}

function fillTermRows(terms) {
  termsList.innerHTML = "";
  const rows = terms.slice(0, MAX_TERMS);
  const count = Math.max(rows.length, MIN_TERMS);
  for (let index = 0; index < count; index += 1) {
    const row = addTermRow();
    if (!row || !rows[index]) continue;
    row.querySelector(".term-input").value = rows[index].term;
    row.querySelector(".definition-input").value = rows[index].definition;
  }
  updateTermUi();
}

function collectTerms() {
  return getTermRows().map((row) => ({
    term: row.querySelector(".term-input").value.trim(),
    definition: row.querySelector(".definition-input").value.trim(),
    termInput: row.querySelector(".term-input"),
    definitionInput: row.querySelector(".definition-input"),
  }));
}

function validateForm() {
  clearValidationState();

  let valid = true;
  const setName = form.setName.value.trim();
  const dueDate = form.dueDate.value;
  const dueTime = form.dueTime.value;
  const teacherEmail = form.teacherEmail.value.trim();
  const terms = collectTerms();
  const dueAt = dueAtFromInputs(dueDate, dueTime);

  if (!setName) {
    form.setName.classList.add("invalid");
    setFieldError("setName", "Please name this vocabulary set.");
    valid = false;
  }

  if (!dueDate) {
    form.dueDate.classList.add("invalid");
    setFieldError("dueDate", "Choose a due date for practice.");
    valid = false;
  }

  if (!dueTime) {
    form.dueTime.classList.add("invalid");
    setFieldError("dueTime", "Choose a due time for practice.");
    valid = false;
  } else if (dueAt && dueAt.getTime() <= Date.now()) {
    form.dueDate.classList.add("invalid");
    form.dueTime.classList.add("invalid");
    setFieldError("dueTime", "Due date and time can’t be in the past.");
    valid = false;
  }

  if (!teacherEmail) {
    form.teacherEmail.classList.add("invalid");
    setFieldError(
      "teacherEmail",
      "Enter an email address for the class report.",
    );
    valid = false;
  } else if (!form.teacherEmail.checkValidity()) {
    form.teacherEmail.classList.add("invalid");
    setFieldError("teacherEmail", "Enter a valid email address.");
    valid = false;
  }

  const filledTerms = terms.filter((item) => item.term && item.definition);

  if (filledTerms.length === 0) {
    setFieldError("terms", "Add at least one term and definition.");
    terms[0]?.termInput.classList.add("invalid");
    terms[0]?.definitionInput.classList.add("invalid");
    valid = false;
  } else if (filledTerms.length < MIN_TERMS) {
    setFieldError(
      "terms",
      `Add at least ${MIN_TERMS} terms so students get four answer choices.`,
    );
    valid = false;
  }

  for (const item of terms) {
    const hasEither = Boolean(item.term || item.definition);
    const hasBoth = Boolean(item.term && item.definition);

    if (hasEither && !hasBoth) {
      if (!item.term) item.termInput.classList.add("invalid");
      if (!item.definition) item.definitionInput.classList.add("invalid");
      setFieldError(
        "terms",
        "Each term needs both a word and a definition.",
      );
      valid = false;
    }
  }

  if (filledTerms.length > MAX_TERMS) {
    setFieldError("terms", `You can add up to ${MAX_TERMS} terms.`);
    valid = false;
  }

  return {
    valid,
    data: {
      setName,
      dueDate,
      dueTime,
      dueAt: dueAt ? dueAt.toISOString() : null,
      teacherEmail,
      terms: filledTerms.map(({ term, definition }) => ({ term, definition })),
    },
  };
}

function showSuccess(set) {
  const studentLink = buildStudentLink(set);
  const reportLink = buildReportLink(set);
  form.hidden = true;
  successPanel.hidden = false;
  document.querySelector("#success-message").textContent =
    `“${set.setName}” is ready. Share the student link below. One class report will go to ${set.teacherEmail} after ${formatDueAt(set)}.`;
  document.querySelector("#success-name").textContent = set.setName;
  document.querySelector("#success-due").textContent = formatDueAt(set);
  document.querySelector("#success-email").textContent = set.teacherEmail;
  document.querySelector("#success-terms").textContent = String(set.terms.length);
  studentLinkInput.value = studentLink;
  reportLinkInput.value = reportLink;
  copyLinkButton.textContent = "Copy link";
  copyReportLinkButton.textContent = "Copy link";
  studentLinkInput.focus();
  studentLinkInput.select();
  renderSavedSets();
}

async function copyText(input, button) {
  const value = input.value;
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    button.textContent = "Copied";
  } catch {
    input.focus();
    input.select();
    button.textContent = "Select & copy";
  }
}

function renderSavedSets() {
  const sets = loadSets();
  if (!savedSetsSection || !savedSetsList) return;
  savedSetsList.innerHTML = "";
  if (sets.length === 0) {
    savedSetsSection.hidden = true;
    return;
  }

  savedSetsSection.hidden = false;
  sets.slice(0, 8).forEach((set) => {
    const item = document.createElement("li");
    item.className = "saved-set";
    const title = document.createElement("p");
    title.className = "saved-set-name";
    title.textContent = set.setName;
    const meta = document.createElement("p");
    meta.className = "saved-set-meta";
    meta.textContent = `Due ${formatDueAt(set)}`;
    const actions = document.createElement("div");
    actions.className = "saved-set-actions";
    const student = document.createElement("a");
    student.className = "btn btn-secondary";
    student.href = buildStudentLink(set);
    student.textContent = "Student link";
    const report = document.createElement("a");
    report.className = "btn btn-primary";
    report.href = buildReportLink(set);
    report.textContent = "Class report";
    actions.append(student, report);
    item.append(title, meta, actions);
    savedSetsList.appendChild(item);
  });
}

function resetForm() {
  form.reset();
  termsList.innerHTML = "";
  for (let i = 0; i < MIN_TERMS; i += 1) {
    addTermRow();
  }
  dueDateInput.min = todayIsoDate();
  dueTimeInput.value = "23:59";
  clearValidationState();
  successPanel.hidden = true;
  form.hidden = false;
  submitButton.disabled = false;
  submitButton.textContent = "Create practice set";
  form.setName.focus();
}

termsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-term");
  if (!removeButton) return;
  removeButton.closest(".term-row")?.remove();
  updateTermUi();
});

addTermButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (addTermButton.disabled) return;
  addTermRow(true);
});

termsFileInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = parseTermList(text, { maxTerms: MAX_TERMS + 1 });
    if (parsed.length === 0) {
      setFieldError(
        "terms",
        "That file didn’t have any term and definition pairs. Use a CSV or tab-separated file with a term and definition on each row.",
      );
      return;
    }
    const truncated = parsed.length > MAX_TERMS;
    const terms = parsed.slice(0, MAX_TERMS);
    clearFieldError("terms");
    fillTermRows(terms);
    if (truncated) {
      setFieldError(
        "terms",
        `Loaded the first ${MAX_TERMS} terms. A set can have at most ${MAX_TERMS}.`,
      );
    }
  } catch {
    setFieldError("terms", "Could not read that file. Try a CSV or text file.");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { valid, data } = validateForm();
  if (!valid) {
    const firstInvalid = form.querySelector(".invalid");
    firstInvalid?.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Setting up class reports…";

  const set = {
    id: crypto.randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
  };

  try {
    const store = await createReportStore(set);
    const completeSet = { ...set, ...store };
    saveSet(completeSet);
    showSuccess(completeSet);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    setFieldError(
      "teacherEmail",
      `Could not set up class reports. ${detail}`,
    );
    submitButton.disabled = false;
    submitButton.textContent = "Create practice set";
  }
});

createAnotherButton.addEventListener("click", () => {
  resetForm();
});

copyLinkButton.addEventListener("click", () => {
  copyText(studentLinkInput, copyLinkButton);
});

copyReportLinkButton.addEventListener("click", () => {
  copyText(reportLinkInput, copyReportLinkButton);
});

dueDateInput.min = todayIsoDate();
dueTimeInput.value = dueTimeInput.value || "23:59";
for (let i = 0; i < MIN_TERMS; i += 1) {
  addTermRow();
}
renderSavedSets();
form.setName.focus();
