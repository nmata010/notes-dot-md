# Architecture

`notes dot md` is a static web app with a small app shell, an extensible core, and browser-specific adapters. It has no build step and no runtime dependencies.

## Shape

- `index.html` is the static shell.
- `src/styles.css` is the stylesheet.
- `src/app.js` wires browser UI interactions to the core and web adapters.
- `src/core/` owns markdown persistence and product model behavior.
- `src/web/` owns browser APIs and DOM-specific helpers.
- `scripts/check.mjs` is the project quality gate.

## Boundaries

Core modules should stay DOM-free. Put parsing, serialization, filtering, card mutations, section mutations, label behavior, dates, previews, and export text in `src/core/`.

Web modules may touch browser concepts such as file handles, clipboard, DOM nodes, contenteditable state, and transient UI behavior. Keep these helpers small and testable without needing a real browser where practical.

`src/app.js` can orchestrate UI rendering and event handling, but avoid putting product rules there when they can live in the core.

## Data Flow

1. User opens or creates a markdown file.
2. The browser reads file contents.
3. `src/core/markdown.js` parses markdown into workspace state.
4. UI interactions mutate that state through core helpers where possible.
5. The core serializes state back to markdown.
6. Supported Chromium browsers write to the original file handle through the File System Access API.

The codebase retains file-input and download helpers for browsers without direct file access. This is a best-effort fallback, not an explicitly supported product workflow.

## Markdown Contract

Markdown is the persistence format, not the authoring surface. Users live in the app.

Current conventions:

- `##` headings become sections.
- Checkbox list items become cards. Every newly serialized card uses this form.
- Bold non-checkbox list items are accepted as legacy cards for backward compatibility.
- `Created`, `Due`, and `Relates to` use bold nested metadata lines.
- Other nested bullets become notes; legacy nested checkbox bullets are promoted to standalone linked cards when the file is loaded.
- The setup block after `---` stores initiatives.
- Cards store zero or more initiatives as contiguous trailing hashtags, such as `#product #marketing`.
- Existing setup initiative names containing spaces are preserved and used to parse legacy trailing tags.

The parser accepts the older split note/task syntax and inline due dates. Saving normalizes those cards to the unified format without inventing missing creation dates.

## Change Rules

- Keep the app deployable as static files on GitHub Pages.
- Treat Chromium browsers with File System Access API support as the supported environment.
- Avoid third-party dependencies until a feature clearly earns one.
- Do not move private or local reference files into the public app surface.
- Run `npm test` before shipping changes.
