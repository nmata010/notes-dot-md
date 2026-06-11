function noteText(noteValue) {
  return typeof noteValue === "string" ? noteValue : noteValue.text;
}

export function normalizeSearchText(value) {
  return String(value || "").toLowerCase();
}

export function getCardSearchText(card, options = {}) {
  const meetingTitle = options.meetingTitle || "";
  const parts = [card.title, card.note, meetingTitle, card.initiative];

  if (card.subtasks) {
    parts.push(...card.subtasks.map(subtask => subtask.text || subtask));
  }

  if (card.notes) {
    parts.push(...card.notes.map(noteText));
  }

  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function getCardFilterData(card, options = {}) {
  return {
    searchText: getCardSearchText(card, options),
    initiative: card.initiative || ""
  };
}

export function matchesFilter(filterData, filter = {}) {
  const query = normalizeSearchText(filter.query);
  const initiativeFilter = filter.initiative || null;
  const searchText = normalizeSearchText(filterData.searchText);
  const initiative = filterData.initiative || "";

  const textMatch = !query || searchText.includes(query);
  const initiativeMatch = !initiativeFilter
    || (initiativeFilter === "__none__" ? !initiative : initiative === initiativeFilter);

  return textMatch && initiativeMatch;
}
