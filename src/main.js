const MAX_TERMS = 10;
const STORAGE_KEY = "wordnest.vocabularySets";

const form = document.querySelector("#vocab-form");
const termsList = document.querySelector("#terms-list");
const addTermButton = document.querySelector("#add-term");
const termCount = document.querySelector("#term-count");
const termRowTemplate = document.querySelector("#term-row-template");
const successPanel = document.querySelector("#success-panel");
const createAnotherButton = document.querySelector("#create-another");
const dueDateInput = document.querySelector("#due-date");

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

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
    removeButton.setAttribute(
      "aria-label",
      `Remove term ${index + 1}`,
    );
  });

  termCount.textContent = `${count} of ${MAX_TERMS} terms`;
  addTermButton.disabled = count >= MAX_TERMS;
  addTermButton.setAttribute(
    "aria-disabled",
    String(count >= MAX_TERMS),
  );
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
  ["setName", "dueDate", "teacherEmail", "terms"].forEach(clearFieldError);
}

function addTermRow(focus = false) {
  if (getTermRows().length >= MAX_TERMS) return;

  const fragment = termRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".term-row");
  termsList.appendChild(fragment);
  updateTermUi();

  if (focus) {
    row.querySelector(".term-input").focus();
  }
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
  const teacherEmail = form.teacherEmail.value.trim();
  const terms = collectTerms();

  if (!setName) {
    form.setName.classList.add("invalid");
    setFieldError("setName", "Please name this vocabulary set.");
    valid = false;
  }

  if (!dueDate) {
    form.dueDate.classList.add("invalid");
    setFieldError("dueDate", "Choose a due date for practice.");
    valid = false;
  } else if (dueDate < todayIsoDate()) {
    form.dueDate.classList.add("invalid");
    setFieldError("dueDate", "Due date can’t be in the past.");
    valid = false;
  }

  if (!teacherEmail) {
    form.teacherEmail.classList.add("invalid");
    setFieldError(
      "teacherEmail",
      "Enter an email address for student reports.",
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
      teacherEmail,
      terms: filledTerms.map(({ term, definition }) => ({ term, definition })),
    },
  };
}

function loadSets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSet(set) {
  const sets = loadSets();
  sets.unshift(set);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

function formatDueDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function showSuccess(set) {
  form.hidden = true;
  successPanel.hidden = false;
  document.querySelector("#success-message").textContent =
    `“${set.setName}” is saved. Students can practice until ${formatDueDate(set.dueDate)}, and reports will go to ${set.teacherEmail}.`;
  document.querySelector("#success-name").textContent = set.setName;
  document.querySelector("#success-due").textContent = formatDueDate(set.dueDate);
  document.querySelector("#success-email").textContent = set.teacherEmail;
  document.querySelector("#success-terms").textContent = String(set.terms.length);
  createAnotherButton.focus();
}

function resetForm() {
  form.reset();
  termsList.innerHTML = "";
  addTermRow();
  dueDateInput.min = todayIsoDate();
  clearValidationState();
  successPanel.hidden = true;
  form.hidden = false;
  form.setName.focus();
}

termsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-term");
  if (!removeButton) return;
  removeButton.closest(".term-row")?.remove();
  updateTermUi();
});

addTermButton.addEventListener("click", () => {
  addTermRow(true);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const { valid, data } = validateForm();
  if (!valid) {
    const firstInvalid = form.querySelector(".invalid");
    firstInvalid?.focus();
    return;
  }

  const set = {
    id: crypto.randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
  };

  saveSet(set);
  showSuccess(set);
});

createAnotherButton.addEventListener("click", () => {
  resetForm();
});

dueDateInput.min = todayIsoDate();
addTermRow();
form.setName.focus();
