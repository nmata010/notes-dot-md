import assert from "node:assert/strict";
import {
  createMarkdownBlob,
  markdownFileTypes,
  markdownInputAccept
} from "../../src/web/file-actions.js";

assert.equal(markdownInputAccept, ".md,text/markdown,text/plain");
assert.deepEqual(markdownFileTypes, [
  { description: "Markdown", accept: { "text/markdown": [".md"], "text/plain": [".md", ".txt"] } }
]);

const blob = createMarkdownBlob("# Test\n");
assert.equal(blob.type, "text/markdown;charset=utf-8");
assert.equal(await blob.text(), "# Test\n");

console.log("Web file action tests passed.");
