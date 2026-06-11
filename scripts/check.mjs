import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "index.html",
  "README.md",
  "LICENSE",
  ".nojekyll",
  "src/app.js",
  "src/styles.css",
  "src/core/markdown.js",
  "src/core/workspace.js",
  "src/core/utils.js",
  "src/core/filter.js",
  "src/core/export.js",
  "src/core/text.js",
  "src/web/file-storage.js",
  "src/web/file-actions.js",
  "src/web/note-editor.js",
  "src/web/status.js",
  "src/web/visible-cards.js",
  "test/core-workspace.test.mjs",
  "test/core-markdown.test.mjs",
  "test/core-utils.test.mjs",
  "test/core-filter.test.mjs",
  "test/core-export.test.mjs",
  "test/core-text.test.mjs",
  "test/web/file-storage.test.mjs",
  "test/web/file-actions.test.mjs",
  "test/web/note-editor.test.mjs",
  "test/web/status.test.mjs",
  "test/web/visible-cards.test.mjs"
];

for (const path of requiredFiles) {
  await readFile(path, "utf8");
}

const index = await readFile("index.html", "utf8");
const app = await readFile("src/app.js", "utf8");
const workspaceCore = await readFile("src/core/workspace.js", "utf8");

const requiredIndexSnippets = [
  "<!DOCTYPE html>",
  "<title>notes dot md</title>",
  'href="./src/styles.css"',
  'src="./src/app.js"',
  'id="board"',
  'id="newTaskBtn"',
  'id="newBtnLarge"',
  'id="openTaskBtn"',
  'id="saveBtn"',
  'id="filterSearchInput"',
  'id="taskViewToggle"',
  "notes d"
];

for (const snippet of requiredIndexSnippets) {
  if (!index.includes(snippet)) {
    throw new Error(`Missing expected app markup: ${snippet}`);
  }
}

const requiredAppSnippets = [
  "showSaveFilePicker",
  "createStarterMarkdown",
  "getCardFilterData",
  "formatNoteForClipboard",
  "inlineMarkdownToHtml",
  "file-storage.js",
  "file-actions.js",
  "note-editor.js",
  "status.js",
  "visible-cards.js"
];

for (const snippet of requiredAppSnippets) {
  if (!app.includes(snippet)) {
    throw new Error(`Missing expected app script content: ${snippet}`);
  }
}

const requiredWorkspaceSnippets = [
  "my-notes.md",
  "To Do",
  "In Progress",
  "initiativeColorPalette",
  "#b9432f"
];

for (const snippet of requiredWorkspaceSnippets) {
  if (!workspaceCore.includes(snippet)) {
    throw new Error(`Missing expected workspace core content: ${snippet}`);
  }
}

const forbiddenSnippets = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  'id="memoryPanel"',
  ">Memory<",
  "Commonplace",
  "Local Notes"
];

for (const snippet of forbiddenSnippets) {
  if (index.includes(snippet)) {
    throw new Error(`Found stale or external app content: ${snippet}`);
  }
}

const appSyntaxResult = spawnSync(process.execPath, ["--check", "src/app.js"], { stdio: "inherit" });
if (appSyntaxResult.status !== 0) {
  throw new Error("App script has a syntax error.");
}

const testResult = spawnSync(process.execPath, ["test/core-markdown.test.mjs"], { stdio: "inherit" });
if (testResult.status !== 0) {
  throw new Error("Core markdown tests failed.");
}

const workspaceTestResult = spawnSync(process.execPath, ["test/core-workspace.test.mjs"], { stdio: "inherit" });
if (workspaceTestResult.status !== 0) {
  throw new Error("Core workspace tests failed.");
}

const utilsTestResult = spawnSync(process.execPath, ["test/core-utils.test.mjs"], { stdio: "inherit" });
if (utilsTestResult.status !== 0) {
  throw new Error("Core utility tests failed.");
}

const filterTestResult = spawnSync(process.execPath, ["test/core-filter.test.mjs"], { stdio: "inherit" });
if (filterTestResult.status !== 0) {
  throw new Error("Core filter tests failed.");
}

const exportTestResult = spawnSync(process.execPath, ["test/core-export.test.mjs"], { stdio: "inherit" });
if (exportTestResult.status !== 0) {
  throw new Error("Core export tests failed.");
}

const textTestResult = spawnSync(process.execPath, ["test/core-text.test.mjs"], { stdio: "inherit" });
if (textTestResult.status !== 0) {
  throw new Error("Core text tests failed.");
}

const fileStorageTestResult = spawnSync(process.execPath, ["test/web/file-storage.test.mjs"], { stdio: "inherit" });
if (fileStorageTestResult.status !== 0) {
  throw new Error("Web file storage tests failed.");
}

const fileActionsTestResult = spawnSync(process.execPath, ["test/web/file-actions.test.mjs"], { stdio: "inherit" });
if (fileActionsTestResult.status !== 0) {
  throw new Error("Web file action tests failed.");
}

const noteEditorTestResult = spawnSync(process.execPath, ["test/web/note-editor.test.mjs"], { stdio: "inherit" });
if (noteEditorTestResult.status !== 0) {
  throw new Error("Web note editor tests failed.");
}

const statusTestResult = spawnSync(process.execPath, ["test/web/status.test.mjs"], { stdio: "inherit" });
if (statusTestResult.status !== 0) {
  throw new Error("Web status tests failed.");
}

const visibleCardsTestResult = spawnSync(process.execPath, ["test/web/visible-cards.test.mjs"], { stdio: "inherit" });
if (visibleCardsTestResult.status !== 0) {
  throw new Error("Web visible cards tests failed.");
}

console.log("Static app checks passed.");
