const MIN_LINK_TERMS = 4;
const COMPRESSED_PREFIX = "z.";

function packSet(set) {
  const terms =
    Array.isArray(set.terms) && set.terms.length && !set.storeId
      ? set.terms.map((item) => [item.term, item.definition])
      : null;
  return [
    1,
    set.id || "",
    set.setName || "",
    set.dueAt || null,
    set.dueAt ? null : set.dueDate || null,
    set.dueAt ? null : set.dueTime || null,
    set.teacherEmail || null,
    terms,
    set.storeId || null,
    set.storeEditKey || null,
  ];
}

function unpackSet(packed) {
  if (!Array.isArray(packed) || packed[0] !== 1) return null;
  const [
    ,
    id,
    setName,
    dueAt,
    dueDate,
    dueTime,
    teacherEmail,
    terms,
    storeId,
    storeEditKey,
  ] = packed;
  if (typeof setName !== "string") return null;

  const payload = { id, setName };
  if (dueAt) payload.dueAt = dueAt;
  if (dueDate) payload.dueDate = dueDate;
  if (dueTime) payload.dueTime = dueTime;
  if (teacherEmail) payload.teacherEmail = teacherEmail;
  if (Array.isArray(terms)) {
    payload.terms = terms.map(([term, definition]) => ({ term, definition }));
  }
  if (storeId) payload.storeId = storeId;
  if (storeEditKey) payload.storeEditKey = storeEditKey;
  return payload;
}

function validatePayload(payload) {
  if (!payload || typeof payload.setName !== "string") return null;
  const hasTerms =
    Array.isArray(payload.terms) && payload.terms.length >= MIN_LINK_TERMS;
  const hasStore = typeof payload.storeId === "string" && payload.storeId;
  if (!hasTerms && !hasStore) return null;
  return payload;
}

function bytesToBase64Url(bytes) {
  const chunk = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(encoded) {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padLength));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deflateBytes(bytes) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateBytes(bytes) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeLegacy(encoded) {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLength);
  const json = decodeURIComponent(escape(atob(base64)));
  return JSON.parse(json);
}

export async function encodeSetPayload(set) {
  const json = JSON.stringify(packSet(set));
  const compressed = await deflateBytes(new TextEncoder().encode(json));
  return `${COMPRESSED_PREFIX}${bytesToBase64Url(compressed)}`;
}

export async function decodeSetPayload(encoded) {
  if (!encoded) return null;
  try {
    if (encoded.startsWith(COMPRESSED_PREFIX)) {
      const inflated = await inflateBytes(base64UrlToBytes(encoded.slice(2)));
      const packed = JSON.parse(new TextDecoder().decode(inflated));
      return validatePayload(unpackSet(packed));
    }
    return validatePayload(decodeLegacy(encoded));
  } catch {
    return null;
  }
}

export function getEncodedSetParam(search, hash = "") {
  const query = new URLSearchParams(search);
  const fromQuery = query.get("s") || query.get("set");
  if (fromQuery) return fromQuery;
  const hashQuery = new URLSearchParams(
    hash.startsWith("#") ? hash.slice(1) : hash,
  );
  return hashQuery.get("s") || hashQuery.get("set") || null;
}
