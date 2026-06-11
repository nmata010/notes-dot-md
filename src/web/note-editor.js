import { inlineMarkdownToHtml } from "../core/text.js";

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export function editorNodeToMarkdown(node) {
  if (node.nodeType === TEXT_NODE) return node.textContent;
  if (node.nodeName === "BR") return "";

  const inner = [...node.childNodes].map(editorNodeToMarkdown).join("");
  if (node.nodeName === "STRONG" || node.nodeName === "B") return `**${inner}**`;
  if (node.nodeName === "EM" || node.nodeName === "I") return `_${inner}_`;
  return inner;
}

export function noteEditorToNotes(editable) {
  return [...editable.querySelectorAll(".note-line")].map(line => {
    const level = parseInt(line.dataset.level || "0");
    const text = [...line.childNodes].map(editorNodeToMarkdown).join("").trim();
    return text ? { text, level } : null;
  }).filter(Boolean);
}

export function notesToEditorHtml(notes) {
  if (!notes.length) return '<div class="note-line" data-level="0" style="--level:0"><br></div>';

  return notes.map(noteValue => {
    const note = typeof noteValue === "string" ? { text: noteValue, level: 0 } : noteValue;
    const html = inlineMarkdownToHtml(note.text);
    return `<div class="note-line" data-level="${note.level}" style="--level:${note.level}">${html || "<br>"}</div>`;
  }).join("");
}

export function getCurrentNoteLine(editable, selection = globalThis.getSelection?.()) {
  if (!selection?.rangeCount) return null;
  let node = selection.getRangeAt(0).startContainer;
  while (node && node !== editable) {
    if (node.parentNode === editable) return node.nodeType === ELEMENT_NODE ? node : null;
    node = node.parentNode;
  }
  return null;
}

export function applyInlineMarkdownShortcut(editable, options = {}) {
  const selection = options.selection ?? globalThis.getSelection?.();
  const doc = options.document ?? globalThis.document;
  if (!selection?.rangeCount || !selection.getRangeAt(0).collapsed || !doc) return false;

  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== TEXT_NODE || !editable.contains(node)) return false;

  const offset = range.startOffset;
  const before = node.textContent.substring(0, offset);
  const patterns = [
    { re: /\*\*([^*\n]+)\*\*$/, tag: "strong" },
    { re: /(?<!\*)\*([^*\n]+)\*(?!\*)$/, tag: "em" },
    { re: /_([^_\n]+)_$/, tag: "em" }
  ];

  for (const { re, tag } of patterns) {
    const match = before.match(re);
    if (!match) continue;

    const matchStart = offset - match[0].length;
    const beforeText = node.textContent.substring(0, matchStart);
    const afterText = node.textContent.substring(offset);
    const parent = node.parentNode;
    const next = node.nextSibling;
    node.remove();

    const insert = child => next ? parent.insertBefore(child, next) : parent.appendChild(child);
    if (beforeText) insert(doc.createTextNode(beforeText));

    const formatted = doc.createElement(tag);
    formatted.textContent = match[1];
    insert(formatted);

    const afterNode = doc.createTextNode(afterText);
    insert(afterNode);

    const newRange = doc.createRange();
    newRange.setStart(afterNode, 0);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    return true;
  }

  return false;
}
