import assert from "node:assert/strict";
import {
  appendDateToTitle,
  formatDueDate,
  isNotesPreviewCollapsible,
  isOverdue
} from "../src/core/utils.js";

const now = new Date("2026-06-10T12:00:00");

assert.equal(appendDateToTitle("Planning", now), "Planning - 06/10/2026");
assert.equal(formatDueDate("2026-06-12", now), "Jun 12");
assert.equal(formatDueDate("2027-01-05", now), "Jan 5, 2027");
assert.equal(formatDueDate("not-a-date", now), "not-a-date");
assert.equal(formatDueDate("", now), null);
assert.equal(isOverdue("2026-06-09", now), true);
assert.equal(isOverdue("2026-06-10", now), false);
assert.equal(isOverdue("2026-06-11", now), false);
assert.equal(isOverdue("not-a-date", now), false);

assert.equal(isNotesPreviewCollapsible([]), false);
assert.equal(isNotesPreviewCollapsible(["short"]), false);
assert.equal(isNotesPreviewCollapsible(["a", "b", "c", "d", "e", "f"]), true);
assert.equal(isNotesPreviewCollapsible([{ text: "x".repeat(361), level: 0 }]), true);

console.log("Core utility tests passed.");
