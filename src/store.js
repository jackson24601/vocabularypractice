import { appendReport, emptyStorePayload } from "./reportUtils.js";

const JSON_API = "https://jsonhosting.com/api/json";
const CORS_PROXY = "https://proxy.cors.sh/";

function proxyUrl(url) {
  return `${CORS_PROXY}${url}`;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
    if (url.startsWith(CORS_PROXY)) throw error;
    return await fetchJson(proxyUrl(url), options);
  }
}

function unwrapStore(data) {
  if (data && typeof data === "object" && data.content) {
    return data.content;
  }
  return data;
}

export async function createReportStore(set) {
  const created = await requestJson(`${JSON_API}/save`, {
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
  const data = await requestJson(`${JSON_API}/${encodeURIComponent(storeId)}`);
  return unwrapStore(data) || emptyStorePayload({});
}

export async function writeReportStore(storeId, storeEditKey, payload) {
  if (!storeId || !storeEditKey) {
    throw new Error("Missing class report storage.");
  }
  await requestJson(`${JSON_API}/${encodeURIComponent(storeId)}`, {
    method: "PUT",
    body: JSON.stringify({
      editKey: storeEditKey,
      data: payload,
    }),
  });
  return payload;
}

export async function saveStudentReport(set, report) {
  if (!set?.storeId || !set?.storeEditKey) {
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
