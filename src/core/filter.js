function noteText(noteValue) {
  return typeof noteValue === "string" ? noteValue : noteValue.text;
}

export function normalizeSearchText(value) {
  return String(value || "").toLowerCase();
}

export function getCardSearchText(card, options = {}) {
  const meetingTitle = options.meetingTitle || "";
  const initiatives = card.initiatives || (card.initiative ? [card.initiative] : []);
  const parts = [card.title, card.note, meetingTitle, ...initiatives];

  if (card.notes) {
    parts.push(...card.notes.map(noteText));
  }

  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function getCardFilterData(card, options = {}) {
  const initiatives = card.initiatives || (card.initiative ? [card.initiative] : []);
  return {
    searchText: getCardSearchText(card, options),
    initiatives
  };
}

export function matchesFilter(filterData, filter = {}) {
  const query = normalizeSearchText(filter.query);
  const initiativeFilter = filter.initiative || null;
  const searchText = normalizeSearchText(filterData.searchText);
  let initiatives = filterData.initiatives || (filterData.initiative ? [filterData.initiative] : []);
  if (typeof initiatives === "string") {
    try { initiatives = JSON.parse(initiatives); }
    catch { initiatives = initiatives ? initiatives.split(",") : []; }
  }

  const textMatch = !query || searchText.includes(query);
  const initiativeMatch = !initiativeFilter
    || (initiativeFilter === "__none__" ? initiatives.length === 0 : initiatives.includes(initiativeFilter));

  return textMatch && initiativeMatch;
}
