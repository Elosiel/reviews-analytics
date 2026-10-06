import { test } from "node:test";
import assert from "node:assert/strict";
import { parseModelJson } from "../src/lib/pipeline/parse-model-json.ts";

test("plain JSON", () => {
  assert.deepEqual(parseModelJson('{"title":"A"}'), { title: "A" });
});

test("```json fence — the shape that broke SOP drafts and meeting agendas in production", () => {
  const reply = '```json\n{\n  "title": "Pacing & Wait-Time Standard",\n  "content": "PURPOSE: ..."\n}\n```';
  assert.deepEqual(parseModelJson(reply), { title: "Pacing & Wait-Time Standard", content: "PURPOSE: ..." });
});

test("fenced array (meeting agenda)", () => {
  const reply = '```json\n[{"discussion_point":"Parking","suggested_action":"Add signage"}]\n```';
  assert.deepEqual(parseModelJson(reply), [{ discussion_point: "Parking", suggested_action: "Add signage" }]);
});

test("a sentence around the JSON", () => {
  assert.deepEqual(parseModelJson('Here is the SOP:\n{"title":"B"}\nLet me know!'), { title: "B" });
});

test("truncated or missing JSON still throws", () => {
  assert.throws(() => parseModelJson('```json\n{"title": "Cut off mid'));
  assert.throws(() => parseModelJson("no json here"));
});
