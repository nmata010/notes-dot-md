import assert from "node:assert/strict";
import { showTransientStatus } from "../../src/web/status.js";

const classes = new Set();
let scheduled = null;
const element = {
  textContent: "",
  classList: {
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    }
  }
};

showTransientStatus(element, "Saved", {
  timeout: 25,
  setTimeout(callback, timeout) {
    scheduled = { callback, timeout };
  }
});

assert.equal(element.textContent, "Saved");
assert.equal(classes.has("visible"), true);
assert.equal(scheduled.timeout, 25);
scheduled.callback();
assert.equal(classes.has("visible"), false);

console.log("Web status tests passed.");
