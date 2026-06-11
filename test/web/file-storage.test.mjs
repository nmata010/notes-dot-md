import assert from "node:assert/strict";
import {
  fileHandleDbName,
  fileHandleStoreName,
  lastTaskFileKey,
  supportsIndexedDb,
  supportsOpenFilePicker,
  supportsSaveFilePicker
} from "../../src/web/file-storage.js";

assert.equal(fileHandleDbName, "notes-dot-md");
assert.equal(fileHandleStoreName, "file-handles");
assert.equal(lastTaskFileKey, "last-task-file");

assert.equal(supportsIndexedDb({ indexedDB: {} }), true);
assert.equal(supportsIndexedDb({}), false);
assert.equal(supportsOpenFilePicker({ showOpenFilePicker() {} }), true);
assert.equal(supportsOpenFilePicker({}), false);
assert.equal(supportsSaveFilePicker({ showSaveFilePicker() {} }), true);
assert.equal(supportsSaveFilePicker({}), false);

console.log("Web file storage tests passed.");
