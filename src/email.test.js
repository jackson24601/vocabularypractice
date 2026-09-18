import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  sendAttemptEmail,
  sendTeacherSetupEmail,
  submitPracticeResult,
} from "./shared.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(data),
    json: async () => data,
  };
}

function mockFetch(handler) {
  globalThis.fetch = handler;
}

const sampleReport = {
  id: "attempt-1",
  setName: "Ecosystems",
  teacherEmail: "teacher@school.edu",
  studentName: "Ada Lovelace",
  correct: 8,
  attempted: 10,
  accuracy: 80,
  completedAt: "2026-09-07T12:00:00.000Z",
};

describe("sendAttemptEmail", () => {
  it("posts the student score to FormSubmit for the inputted teacher email", async () => {
    const calls = [];
    mockFetch(async (url, options) => {
      calls.push({ url: String(url), options });
      return jsonResponse({ success: "true" });
    });

    const result = await sendAttemptEmail(sampleReport);

    assert.equal(result.status, "sent");
    assert.equal(result.message, "Score emailed to teacher@school.edu");
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      "https://formsubmit.co/ajax/teacher%40school.edu",
    );
    assert.equal(calls[0].options.method, "POST");
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.email, "teacher@school.edu");
    assert.equal(body.studentName, "Ada Lovelace");
    assert.equal(body.setName, "Ecosystems");
    assert.equal(body.correctMatches, 8);
    assert.equal(body.attempts, 10);
    assert.equal(body.accuracy, "80%");
    assert.match(body._subject, /Ada Lovelace/);
    assert.match(body.message, /80%/);
  });

  it("throws when the teacher email is missing", async () => {
    await assert.rejects(
      () => sendAttemptEmail({ studentName: "Ada" }),
      /Missing teacher email/,
    );
  });
});

describe("sendTeacherSetupEmail", () => {
  it("posts a confirmation to the same teacher address", async () => {
    const calls = [];
    mockFetch(async (url, options) => {
      calls.push({ url: String(url), body: options.body });
      return jsonResponse({ success: "true" });
    });

    const result = await sendTeacherSetupEmail({
      setName: "Ecosystems",
      teacherEmail: "teacher@school.edu",
    });

    assert.equal(result.status, "sent");
    assert.equal(calls[0].url, "https://formsubmit.co/ajax/teacher%40school.edu");
    const body = JSON.parse(calls[0].body);
    assert.equal(body.email, "teacher@school.edu");
    assert.match(body._subject, /Ecosystems/);
  });
});

describe("submitPracticeResult", () => {
  it("emails the score when there is no class-report store", async () => {
    const calls = [];
    mockFetch(async (url, options) => {
      calls.push({ url: String(url), method: options?.method, body: options?.body });
      return jsonResponse({ success: "true" });
    });

    const result = await submitPracticeResult(
      { teacherEmail: "teacher@school.edu" },
      sampleReport,
    );

    assert.equal(result.status, "sent");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /formsubmit\.co\/ajax\/teacher%40school\.edu/);
    const body = JSON.parse(calls[0].body);
    assert.equal(body.studentName, "Ada Lovelace");
  });

  it("emails the score as soon as the student finishes even when a store exists", async () => {
    let store = {
      setName: "Ecosystems",
      teacherEmail: "teacher@school.edu",
      reports: [],
      summarySent: false,
    };
    const formCalls = [];

    mockFetch(async (url, options) => {
      const href = String(url);
      if (href.includes("formsubmit")) {
        formCalls.push({ url: href, body: options.body });
        return jsonResponse({ success: "true" });
      }
      if (options?.method === "PUT") {
        const payload = JSON.parse(options.body);
        store = payload.data;
        return jsonResponse({ ok: true });
      }
      return jsonResponse(store);
    });

    const result = await submitPracticeResult(
      {
        storeId: "abc123",
        storeEditKey: "secret",
        teacherEmail: "teacher@school.edu",
        dueAt: "2099-01-01T00:00:00.000Z",
      },
      sampleReport,
    );

    assert.equal(result.status, "sent");
    assert.equal(formCalls.length, 1);
    assert.equal(
      formCalls[0].url,
      "https://formsubmit.co/ajax/teacher%40school.edu",
    );
    const body = JSON.parse(formCalls[0].body);
    assert.equal(body.email, "teacher@school.edu");
    assert.equal(body.studentName, "Ada Lovelace");
    assert.equal(body.accuracy, "80%");
    assert.equal(store.reports.length, 1);
    assert.equal(store.reports[0].id, "attempt-1");
  });

  it("still emails the score if class-report storage fails", async () => {
    const formCalls = [];
    mockFetch(async (url, options) => {
      const href = String(url);
      if (href.includes("formsubmit")) {
        formCalls.push({ url: href, body: options.body });
        return jsonResponse({ success: "true" });
      }
      return jsonResponse({ message: "blocked" }, { ok: false, status: 403 });
    });

    const result = await submitPracticeResult(
      {
        storeId: "abc123",
        storeEditKey: "secret",
        teacherEmail: "teacher@school.edu",
        dueAt: "2099-01-01T00:00:00.000Z",
      },
      sampleReport,
    );

    assert.equal(result.status, "sent");
    assert.equal(formCalls.length, 1);
    assert.match(formCalls[0].url, /teacher%40school\.edu/);
  });
});
