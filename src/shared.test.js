import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeSetPayload,
  encodeSetPayload,
  getEncodedSetParam,
} from "./setPayload.js";

function sampleSet(extra = {}) {
  return {
    id: "set-1",
    setName: "Ecosystems",
    dueDate: "2026-09-08",
    dueTime: "23:59",
    dueAt: "2026-09-09T03:59:00.000Z",
    teacherEmail: "teacher@school.edu",
    terms: [
      { term: "habitat", definition: "Where a species lives" },
      { term: "producer", definition: "Makes its own food" },
      { term: "consumer", definition: "Eats other organisms" },
      { term: "decomposer", definition: "Breaks down dead matter" },
    ],
    ...extra,
  };
}

function encodeLegacy(set) {
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

describe("encodeSetPayload and decodeSetPayload", () => {
  it("keeps terms in a compressed shareable payload when storage is missing", async () => {
    const encoded = await encodeSetPayload(sampleSet());
    const decoded = await decodeSetPayload(encoded);
    assert.match(encoded, /^z\./);
    assert.equal(decoded.setName, "Ecosystems");
    assert.equal(decoded.teacherEmail, "teacher@school.edu");
    assert.equal(decoded.dueAt, "2026-09-09T03:59:00.000Z");
    assert.equal(decoded.terms.length, 4);
    assert.equal(decoded.terms[0].term, "habitat");
    assert.equal(decoded.storeId, undefined);
    assert.ok(encoded.length < encodeLegacy(sampleSet()).length);
  });

  it("omits terms from the payload when a remote store id is present", async () => {
    const encoded = await encodeSetPayload(
      sampleSet({ storeId: "abc123", storeEditKey: "secret" }),
    );
    const decoded = await decodeSetPayload(encoded);
    assert.equal(decoded.storeId, "abc123");
    assert.equal(decoded.storeEditKey, "secret");
    assert.equal(decoded.terms, undefined);
  });

  it("still reads older uncompressed links", async () => {
    const encoded = encodeLegacy(sampleSet());
    const decoded = await decodeSetPayload(encoded);
    assert.equal(decoded.setName, "Ecosystems");
    assert.equal(decoded.terms[2].term, "consumer");
  });

  it("stays much shorter than the old encoding for larger sets", async () => {
    const terms = [];
    for (let index = 0; index < 30; index += 1) {
      terms.push({
        term: `term-${index}-photosynthesis`,
        definition: `A student-facing definition for vocabulary item ${index} about energy and ecosystems.`,
      });
    }
    const set = sampleSet({ terms });
    const encoded = await encodeSetPayload(set);
    const legacy = encodeLegacy(set);
    assert.ok(
      encoded.length < legacy.length / 2,
      `expected ${encoded.length} to be under half of ${legacy.length}`,
    );
  });
});

describe("getEncodedSetParam", () => {
  it("prefers the compact s param and still accepts set", () => {
    assert.equal(getEncodedSetParam("?s=short&set=old"), "short");
    assert.equal(getEncodedSetParam("?set=legacy"), "legacy");
    assert.equal(getEncodedSetParam("", "#s=fromhash"), "fromhash");
  });
});
