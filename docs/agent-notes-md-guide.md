# Agent Guide for Editing notes dot md Files

This guide tells an AI agent how to edit a `notes dot md` markdown file directly when it cannot see the card UI.

The markdown file is the source of record. Preserve the user's existing content, section order, wording, notes, and metadata unless the user explicitly asks you to change them.

## Mental Model

- The file is a board made of `##` sections.
- Each card is a top-level bullet under one `##` section.
- All new cards should use checkbox bullets, even when the card is a note or meeting.
- A task is normally a card in `## To Do`.
- A completed card usually uses `[x]` and is usually moved to `## Done`.
- Initiatives are trailing hashtags on the card title line.
- Card metadata and body notes are nested bullets under the card.
- The setup block after `---` stores the known initiative list.

The app normalizes the file when it saves. Durable content is limited to recognized `##` sections, top-level cards, nested card bullets, and setup initiatives. Avoid adding freeform content outside that structure unless the user understands it may not survive an app save.

Canonical card shape:

```md
- [ ] **Card title** #initiative-one #initiative-two
	- **Created:** YYYY-MM-DD
	- **Due:** YYYY-MM-DD
	- **Relates to:** Parent card title
	- First note line.
		- Nested note detail.
```

## File Structure

The top-level title is not used as data. The app may rewrite it as `# Tasks` on save:

```md
# Notes
```

Cards live below second-level headings:

```md
## Notes

## Meetings

## To Do

## In Progress

## Done
```

The user may have different or additional sections. Use the existing sections when possible. Do not create a new section unless the user asks for one or there is no suitable existing section.

Known initiatives live at the end of the file after an exact horizontal-rule line. The delimiter must be exactly `---` on its own line:

```md
---
## Setup
- work
- personal
```

Preserve the setup block. Add a new initiative there when you add it to a card and it is not already listed.
If there is no setup block and you need to add an initiative, create one at the end of the file.
Do not store any other important content after `---`; only the setup initiative list is durable.

## Card Syntax

Use this line for an open card:

```md
- [ ] **Title** #initiative
```

Use this line for a completed card:

```md
- [x] **Title** #initiative
```

Rules:

- The card line must start at column 0.
- The card title is inside `**bold**`.
- Put initiative tags at the very end of the card line.
- Do not put due dates or notes after the bold title on the card line; use nested bullets.
- Multiple initiatives are allowed: `#product #marketing #q3-launch`.
- Prefer lowercase kebab-case initiative names, such as `client-work`.
- If an existing setup initiative contains spaces, preserve and reuse that exact name when matching existing cards.
- Do not use `#task` to mark a task. In this app, task status comes from the section and checkbox.

Avoid this shape:

```md
- [ ] **Call Taylor** urgent #client-work
```

The parser can treat `urgent` as an inline due/note value, and saving may rewrite it as a `Due` metadata line.

## Metadata

Metadata is stored as nested bullets below the card. Use tabs for indentation when adding new metadata.

Supported metadata:

```md
	- **Created:** YYYY-MM-DD
	- **Due:** YYYY-MM-DD
	- **Relates to:** Exact parent card title
```

Rules:

- Dates must be ISO format: `YYYY-MM-DD`.
- Add `Created` for new cards when you know today's local date.
- Do not invent a `Created` date for existing cards that do not already have one.
- Use `Due` only when the user gives a date, deadline, or clear relative date you can resolve.
- Use `Relates to` to link a task to another card, meeting, note, project, or parent card.
- The app stores relationships internally as slugs. Markdown should use the readable card title when that card exists; if no matching card exists, the app may serialize the slug.
- A nested bullet beginning with `Created:`, `Due:`, or `Relates to:` is metadata, not an ordinary note.

## Notes on Cards

Freeform details are nested bullets below metadata:

```md
	- Capture the discussion points.
	- Follow up with Alex.
		- Ask about timeline.
```

Rules:

- Keep notes as ordinary nested bullets.
- Do not turn detail bullets into separate cards unless the user asks for separate tasks.
- Preserve existing indentation levels.
- Avoid nested checkbox bullets. Older files may contain them, but the app promotes them into standalone linked cards on load.
- If the user wants a literal note that starts with `Due:`, `Created:`, or `Relates to:`, rephrase it so it does not look like metadata.

## Common User Requests

### "Add a task for xyz"

Add an open card to `## To Do`. If there is no `## To Do` section, create it before `## Done` when that section exists, otherwise place it before the setup block.

```md
## To Do

- [ ] **xyz** #optional-initiative
	- **Created:** YYYY-MM-DD
```

