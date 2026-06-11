import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  findMeetingBySlug,
  meetingSlug,
  parseMarkdown,
  sectionId,
  serializeFilteredMarkdown,
  serializeMarkdown
} from "../src/core/markdown.js";

const sample = await readFile("test/fixtures/markdown-sample.md", "utf8");
const workspace = parseMarkdown(sample);

assert.deepEqual(workspace.sections.map(section => section.name), ["Notes", "Meetings", "To Do", "Done"]);
assert.deepEqual(workspace.initiatives, ["product", "team"]);
assert.equal(sectionId("In Progress"), "in-progress");
assert.equal(meetingSlug("Roadmap sync"), "roadmap-sync");

const notes = workspace.tasks.notes;
assert.equal(notes.length, 1);
assert.equal(notes[0].title, "Monday planning");
assert.equal(notes[0].checked, false);
assert.equal(notes[0].createdAt, null);
assert.deepEqual(notes[0].subtasks, []);
assert.equal(notes[0].initiative, "product");
assert.deepEqual(notes[0].notes, [
  { text: "Capture demo beats.", level: 0 },
  { text: "Nested detail.", level: 1 }
]);

const todo = workspace.tasks["to-do"][0];
assert.equal(todo.title, "Record demo gif");
assert.equal(todo.note, "2026-06-12");
assert.equal(todo.checked, false);
assert.equal(todo.initiative, "product");
assert.equal(todo.meetingRef, "roadmap-sync");
assert.equal(todo.createdAt, null);
assert.deepEqual(todo.notes, [
  { text: "Show board view.", level: 0 },
  { text: "Show label filters.", level: 0 }
]);
assert.deepEqual(todo.subtasks, [
  { text: "Open sample file.", checked: false },
  { text: "Check current palette.", checked: true }
]);

const meeting = findMeetingBySlug(workspace, "roadmap-sync");
assert.equal(meeting.title, "Roadmap sync");

const serialized = serializeMarkdown(workspace);
assert.match(serialized, /^# Tasks\n/);
assert.match(serialized, /## To Do/);
assert.match(serialized, /- \[ \] \*\*Monday planning\*\* #product/);
assert.match(serialized, /- \[ \] \*\*Record demo gif\*\* #product/);
assert.match(serialized, /\t- \*\*Due:\*\* 2026-06-12/);
assert.match(serialized, /\t- \*\*Relates to:\*\* Roadmap sync/);
assert.match(serialized, /  - \[x\] Check current palette/);
assert.match(serialized, /---\n## Setup\n- product\n- team\n$/);

const filtered = serializeFilteredMarkdown(workspace, new Set([todo.id]));
assert.equal(filtered, [
  "## To Do",
  "- [ ] **Record demo gif** #product",
  "\t- **Due:** 2026-06-12",
  "\t- **Relates to:** Roadmap sync",
  "\t- Show board view.",
  "\t- Show label filters.",
  "  - [ ] Open sample file.",
  "  - [x] Check current palette.",
  ""
].join("\n"));

const currentShape = parseMarkdown([
  "# Notes",
  "",
  "## Notes",
  "- [ ] **Planning notes** #team",
  "\t- **Created:** 2026-06-10",
  "\t- **Due:** 2026-06-20",
  "\t- **Relates to:** Roadmap sync",
  "\t- Decision captured.",
  "  - [ ] Share the decision.",
  ""
].join("\n"));
const currentCard = currentShape.tasks.notes[0];
assert.equal(currentCard.createdAt, "2026-06-10");
assert.equal(currentCard.note, "2026-06-20");
assert.equal(currentCard.meetingRef, "roadmap-sync");
assert.deepEqual(currentCard.notes, [{ text: "Decision captured.", level: 0 }]);
assert.deepEqual(currentCard.subtasks, [{ text: "Share the decision.", checked: false }]);

console.log("Core markdown tests passed.");
