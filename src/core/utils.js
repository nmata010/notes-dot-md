export function appendDateToTitle(title, date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${title} - ${mm}/${dd}/${date.getFullYear()}`;
}

export function formatDueDate(dateStr, now = new Date(), locale = "en-US") {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const options = { month: "short", day: "numeric" };
  if (date.getFullYear() !== today.getFullYear()) options.year = "numeric";
  return date.toLocaleDateString(locale, options);
}

export function isOverdue(dateStr, now = new Date()) {
  if (!dateStr) return false;
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function isNotesPreviewCollapsible(notes, options = {}) {
  const maxLines = options.maxLines ?? 5;
  const maxChars = options.maxChars ?? 360;
  if (!notes || notes.length === 0) return false;

  const totalChars = notes.reduce((sum, noteValue) => {
    const note = typeof noteValue === "string" ? noteValue : noteValue.text;
    return sum + (note || "").length;
  }, 0);

  return notes.length > maxLines || totalChars > maxChars;
}