If the user mentions a project, client, or initiative, add the matching initiative tag. If the initiative is new, add it to `## Setup`.

### "Add a note about xyz"

Add an open card to `## Notes`:

```md
## Notes

- [ ] **xyz** #optional-initiative
	- **Created:** YYYY-MM-DD
```

If the user provides body text, add it as nested note bullets.

### "Add a meeting"

Add an open card to `## Meetings` if it exists. Otherwise add it to `## Notes`:

```md
## Meetings

- [ ] **Roadmap sync** #product
	- **Created:** YYYY-MM-DD
	- Discuss launch risks.
```

### "Mark xyz done" or "Complete xyz"

Find the matching card, change `[ ]` to `[x]`, and move the entire card block to `## Done` unless the user asks to leave it in place. Put it near the top of `## Done` unless the user gives another ordering instruction.

### "Reopen xyz"

Find the matching card, change `[x]` to `[ ]`, and move it out of `## Done` unless the user asks to leave it in place. Use `## To Do` unless the user asks for another section.

### "Set xyz due Friday"

Resolve the date using the current local date and update or add:

```md
	- **Due:** YYYY-MM-DD
```

If the date is ambiguous, ask a concise clarification before editing.

### "Link this task to the roadmap sync"

Add or update:

```md
	- **Relates to:** Roadmap sync
```

Use the existing card title if you can find one. If several cards could match, ask which one.

### "Add a subtask"

The markdown format does not have durable subtasks. Add a new standalone task in `## To Do` and link it to the parent card:

```md
## To Do

- [ ] **Follow up with Alex** #product
	- **Created:** YYYY-MM-DD
	- **Relates to:** Roadmap sync
```

Inherit the parent card's initiatives unless the user says otherwise.

## Placement Rules

- New tasks go at the top of `## To Do` unless the user implies a different section.
- New notes go at the top of `## Notes`.
- New meetings go at the top of `## Meetings`, or `## Notes` if there is no meetings section.
- Completed cards go at the top of `## Done`.
- Preserve all nested bullets when moving a card.
- Keep blank lines between sections readable, but do not reformat the whole file.

## Initiative Rules

Initiatives are lightweight tags used for filtering.

When adding an initiative:

1. Normalize new names to lowercase kebab-case.
2. Add the tag to the card line as a trailing hashtag.
3. Add the initiative name to the setup list if missing.
4. Do not duplicate initiatives in setup.

Unknown initiatives can contain only letters, numbers, underscores, and hyphens. Multi-word initiatives, such as `Client Work`, parse safely only when the exact name already appears in setup.

Example:

```md
- [ ] **Prepare Q3 client plan** #client-work #q3

---
## Setup
- client-work
- q3
```

If the file already has a setup initiative with spaces or capitalization, such as `Client Work`, reuse it exactly:

```md
- [ ] **Prepare Q3 plan** #Client Work
```

If `Client Work` is not already in setup, prefer `#client-work` instead.

## Matching Cards

When a user refers to an existing card:

- Prefer exact case-insensitive title matches.
- Then try obvious partial title matches.
- If multiple cards match, ask a clarification.
- When changing one card, edit the entire card block, including its nested metadata and notes.
- If renaming a card, update any `Relates to` lines that point to the old title.
- Avoid creating duplicate or slug-equivalent titles, such as `Roadmap Sync` and `Roadmap sync`, when linked cards rely on `Relates to`.

## Safety Rules

- Never discard unrelated notes or metadata.
- Never sort or reorganize the whole file unless asked.
- Never convert the file to another markdown style.
- Never add invented facts, dates, initiatives, or relationships.
- Preserve legacy cards if you are not touching them.
- Use ISO dates only.
- Keep the setup block at the end of the file.
- Keep section headings and card lines flush left.
- Use exactly `---` on its own line before `## Setup`.
- Before finishing, reread the edited area and verify the card remains under the intended `##` section.

## Quick Reference

Task:

```md
## To Do

- [ ] **Call Taylor about contract** #client-work
	- **Created:** YYYY-MM-DD
	- **Due:** YYYY-MM-DD
```

Note:

```md
## Notes

- [ ] **Contract constraints** #client-work
	- **Created:** YYYY-MM-DD
	- Pricing needs legal review.
```

Linked task:

```md
## To Do

- [ ] **Send legal the pricing notes** #client-work
	- **Created:** YYYY-MM-DD
	- **Relates to:** Contract constraints
```

Done:

```md
## Done

- [x] **Send legal the pricing notes** #client-work
	- **Created:** YYYY-MM-DD
	- **Relates to:** Contract constraints
```
