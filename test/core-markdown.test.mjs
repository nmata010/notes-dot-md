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
assert.deepEqual(notes[0].initiatives, ["product"]);
assert.deepEqual(notes[0].notes, [
  { text: "Capture demo beats.", level: 0 },
  { text: "Nested detail.", level: 1 }
]);

const todo = workspace.tasks["to-do"][0];
assert.equal(todo.title, "Record demo gif");
assert.equal(todo.note, "2026-06-12");
assert.equal(todo.checked, false);
assert.deepEqual(todo.initiatives, ["product"]);
assert.equal(todo.meetingRef, "roadmap-sync");
assert.equal(todo.createdAt, null);
assert.deepEqual(todo.notes, [
  { text: "Show board view.", level: 0 },
  { text: "Show label filters.", level: 0 }
]);
assert.deepEqual(todo.subtasks, []);

const promotedOpen = workspace.tasks["to-do"].find(card => card.title === "Open sample file.");
assert.equal(promotedOpen.checked, false);
assert.deepEqual(promotedOpen.initiatives, ["product"]);
assert.equal(promotedOpen.meetingRef, "record-demo-gif");
const promotedPalette = workspace.tasks["to-do"].find(card => card.title === "Check current palette.");
assert.equal(promotedPalette.checked, true);
assert.deepEqual(promotedPalette.initiatives, ["product"]);
assert.equal(promotedPalette.meetingRef, "record-demo-gif");

const meeting = findMeetingBySlug(workspace, "roadmap-sync");
assert.equal(meeting.title, "Roadmap sync");

const serialized = serializeMarkdown(workspace);
assert.match(serialized, /^# Tasks\n/);
assert.match(serialized, /## To Do/);
assert.match(serialized, /- \[ \] \*\*Monday planning\*\* #product/);
assert.match(serialized, /- \[ \] \*\*Record demo gif\*\* #product/);
assert.match(serialized, /\t- \*\*Due:\*\* 2026-06-12/);
assert.match(serialized, /\t- \*\*Relates to:\*\* Roadmap sync/);
assert.match(serialized, /- \[x\] \*\*Check current palette\.\*\* #product/);
assert.match(serialized, /\t- \*\*Relates to:\*\* Record demo gif/);
assert.doesNotMatch(serialized, /  - \[[ x]\]/);
assert.match(serialized, /---\n## Setup\n- product\n- team\n$/);

const filtered = serializeFilteredMarkdown(workspace, new Set([todo.id]));
assert.equal(filtered, [
  "## To Do",
  "- [ ] **Record demo gif** #product",
  "\t- **Due:** 2026-06-12",
  "\t- **Relates to:** Roadmap sync",
  "\t- Show board view.",
  "\t- Show label filters.",
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
assert.deepEqual(currentCard.subtasks, []);
const fallbackLinkedCard = currentShape.tasks.notes.find(card => card.title === "Share the decision.");
assert.equal(fallbackLinkedCard.meetingRef, "planning-notes");
assert.deepEqual(fallbackLinkedCard.initiatives, ["team"]);

const multipleInitiatives = parseMarkdown([
  "# Notes",
  "",
  "## To Do",
  "- [ ] **Prepare launch plan** #product #marketing #q3-launch",
  "- [ ] **Legacy planning** #Client Work #Q3 Planning",
  "",
  "---",
  "## Setup",
  "- product",
  "- marketing",
  "- q3-launch",
  "- Client Work",
  "- Q3 Planning",
  ""
].join("\n"));
assert.deepEqual(multipleInitiatives.tasks["to-do"][0].initiatives, ["product", "marketing", "q3-launch"]);
assert.deepEqual(multipleInitiatives.tasks["to-do"][1].initiatives, ["Client Work", "Q3 Planning"]);
assert.match(serializeMarkdown(multipleInitiatives), /\*\*Prepare launch plan\*\* #product #marketing #q3-launch/);
assert.match(serializeMarkdown(multipleInitiatives), /\*\*Legacy planning\*\* #Client Work #Q3 Planning/);

console.log("Core markdown tests passed.");
