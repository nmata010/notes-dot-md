import assert from "node:assert/strict";
import { escapeHtml, inlineMarkdownToHtml } from "../src/core/text.js";

assert.equal(escapeHtml("<script>&</script>"), "&lt;script&gt;&amp;&lt;/script&gt;");
assert.equal(inlineMarkdownToHtml("Make **this** bold"), "Make <strong>this</strong> bold");
assert.equal(inlineMarkdownToHtml("Make *this* italic"), "Make <em>this</em> italic");
assert.equal(inlineMarkdownToHtml("Make _this_ italic"), "Make <em>this</em> italic");
assert.equal(
  inlineMarkdownToHtml("<b>unsafe</b> and **safe**"),
  "&lt;b&gt;unsafe&lt;/b&gt; and <strong>safe</strong>"
);
assert.equal(inlineMarkdownToHtml(null), "");

console.log("Core text tests passed.");
