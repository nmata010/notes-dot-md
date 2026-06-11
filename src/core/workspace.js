import { meetingSlug, sectionId, serializeMarkdown } from "./markdown.js";

export const defaultFileName = "my-notes.md";

export const initiativeColorPalette = [
  "#b9432f",
  "#5a4fd6",
  "#007a83",
  "#c17900",
  "#2f7b3f",
  "#b43d84",
  "#1768b3",
  "#d14f57",
  "#6f761c",
  "#3f3f3c"
];

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createStarterWorkspace() {
  return {
    sections: [
      { id: "notes", name: "Notes" },
      { id: "to-do", name: "To Do" },
      { id: "in-progress", name: "In Progress" },
      { id: "done", name: "Done" }
    ],
    tasks: {
      notes: [
        {
          id: "starter-note",
          title: "First note",
          note: "",
          checked: false,
          subtasks: [],
          notes: [{ text: "Capture the thing you do not want to lose.", level: 0 }],
          section: "notes",
          initiatives: ["work"],
          meetingRef: null,
          createdAt: localDateString()
        }
      ],
      "to-do": [
        {
          id: "starter-task",
          title: "Add your first task",
          note: "",
          checked: false,
          subtasks: [],
          notes: [{ text: "Add details here.", level: 0 }],
          section: "to-do",
          initiatives: ["personal"],
          meetingRef: null,
          createdAt: localDateString()
        }
      ],
      "in-progress": [
        {
          id: "starter-active-task",
          title: "Shape the next thing",
          note: "",
          checked: false,
          subtasks: [],
          notes: [{ text: "Use this column for work that is active but not done.", level: 0 }],
          section: "in-progress",
          initiatives: ["work"],
          meetingRef: null,
          createdAt: localDateString()
        }
      ],
      done: []
    },
    initiatives: ["work", "personal"]
  };
}

export function createCard(title, sectionIdValue, options = {}) {
  return {
    id: options.id ?? Date.now() + Math.random(),
    title,
    note: "",
    checked: false,
    subtasks: [],
    notes: [],
    section: sectionIdValue,
    initiatives: options.initiatives ? [...options.initiatives] : (options.initiative ? [options.initiative] : []),
    meetingRef: options.meetingRef ?? undefined,
    createdAt: options.createdAt ?? localDateString()
  };
}

export const createTaskCard = createCard;
export const createNoteCard = createCard;

export function createCardForSection(title, sectionIdValue, options = {}) {
  return createCard(title, sectionIdValue, options);
}

export function addCardToSection(workspace, sectionIdValue, card, position = "end") {
  if (!workspace.tasks[sectionIdValue]) workspace.tasks[sectionIdValue] = [];
  if (typeof position === "number" && position >= 0 && position <= workspace.tasks[sectionIdValue].length) {
    workspace.tasks[sectionIdValue].splice(position, 0, card);
  } else if (position === "start") workspace.tasks[sectionIdValue].unshift(card);
  else workspace.tasks[sectionIdValue].push(card);
  return card;
}

export function addSection(workspace, name) {
  const id = sectionId(name);
  if (workspace.tasks[id]) return null;
  const section = { id, name };
  workspace.sections.push(section);
  workspace.tasks[id] = [];
  return section;
}

export function renameSection(workspace, sectionIdValue, newName) {
  const section = workspace.sections.find(candidate => candidate.id === sectionIdValue);
  if (!section) return null;

  const trimmedName = newName.trim();
  if (!trimmedName) return null;
  if (trimmedName === section.name) return section;

  const oldId = section.id;
  const newId = sectionId(trimmedName);
  if (newId !== oldId && workspace.tasks[newId]) return null;

  section.name = trimmedName;
  if (newId !== oldId) {
    workspace.tasks[newId] = workspace.tasks[oldId] || [];
    delete workspace.tasks[oldId];
    workspace.tasks[newId].forEach(card => { card.section = newId; });
    section.id = newId;
  }
  return section;
}

