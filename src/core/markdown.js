export function sectionId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function meetingSlug(title) {
  return sectionId(title);
}

export function extractMeetingRef(str) {
  const match = str.match(/\s+\^([\w-]+)$/);
  if (match) return { meetingRef: match[1], str: str.slice(0, str.length - match[0].length) };
  return { meetingRef: null, str };
}

export function findMeetingBySlug(workspace, slug) {
  for (const section of workspace.sections) {
    const sectionCards = workspace.tasks[section.id] || [];
    const found = sectionCards.find(card => meetingSlug(card.title) === slug);
    if (found) return found;
  }
  return null;
}

function extractInitiatives(str, knownInitiatives = []) {
  const initiatives = [];
  const knownByLength = [...knownInitiatives].sort((a, b) => b.length - a.length);
  let remaining = str;

  while (remaining) {
    const known = knownByLength.find(name => remaining.endsWith(` #${name}`));
    if (known) {
      initiatives.unshift(known);
      remaining = remaining.slice(0, -known.length - 2);
      continue;
    }

    const match = remaining.match(/\s+#([\w-]+)$/);
    if (!match) break;
    initiatives.unshift(match[1]);
    remaining = remaining.slice(0, remaining.length - match[0].length);
  }

  return { initiatives, str: remaining };
}

function createId() {
  return Date.now() + Math.random();
}

export function parseMarkdown(content) {
  const resultSections = [];
  const resultTasks = {};
  const resultInitiatives = [];

  const hrIdx = content.indexOf('\n---\n');
  const mainContent = hrIdx !== -1 ? content.slice(0, hrIdx) : content;
  const setupContent = hrIdx !== -1 ? content.slice(hrIdx + 5) : '';

  let inSetupSection = false;
  for (const line of setupContent.split('\n')) {
    if (line.match(/^## Setup/)) { inSetupSection = true; continue; }
    if (inSetupSection && line.match(/^## /)) { inSetupSection = false; }
    if (inSetupSection && line.match(/^- /)) {
      resultInitiatives.push(line.replace(/^- /, '').trim());
    }
  }

  let currentSectionId = null;
  let currentCard = null;

  const saveCurrentCard = () => {
    if (currentCard && currentSectionId) resultTasks[currentSectionId].push(currentCard);
    currentCard = null;
  };

  for (const line of mainContent.split('\n')) {
    const headerMatch = line.match(/^## \*{0,2}(.+?)\*{0,2}$/);
    if (headerMatch) {
      saveCurrentCard();

      const sectionName = headerMatch[1].trim();
      currentSectionId = sectionId(sectionName);

      if (!resultTasks[currentSectionId]) {
        resultSections.push({ id: currentSectionId, name: sectionName });
        resultTasks[currentSectionId] = [];
      }
    } else if (currentSectionId && line.match(/^- \[[ xX]\]/)) {
      saveCurrentCard();

      const checked = line.match(/\[[xX]\]/) !== null;
      const rawText = line.replace(/^- \[[ xX]\]\s*/, '');
      const { meetingRef, str: afterRef } = extractMeetingRef(rawText);
      const { str: text, initiatives } = extractInitiatives(afterRef, resultInitiatives);
      let title = text;
      let note = '';

      const boldMatch = text.match(/^\*\*(.+?)\*\*(.*)$/);
      if (boldMatch) {
        title = boldMatch[1];
        note = boldMatch[2].replace(/^\s*-\s*/, '').trim();
      }

      currentCard = {
        id: createId(), title, note, checked, subtasks: [], notes: [], section: currentSectionId,
        initiatives, meetingRef, createdAt: null
      };
    } else if (currentCard && line.match(/^\s+- /) && !line.match(/^\s+- \[[ xX]\]/)) {
      const match = line.match(/^(\s+)- (.*)/);
      if (match) {
        const text = match[2].trim();
        const relatesMatch = text.match(/^(?:\*\*)?relates to:(?:\*\*)?\s*(.+)/i);
        const createdMatch = text.match(/^(?:\*\*)?created:(?:\*\*)?\s*(\d{4}-\d{2}-\d{2})/i);
        const dueMatch = text.match(/^(?:\*\*)?due:(?:\*\*)?\s*(\d{4}-\d{2}-\d{2})/i);
        if (relatesMatch) {
          currentCard.meetingRef = meetingSlug(relatesMatch[1].trim());
        } else if (createdMatch) {
          currentCard.createdAt = createdMatch[1];
        } else if (dueMatch) {
          currentCard.note = dueMatch[1];
        } else {
          const tabCount = (match[1].match(/\t/g) || []).length;
          const level = tabCount > 0
            ? Math.max(0, tabCount - 1)
            : Math.max(0, Math.floor((match[1].length - 2) / 2));
          if (text) currentCard.notes.push({ text, level });
        }
      }
    } else if (currentCard && line.match(/^\s+- \[[ xX]\]/)) {
      const checked = line.match(/\[[xX]\]/) !== null;
      const text = line.replace(/^\s+- \[[ xX]\]\s*/, '');
      currentCard.subtasks.push({ text, checked });
    } else if (currentSectionId && line.match(/^- (?!\[)/)) {
      saveCurrentCard();

      const { str: noteLine, initiatives } = extractInitiatives(line.replace(/^- /, '').trim(), resultInitiatives);
      const noteTitle = noteLine.replace(/^\*\*(.+)\*\*$/, '$1');
      currentCard = {
        id: createId(), title: noteTitle, note: '', checked: false, subtasks: [], notes: [],
        section: currentSectionId, initiatives, meetingRef: null, createdAt: null
      };
    }
  }

  saveCurrentCard();

  return { sections: resultSections, tasks: resultTasks, initiatives: resultInitiatives };
}

function serializeCards(cards, workspace) {
  let md = '';
  cards.forEach(card => {
    const checkbox = card.checked ? '[x]' : '[ ]';
    const tags = (card.initiatives || (card.initiative ? [card.initiative] : []))
      .map(initiative => ` #${initiative}`)
      .join('');
    md += `- ${checkbox} **${card.title}**${tags}\n`;
    if (card.createdAt) md += `\t- **Created:** ${card.createdAt}\n`;
    if (card.note) md += `\t- **Due:** ${card.note}\n`;
    if (card.meetingRef) {
      const relatedCard = findMeetingBySlug(workspace, card.meetingRef);
      const relatedTitle = relatedCard ? relatedCard.title : card.meetingRef;
      md += `\t- **Relates to:** ${relatedTitle}\n`;
    }
    (card.notes || []).forEach(noteValue => {
      const note = typeof noteValue === 'string' ? { text: noteValue, level: 0 } : noteValue;
      md += `${'\t'.repeat(note.level + 1)}- ${note.text}\n`;
    });
    (card.subtasks || []).forEach(subtask => {
      const stCheckbox = subtask.checked ? '[x]' : '[ ]';
      md += `  - ${stCheckbox} ${subtask.text}\n`;
    });
  });
  return md;
}

export function serializeMarkdown(workspace, options = {}) {
  const title = options.title || 'Tasks';
  let md = `# ${title}\n`;

  workspace.sections.forEach(section => {
    md += `\n## ${section.name}\n`;
    md += serializeCards(workspace.tasks[section.id] || [], workspace);
  });

  if (workspace.initiatives.length > 0) {
    md += '\n---\n## Setup\n';
    workspace.initiatives.forEach(init => { md += `- ${init}\n`; });
  }

  return md.trimEnd() + '\n';
}

export function serializeFilteredMarkdown(workspace, visibleIds) {
  let md = '';
  workspace.sections.forEach(section => {
    const sectionCards = (workspace.tasks[section.id] || []).filter(card => visibleIds.has(card.id));
    if (sectionCards.length === 0) return;
    md += `## ${section.name}\n`;
    md += serializeCards(sectionCards, workspace);
    md += '\n';
  });

  return md.trimEnd() + '\n';
}
