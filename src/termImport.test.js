import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTermList } from "./termImport.js";

describe("parseTermList", () => {
  it("reads a CSV with a header row", () => {
    const terms = parseTermList(
      "term,definition\nHabitat,The place where an organism lives\nProducer,An organism that makes its own food",
    );
    assert.deepEqual(terms, [
      { term: "Habitat", definition: "The place where an organism lives" },
      { term: "Producer", definition: "An organism that makes its own food" },
    ]);
  });

  it("reads tab-separated rows without a header", () => {
    const terms = parseTermList("Consumer\tAn organism that eats other organisms");
    assert.equal(terms.length, 1);
    assert.equal(terms[0].term, "Consumer");
  });

  it("keeps commas inside quoted definitions", () => {
    const terms = parseTermList('Biome,"A large community of plants, animals, and other organisms"');
    assert.equal(terms[0].term, "Biome");
    assert.match(terms[0].definition, /plants, animals/);
  });

  it("caps at 50 terms by default", () => {
    const lines = Array.from({ length: 60 }, (_, index) => `Term ${index + 1},Definition ${index + 1}`);
    const terms = parseTermList(lines.join("\n"));
    assert.equal(terms.length, 50);
    assert.equal(terms[0].term, "Term 1");
    assert.equal(terms[49].term, "Term 50");
  });

  it("skips incomplete rows and caps at maxTerms", () => {
    const terms = parseTermList("One,First\nTwo\nThree,Third\nFour,Fourth", {
      maxTerms: 2,
    });
    assert.equal(terms.length, 2);
    assert.equal(terms[0].term, "One");
    assert.equal(terms[1].term, "Three");
  });
});