export function moveSection(workspace, fromId, toId, insertBefore = true) {
  const fromIndex = workspace.sections.findIndex(section => section.id === fromId);
  const toIndex = workspace.sections.findIndex(section => section.id === toId);
  if (fromIndex === -1 || toIndex === -1) return null;

  const [section] = workspace.sections.splice(fromIndex, 1);
  let newIndex = workspace.sections.findIndex(candidate => candidate.id === toId);
  if (!insertBefore) newIndex++;
  workspace.sections.splice(newIndex, 0, section);
  return section;
}

export function deleteSection(workspace, sectionIdValue, destinationId = null) {
  if (workspace.sections.length <= 1) return null;

  const sectionIndex = workspace.sections.findIndex(section => section.id === sectionIdValue);
  if (sectionIndex === -1) return null;

  const cards = workspace.tasks[sectionIdValue] || [];
  if (cards.length > 0) {
    if (!destinationId || destinationId === sectionIdValue || !workspace.tasks[destinationId]) return null;
    cards.forEach(card => { card.section = destinationId; });
    workspace.tasks[destinationId].push(...cards);
  }

  const [section] = workspace.sections.splice(sectionIndex, 1);
  delete workspace.tasks[sectionIdValue];
  return section;
}

export function removeCard(workspace, cardId) {
  for (const section of workspace.sections) {
    const sectionTasks = workspace.tasks[section.id] || [];
    const index = sectionTasks.findIndex(card => card.id === cardId);
    if (index !== -1) {
      return sectionTasks.splice(index, 1)[0];
    }
  }
  return null;
}

export function deleteCard(workspace, card) {
  if (!card) return null;
  removeMeetingRefs(workspace, meetingSlug(card.title));
  return removeCard(workspace, card.id);
}

export function moveCard(workspace, cardId, toSectionId, dropIndex = -1) {
  const card = removeCard(workspace, cardId);
  if (!card) return null;

  card.section = toSectionId;
  if (!workspace.tasks[toSectionId]) workspace.tasks[toSectionId] = [];
  if (dropIndex >= 0 && dropIndex <= workspace.tasks[toSectionId].length) {
    workspace.tasks[toSectionId].splice(dropIndex, 0, card);
  } else {
    workspace.tasks[toSectionId].push(card);
  }
  return card;
}

export function setCardTitle(card, title) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return false;
  card.title = trimmedTitle;
  return true;
}

export function setWorkspaceCardTitle(workspace, card, title) {
  const oldTitle = card.title;
  if (!setCardTitle(card, title)) return false;

  const oldSlug = meetingSlug(oldTitle);
  const newSlug = meetingSlug(card.title);
  if (oldSlug !== newSlug) updateMeetingRefs(workspace, oldSlug, newSlug);

  return true;
}

export function setCardDueDate(card, dueDate) {
  card.note = dueDate || "";
  return true;
}

export function setCardNotes(card, notes) {
  card.notes = notes;
  return true;
}

export function ensureCardInitiatives(card) {
  if (!Array.isArray(card.initiatives)) {
    card.initiatives = card.initiative ? [card.initiative] : [];
  }
  delete card.initiative;
  return card.initiatives;
}

export function setCardInitiatives(card, initiatives) {
  card.initiatives = [...new Set((initiatives || []).filter(Boolean))];
  delete card.initiative;
  return true;
}

export function toggleCardInitiative(card, initiative) {
  if (!initiative) return false;
  const initiatives = ensureCardInitiatives(card);
  const index = initiatives.indexOf(initiative);
  if (index === -1) initiatives.push(initiative);
  else initiatives.splice(index, 1);
  return true;
}

export function toggleCardChecked(card) {
  if (!card) return false;
  card.checked = !card.checked;
  return true;
}

export function ensureSubtasks(card) {
  if (!card.subtasks) card.subtasks = [];
  return card.subtasks;
}

export function addSubtask(card, text) {
  const trimmedText = text.trim();
  if (!trimmedText) return null;
  const subtask = { text: trimmedText, checked: false };
  ensureSubtasks(card).push(subtask);
  return subtask;
}

export function updateSubtask(card, index, text) {
  const subtasks = ensureSubtasks(card);
  if (!subtasks[index]) return false;

  const trimmedText = text.trim();
  if (!trimmedText) {
    subtasks.splice(index, 1);
    return true;
  }

  subtasks[index].text = trimmedText;
  return true;
}

