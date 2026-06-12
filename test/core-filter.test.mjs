import assert from "node:assert/strict";
import {
  getCardFilterData,
  getCardSearchText,
  matchesFilter,
  normalizeSearchText
} from "../src/core/filter.js";

const task = {
  title: "Record demo gif",
  note: "2026-06-12",
  initiatives: ["product", "marketing"],
  meetingRef: "roadmap-sync",
  notes: [{ text: "Show board view.", level: 0 }, "Copy filtered tasks."]
};

assert.equal(normalizeSearchText(" Product "), " product ");
assert.equal(
  getCardSearchText(task, { meetingTitle: "Roadmap sync" }),
  "record demo gif 2026-06-12 roadmap sync product marketing show board view. copy filtered tasks."
);

const data = getCardFilterData(task, { meetingTitle: "Roadmap sync" });
assert.deepEqual(data.initiatives, ["product", "marketing"]);
assert.equal(matchesFilter(data, { query: "roadmap", initiative: "product" }), true);
assert.equal(matchesFilter(data, { query: "roadmap", initiative: "marketing" }), true);
assert.equal(matchesFilter(data, { query: "missing", initiative: "product" }), false);
assert.equal(matchesFilter(data, { query: "roadmap", initiative: "design" }), false);
assert.equal(matchesFilter({ searchText: "untagged note", initiatives: [] }, { initiative: "__none__" }), true);
assert.equal(matchesFilter(data, { initiative: "__none__" }), false);
assert.equal(matchesFilter({ searchText: "card", initiatives: '["product","marketing"]' }, { initiative: "marketing" }), true);

console.log("Core filter tests passed.");
