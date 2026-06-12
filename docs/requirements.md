# Requirements

`notes dot md` turns everyday notes and tasks into structured, portable context without folders, filing, or setup.

It provides one place to capture work, then lets the user narrow that record to the context relevant to a particular initiative or question.

## Must Do

- Open an existing local `.md` file.
- Create a new starter `.md` file.
- Capture meetings, tasks, and thoughts as cards in the same workspace.
- Preserve useful context on each card, including initiatives, creation date, due date, notes, and relationships.
- Support board and list views.
- Filter the workspace by initiative and matching text.
- Copy the filtered cards and their metadata as structured markdown.
- Save changes directly back to the selected file through the File System Access API.
- Keep the markdown readable, portable, and suitable for providing focused context to an LLM.
- Avoid accounts, sync, analytics, servers, and databases.

## Browser Support

- The supported environment is a Chromium-based browser with File System Access API support.
- Chrome is the tested and recommended browser.
- File-input and download fallback code exists for other browsers, but that workflow is best-effort and not explicitly supported.

## Data Expectations

- The selected markdown file is the source of record.
- The app may remember a browser file handle for convenience.
- The app must not upload note contents to any remote service.
- A GitHub Pages deployment hosts only static app files.

## Product Model

- Sections provide context and workflow state; they do not define card type.
- Every card has a checkbox and can have a creation date, due date, notes, zero or more initiatives, and an optional relationship to another card.
- Linked cards are full cards with their own notes and linked cards. New linked cards inherit the parent initiatives and start in `To Do`, or in the parent's section when no `To Do` section exists.
- Checking a card moves it to `Done`; manually moving it afterward is allowed even if that creates a contradictory state.
- New cards receive a creation date. Existing cards without one remain undated rather than receiving an invented date.
- Initiatives create a low-maintenance structure for filtering and visual scanning without requiring folders or directories. A card may belong to multiple equal initiatives.
- Filtered cards can be copied together as a portable bundle of context.

## Non-Goals

- Cross-device sync.
- Multi-user collaboration.
- Cloud storage.
- Recreating a general-purpose document editor.
- A database-backed task manager.
