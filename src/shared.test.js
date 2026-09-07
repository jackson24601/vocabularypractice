import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeSetPayload, encodeSetPayload } from "./shared.js";

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

describe("encodeSetPayload and decodeSetPayload", () => {
  it("keeps terms in the shareable link when class report storage is missing", () => {
    const encoded = encodeSetPayload(sampleSet());
    const decoded = decodeSetPayload(encoded);
    assert.equal(decoded.setName, "Ecosystems");
    assert.equal(decoded.teacherEmail, "teacher@school.edu");
    assert.equal(decoded.terms.length, 4);
    assert.equal(decoded.terms[0].term, "habitat");
    assert.equal(decoded.storeId, undefined);
  });

  it("omits terms from the link when a remote store id is present", () => {
    const encoded = encodeSetPayload(
      sampleSet({ storeId: "abc123", storeEditKey: "secret" }),
    );
    const decoded = decodeSetPayload(encoded);
    assert.equal(decoded.storeId, "abc123");
    assert.equal(decoded.storeEditKey, "secret");
    assert.equal(decoded.terms, undefined);
  });
});
