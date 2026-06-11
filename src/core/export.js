function normalizeNote(noteValue) {
  return typeof noteValue === "string" ? { text: noteValue, level: 0 } : noteValue;
}

export function formatNoteForClipboard(noteCard, linkedTasks = []) {
  const lines = [noteCard.title, ""];

  if (noteCard.notes.length > 0) {
    lines.push("Notes:");
    noteCard.notes.forEach(noteValue => {
      const note = normalizeNote(noteValue);
      const indent = "  ".repeat(note.level);
      lines.push(`${indent}• ${note.text}`);
    });
    lines.push("");
  }

  if (linkedTasks.length > 0) {
    lines.push("Tasks:");
    linkedTasks.forEach(task => {
      const check = task.checked ? "[x]" : "[ ]";
      lines.push(`${check} ${task.title}`);
    });
    lines.push("");
  }

  const initiatives = noteCard.initiatives || (noteCard.initiative ? [noteCard.initiative] : []);
  if (initiatives.length > 0) {
    lines.push(`${initiatives.length === 1 ? "Initiative" : "Initiatives"}: ${initiatives.join(", ")}`);
  }

  return lines.join("\n").trim();
}
