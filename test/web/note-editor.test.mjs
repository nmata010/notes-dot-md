import assert from "node:assert/strict";
import {
  applyInlineMarkdownShortcut,
  editorNodeToMarkdown,
  getCurrentNoteLine,
  noteEditorToNotes,
  notesToEditorHtml
} from "../../src/web/note-editor.js";

const text = value => ({ nodeType: 3, textContent: value });
const element = (name, childNodes = []) => ({ nodeType: 1, nodeName: name, childNodes });

assert.equal(editorNodeToMarkdown(text("plain")), "plain");
assert.equal(editorNodeToMarkdown(element("STRONG", [text("bold")])), "**bold**");
assert.equal(editorNodeToMarkdown(element("EM", [text("italic")])), "_italic_");
assert.equal(
  editorNodeToMarkdown(element("SPAN", [text("mix "), element("B", [text("bold")]), text(" text")])),
  "mix **bold** text"
);
assert.equal(editorNodeToMarkdown(element("BR")), "");

const editable = {
  querySelectorAll(selector) {
    assert.equal(selector, ".note-line");
    return [
      { dataset: { level: "0" }, childNodes: [text("Decision: "), element("STRONG", [text("ship")])] },
      { dataset: { level: "2" }, childNodes: [element("EM", [text("blocked")])] },
      { dataset: { level: "1" }, childNodes: [text("   ")] }
    ];
  }
};

assert.deepEqual(noteEditorToNotes(editable), [
  { text: "Decision: **ship**", level: 0 },
  { text: "_blocked_", level: 2 }
]);

assert.equal(
  notesToEditorHtml([{ text: "Make **this** safe", level: 1 }]),
  '<div class="note-line" data-level="1" style="--level:1">Make <strong>this</strong> safe</div>'
);
assert.equal(
  notesToEditorHtml([]),
  '<div class="note-line" data-level="0" style="--level:0"><br></div>'
);

const line = { nodeType: 1, parentNode: null };
const childText = { nodeType: 3, parentNode: line };
const selectionForLine = { rangeCount: 1, getRangeAt: () => ({ startContainer: childText }) };
const editableForLine = {};
line.parentNode = editableForLine;
assert.equal(getCurrentNoteLine(editableForLine, selectionForLine), line);
assert.equal(getCurrentNoteLine(editableForLine, { rangeCount: 0 }), null);

function createFakeDocument() {
  return {
    createTextNode(value) {
      return { nodeType: 3, nodeName: "#text", textContent: value, childNodes: [] };
    },
    createElement(name) {
      return { nodeType: 1, nodeName: name.toUpperCase(), textContent: "", childNodes: [] };
    },
    createRange() {
      return {
        setStart(node, offset) {
          this.startContainer = node;
          this.startOffset = offset;
        },
        collapse(value) {
          this.collapsed = value;
        }
      };
    }
  };
}

const fakeDocument = createFakeDocument();
const parent = {
  childNodes: [],
  appendChild(node) {
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  },
  insertBefore(node, next) {
    node.parentNode = this;
    const index = this.childNodes.indexOf(next);
    if (index === -1) this.childNodes.push(node);
    else this.childNodes.splice(index, 0, node);
    return node;
  }
};
const shortcutText = {
  nodeType: 3,
  textContent: "Use **bold**",
  parentNode: parent,
  nextSibling: null,
  remove() {
    parent.childNodes = parent.childNodes.filter(node => node !== this);
  }
};
parent.childNodes.push(shortcutText);

const selectionForShortcut = {
  rangeCount: 1,
  removed: false,
  addedRange: null,
  getRangeAt: () => ({ collapsed: true, startContainer: shortcutText, startOffset: shortcutText.textContent.length }),
  removeAllRanges() {
    this.removed = true;
  },
  addRange(range) {
    this.addedRange = range;
  }
};
const editableForShortcut = { contains: node => node === shortcutText };

assert.equal(applyInlineMarkdownShortcut(editableForShortcut, { document: fakeDocument, selection: selectionForShortcut }), true);
assert.deepEqual(parent.childNodes.map(node => [node.nodeName, node.textContent]), [
  ["#text", "Use "],
  ["STRONG", "bold"],
  ["#text", ""]
]);
assert.equal(selectionForShortcut.removed, true);
assert.equal(selectionForShortcut.addedRange.startOffset, 0);
assert.equal(applyInlineMarkdownShortcut(editableForShortcut, { document: fakeDocument, selection: { rangeCount: 0 } }), false);

console.log("Web note editor tests passed.");
