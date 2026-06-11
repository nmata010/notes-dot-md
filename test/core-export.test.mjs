import assert from "node:assert/strict";
import { formatNoteForClipboard } from "../src/core/export.js";

const note = {
  title: "Roadmap sync",
  initiative: "team",
  notes: [
    { text: "Keep the app static.", level: 0 },
    { text: "Extract core behavior.", level: 1 },
    "Plain string note."
  ]
};

const linkedTasks = [
  { title: "Record demo gif", checked: false },
  { title: "Remove stale section", checked: true }
];

assert.equal(formatNoteForClipboard(note, linkedTasks), [
  "Roadmap sync",
  "",
  "Notes:",
  "• Keep the app static.",
  "  • Extract core behavior.",
  "• Plain string note.",
  "",
  "Tasks:",
  "[ ] Record demo gif",
  "[x] Remove stale section",
  "",
  "Initiative: team"
].join("\n"));

assert.equal(formatNoteForClipboard({ title: "Empty", notes: [], initiative: null }), "Empty");

console.log("Core export tests passed.");
