import {
  appendReport,
  emptyStorePayload,
  hasReportStore,
} from "./reportUtils.js";

const JSONHOSTING_API = "https://jsonhosting.com/api/json";

function jsonApiBase() {
  // Vite can proxy this host in `npm run dev`. GitHub Pages cannot, and
  // jsonhosting.com does not send CORS headers, so production falls back.
  if (import.meta.env?.DEV) return "/json-store";
  return JSONHOSTING_API;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function asError(error) {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return new Error(
      "The class report service could not be reached from this browser.",
    );
  }
  return error instanceof Error ? error : new Error("Unknown error");
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await parseBody(response);
  if (!response.ok) {
    const detail = data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return data;
}

async function requestJson(url, options = {}) {
  try {
    return await fetchJson(url, options);
  } catch (error) {
    throw asError(error);
  }
}

function unwrapStore(data) {
  if (data && typeof data === "object" && data.content) {
    return data.content;
  }
  return data;
}

export { hasReportStore };

export async function createReportStore(set) {
  const created = await requestJson(`${jsonApiBase()}/save`, {
    method: "POST",
    body: JSON.stringify(emptyStorePayload(set)),
  });
  if (!created?.id || !created?.editKey) {
    throw new Error("Could not set up class report storage.");
  }
  return {
    storeId: created.id,
    storeEditKey: created.editKey,
  };
}

export async function readReportStore(storeId) {
  if (!storeId) {
    throw new Error("Missing class report storage.");
  }
  const data = await requestJson(
    `${jsonApiBase()}/${encodeURIComponent(storeId)}`,
  );
  return unwrapStore(data) || emptyStorePayload({});
}

export async function writeReportStore(storeId, storeEditKey, payload) {
  if (!storeId || !storeEditKey) {
    throw new Error("Missing class report storage.");
  }
  await requestJson(`${jsonApiBase()}/${encodeURIComponent(storeId)}`, {
    method: "PUT",
    body: JSON.stringify({
      editKey: storeEditKey,
      data: payload,
    }),
  });
  return payload;
}

export async function saveStudentReport(set, report) {
  if (!hasReportStore(set)) {
    throw new Error("This practice set is missing class report storage.");
  }

  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const store = await readReportStore(set.storeId);
      const next = appendReport(store, report);
      await writeReportStore(set.storeId, set.storeEditKey, next);
      const verify = await readReportStore(set.storeId);
      if ((verify.reports || []).some((item) => item.id === report.id)) {
        return verify;
      }
      lastError = new Error("Saved report did not appear in the class list.");
    } catch (error) {
      lastError = error;
    }
    await delay(200 * (attempt + 1));
  }

  throw lastError || new Error("Could not save the student report.");
}

export async function updateStoreFlags(set, patch) {
  const store = await readReportStore(set.storeId);
  const next = { ...store, ...patch };
  await writeReportStore(set.storeId, set.storeEditKey, next);
  return next;
}
