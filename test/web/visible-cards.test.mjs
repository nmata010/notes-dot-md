import assert from "node:assert/strict";
import { collectVisibleCardIds } from "../../src/web/visible-cards.js";

function root(cardsBySelector) {
  return {
    querySelectorAll(selector) {
      return cardsBySelector[selector] || [];
    }
  };
}

const visibleBoardCard = { style: { display: "" }, dataset: { id: "101" } };
const hiddenBoardCard = { style: { display: "none" }, dataset: { id: "102" } };
const board = root({ ".task-card": [visibleBoardCard, hiddenBoardCard] });

const visibleListItem = { style: { display: "" }, dataset: { taskId: "201" } };
const hiddenListItem = { style: { display: "none" }, dataset: { taskId: "202" } };
const listView = root({ ".list-item": [visibleListItem, hiddenListItem] });

assert.deepEqual(
  [...collectVisibleCardIds({ currentView: "board", board, listView })],
  [101]
);

assert.deepEqual(
  [...collectVisibleCardIds({ currentView: "list", board, listView })],
  [201]
);

console.log("Web visible cards tests passed.");
