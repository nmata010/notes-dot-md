import assert from "node:assert/strict";
import { parseMarkdown } from "../src/core/markdown.js";
import {
  createStarterMarkdown,
  createStarterWorkspace,
  createCardForSection,
  addCardToSection,
  addInitiative,
  addSection,
  addSubtask,
  defaultFileName,
  deleteCard,
  deleteSection,
  deleteInitiative,
  ensureSubtasks,
  getLinkedTasks,
  getInitiativeColor,
  getInitiativeUsageCount,
  initiativeColorPalette,
  localDateString,
  moveCheckedTaskToDone,
  moveCard,
  moveSection,
  removeCard,
  removeMeetingRefs,
  removeSubtask,
  renameSection,
  setCardDueDate,
  setCardInitiative,
  setCardNotes,
  setCardTitle,
  setWorkspaceCardTitle,
  toggleCardChecked,
  toggleSubtaskChecked,
  updateMeetingRefs,
  updateSubtask,
  renameInitiative
} from "../src/core/workspace.js";

assert.equal(defaultFileName, "my-notes.md");

const starter = createStarterMarkdown();
assert.match(starter, /^# Notes\n/);
assert.match(starter, /## Notes/);
assert.match(starter, /## To Do/);
assert.match(starter, /## In Progress/);
assert.match(starter, /## Done/);
assert.match(starter, /- \[ \] \*\*First note\*\* #work/);
assert.match(starter, /\t- \*\*Created:\*\* \d{4}-\d{2}-\d{2}/);
assert.match(starter, /- work\n- personal\n$/);

const parsedStarter = parseMarkdown(starter);
assert.deepEqual(parsedStarter.sections.map(section => section.name), ["Notes", "To Do", "In Progress", "Done"]);
assert.deepEqual(parsedStarter.initiatives, ["work", "personal"]);

const workspace = createStarterWorkspace();
const addedSection = addSection(workspace, "Ideas");
assert.deepEqual(addedSection, { id: "ideas", name: "Ideas" });
assert.deepEqual(workspace.tasks.ideas, []);
assert.equal(addSection(workspace, "Ideas"), null);

const ideaCard = addCardToSection(
  workspace,
  "ideas",
  createCardForSection("Sketch model", "ideas", { id: "idea-task" }),
  "start"
);
assert.equal(ideaCard.title, "Sketch model");
assert.equal(ideaCard.checked, false);
assert.deepEqual(ideaCard.notes, []);
assert.deepEqual(ideaCard.subtasks, []);
assert.equal(ideaCard.createdAt, localDateString());
assert.equal(workspace.tasks.ideas[0], ideaCard);
const insertedCard = addCardToSection(
  workspace,
  "ideas",
  createCardForSection("Inserted", "ideas", { id: "inserted-task" }),
  0
);
assert.equal(workspace.tasks.ideas[0], insertedCard);
assert.equal(workspace.tasks.ideas[1], ideaCard);
assert.equal(moveCard(workspace, "idea-task", "to-do", 0), ideaCard);
assert.equal(workspace.tasks.ideas.length, 1);
assert.equal(workspace.tasks["to-do"][0], ideaCard);
assert.equal(removeCard(workspace, "idea-task"), ideaCard);
assert.equal(removeCard(workspace, "missing"), null);

const renamedSection = renameSection(workspace, "ideas", "Backlog Ideas");
assert.equal(renamedSection.id, "backlog-ideas");
assert.equal(renamedSection.name, "Backlog Ideas");
assert.equal(workspace.tasks.ideas, undefined);
assert.equal(workspace.tasks["backlog-ideas"][0], insertedCard);
assert.equal(insertedCard.section, "backlog-ideas");
assert.equal(renameSection(workspace, "backlog-ideas", "To Do"), null);
assert.equal(workspace.sections.some(section => section.id === "backlog-ideas"), true);

assert.equal(moveSection(workspace, "backlog-ideas", "notes", true), renamedSection);
assert.deepEqual(workspace.sections.map(section => section.id).slice(0, 2), ["backlog-ideas", "notes"]);
assert.equal(moveSection(workspace, "missing", "notes", true), null);

const emptySection = addSection(workspace, "Empty");
assert.equal(deleteSection(workspace, emptySection.id), emptySection);
assert.equal(workspace.tasks.empty, undefined);

const movableSection = addSection(workspace, "Move Me");
const movedSectionCard = addCardToSection(
  workspace,
  movableSection.id,
  createCardForSection("Move with section", movableSection.id, { id: "move-with-section" })
);
assert.equal(deleteSection(workspace, movableSection.id), null);
assert.equal(deleteSection(workspace, movableSection.id, "notes"), movableSection);
assert.equal(movedSectionCard.section, "notes");
assert.equal(workspace.tasks.notes.includes(movedSectionCard), true);
assert.equal(workspace.tasks[movableSection.id], undefined);

const oneSectionWorkspace = { sections: [{ id: "only", name: "Only" }], tasks: { only: [] }, initiatives: [] };
assert.equal(deleteSection(oneSectionWorkspace, "only"), null);

const linkedTask = createCardForSection("Follow up", "to-do", {
  id: "linked-task",
  initiative: "client",
  meetingRef: "roadmap-sync"
});
assert.equal(linkedTask.initiative, "client");
assert.equal(linkedTask.meetingRef, "roadmap-sync");
assert.equal(setCardTitle(linkedTask, "  Follow up again  "), true);
assert.equal(linkedTask.title, "Follow up again");
assert.equal(setCardTitle(linkedTask, "   "), false);
assert.equal(linkedTask.title, "Follow up again");
assert.equal(setCardDueDate(linkedTask, "2026-06-15"), true);
assert.equal(linkedTask.note, "2026-06-15");
assert.equal(setCardInitiative(linkedTask, ""), true);
assert.equal(linkedTask.initiative, null);
assert.equal(setCardNotes(linkedTask, [{ text: "Decision captured", level: 0 }]), true);
assert.deepEqual(linkedTask.notes, [{ text: "Decision captured", level: 0 }]);
assert.equal(toggleCardChecked(linkedTask), true);
assert.equal(linkedTask.checked, true);
assert.equal(toggleCardChecked({ checked: false }), true);

const subtaskCard = createCardForSection("Subtasks", "to-do", { id: "subtask-card" });
assert.deepEqual(ensureSubtasks(subtaskCard), []);
assert.deepEqual(addSubtask(subtaskCard, "  Draft outline  "), { text: "Draft outline", checked: false });
assert.equal(addSubtask(subtaskCard, "   "), null);
assert.equal(toggleSubtaskChecked(subtaskCard, 0), true);
assert.equal(subtaskCard.subtasks[0].checked, true);
assert.equal(updateSubtask(subtaskCard, 0, "  Draft revised outline  "), true);
assert.equal(subtaskCard.subtasks[0].text, "Draft revised outline");
assert.equal(updateSubtask(subtaskCard, 0, " "), true);
assert.equal(subtaskCard.subtasks.length, 0);
assert.deepEqual(addSubtask(subtaskCard, "Review"), { text: "Review", checked: false });
assert.deepEqual(removeSubtask(subtaskCard, 0), { text: "Review", checked: false });
assert.equal(removeSubtask(subtaskCard, 0), null);

assert.equal(getInitiativeColor(workspace.initiatives, "work"), initiativeColorPalette[0]);
assert.equal(getInitiativeColor(workspace.initiatives, "personal"), initiativeColorPalette[1]);
assert.equal(getInitiativeColor(workspace.initiatives, "missing"), initiativeColorPalette[2]);
assert.equal(getInitiativeUsageCount(workspace, "work"), 2);
assert.equal(addInitiative(workspace, "  ops  "), "ops");
assert.equal(addInitiative(workspace, "ops"), null);
assert.equal(addInitiative(workspace, "   "), null);
assert.deepEqual(workspace.initiatives, ["work", "personal", "ops"]);

const meetingNote = {
  id: "meeting-note",
  title: "Roadmap sync",
  checked: false,
  subtasks: [],
  notes: [],
  section: "notes",
  initiative: "client"
};
workspace.tasks.notes.push(meetingNote);
workspace.tasks["to-do"][0].meetingRef = "roadmap-sync";
assert.deepEqual(getLinkedTasks(workspace, "roadmap-sync").map(task => task.id), ["starter-task"]);
assert.equal(setWorkspaceCardTitle(workspace, meetingNote, "Planning sync"), true);
assert.equal(meetingNote.title, "Planning sync");
assert.equal(workspace.tasks["to-do"][0].meetingRef, "planning-sync");
assert.equal(setWorkspaceCardTitle(workspace, meetingNote, "   "), false);
assert.equal(meetingNote.title, "Planning sync");
updateMeetingRefs(workspace, "planning-sync", "decision-sync");
assert.equal(workspace.tasks["to-do"][0].meetingRef, "decision-sync");
removeMeetingRefs(workspace, "decision-sync");
assert.equal(workspace.tasks["to-do"][0].meetingRef, null);
workspace.tasks["to-do"][0].meetingRef = "planning-sync";
assert.equal(deleteCard(workspace, meetingNote), meetingNote);
assert.equal(workspace.tasks.notes.includes(meetingNote), false);
assert.equal(workspace.tasks["to-do"][0].meetingRef, null);
const removableTask = addCardToSection(workspace, "to-do", createCardForSection("Remove me", "to-do", { id: "remove-me" }));
assert.equal(deleteCard(workspace, removableTask), removableTask);
assert.equal(workspace.tasks["to-do"].some(card => card.id === "remove-me"), false);

renameInitiative(workspace, "work", "client");
assert.deepEqual(workspace.initiatives, ["client", "personal", "ops"]);
assert.equal(workspace.tasks.notes[0].initiative, "client");
assert.equal(workspace.tasks["in-progress"][0].initiative, "client");

deleteInitiative(workspace, "personal");
assert.deepEqual(workspace.initiatives, ["client", "ops"]);
assert.equal(workspace.tasks["to-do"][0].initiative, null);

const task = workspace.tasks["to-do"][0];
task.checked = true;
assert.equal(moveCheckedTaskToDone(workspace, task), true);
assert.equal(workspace.tasks["to-do"].length, 0);
assert.equal(workspace.tasks.done[0], task);
assert.equal(task.section, "done");
assert.equal(moveCheckedTaskToDone(workspace, task), false);

const noteCard = workspace.tasks.notes[0];
noteCard.checked = true;
assert.equal(moveCheckedTaskToDone(workspace, noteCard), true);
assert.equal(noteCard.section, "done");

console.log("Core workspace tests passed.");
