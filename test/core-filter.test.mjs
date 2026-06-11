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
  initiative: "product",
  meetingRef: "roadmap-sync",
  notes: [{ text: "Show board view.", level: 0 }, "Copy filtered tasks."],
  subtasks: [{ text: "Open sample file.", checked: false }]
};

assert.equal(normalizeSearchText(" Product "), " product ");
assert.equal(
  getCardSearchText(task, { meetingTitle: "Roadmap sync" }),
  "record demo gif 2026-06-12 roadmap sync product open sample file. show board view. copy filtered tasks."
);

const data = getCardFilterData(task, { meetingTitle: "Roadmap sync" });
assert.equal(data.initiative, "product");
assert.equal(matchesFilter(data, { query: "roadmap", initiative: "product" }), true);
assert.equal(matchesFilter(data, { query: "missing", initiative: "product" }), false);
assert.equal(matchesFilter(data, { query: "roadmap", initiative: "design" }), false);
assert.equal(matchesFilter({ searchText: "untagged note", initiative: "" }, { initiative: "__none__" }), true);
assert.equal(matchesFilter(data, { initiative: "__none__" }), false);

console.log("Core filter tests passed.");