export function removeSubtask(card, index) {
  const subtasks = ensureSubtasks(card);
  if (!subtasks[index]) return null;
  return subtasks.splice(index, 1)[0];
}

export function toggleSubtaskChecked(card, index) {
  const subtasks = ensureSubtasks(card);
  if (!subtasks[index]) return false;
  subtasks[index].checked = !subtasks[index].checked;
  return true;
}

export function createStarterMarkdown() {
  return serializeMarkdown(createStarterWorkspace(), { title: "Notes" });
}

export function getInitiativeColor(initiatives, name) {
  const index = initiatives.indexOf(name);
  const position = index >= 0 ? index : initiatives.length;
  return initiativeColorPalette[position % initiativeColorPalette.length];
}

export function getInitiativeUsageCount(workspace, name) {
  let count = 0;
  for (const section of workspace.sections) {
    (workspace.tasks[section.id] || []).forEach(card => {
      if (ensureCardInitiatives(card).includes(name)) count++;
    });
  }
  return count;
}

export function normalizeInitiativeName(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function addInitiative(workspace, name) {
  const normalizedName = normalizeInitiativeName(name);
  if (!normalizedName || workspace.initiatives.includes(normalizedName)) return null;
  workspace.initiatives.push(normalizedName);
  return normalizedName;
}

export function getLinkedTasks(workspace, slug) {
  const linked = [];
  for (const section of workspace.sections) {
    (workspace.tasks[section.id] || []).forEach(card => {
      if (card.meetingRef === slug) linked.push(card);
    });
  }
  return linked;
}

export function updateMeetingRefs(workspace, oldSlug, newSlug) {
  for (const section of workspace.sections) {
    (workspace.tasks[section.id] || []).forEach(card => {
      if (card.meetingRef === oldSlug) card.meetingRef = newSlug;
    });
  }
}

export function removeMeetingRefs(workspace, slug) {
  for (const section of workspace.sections) {
    (workspace.tasks[section.id] || []).forEach(card => {
      if (card.meetingRef === slug) card.meetingRef = null;
    });
  }
}

export function renameInitiative(workspace, oldName, newName) {
  const normalizedName = normalizeInitiativeName(newName);
  if (!normalizedName || (normalizedName !== oldName && workspace.initiatives.includes(normalizedName))) return null;
  const index = workspace.initiatives.indexOf(oldName);
  if (index === -1) return null;
  workspace.initiatives[index] = normalizedName;
  for (const section of workspace.sections) {
    (workspace.tasks[section.id] || []).forEach(card => {
      const initiatives = ensureCardInitiatives(card);
      const cardIndex = initiatives.indexOf(oldName);
      if (cardIndex !== -1) initiatives[cardIndex] = normalizedName;
      card.initiatives = [...new Set(initiatives)];
    });
  }
  return normalizedName;
}

export function deleteInitiative(workspace, name) {
  const index = workspace.initiatives.indexOf(name);
  if (index !== -1) workspace.initiatives.splice(index, 1);
  for (const section of workspace.sections) {
    (workspace.tasks[section.id] || []).forEach(card => {
      card.initiatives = ensureCardInitiatives(card).filter(initiative => initiative !== name);
    });
  }
}

export function moveCheckedTaskToDone(workspace, task) {
  if (!task || !task.checked) return false;

  let doneSection = workspace.sections.find(section => section.name.toLowerCase() === "done");
  if (!doneSection) {
    const id = sectionId("Done");
    doneSection = { id, name: "Done" };
    workspace.sections.push(doneSection);
    workspace.tasks[id] = [];
  }

  if (task.section === doneSection.id) return false;

  const currentTasks = workspace.tasks[task.section] || [];
  const index = currentTasks.findIndex(candidate => candidate.id === task.id);
  if (index !== -1) currentTasks.splice(index, 1);

  task.section = doneSection.id;
  if (!workspace.tasks[doneSection.id]) workspace.tasks[doneSection.id] = [];
  workspace.tasks[doneSection.id].unshift(task);
  return true;
}
