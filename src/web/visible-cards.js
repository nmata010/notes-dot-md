export function collectVisibleCardIds({ currentView, board, listView }) {
  const visibleIds = new Set();
  const selector = currentView === "board" ? ".task-card" : ".list-item";
  const root = currentView === "board" ? board : listView;
  const idAttribute = currentView === "board" ? "id" : "taskId";

  root.querySelectorAll(selector).forEach(card => {
    if (card.style.display !== "none") visibleIds.add(parseFloat(card.dataset[idAttribute]));
  });

  return visibleIds;
}
