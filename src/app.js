import { showTransientStatus } from "./web/status.js";

const statusEl = document.getElementById('status');
const filePathEl = document.getElementById('filePath');

function showStatus(msg) {
  showTransientStatus(statusEl, msg);
}

const taskViewToggle = document.getElementById('taskViewToggle');
const newTaskBtn = document.getElementById('newTaskBtn');
const openTaskBtn = document.getElementById('openTaskBtn');
const saveBtn = document.getElementById('saveBtn');
const setupBtn = document.getElementById('setupBtn');
const filterBar = document.getElementById('filterBar');
const filterSearchInput = document.getElementById('filterSearchInput');
const filterPills = document.getElementById('filterPills');
const copyFilteredBtn = document.getElementById('copyFilteredBtn');
let markdownCore = null;
let fileStorage = null;
let fileActions = null;
let noteEditorWeb = null;
let visibleCardsWeb = null;
const markdownCoreReady = Promise.all([
    import('./core/markdown.js'),
    import('./core/workspace.js'),
    import('./core/utils.js'),
    import('./core/filter.js'),
    import('./core/export.js'),
    import('./core/text.js'),
    import('./web/file-storage.js'),
    import('./web/file-actions.js'),
    import('./web/note-editor.js'),
    import('./web/visible-cards.js')
  ])
  .then(([markdown, workspace, utils, filter, exportCore, text, storage, actions, noteEditor, visibleCards]) => {
    markdownCore = { ...markdown, ...workspace, ...utils, ...filter, ...exportCore, ...text };
    fileStorage = storage;
    fileActions = actions;
    noteEditorWeb = noteEditor;
    visibleCardsWeb = visibleCards;
    return markdownCore;
  })
  .catch(error => {
    showStatus('Failed to load app core');
    throw error;
  });

setupBtn.addEventListener('click', () => openSetupModal());

copyFilteredBtn.addEventListener('click', async () => {
  await markdownCoreReady;
  const md = toFilteredMarkdown();
  await navigator.clipboard.writeText(md);
  const svg = copyFilteredBtn.querySelector('svg');
  const original = svg.outerHTML;
  svg.outerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);"><polyline points="20 6 9 17 4 12"/></svg>';
  setTimeout(() => { copyFilteredBtn.querySelector('svg').outerHTML = original; }, 1500);
});

filterSearchInput.addEventListener('input', () => {
  globalSearch = filterSearchInput.value;
  applyGlobalFilter();
});

filterSearchInput.addEventListener('focus', () => {
  renderFilterPills();
});

function renderFilterPills() {
  filterPills.innerHTML = '';
  if (initiatives.length === 0) return;

  const nonePill = document.createElement('span');
  nonePill.className = 'filter-pill' + (globalInitFilter === '__none__' ? ' active' : '');
  nonePill.style.cssText = 'background: var(--bg-secondary); color: var(--text-muted); border-color: var(--border);';
  nonePill.textContent = 'No tag';
  nonePill.addEventListener('click', (e) => {
    e.stopPropagation();
    globalInitFilter = (globalInitFilter === '__none__') ? null : '__none__';
    renderFilterPills();
    applyGlobalFilter();
  });
  filterPills.appendChild(nonePill);

  initiatives.forEach(init => {
    const color = getInitiativeColor(init);
    const pill = document.createElement('span');
    pill.className = 'filter-pill' + (globalInitFilter === init ? ' active' : '');
    pill.style.cssText = `background: ${color}22; color: ${color}; border-color: ${color}66;`;
    pill.textContent = init;
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      globalInitFilter = (globalInitFilter === init) ? null : init;
      renderFilterPills();
      applyGlobalFilter();
    });
    filterPills.appendChild(pill);
  });
}

// ============================================================
// ===== TASKS FUNCTIONALITY =====
// ============================================================

let taskFileHandle = null;
let taskFileName = '';
let taskFileIsDownloadFallback = false;
let sections = [];
let tasks = {};
let initiatives = [];
let hasChanges = false;
let currentView = 'board';
let quickAddSection = null;
let globalSearch = '';
let globalInitFilter = null;

const supportsFileSystemAccess = 'showOpenFilePicker' in window;
const supportsSaveFilePicker = 'showSaveFilePicker' in window;
const reopenTaskBtn = document.getElementById('reopenTaskBtn');
const browserSupportHint = document.getElementById('browserSupportHint');

if (!supportsFileSystemAccess && browserSupportHint) {
  browserSupportHint.textContent = 'This browser can read markdown files, but saves and new files will download markdown replacements. Chrome and Edge can save directly back to local files.';
}

async function rememberHandle(key, handle) {
  await markdownCoreReady;
  return fileStorage.rememberHandle(key, handle, { scope: window });
}

async function getRememberedHandle(key) {
  await markdownCoreReady;
  return fileStorage.getRememberedHandle(key, { scope: window });
}

async function hasRememberedTaskFile() {
  await markdownCoreReady;
  return fileStorage.hasRememberedHandle(fileStorage.lastTaskFileKey, { scope: window });
}

async function requestReadWritePermission(handle) {
  await markdownCoreReady;
  return fileStorage.requestReadWritePermission(handle);
}

async function updateReopenButton() {
  if (!reopenTaskBtn || !supportsFileSystemAccess) return;
  reopenTaskBtn.style.display = await hasRememberedTaskFile() ? 'inline-flex' : 'none';
}

async function loadTaskFileFromHandle(handle) {
  await markdownCoreReady;
  taskFileHandle = handle;
  taskFileIsDownloadFallback = false;
  const file = await taskFileHandle.getFile();
  const content = await file.text();
  lastModified = file.lastModified;
  const result = parseTaskMarkdown(content);
  sections = result.sections;
  tasks = result.tasks;
  initiatives = result.initiatives;
  switchTaskView('board');
  startWatching();
  taskFileName = file.name;
  filePathEl.textContent = file.name;
  filterBar.style.display = 'flex';
  renderFilterPills();
  setupBtn.style.display = 'inline-flex';
  saveBtn.disabled = true;
  showStatus('Loaded ' + file.name);
}

async function loadTaskFileFromText(fileName, content) {
  await markdownCoreReady;
  taskFileHandle = null;
  taskFileIsDownloadFallback = true;
  stopWatching();
  const result = parseTaskMarkdown(content);
  sections = result.sections;
  tasks = result.tasks;
  initiatives = result.initiatives;
  switchTaskView('board');
  taskFileName = fileName;
  filePathEl.textContent = fileName + ' (download saves)';
  filterBar.style.display = 'flex';
  renderFilterPills();
  setupBtn.style.display = 'inline-flex';
  saveBtn.disabled = false;
  showStatus('Loaded ' + fileName);
}

async function downloadTaskMarkdown() {
  await markdownCoreReady;
  fileActions.downloadTextFile(taskFileName || markdownCore.defaultFileName, toMarkdown());
  hasChanges = false;
  saveBtn.disabled = true;
  showStatus('Downloaded markdown');
}

async function downloadStarterMarkdown() {
  await markdownCoreReady;
  const starterMarkdown = markdownCore.createStarterMarkdown();
  fileActions.downloadTextFile(markdownCore.defaultFileName, starterMarkdown);
  loadTaskFileFromText(markdownCore.defaultFileName, starterMarkdown);
  showStatus('Downloaded starter markdown');
}

function formatDueDate(dateStr) {
  return markdownCore.formatDueDate(dateStr);
}

function isOverdue(dateStr) {
  return markdownCore.isOverdue(dateStr);
}

function getInitiativeColor(name) {
  return markdownCore.getInitiativeColor(initiatives, name);
}

// ===== RICH TEXT UTILITIES =====

function inlineMdToHtml(text) {
  return markdownCore.inlineMarkdownToHtml(text);
}

function noteEditorToNotes(editable) {
  return noteEditorWeb.noteEditorToNotes(editable);
}

function getCurrentNoteLine(editable) {
  return noteEditorWeb.getCurrentNoteLine(editable);
}

function detectAndApplyMarkdown(editable) {
  noteEditorWeb.applyInlineMarkdownShortcut(editable);
}

function makeNoteEditor(item, large) {
  const editable = document.createElement('div');
  editable.contentEditable = 'true';
  editable.className = large ? 'note-editor-large' : 'note-editor-inline';

  editable.innerHTML = noteEditorWeb.notesToEditorHtml(item.notes);

  editable.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'b') { e.preventDefault(); document.execCommand('bold', false, null); return; }
    if (mod && e.key === 'i') { e.preventDefault(); document.execCommand('italic', false, null); return; }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const line = getCurrentNoteLine(editable);
      const level = line ? parseInt(line.dataset.level || '0') : 0;
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const newLine = document.createElement('div');
      newLine.className = 'note-line';
      newLine.dataset.level = level;
      newLine.style.setProperty('--level', level);
      if (line) {
        const afterRange = range.cloneRange();
        afterRange.setEnd(line, line.childNodes.length);
        const fragment = afterRange.extractContents();
        if (!range.collapsed) range.deleteContents();
        newLine.appendChild(fragment);
        if (newLine.textContent === '') newLine.innerHTML = '<br>';
        line.after(newLine);
      } else {
        newLine.innerHTML = '<br>';
        editable.appendChild(newLine);
      }
      const newRange = document.createRange();
      const first = newLine.firstChild;
      if (first && first.nodeType === Node.TEXT_NODE) newRange.setStart(first, 0);
      else newRange.setStart(newLine, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      newLine.scrollIntoView({ block: 'nearest' });
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const allLines = [...editable.querySelectorAll('.note-line')];
      const selectedLines = range.collapsed
        ? allLines.filter(line => line === getCurrentNoteLine(editable))
        : allLines.filter(line => range.intersectsNode(line));
      selectedLines.forEach(line => {
        const level = parseInt(line.dataset.level || '0');
        const newLevel = e.shiftKey ? Math.max(0, level - 1) : Math.min(4, level + 1);
        line.dataset.level = newLevel;
        line.style.setProperty('--level', newLevel);
      });
      return;
    }
  });

  editable.addEventListener('paste', (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });

  editable.addEventListener('input', () => {
    detectAndApplyMarkdown(editable);
    markdownCore.setCardNotes(item, noteEditorToNotes(editable));
    markChanged();
  });

  return editable;
}

function autoSizeExpandedNoteEditor(editor, body) {
  let frame = null;

  const keepCaretVisible = () => {
    if (document.activeElement !== editor) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer)) return;

    const line = getCurrentNoteLine(editor);
    const targetRect = line?.getBoundingClientRect() || range.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const inset = 8;

    if (targetRect.bottom > editorRect.bottom - inset) {
      editor.scrollTop += targetRect.bottom - editorRect.bottom + inset;
    } else if (targetRect.top < editorRect.top + inset) {
      editor.scrollTop -= editorRect.top - targetRect.top + inset;
    }
  };

  const resize = () => {
    frame = null;
    const previousScrollTop = editor.scrollTop;
    editor.style.height = 'auto';
    editor.style.overflowY = 'hidden';

    const bodyStyle = getComputedStyle(body);
    const editorStyle = getComputedStyle(editor);
    const children = [...body.children].filter(child => child.offsetParent !== null);
    const gap = parseFloat(bodyStyle.rowGap || bodyStyle.gap) || 0;
    const bodyPadding = (parseFloat(bodyStyle.paddingTop) || 0) + (parseFloat(bodyStyle.paddingBottom) || 0);
    const reservedHeight = children
      .filter(child => child !== editor)
      .reduce((total, child) => total + child.offsetHeight, 0);
    const availableHeight = Math.max(
      60,
      body.clientHeight - bodyPadding - reservedHeight - gap * Math.max(0, children.length - 1)
    );
    const editorBorders = (parseFloat(editorStyle.borderTopWidth) || 0) + (parseFloat(editorStyle.borderBottomWidth) || 0);
    const contentHeight = Math.max(60, editor.scrollHeight + editorBorders);
    const nextHeight = Math.min(contentHeight, availableHeight);

    editor.style.height = `${nextHeight}px`;
    editor.style.overflowY = contentHeight > availableHeight ? 'auto' : 'hidden';
    editor.scrollTop = Math.min(previousScrollTop, Math.max(0, editor.scrollHeight - editor.clientHeight));
    keepCaretVisible();
  };

  const scheduleResize = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(resize);
  };

  const resizeObserver = new ResizeObserver(scheduleResize);
  resizeObserver.observe(body);
  const mutationObserver = new MutationObserver(scheduleResize);
  mutationObserver.observe(body, { childList: true, subtree: true });
  editor.addEventListener('input', scheduleResize);
  window.addEventListener('resize', scheduleResize);
  scheduleResize();

  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    editor.removeEventListener('input', scheduleResize);
    window.removeEventListener('resize', scheduleResize);
  };
}

const board = document.getElementById('board');
const listView = document.getElementById('listView');
const listViewBtn = document.getElementById('listViewBtn');
const boardViewBtn = document.getElementById('boardViewBtn');

function meetingSlug(title) {
  return markdownCore.meetingSlug(title);
}

function extractMeetingRef(str) {
  return markdownCore.extractMeetingRef(str);
}

function findMeetingBySlug(slug) {
  return markdownCore.findMeetingBySlug({ sections, tasks, initiatives }, slug);
}

function getWorkspace() {
  return { sections, tasks, initiatives };
}

function createCardForSection(title, sectionIdValue) {
  return markdownCore.createCardForSection(title, sectionIdValue);
}

function applyCardFilterDataset(el, card) {
  const meetingTitle = card.meetingRef ? (findMeetingBySlug(card.meetingRef)?.title || card.meetingRef) : '';
  const filterData = markdownCore.getCardFilterData(card, { meetingTitle });
  el.dataset.searchText = filterData.searchText;
  el.dataset.initiatives = JSON.stringify(filterData.initiatives);
}

function getLinkedTasks(slug) {
  return markdownCore.getLinkedTasks(getWorkspace(), slug);
}

function isNotesPreviewCollapsible(notes) {
  return markdownCore.isNotesPreviewCollapsible(notes);
}

function checkAutoMoveToDone(task) {
  markdownCore.moveCheckedTaskToDone(getWorkspace(), task);
}

function parseTaskMarkdown(content) {
  return markdownCore.parseMarkdown(content);
}

function toMarkdown() {
  return markdownCore.serializeMarkdown(getWorkspace());
}

function toFilteredMarkdown() {
  const visibleIds = visibleCardsWeb.collectVisibleCardIds({ currentView, board, listView });
  return markdownCore.serializeFilteredMarkdown(getWorkspace(), visibleIds);
}

function getInitiativeUsageCount(name) {
  return markdownCore.getInitiativeUsageCount(getWorkspace(), name);
}

function renameInitiative(oldName, newName) {
  const normalizedName = markdownCore.renameInitiative(getWorkspace(), oldName, newName);
  if (!normalizedName) return null;
  if (globalInitFilter === oldName) globalInitFilter = normalizedName;
  markChanged();
  return normalizedName;
}

function deleteInitiative(name) {
  markdownCore.deleteInitiative(getWorkspace(), name);
  if (globalInitFilter === name) globalInitFilter = null;
  markChanged();
}

function openSetupModal() {
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalFooter = modalOverlay.querySelector('.modal-footer');

  modalTitle.textContent = 'Setup';
  modalFooter.style.display = 'none';
  modalBody.innerHTML = '';

  const renderInitiatives = () => {
    modalBody.innerHTML = '';

    const section = document.createElement('div');
    section.className = 'setup-section';
    const label = document.createElement('div');
    label.className = 'setup-section-label';
    label.textContent = 'Initiatives';
    section.appendChild(label);

    initiatives.forEach((init, i) => {
      const row = document.createElement('div');
      row.className = 'init-manage-row';

      const dot = document.createElement('span');
      dot.className = 'initiative-option-dot';
      dot.style.background = getInitiativeColor(init);
      row.appendChild(dot);

      const name = document.createElement('span');
      name.className = 'init-manage-name';
      name.textContent = init;
      name.addEventListener('click', () => {
        const editWrap = document.createElement('div');
        editWrap.className = 'init-manage-edit-wrap';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = init;
        input.className = 'init-manage-edit';
        const preview = document.createElement('div');
        preview.className = 'initiative-slug-preview';
        const updatePreview = () => {
          const normalized = markdownCore.normalizeInitiativeName(input.value);
          preview.textContent = normalized && normalized !== input.value.trim()
            ? `Will be saved as ${normalized}`
            : '';
        };
        input.addEventListener('input', updatePreview);
        editWrap.append(input, preview);
        name.replaceWith(editWrap);
        input.focus();
        input.select();
        let saved = false;
        const save = () => {
          if (saved) return;
          saved = true;
          const val = input.value.trim();
          if (val && val !== init) {
            renameInitiative(init, val);
          }
          renderInitiatives();
          renderTasks();
        };
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          else if (e.key === 'Escape') { saved = true; renderInitiatives(); }
        });
        input.addEventListener('blur', save);
      });
      row.appendChild(name);

      const count = document.createElement('span');
      count.className = 'init-manage-count';
      count.textContent = getInitiativeUsageCount(init);
      row.appendChild(count);

      const del = document.createElement('button');
      del.className = 'init-manage-delete';
      del.innerHTML = '&times;';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteInitiative(init);
        renderInitiatives();
        renderTasks();
      });
      row.appendChild(del);

      section.appendChild(row);
    });

    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.className = 'init-manage-input';
    addInput.placeholder = '+ Add initiative...';
    const addPreview = document.createElement('div');
    addPreview.className = 'initiative-slug-preview';
    const updatePreview = () => {
      const normalized = markdownCore.normalizeInitiativeName(addInput.value);
      addPreview.textContent = normalized && normalized !== addInput.value.trim()
        ? `Will be saved as ${normalized}`
        : '';
    };
    addInput.addEventListener('input', updatePreview);
    addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = addInput.value.trim();
        if (markdownCore.addInitiative(getWorkspace(), val)) {
          markChanged();
          renderInitiatives();
          renderTasks();
          setTimeout(() => {
            const newInput = modalBody.querySelector('.init-manage-input');
            if (newInput) newInput.focus();
          }, 10);
        }
      }
    });
    section.appendChild(addInput);
    section.appendChild(addPreview);

    modalBody.appendChild(section);
  };

  renderInitiatives();
  modalOverlay.classList.add('visible');
}

function cardInitiatives(item) {
  return markdownCore.ensureCardInitiatives(item);
}

function createInitiativePill(name, options = {}) {
  const pill = document.createElement(options.removable ? 'button' : 'span');
  if (options.removable) pill.type = 'button';
  const color = getInitiativeColor(name);
  pill.className = 'initiative-pill';
  pill.style.cssText = `background: ${color}22; color: ${color}; border-color: ${color}66;`;
  pill.appendChild(document.createTextNode(name));
  if (options.removable) {
    const remove = document.createElement('span');
    remove.className = 'initiative-pill-remove';
    remove.textContent = '×';
    pill.appendChild(remove);
    pill.setAttribute('aria-label', `Remove ${name}`);
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      options.onRemove?.();
    });
  }
  return pill;
}

function renderInitiativePills(container, item) {
  container.innerHTML = '';
  cardInitiatives(item).forEach(name => container.appendChild(createInitiativePill(name)));
  if (initiatives.length > 0) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'initiative-pill initiative-pill-empty';
    add.textContent = cardInitiatives(item).length > 0 ? '+' : '+ initiative';
    add.style.display = 'inline-flex';
    container.appendChild(add);
  }
}

function updateInitiativePresentation(container, item) {
  renderInitiativePills(container, item);
  const card = container.closest('.task-card, .list-item');
  if (!card) return;
  applyCardFilterDataset(card, item);
  const attached = cardInitiatives(item);
  if (attached.length === 1) card.style.borderLeft = `3px solid ${getInitiativeColor(attached[0])}`;
  else if (attached.length > 1) card.style.borderLeft = '3px solid var(--border)';
  else card.style.borderLeft = '';
  applyGlobalFilter();
}

function buildInitiativeDropdown(anchor, item, onChange) {
  document.querySelector('.initiative-dropdown')?.remove();
  if (initiatives.length === 0) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'initiative-dropdown';
  let currentMatches = [];
  let highlightedIndex = 0;

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Filter...';
  searchInput.className = 'initiative-search';
  searchInput.addEventListener('mousedown', e => e.stopPropagation());
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      dropdown.remove();
      e.preventDefault();
      e.stopPropagation();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, currentMatches.length - 1);
      renderOptions(searchInput.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
      renderOptions(searchInput.value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (currentMatches[highlightedIndex]) toggle(currentMatches[highlightedIndex]);
    } else if (e.key === 'Backspace' && !searchInput.value && cardInitiatives(item).length > 0) {
      markdownCore.toggleCardInitiative(item, cardInitiatives(item).at(-1));
      onChange();
      renderOptions('');
    }
  });
  dropdown.appendChild(searchInput);

  const optionsEl = document.createElement('div');
  dropdown.appendChild(optionsEl);

  const renderOptions = (query) => {
    optionsEl.innerHTML = '';
    const q = query.toLowerCase();
    currentMatches = initiatives.filter(init => init.toLowerCase().includes(q));
    if (highlightedIndex >= currentMatches.length) highlightedIndex = Math.max(0, currentMatches.length - 1);
    currentMatches.forEach((init, idx) => {
      const color = getInitiativeColor(init);
      const opt = document.createElement('button');
      opt.type = 'button';
      const selected = cardInitiatives(item).includes(init);
      opt.className = 'initiative-option' + (idx === highlightedIndex ? ' highlighted' : '') + (selected ? ' selected' : '');
      const dot = document.createElement('span');
      dot.className = 'initiative-option-dot';
      dot.style.background = color;
      const label = document.createElement('span');
      label.textContent = init;
      const state = document.createElement('span');
      state.className = 'initiative-option-state';
      state.textContent = selected ? 'Selected' : 'Add';
      opt.appendChild(dot);
      opt.appendChild(label);
      opt.appendChild(state);
      opt.addEventListener('mouseenter', () => { highlightedIndex = idx; });
      opt.addEventListener('click', (e) => { e.stopPropagation(); toggle(init); });
      optionsEl.appendChild(opt);
    });
  };

  const toggle = (init) => {
    markdownCore.toggleCardInitiative(item, init);
    onChange();
    searchInput.value = '';
    highlightedIndex = 0;
    renderOptions('');
    searchInput.focus();
  };

  renderOptions('');
  searchInput.addEventListener('input', () => { highlightedIndex = 0; renderOptions(searchInput.value); });

  document.body.appendChild(dropdown);
  const rect = anchor.getBoundingClientRect();
  const dropdownHeight = dropdown.offsetHeight;
  const below = rect.bottom + 4;
  const top = below + dropdownHeight <= window.innerHeight - 8
    ? below
    : Math.max(8, rect.top - dropdownHeight - 4);
  dropdown.style.top = top + 'px';
  dropdown.style.left = Math.min(rect.left, window.innerWidth - dropdown.offsetWidth - 8) + 'px';

  setTimeout(() => searchInput.focus(), 0);
  setTimeout(() => {
    const close = (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', close, true);
      }
    };
    document.addEventListener('click', close, true);
  }, 0);
}

function showInitiativeDropdown(anchor, item) {
  buildInitiativeDropdown(anchor, item, () => {
    markChanged();
    updateInitiativePresentation(anchor, item);
  });
}

function createInitiativePills(item) {
  const container = document.createElement('div');
  container.className = 'initiative-pills';
  renderInitiativePills(container, item);
  container.addEventListener('click', (e) => {
    e.stopPropagation();
    showInitiativeDropdown(container, item);
  });
  return container;
}

let cardMetadataDismiss = null;
let cardMetadataTrigger = null;

function closeCardMetadataPopover({ restoreFocus = false } = {}) {
  document.querySelector('.card-metadata-popover')?.remove();
  if (cardMetadataDismiss) {
    document.removeEventListener('click', cardMetadataDismiss, true);
    cardMetadataDismiss = null;
  }
  if (restoreFocus) cardMetadataTrigger?.focus();
  cardMetadataTrigger = null;
}

function positionCardMetadataPopover(popover, anchor) {
  document.body.appendChild(popover);
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(300, window.innerWidth - 24);
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  popover.style.top = `${Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - popover.offsetHeight - 12))}px`;
}

function showDueDatePopover(anchor, item, onChange = null) {
  closeCardMetadataPopover();
  cardMetadataTrigger = anchor;

  const popover = document.createElement('div');
  popover.className = 'card-metadata-popover';

  const heading = document.createElement('div');
  heading.className = 'card-metadata-popover-heading';
  const headingText = document.createElement('span');
  headingText.textContent = item.note ? 'Change due date' : 'Set due date';
  const escapeHint = document.createElement('span');
  escapeHint.className = 'card-metadata-escape';
  escapeHint.textContent = 'Esc';
  heading.appendChild(headingText);
  heading.appendChild(escapeHint);
  popover.appendChild(heading);

  const input = document.createElement('input');
  input.type = 'date';
  input.value = item.note || '';
  input.className = 'card-metadata-date-input';
  popover.appendChild(input);

  const saveDate = value => {
    markdownCore.setCardDueDate(item, value);
    markChanged();
    closeCardMetadataPopover();
    onChange?.();
  };

  input.addEventListener('change', () => saveDate(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeCardMetadataPopover({ restoreFocus: true });
    }
  });

  const quickActions = document.createElement('div');
  quickActions.className = 'card-metadata-quick-actions';
  [
    ['Today', 0],
    ['Tomorrow', 1],
    ['Next week', 7]
  ].forEach(([label, days]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      saveDate(markdownCore.localDateString(date));
    });
    quickActions.appendChild(button);
  });
  popover.appendChild(quickActions);

  const footer = document.createElement('div');
  footer.className = 'card-metadata-popover-footer';
  if (item.note) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'card-metadata-clear';
    clear.textContent = 'Clear due date';
    clear.addEventListener('click', () => saveDate(''));
    footer.appendChild(clear);
  }
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'card-metadata-done';
  done.textContent = 'Done';
  done.addEventListener('click', () => closeCardMetadataPopover({ restoreFocus: true }));
  footer.appendChild(done);
  popover.appendChild(footer);

  popover.addEventListener('click', e => e.stopPropagation());
  positionCardMetadataPopover(popover, anchor);
  input.focus();
  input.showPicker?.();

  setTimeout(() => {
    cardMetadataDismiss = e => {
      if (!popover.contains(e.target) && e.target !== anchor) {
        closeCardMetadataPopover();
      }
    };
    document.addEventListener('click', cardMetadataDismiss, true);
  }, 0);
}

function showParentPicker(anchor, item, onChange = null) {
  closeCardMetadataPopover();
  cardMetadataTrigger = anchor;

  const popover = document.createElement('div');
  popover.className = 'card-metadata-popover';
  const heading = document.createElement('div');
  heading.className = 'card-metadata-popover-heading';
  const headingText = document.createElement('span');
  headingText.textContent = item.meetingRef ? 'Change parent' : 'Add parent';
  const escapeHint = document.createElement('span');
  escapeHint.className = 'card-metadata-escape';
  escapeHint.textContent = 'Esc';
  heading.appendChild(headingText);
  heading.appendChild(escapeHint);
  popover.appendChild(heading);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'card-metadata-search-input';
  search.placeholder = 'Search cards...';
  popover.appendChild(search);

  const results = document.createElement('div');
  results.className = 'card-metadata-results';
  popover.appendChild(results);

  const candidates = sections.flatMap(section => (tasks[section.id] || []).map(card => ({
    card,
    sectionName: section.name
  }))).filter(candidate => candidate.card !== item);
  let highlightedIndex = Math.max(0, candidates.findIndex(candidate => meetingSlug(candidate.card.title) === item.meetingRef));
  let visibleCandidates = [];

  const chooseParent = parent => {
    markdownCore.setCardParent(item, parent?.title || '');
    markChanged();
    closeCardMetadataPopover();
    onChange?.();
  };

  const renderResults = () => {
    const query = search.value.trim().toLowerCase();
    visibleCandidates = candidates.filter(({ card }) => !query || card.title.toLowerCase().includes(query));
    highlightedIndex = Math.min(highlightedIndex, Math.max(0, visibleCandidates.length - 1));
    results.innerHTML = '';
    visibleCandidates.forEach(({ card, sectionName }, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `card-metadata-result${index === highlightedIndex ? ' highlighted' : ''}`;
      const title = document.createElement('span');
      title.textContent = card.title;
      const section = document.createElement('small');
      section.textContent = sectionName;
      button.appendChild(title);
      button.appendChild(section);
      button.addEventListener('click', () => chooseParent(card));
      results.appendChild(button);
    });
    if (visibleCandidates.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'card-metadata-empty';
      empty.textContent = 'No matching cards';
      results.appendChild(empty);
    }
  };

  search.addEventListener('input', () => { highlightedIndex = 0; renderResults(); });
  search.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && visibleCandidates.length > 0) {
      e.preventDefault();
      highlightedIndex = (highlightedIndex + 1) % visibleCandidates.length;
      renderResults();
    } else if (e.key === 'ArrowUp' && visibleCandidates.length > 0) {
      e.preventDefault();
      highlightedIndex = (highlightedIndex - 1 + visibleCandidates.length) % visibleCandidates.length;
      renderResults();
    } else if (e.key === 'Enter' && visibleCandidates[highlightedIndex]) {
      e.preventDefault();
      chooseParent(visibleCandidates[highlightedIndex].card);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      closeCardMetadataPopover({ restoreFocus: true });
    }
  });

  const footer = document.createElement('div');
  footer.className = 'card-metadata-popover-footer';
  if (item.meetingRef) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'card-metadata-clear';
    remove.textContent = 'Remove parent';
    remove.addEventListener('click', () => chooseParent(null));
    footer.appendChild(remove);
  }
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'card-metadata-done';
  done.textContent = 'Done';
  done.addEventListener('click', () => closeCardMetadataPopover({ restoreFocus: true }));
  footer.appendChild(done);
  popover.appendChild(footer);

  renderResults();
  popover.addEventListener('click', e => e.stopPropagation());
  positionCardMetadataPopover(popover, anchor);
  search.focus();

  setTimeout(() => {
    cardMetadataDismiss = e => {
      if (!popover.contains(e.target) && e.target !== anchor) {
        closeCardMetadataPopover();
      }
    };
    document.addEventListener('click', cardMetadataDismiss, true);
  }, 0);
}

function createCompactMetadata(item, onChange = renderTasks) {
  const row = document.createElement('div');
  row.className = 'card-primary-meta';

  const due = document.createElement('button');
  due.type = 'button';
  due.className = `card-due-control${item.note ? '' : ' empty'}${item.note && isOverdue(item.note) ? ' overdue' : ''}`;
  due.textContent = item.note ? formatDueDate(item.note) : '+ Due';
  due.addEventListener('click', e => {
    e.stopPropagation();
    showDueDatePopover(due, item, onChange);
  });
  row.appendChild(due);

  if (item.meetingRef) {
    const parent = findMeetingBySlug(item.meetingRef);
    const divider = document.createElement('span');
    divider.className = 'card-primary-meta-divider';
    row.appendChild(divider);
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'meeting-ref-badge';
    badge.textContent = parent ? parent.title : item.meetingRef;
    badge.title = parent ? parent.title : item.meetingRef;
    badge.addEventListener('click', e => {
      e.stopPropagation();
      if (parent) openCardExpanded(parent);
    });
    row.appendChild(badge);
  }

  return row;
}

function openCardExpanded(item, focusTarget = null) {
  document.querySelector('.card-expand-overlay')?.remove();
  document.querySelector('.initiative-dropdown')?.remove();
  closeCardMetadataPopover();

  const overlay = document.createElement('div');
  overlay.className = 'card-expand-overlay';

  let titleInput;
  let noteEditor = null;
  let cleanupNoteEditorSizing = null;

  const close = () => {
    // Sync note editor state before removing overlay (Tab/Enter don't fire input events)
    if (noteEditor) {
      markdownCore.setCardNotes(item, noteEditorToNotes(noteEditor));
      markChanged();
    }
    const v = titleInput?.value.trim();
    if (v && v !== item.title) {
      if (markdownCore.setWorkspaceCardTitle(getWorkspace(), item, v)) markChanged();
    }
    cleanupNoteEditorSizing?.();
    document.querySelector('.initiative-dropdown')?.remove();
    overlay.remove();
    document.removeEventListener('keydown', escHandler);
    renderTasks();
  };

  const escHandler = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', escHandler);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const panel = document.createElement('div');
  panel.className = 'card-expand-panel';
  panel.addEventListener('click', (e) => e.stopPropagation());

  // ── Header ──
  const header = document.createElement('div');
  header.className = 'card-expand-header';

  const titleArea = document.createElement('div');
  titleArea.className = 'card-expand-title-area';

  const checkbox = document.createElement('span');
  checkbox.className = `checkbox ${item.checked ? 'checked' : ''}`;
  checkbox.style.flexShrink = '0';
  checkbox.addEventListener('click', () => {
    markdownCore.toggleCardChecked(item);
    checkbox.classList.toggle('checked', item.checked);
    checkAutoMoveToDone(item);
    markChanged();
  });
  titleArea.appendChild(checkbox);

  titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.value = item.title;
  titleInput.className = 'card-expand-title-input';
  titleArea.appendChild(titleInput);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'card-expand-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', close);

  header.appendChild(titleArea);
  header.appendChild(closeBtn);

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'card-expand-body';

  const properties = document.createElement('div');
  properties.className = 'card-expand-properties';

  const dueProperty = document.createElement('button');
  dueProperty.type = 'button';
  dueProperty.className = 'card-expand-property';
  const renderDueProperty = () => {
    dueProperty.innerHTML = '';
    const content = document.createElement('span');
    content.className = 'card-expand-property-content';
    const label = document.createElement('span');
    label.className = 'card-expand-property-label';
    label.textContent = 'Due';
    const value = document.createElement('span');
    value.className = `card-expand-property-value${item.note && isOverdue(item.note) ? ' overdue' : ''}${item.note ? '' : ' empty'}`;
    value.textContent = item.note ? formatDueDate(item.note) : 'None';
    content.appendChild(label);
    content.appendChild(value);
    dueProperty.appendChild(content);
  };
  dueProperty.addEventListener('click', e => {
    e.stopPropagation();
    showDueDatePopover(dueProperty, item, () => {
      renderDueProperty();
      renderTasks();
    });
  });
  renderDueProperty();
  properties.appendChild(dueProperty);

  const parentProperty = document.createElement('button');
  parentProperty.type = 'button';
  parentProperty.className = 'card-expand-property';
  const renderParentProperty = () => {
    parentProperty.innerHTML = '';
    const content = document.createElement('span');
    content.className = 'card-expand-property-content';
    const label = document.createElement('span');
    label.className = 'card-expand-property-label';
    label.textContent = 'Parent';
    const value = document.createElement('span');
    value.className = `card-expand-property-value${item.meetingRef ? '' : ' empty'}`;
    const parent = item.meetingRef ? findMeetingBySlug(item.meetingRef) : null;
    value.textContent = item.meetingRef ? (parent?.title || item.meetingRef) : 'None';
    content.appendChild(label);
    content.appendChild(value);
    parentProperty.appendChild(content);
  };
  parentProperty.addEventListener('click', e => {
    e.stopPropagation();
    showParentPicker(parentProperty, item, () => {
      renderParentProperty();
      renderTasks();
    });
  });
  renderParentProperty();
  properties.appendChild(parentProperty);

  // Every card shares the same editing surface.
    const notesLabel = document.createElement('div');
    notesLabel.className = 'card-expand-label';
    notesLabel.textContent = 'Notes';
    body.appendChild(notesLabel);

    if (!item.notes) item.notes = [];
    const taskNoteEditor = makeNoteEditor(item, false);
    noteEditor = taskNoteEditor;
    taskNoteEditor.style.minHeight = '60px';
    taskNoteEditor.style.marginTop = '0';
    taskNoteEditor.style.border = '1px solid var(--border)';
    taskNoteEditor.style.borderRadius = '8px';
    body.appendChild(taskNoteEditor);

    const linkedSection = document.createElement('div');
    linkedSection.className = 'linked-tasks-section';
    const linkedLabel = document.createElement('div');
    linkedLabel.className = 'linked-tasks-label';
    linkedLabel.textContent = 'Linked Cards';
    linkedSection.appendChild(linkedLabel);

    const linkedList = document.createElement('div');
    linkedList.className = 'linked-tasks-list';
    linkedSection.appendChild(linkedList);

    const slug = meetingSlug(item.title);
    let insertIdx = 0;
    const renderLinkedCards = () => {
      linkedList.innerHTML = '';
      getLinkedTasks(slug).forEach(linkedCard => {
        const row = document.createElement('div');
        row.className = 'linked-task-row';
        const linkedCheckbox = document.createElement('span');
        linkedCheckbox.className = `checkbox ${linkedCard.checked ? 'checked' : ''}`;
        linkedCheckbox.style.cssText = 'width: 18px; height: 18px; min-width: 18px; flex-shrink: 0;';
        const linkedTitle = document.createElement('span');
        linkedTitle.className = `linked-task-title ${linkedCard.checked ? 'checked' : ''}`;
        linkedTitle.textContent = linkedCard.title;
        linkedTitle.addEventListener('click', () => openCardExpanded(linkedCard));
        linkedCheckbox.addEventListener('click', () => {
          markdownCore.toggleCardChecked(linkedCard);
          checkAutoMoveToDone(linkedCard);
          markChanged();
          renderLinkedCards();
        });
        row.appendChild(linkedCheckbox);
        row.appendChild(linkedTitle);
        const linkedSectionName = sections.find(section => section.id === linkedCard.section)?.name;
        if (linkedSectionName) {
          const badge = document.createElement('span');
          badge.className = 'linked-task-section-badge';
          badge.textContent = linkedSectionName;
          row.appendChild(badge);
        }
        linkedList.appendChild(row);
      });

      const addRow = document.createElement('div');
      addRow.className = 'linked-task-add';
      const addInput = document.createElement('input');
      addInput.type = 'text';
      addInput.className = 'linked-task-add-input';
      addInput.placeholder = '+ Add linked card...';
      addInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const title = addInput.value.trim();
          if (!title || sections.length === 0) return;
          const targetSection = markdownCore.getLinkedCardSectionId({ sections }, item);
          const linkedCard = markdownCore.createCard(title, targetSection, {
            initiatives: cardInitiatives(item),
            meetingRef: slug
          });
          markdownCore.addCardToSection(getWorkspace(), targetSection, linkedCard, insertIdx);
          insertIdx++;
          addInput.value = '';
          markChanged();
          renderLinkedCards();
        } else if (e.key === 'Escape') {
          addInput.blur();
        }
      });
      addRow.appendChild(addInput);
      linkedList.appendChild(addRow);
    };

  renderLinkedCards();
  body.appendChild(linkedSection);

  // ── Footer ──
  const footer = document.createElement('div');
  footer.className = 'card-expand-footer';

  const footerInitiatives = document.createElement('div');
  footerInitiatives.className = 'card-expand-initiatives';
  const renderExpandedInitiatives = () => {
    footerInitiatives.innerHTML = '';
    cardInitiatives(item).forEach(name => footerInitiatives.appendChild(createInitiativePill(name)));
    if (initiatives.length > 0) {
      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className = 'initiative-add-button';
      addButton.textContent = '+';
      addButton.title = 'Add initiative';
      addButton.setAttribute('aria-label', 'Add initiative');
      addButton.addEventListener('click', (e) => {
        e.stopPropagation();
        buildInitiativeDropdown(addButton, item, () => {
          markChanged();
          renderExpandedInitiatives();
        });
      });
      footerInitiatives.appendChild(addButton);
    }
  };
  renderExpandedInitiatives();
  footer.appendChild(footerInitiatives);

  const footerMeta = document.createElement('div');
  footerMeta.className = 'card-expand-footer-meta';

  const sectionName = sections.find(s => s.id === item.section)?.name || '';
  if (sectionName) {
    const badge = document.createElement('span');
    badge.className = 'list-item-section';
    badge.textContent = sectionName;
    footerMeta.appendChild(badge);
  }

  if (item.createdAt) {
    const created = document.createElement('span');
    created.className = 'list-item-section';
    created.textContent = `Created ${item.createdAt}`;
    footerMeta.appendChild(created);
  }
  footer.appendChild(footerMeta);

  panel.appendChild(header);
  panel.appendChild(properties);
  panel.appendChild(body);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  cleanupNoteEditorSizing = autoSizeExpandedNoteEditor(taskNoteEditor, body);

  if (focusTarget === 'notes') {
    setTimeout(() => noteEditor?.focus(), 0);
  }
}

function createCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.draggable = true;
  card.dataset.id = task.id;
  applyCardFilterDataset(card, task);
  const attachedInitiatives = cardInitiatives(task);
  if (attachedInitiatives.length === 1) card.style.borderLeft = `3px solid ${getInitiativeColor(attachedInitiatives[0])}`;
  else if (attachedInitiatives.length > 1) card.style.borderLeft = '3px solid var(--border)';

  let html = `
    <button class="card-expand-btn" data-action="expand" title="Expand"><svg width="11" height="11" viewBox="0 0 11 11" fill="none" style="pointer-events:none"><path d="M7 1h3v3M4 10H1V7M10 1L6.5 4.5M1 10L4.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
    <div class="card-heading-row">
      <button class="delete-btn" data-action="delete" title="Delete card">&times;</button>
      <span class="checkbox ${task.checked ? 'checked' : ''}" data-action="toggle"></span>
      <div class="card-title" data-action="edit-title">${task.title}</div>
    </div>
  `;

  if (task.notes && task.notes.length > 0) {
    const collapsible = isNotesPreviewCollapsible(task.notes);
    const collapsed = collapsible && !task.notesExpanded;
    html += `<div class="card-subtasks task-card-notes${collapsed ? ' collapsed' : ''}" style="margin-left: 30px; border-top: 1px solid var(--border-light); padding-top: 8px;">`;
    task.notes.forEach(n => {
      const tn = typeof n === 'string' ? { text: n, level: 0 } : n;
      html += `<div class="note-card-note-row" style="padding-left: ${tn.level * 14}px;">
        <span class="note-bullet">•</span>
        <span class="note-card-note">${inlineMdToHtml(tn.text)}</span>
      </div>`;
    });
    html += '</div>';
    if (collapsible) {
      html += `<div class="note-expand-btn" data-action="toggle-notes" style="margin-left: 30px;">${collapsed ? 'See more' : 'See less'}</div>`;
    }
  }

  card.innerHTML = html;
  card.querySelector('.card-heading-row')?.after(createCompactMetadata(task));

  if (initiatives.length > 0 || cardInitiatives(task).length > 0) {
    const metaRow = document.createElement('div');
    metaRow.className = 'card-meta-row';
    metaRow.appendChild(createInitiativePills(task));
    card.appendChild(metaRow);
  }

  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.id);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  card.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle') {
      markdownCore.toggleCardChecked(task);
      checkAutoMoveToDone(task);
      markChanged();
      renderTasks();
    } else if (action === 'edit-title') {
      startEditingTitle(e.target, task);
    } else if (action === 'delete') {
      deleteTask(task);
    } else if (action === 'expand') {
      openCardExpanded(task);
    } else if (action === 'toggle-notes') {
      task.notesExpanded = !task.notesExpanded;
      renderTasks();
    } else if (!action) {
      openCardExpanded(task, 'notes');
    }
  });

  return card;
}

function createNoteCard(item) {
  const card = document.createElement('div');
  card.className = 'task-card note-card';
  card.draggable = true;
  card.dataset.id = item.id;
  const attachedInitiatives = cardInitiatives(item);
  if (attachedInitiatives.length === 1) card.style.borderLeftColor = getInitiativeColor(attachedInitiatives[0]);
  else if (attachedInitiatives.length > 1) card.style.borderLeftColor = 'var(--border)';
  applyCardFilterDataset(card, item);

  // Header: delete + title
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: flex-start; gap: 12px;';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.title = 'Delete note';
  deleteBtn.innerHTML = '&times;';
  deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(item); });

  const titleEl = document.createElement('div');
  titleEl.className = 'note-card-title';
  titleEl.textContent = item.title;
  titleEl.addEventListener('click', (e) => { e.stopPropagation(); startEditingNoteTitle(titleEl, item); });

  header.appendChild(deleteBtn);
  header.appendChild(titleEl);

  card.appendChild(header);
  card.appendChild(createCompactMetadata(item));

  // Notes area — click anywhere to open textarea
  const notesArea = document.createElement('div');
  notesArea.className = 'note-card-notes-area';

  // Copy button — appears on hover
  const copyBtn = document.createElement('button');
  copyBtn.className = 'note-copy-btn';
  copyBtn.title = 'Copy meeting notes';
  copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const slug = meetingSlug(item.title);
    const linked = getLinkedTasks(slug);
    navigator.clipboard.writeText(markdownCore.formatNoteForClipboard(item, linked));
    copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    setTimeout(() => {
      copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    }, 1500);
  });
  notesArea.appendChild(copyBtn);

  if (item.notes.length > 0) {
    const collapsible = isNotesPreviewCollapsible(item.notes);
    const collapsed = collapsible && !item.expanded;
    const notesDiv = document.createElement('div');
    notesDiv.className = 'note-card-notes' + (collapsed ? ' collapsed' : '');
    item.notes.forEach(n => {
      const note = typeof n === 'string' ? { text: n, level: 0 } : n;
      const row = document.createElement('div');
      row.className = 'note-card-note-row';
      row.style.paddingLeft = `${note.level * 14}px`;
      const bullet = document.createElement('span');
      bullet.className = 'note-bullet';
      bullet.textContent = '•';
      const text = document.createElement('span');
      text.className = 'note-card-note';
      text.innerHTML = inlineMdToHtml(note.text);
      row.appendChild(bullet);
      row.appendChild(text);
      notesDiv.appendChild(row);
    });
    notesArea.appendChild(notesDiv);

    if (collapsible) {
      const expandBtn = document.createElement('div');
      expandBtn.className = 'note-expand-btn';
      expandBtn.textContent = collapsed ? 'See more' : 'See less';
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.expanded = !item.expanded;
        renderTasks();
      });
      notesArea.appendChild(expandBtn);
    }
  }

  const hint = document.createElement('div');
  hint.className = 'card-note add-on-hover';
  hint.style.cssText = 'font-style: italic; cursor: pointer; margin-top: 4px;';
  hint.textContent = item.notes.length > 0 ? '✎ Edit notes' : '+ Add notes';
  notesArea.appendChild(hint);

  notesArea.addEventListener('click', (e) => { e.stopPropagation(); openCardExpanded(item); });
  card.appendChild(notesArea);

  if (initiatives.length > 0 || cardInitiatives(item).length > 0) {
    const pillRow = document.createElement('div');
    pillRow.className = 'card-meta-row';
    pillRow.appendChild(createInitiativePills(item));
    card.appendChild(pillRow);
  }

  card.addEventListener('dragstart', (e) => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', item.id); });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  return card;
}

function startEditingNoteTitle(el, item) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = item.title;
  input.style.cssText = 'flex: 1; background: var(--bg-card); border: 2px solid var(--accent); border-radius: 6px; padding: 6px 10px; color: var(--text-primary); font-size: 14px; font-family: inherit; outline: none;';
  el.replaceWith(input);
  input.focus();
  input.select();
  let saved = false;
  const save = () => {
    if (saved) return;
    saved = true;
    const val = input.value.trim();
    if (val && val !== item.title) {
      if (markdownCore.setWorkspaceCardTitle(getWorkspace(), item, val)) markChanged();
    }
    renderTasks();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { saved = true; renderTasks(); }
  });
  input.addEventListener('blur', save);
}

function startEditingNoteContent(containerEl, item) {
  const editor = makeNoteEditor(item, false);
  containerEl.replaceWith(editor);
  editor.focus();
  const r = document.createRange();
  r.selectNodeContents(editor);
  r.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);

  let saved = false;
  const save = () => {
    if (saved) return;
    saved = true;
    markdownCore.setCardNotes(item, noteEditorToNotes(editor));
    markChanged();
    renderTasks();
  };
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { saved = true; renderTasks(); }
  });
  editor.addEventListener('blur', () => setTimeout(save, 150));
}

function startEditingTitle(titleEl, task) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.title;
  input.style.cssText = 'width: 100%; background: var(--bg-card); border: 2px solid var(--accent); border-radius: 6px; padding: 6px 10px; color: var(--text-primary); font-size: 14px; font-family: inherit; outline: none;';

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let saved = false;
  const saveEdit = () => {
    if (saved) return;
    saved = true;
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== task.title) {
      if (markdownCore.setWorkspaceCardTitle(getWorkspace(), task, newTitle)) markChanged();
    }
    renderTasks();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    else if (e.key === 'Escape') { saved = true; renderTasks(); }
  });
  input.addEventListener('blur', saveEdit);
}

function startEditingColumnTitle(titleEl, colId) {
  const section = sections.find(s => s.id === colId);
  if (!section) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = section.name;
  input.style.cssText = 'width: 180px; background: var(--bg-card); border: 2px solid var(--accent); border-radius: 6px; padding: 4px 10px; color: var(--text-primary); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0; font-family: inherit; outline: none;';

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let saved = false;
  const saveEdit = () => {
    if (saved) return;
    saved = true;
    const newName = input.value.trim();
    if (newName && newName !== section.name) {
      if (markdownCore.renameSection(getWorkspace(), section.id, newName)) markChanged();
    }
    renderTasks();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    else if (e.key === 'Escape') { saved = true; renderTasks(); }
  });
  input.addEventListener('blur', saveEdit);
}

function requestDeleteSection(sectionIdValue) {
  const section = sections.find(candidate => candidate.id === sectionIdValue);
  if (!section || sections.length <= 1) return;

  const deleteWithDestination = (destinationId = null) => {
    const nextWorkspace = {
      sections: sections.map(candidate => ({ ...candidate })),
      tasks: Object.fromEntries(Object.entries(tasks).map(([id, cards]) => [id, [...cards]])),
      initiatives: [...initiatives]
    };
    const deleted = markdownCore.deleteSection(nextWorkspace, sectionIdValue, destinationId);
    if (!deleted) {
      showStatus('Column could not be deleted');
      return false;
    }
    sections = nextWorkspace.sections;
    tasks = nextWorkspace.tasks;
    initiatives = nextWorkspace.initiatives;
    if (quickAddSection === sectionIdValue) quickAddSection = destinationId || sections[0]?.id || null;
    markChanged();
    return true;
  };

  const sectionCards = tasks[sectionIdValue] || [];
  if (sectionCards.length === 0) {
    if (deleteWithDestination()) renderTasks();
    return;
  }

  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalFooter = modalOverlay.querySelector('.modal-footer');
  modalTitle.textContent = `Delete ${section.name}`;
  modalBody.innerHTML = '';
  modalFooter.style.display = '';
  modalFooter.querySelector('.modal-confirm')?.remove();

  const message = document.createElement('p');
  message.className = 'delete-section-message';
  message.textContent = `Move ${sectionCards.length} card${sectionCards.length === 1 ? '' : 's'} before deleting this column.`;
  modalBody.appendChild(message);

  const label = document.createElement('label');
  label.className = 'delete-section-label';
  label.textContent = 'Move cards to';
  const select = document.createElement('select');
  select.className = 'delete-section-select';
  sections.filter(candidate => candidate.id !== sectionIdValue).forEach(candidate => {
    const option = document.createElement('option');
    option.value = candidate.id;
    option.textContent = candidate.name;
    select.appendChild(option);
  });
  label.appendChild(select);
  modalBody.appendChild(label);

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'modal-confirm destructive';
  confirm.textContent = 'Move cards and delete';
  confirm.addEventListener('click', () => {
    if (deleteWithDestination(select.value)) {
      closeModal();
      renderTasks();
    }
  });
  modalFooter.appendChild(confirm);
  modalOverlay.classList.add('visible');
  select.focus();
}

function applyGlobalFilter() {
  const filter = { query: globalSearch, initiative: globalInitFilter };

  if (currentView === 'board') {
    board.querySelectorAll('.column').forEach(col => {
      const cardsEl = col.querySelector('.cards');
      if (!cardsEl) return;
      const countEl = col.querySelector('.count');
      const allCards = cardsEl.querySelectorAll('.task-card');
      let visible = 0;
      allCards.forEach(card => {
        const show = markdownCore.matchesFilter(card.dataset, filter);
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      countEl.textContent = (filter.query || filter.initiative) ? `${visible}/${allCards.length}` : allCards.length;
    });
  } else {
    listView.querySelectorAll('.list-item').forEach(item => {
      item.style.display = markdownCore.matchesFilter(item.dataset, filter) ? '' : 'none';
    });
  }
}

function createColumn(id, title, items) {
  const col = document.createElement('div');
  col.className = 'column';
  col.innerHTML = `
    <div class="column-header">
      <span class="column-title" data-section-id="${id}" style="cursor: pointer;">${title}</span>
      <span class="column-header-actions">
        <span class="count">${items.length}</span>
        <button type="button" class="column-delete" title="Delete column" aria-label="Delete ${title}" ${sections.length <= 1 ? 'disabled' : ''}>&times;</button>
      </span>
    </div>
    <div class="cards" data-column="${id}"></div>
  `;

  col.querySelector('.column-title').addEventListener('click', (e) => {
    if (!col.dragging) { startEditingColumnTitle(e.target, id); }
  });
  col.querySelector('.column-delete').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    requestDeleteSection(id);
  });

  {
    const isNoteSection = id === 'meeting-notes' || id === 'notes';

    const addRow = document.createElement('div');
    addRow.className = 'column-add-row';

    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.className = 'column-add-input';
    addInput.placeholder = isNoteSection ? 'New note...' : 'New task...';

    addRow.appendChild(addInput);
    col.querySelector('.column-header').after(addRow);

    addInput.addEventListener('mousedown', e => e.stopPropagation());
    addInput.addEventListener('click', e => e.stopPropagation());
    addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const title = addInput.value.trim();
        if (!title) return;
        markdownCore.addCardToSection(getWorkspace(), id, createCardForSection(title, id), 'start');
        addInput.value = '';
        markChanged();
        renderTasks();
      } else if (e.key === 'Escape') {
        addInput.value = '';
        addInput.blur();
      }
    });
  }

  const header = col.querySelector('.column-header');
  header.draggable = true;

  header.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    col.classList.add('dragging-column');
    e.dataTransfer.setData('text/column', id);
    e.dataTransfer.effectAllowed = 'move';
  });

  header.addEventListener('dragend', () => {
    col.classList.remove('dragging-column');
    board.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
  });

  col.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('text/column')) {
      e.preventDefault();
      e.stopPropagation();
      board.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
      const indicator = document.createElement('div');
      indicator.className = 'column-drop-indicator';
      const rect = col.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) { col.before(indicator); }
      else { col.after(indicator); }
    }
  });

  col.addEventListener('drop', (e) => {
    if (e.dataTransfer.types.includes('text/column')) {
      e.preventDefault();
      e.stopPropagation();
      const fromId = e.dataTransfer.getData('text/column');
      const toId = id;
      if (fromId !== toId) {
        const rect = col.getBoundingClientRect();
        const insertBefore = e.clientX < rect.left + rect.width / 2;
        moveSection(fromId, toId, insertBefore);
      }
      board.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
    }
  });

  const cardsContainer = col.querySelector('.cards');
  items.forEach(task => cardsContainer.appendChild(createCard(task)));

  const getDropPosition = (e) => {
    const allCards = [...cardsContainer.querySelectorAll('.task-card')];
    const visibleCards = allCards.filter(c => !c.classList.contains('dragging'));
    let insertBeforeCard = null;
    let dropIndex = visibleCards.length;
    for (let i = 0; i < visibleCards.length; i++) {
      const rect = visibleCards[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        insertBeforeCard = visibleCards[i];
        dropIndex = i;
        break;
      }
    }
    return { insertBeforeCard, dropIndex };
  };

  const showDropIndicator = (e) => {
    col.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    const { insertBeforeCard } = getDropPosition(e);
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    indicator.style.cssText = 'height: 3px; background: var(--accent); border-radius: 2px; margin: 5px 0;';
    if (insertBeforeCard) { cardsContainer.insertBefore(indicator, insertBeforeCard); }
    else { cardsContainer.appendChild(indicator); }
  };

  col.addEventListener('dragover', (e) => {
    e.preventDefault();
    cardsContainer.classList.add('drag-over');
    showDropIndicator(e);
  });

  col.addEventListener('dragleave', (e) => {
    if (!col.contains(e.relatedTarget)) {
      cardsContainer.classList.remove('drag-over');
      col.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    }
  });

  col.addEventListener('drop', (e) => {
    e.preventDefault();
    cardsContainer.classList.remove('drag-over');
    col.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    const taskId = parseFloat(e.dataTransfer.getData('text/plain'));
    const { dropIndex } = getDropPosition(e);
    moveTask(taskId, id, dropIndex);
  });


  return col;
}

function addNewTask(sectionId, container) {
  const existing = container.querySelector('.new-task-input');
  if (existing) return;

  const isNoteSection = sectionId === 'meeting-notes' || sectionId === 'notes';

  const input = document.createElement('textarea');
  input.className = 'new-task-input';
  input.placeholder = isNoteSection ? 'Note title...' : 'What needs to be done?';
  input.rows = 2;
  container.appendChild(input);
  input.focus();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const title = input.value.trim();
      if (title) {
        markdownCore.addCardToSection(getWorkspace(), sectionId, createCardForSection(title, sectionId));
        markChanged();
        renderTasks();
      } else { input.remove(); }
    } else if (e.key === 'Escape') { input.remove(); }
  });

  input.addEventListener('blur', () => { setTimeout(() => input.remove(), 100); });
}

function moveSection(fromId, toId, insertBefore) {
  if (!markdownCore.moveSection(getWorkspace(), fromId, toId, insertBefore)) return;
  markChanged();
  renderTasks();
}

function moveTask(taskId, toSectionId, dropIndex = -1) {
  const task = markdownCore.moveCard(getWorkspace(), taskId, toSectionId, dropIndex);
  if (!task) return;
  markChanged();
  renderTasks();
}

function deleteTask(task) {
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalFooter = modalOverlay.querySelector('.modal-footer');

  modalTitle.textContent = 'Delete card';
  modalBody.innerHTML = '';
  modalFooter.style.display = '';
  modalFooter.querySelector('.modal-confirm')?.remove();

  const message = document.createElement('p');
  message.className = 'delete-section-message';
  message.textContent = `Delete "${task.title}"? This cannot be undone.`;
  modalBody.appendChild(message);

  const confirmDelete = document.createElement('button');
  confirmDelete.type = 'button';
  confirmDelete.className = 'modal-confirm destructive';
  confirmDelete.textContent = 'Delete card';
  confirmDelete.addEventListener('click', () => {
    markdownCore.deleteCard(getWorkspace(), task);
    markChanged();
    closeModal();
    renderTasks();
  });

  modalFooter.appendChild(confirmDelete);
  modalOverlay.classList.add('visible');
  confirmDelete.focus();
}

let saveTimeout = null;
let lastModified = 0;
let watchInterval = null;
let isSaving = false;

function markChanged() {
  hasChanges = true;
  saveBtn.disabled = false;
  if (saveTimeout) clearTimeout(saveTimeout);
  if (taskFileIsDownloadFallback) return;
  saveTimeout = setTimeout(autoSave, 500);
}

async function autoSave() {
  if (!taskFileHandle || !hasChanges || isSaving) return;
  isSaving = true;
  try {
    await markdownCoreReady;
    const content = toMarkdown();
    await fileActions.writeFileHandle(taskFileHandle, content);
    const file = await taskFileHandle.getFile();
    lastModified = file.lastModified;
    hasChanges = false;
    saveBtn.disabled = true;
    showStatus('Saved');
  } catch (e) {
    showStatus('Save failed: ' + e.message);
  }
  isSaving = false;
}

async function checkForExternalChanges() {
  if (!taskFileHandle || hasChanges || isSaving) return;
  try {
    const file = await taskFileHandle.getFile();
    if (file.lastModified > lastModified) {
      lastModified = file.lastModified;
      const content = await file.text();
      const result = parseTaskMarkdown(content);
      sections = result.sections;
      tasks = result.tasks;
      initiatives = result.initiatives;
      renderTasks();
      showStatus('Reloaded');
    }
  } catch (e) { console.log('Watch error:', e); }
}

function startWatching() {
  if (watchInterval) clearInterval(watchInterval);
  watchInterval = setInterval(checkForExternalChanges, 1000);
}

function stopWatching() {
  if (watchInterval) { clearInterval(watchInterval); watchInterval = null; }
}

function renderTasks() {
  renderFilterPills();
  if (currentView === 'board') { renderBoard(); }
  else { renderList(); }
}

function renderBoard() {
  board.innerHTML = '';
  sections.forEach(section => {
    const sectionTasks = tasks[section.id] || [];
    board.appendChild(createColumn(section.id, section.name, sectionTasks));
  });

  const addSectionBtn = document.createElement('div');
  addSectionBtn.className = 'board-add-section';
  addSectionBtn.innerHTML = '<span aria-hidden="true">+</span><span class="sr-only">Add section</span>';
  addSectionBtn.addEventListener('click', () => startAddingSection(addSectionBtn));
  board.appendChild(addSectionBtn);

  applyGlobalFilter();
}

function renderList() {
  listView.innerHTML = '';

  if (!quickAddSection && sections.length > 0) {
    quickAddSection = sections[0].id;
  }

  // Quick add at top
  const quickAdd = document.createElement('div');
  quickAdd.className = 'quick-add';
  quickAdd.style.cssText = 'border-bottom: 2px solid var(--border); margin-bottom: 24px; padding-bottom: 16px;';

  const sectionName = sections.find(s => s.id === quickAddSection)?.name || 'Select section';
  quickAdd.innerHTML = `
    <span class="checkbox" style="opacity: 0.3;"></span>
    <input type="text" class="quick-add-input" placeholder="Add a task..." id="quickAddInput">
    <span class="quick-add-section" id="quickAddSectionBtn">${sectionName}</span>
  `;
  listView.appendChild(quickAdd);

  const quickInput = document.getElementById('quickAddInput');
  const sectionBtn = document.getElementById('quickAddSectionBtn');

  quickInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && quickInput.value.trim()) {
      const title = quickInput.value.trim();
      markdownCore.addCardToSection(getWorkspace(), quickAddSection, createCardForSection(title, quickAddSection), 'start');
      quickInput.value = '';
      markChanged();
      renderTasks();
      setTimeout(() => document.getElementById('quickAddInput')?.focus(), 10);
    }
  });

  sectionBtn.addEventListener('click', (e) => { showSectionPicker(e.target); });

  // Render each section
  sections.forEach(section => {
    const sectionTasks = tasks[section.id] || [];
    const sectionEl = document.createElement('div');
    sectionEl.className = 'list-section';
    sectionEl.dataset.sectionId = section.id;

    const header = document.createElement('div');
    header.className = 'list-section-header';
    header.innerHTML = `
      <span class="section-title" data-section-id="${section.id}">${section.name}</span>
      <span class="list-section-actions">
        <span class="count">${sectionTasks.length}</span>
        <button type="button" class="section-delete" title="Delete section" aria-label="Delete ${section.name}" ${sections.length <= 1 ? 'disabled' : ''}>&times;</button>
      </span>
    `;

    header.querySelector('.section-title').addEventListener('click', (e) => {
      startEditingListSectionTitle(e.target, section);
    });
    header.querySelector('.section-delete').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      requestDeleteSection(section.id);
    });

    sectionEl.appendChild(header);

    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'list-tasks-container';
    tasksContainer.dataset.sectionId = section.id;

    sectionTasks.forEach(task => tasksContainer.appendChild(createListItem(task, section)));

    sectionEl.appendChild(tasksContainer);

    // Drag-and-drop handlers for section
    const getDropPosition = (e, container) => {
      const items = [...container.querySelectorAll('.list-item:not(.dragging)')];
      let insertBeforeEl = null;
      let dropIndex = items.length;
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          insertBeforeEl = items[i];
          dropIndex = i;
          break;
        }
      }
      return { insertBeforeEl, dropIndex };
    };

    const showDropIndicator = (e) => {
      tasksContainer.querySelectorAll('.list-drop-indicator').forEach(el => el.remove());
      const { insertBeforeEl } = getDropPosition(e, tasksContainer);
      const indicator = document.createElement('div');
      indicator.className = 'list-drop-indicator';
      if (insertBeforeEl) { tasksContainer.insertBefore(indicator, insertBeforeEl); }
      else { tasksContainer.appendChild(indicator); }
    };

    sectionEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      sectionEl.classList.add('drag-over');
      showDropIndicator(e);
    });

    sectionEl.addEventListener('dragleave', (e) => {
      if (!sectionEl.contains(e.relatedTarget)) {
        sectionEl.classList.remove('drag-over');
        tasksContainer.querySelectorAll('.list-drop-indicator').forEach(el => el.remove());
      }
    });

    sectionEl.addEventListener('drop', (e) => {
      e.preventDefault();
      sectionEl.classList.remove('drag-over');
      tasksContainer.querySelectorAll('.list-drop-indicator').forEach(el => el.remove());
      const taskId = parseFloat(e.dataTransfer.getData('text/plain'));
      if (!taskId) return;
      const { dropIndex } = getDropPosition(e, tasksContainer);
      moveTask(taskId, section.id, dropIndex);
    });

    listView.appendChild(sectionEl);
  });

  // Add Section button
  const addSectionBtn = document.createElement('div');
  addSectionBtn.className = 'list-add-section';
  addSectionBtn.textContent = '+ Add Section';
  addSectionBtn.addEventListener('click', () => { startAddingListSection(addSectionBtn); });
  listView.appendChild(addSectionBtn);

  applyGlobalFilter();
}

function startEditingListSectionTitle(titleEl, section) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = section.name;
  input.style.cssText = 'width: 200px; background: var(--bg-card); border: 2px solid var(--accent); border-radius: 6px; padding: 4px 10px; color: var(--text-primary); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0; font-family: inherit; outline: none;';

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let saved = false;
  const saveEdit = () => {
    if (saved) return;
    saved = true;
    const newName = input.value.trim();
    if (newName && newName !== section.name) {
      if (markdownCore.renameSection(getWorkspace(), section.id, newName)) markChanged();
    }
    renderTasks();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    else if (e.key === 'Escape') { saved = true; renderTasks(); }
  });
  input.addEventListener('blur', saveEdit);
}

function startAddingListSection(btn) {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Section name...';
  input.style.cssText = 'width: 100%; background: var(--bg-card); border: 2px solid var(--accent); border-radius: 8px; padding: 12px 16px; color: var(--text-primary); font-size: 14px; font-family: inherit; outline: none; text-align: left;';

  btn.innerHTML = '';
  btn.style.border = '2px solid var(--accent)';
  btn.style.cursor = 'default';
  btn.appendChild(input);
  input.focus();

  let saved = false;
  const saveSection = () => {
    if (saved) return;
    saved = true;
    const name = input.value.trim();
    if (name) {
      const section = markdownCore.addSection(getWorkspace(), name);
      if (section) {
        markChanged();
      }
    }
    renderTasks();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveSection(); }
    else if (e.key === 'Escape') { saved = true; renderTasks(); }
  });
  input.addEventListener('blur', saveSection);
}

function createListItem(task, section) {
  const item = document.createElement('div');
  item.className = 'list-item';
  item.draggable = true;
  item.dataset.taskId = task.id;
  applyCardFilterDataset(item, task);
  const attachedInitiatives = cardInitiatives(task);
  if (attachedInitiatives.length === 1) item.style.borderLeft = `3px solid ${getInitiativeColor(attachedInitiatives[0])}`;
  else if (attachedInitiatives.length > 1) item.style.borderLeft = '3px solid var(--border)';

  item.addEventListener('dragstart', (e) => {
    item.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  });

  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    document.querySelectorAll('.list-drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.list-section.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  item.addEventListener('click', (event) => {
    if (!event.target.closest('button, input, .checkbox, .initiative-pill, .meeting-ref-badge, .note-expand-btn, [contenteditable="true"]')) {
      openCardExpanded(task, 'notes');
    }
  });

  const checkbox = document.createElement('span');
  checkbox.className = `checkbox ${task.checked ? 'checked' : ''}`;
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    markdownCore.toggleCardChecked(task);
    checkAutoMoveToDone(task);
    markChanged();
    renderTasks();
  });

  const content = document.createElement('div');
  content.className = 'list-item-content';

  const title = document.createElement('div');
  title.className = `list-item-title ${task.checked ? 'checked' : ''}`;
  title.textContent = task.title;
  title.addEventListener('click', (e) => {
    e.stopPropagation();
    startEditingListItem(title, task);
  });
  content.appendChild(title);
  content.appendChild(createCompactMetadata(task));

  if (task.notes && task.notes.length > 0) {
    const collapsible = isNotesPreviewCollapsible(task.notes);
    const collapsed = collapsible && !task.notesExpanded;
    const notesContainer = document.createElement('div');
    notesContainer.className = 'task-list-notes' + (collapsed ? ' collapsed' : '');
    notesContainer.style.cssText = 'margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-light);';
    task.notes.forEach(n => {
      const tn = typeof n === 'string' ? { text: n, level: 0 } : n;
      const row = document.createElement('div');
      row.className = 'note-card-note-row';
      row.style.paddingLeft = `${tn.level * 14}px`;
      const bullet = document.createElement('span');
      bullet.className = 'note-bullet';
      bullet.textContent = '•';
      const text = document.createElement('span');
      text.className = 'note-card-note';
      text.innerHTML = inlineMdToHtml(tn.text);
      row.appendChild(bullet);
      row.appendChild(text);
      notesContainer.appendChild(row);
    });
    content.appendChild(notesContainer);

    if (collapsible) {
      const expandBtn = document.createElement('div');
      expandBtn.className = 'note-expand-btn';
      expandBtn.textContent = collapsed ? 'See more' : 'See less';
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        task.notesExpanded = !task.notesExpanded;
        renderTasks();
      });
      content.appendChild(expandBtn);
    }
  }

  if (initiatives.length > 0 || cardInitiatives(task).length > 0) {
    const metaRow = document.createElement('div');
    metaRow.className = 'card-meta-row';
    metaRow.appendChild(createInitiativePills(task));
    content.appendChild(metaRow);
  }

  item.appendChild(checkbox);
  item.appendChild(content);

  const actions = document.createElement('div');
  actions.className = 'list-item-actions';
  const expandListBtn = document.createElement('button');
  expandListBtn.title = 'Expand';
  expandListBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" style="pointer-events:none"><path d="M7 1h3v3M4 10H1V7M10 1L6.5 4.5M1 10L4.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  expandListBtn.addEventListener('click', (e) => { e.stopPropagation(); openCardExpanded(task); });
  const deleteListBtn = document.createElement('button');
  deleteListBtn.title = 'Delete card';
  deleteListBtn.innerHTML = '&times;';
  deleteListBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task); });
  actions.appendChild(expandListBtn);
  actions.appendChild(deleteListBtn);
  item.appendChild(actions);

  return item;
}

function createNoteListItem(item) {
  const el = document.createElement('div');
  el.className = 'list-item note-list-item';
  el.draggable = true;
  el.dataset.taskId = item.id;
  applyCardFilterDataset(el, item);
  const attachedInitiatives = cardInitiatives(item);
  if (attachedInitiatives.length === 1) el.style.borderLeftColor = getInitiativeColor(attachedInitiatives[0]);
  else if (attachedInitiatives.length > 1) el.style.borderLeftColor = 'var(--border)';

  el.addEventListener('dragstart', (e) => {
    el.classList.add('dragging');
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    document.querySelectorAll('.list-drop-indicator').forEach(e => e.remove());
    document.querySelectorAll('.list-section.drag-over').forEach(e => e.classList.remove('drag-over'));
  });

  const content = document.createElement('div');
  content.className = 'list-item-content';

  const title = document.createElement('div');
  title.className = 'note-list-title';
  title.textContent = item.title;
  title.addEventListener('click', (e) => { e.stopPropagation(); startEditingNoteTitle(title, item); });
  content.appendChild(title);
  content.appendChild(createCompactMetadata(item));

  // Notes area — click anywhere to open textarea
  const notesArea = document.createElement('div');
  notesArea.className = 'note-card-notes-area';

  if (item.notes.length > 0) {
    const collapsible = isNotesPreviewCollapsible(item.notes);
    const collapsed = collapsible && !item.expanded;
    const notesDiv = document.createElement('div');
    notesDiv.className = 'note-list-notes' + (collapsed ? ' collapsed' : '');
    item.notes.forEach(n => {
      const note = typeof n === 'string' ? { text: n, level: 0 } : n;
      const row = document.createElement('div');
      row.className = 'note-list-note-row';
      row.style.paddingLeft = `${note.level * 14}px`;
      const bullet = document.createElement('span');
      bullet.className = 'note-bullet';
      bullet.textContent = '•';
      const text = document.createElement('span');
      text.className = 'note-list-note';
      text.innerHTML = inlineMdToHtml(note.text);
      row.appendChild(bullet);
      row.appendChild(text);
      notesDiv.appendChild(row);
    });
    notesArea.appendChild(notesDiv);

    if (collapsible) {
      const expandBtn = document.createElement('div');
      expandBtn.className = 'note-expand-btn';
      expandBtn.textContent = collapsed ? 'See more' : 'See less';
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.expanded = !item.expanded;
        renderTasks();
      });
      notesArea.appendChild(expandBtn);
    }
  }

  const hint = document.createElement('div');
  hint.className = 'list-item-edit-notes';
  hint.textContent = item.notes.length > 0 ? '✎ Edit notes' : '+ Add notes';
  notesArea.appendChild(hint);

  notesArea.addEventListener('click', (e) => { e.stopPropagation(); openCardExpanded(item); });
  content.appendChild(notesArea);

  if (initiatives.length > 0 || cardInitiatives(item).length > 0) {
    const pillRow = document.createElement('div');
    pillRow.className = 'card-meta-row';
    pillRow.appendChild(createInitiativePills(item));
    content.appendChild(pillRow);
  }

  const actions = document.createElement('div');
  actions.className = 'list-item-actions';
  const deleteNoteListBtn = document.createElement('button');
  deleteNoteListBtn.title = 'Delete note';
  deleteNoteListBtn.innerHTML = '&times;';
  deleteNoteListBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(item); });
  actions.appendChild(deleteNoteListBtn);

  el.appendChild(content);
  el.appendChild(actions);
  return el;
}

function startEditingListItem(titleEl, task) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.title;
  input.style.cssText = 'width: 100%; background: var(--bg-card); border: 2px solid var(--accent); border-radius: 6px; padding: 8px 12px; color: var(--text-primary); font-size: 15px; font-family: inherit; outline: none;';

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let saved = false;
  const saveEdit = () => {
    if (saved) return;
    saved = true;
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== task.title) {
      if (markdownCore.setWorkspaceCardTitle(getWorkspace(), task, newTitle)) markChanged();
    }
    renderTasks();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    else if (e.key === 'Escape') { saved = true; renderTasks(); }
  });
  input.addEventListener('blur', saveEdit);
}

function showSectionPicker(anchorEl) {
  document.querySelectorAll('.section-picker').forEach(el => el.remove());
  const picker = document.createElement('div');
  picker.className = 'section-picker';
  const rect = anchorEl.getBoundingClientRect();
  picker.style.top = (rect.bottom + 4) + 'px';
  picker.style.right = (window.innerWidth - rect.right) + 'px';

  sections.forEach(section => {
    const btn = document.createElement('button');
    btn.textContent = section.name;
    btn.addEventListener('click', () => {
      quickAddSection = section.id;
      picker.remove();
      renderTasks();
      setTimeout(() => document.getElementById('quickAddInput')?.focus(), 10);
    });
    picker.appendChild(btn);
  });

  document.body.appendChild(picker);
  setTimeout(() => {
    document.addEventListener('click', function closeHandler(e) {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', closeHandler);
      }
    });
  }, 10);
}

function switchTaskView(view) {
  currentView = view;
  if (view === 'list') {
    listView.style.display = 'block';
    board.style.display = 'none';
    listViewBtn.classList.add('active');
    boardViewBtn.classList.remove('active');
  } else {
    listView.style.display = 'none';
    board.style.display = 'flex';
    listViewBtn.classList.remove('active');
    boardViewBtn.classList.add('active');
  }
  renderTasks();
}

listViewBtn.addEventListener('click', () => switchTaskView('list'));
boardViewBtn.addEventListener('click', () => switchTaskView('board'));

function startAddingSection(btn) {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Section name...';
  input.style.cssText = 'width: 220px; background: var(--bg-card); border: 2px solid var(--accent); border-radius: 8px; padding: 10px 14px; color: var(--text-primary); font-size: 14px; font-family: inherit; outline: none;';

  btn.innerHTML = '';
  btn.className = 'column board-add-section-active';
  btn.appendChild(input);
  input.focus();

  let saved = false;
  const saveSection = () => {
    if (saved) return;
    saved = true;
    const name = input.value.trim();
    if (name) {
      const section = markdownCore.addSection(getWorkspace(), name);
      if (section) {
        markChanged();
      }
    }
    renderTasks();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveSection(); }
    else if (e.key === 'Escape') { saved = true; renderTasks(); }
  });
  input.addEventListener('blur', saveSection);
}

async function openTaskFileFallback() {
  await markdownCoreReady;
  const picked = await fileActions.pickMarkdownFileWithInput();
  if (!picked) return;
  await loadTaskFileFromText(picked.name, picked.content);
}

async function reopenLastTaskFile() {
  try {
    const handle = await getRememberedHandle(fileStorage.lastTaskFileKey);
    if (!handle) {
      showStatus('No remembered file');
      await updateReopenButton();
      return;
    }
    const allowed = await requestReadWritePermission(handle);
    if (!allowed) {
      showStatus('Permission was not granted');
      return;
    }
    await loadTaskFileFromHandle(handle);
  } catch (e) {
    showStatus('Error: ' + e.message);
  }
}

async function openTaskFile() {
  await markdownCoreReady;
  if (!fileStorage.supportsOpenFilePicker(window)) {
    await openTaskFileFallback();
    return;
  }
  try {
    await markdownCoreReady;
    taskFileHandle = await fileActions.openMarkdownFileWithPicker(window);
    await rememberHandle(fileStorage.lastTaskFileKey, taskFileHandle);
    await updateReopenButton();
    await loadTaskFileFromHandle(taskFileHandle);
  } catch (e) {
    if (e.name !== 'AbortError') { showStatus('Error: ' + e.message); }
  }
}

async function createNewTaskFile() {
  if (!supportsSaveFilePicker) {
    await downloadStarterMarkdown();
    return;
  }
  try {
    await markdownCoreReady;
    const starterMarkdown = markdownCore.createStarterMarkdown();
    const handle = await fileActions.createMarkdownFileWithPicker(markdownCore.defaultFileName, starterMarkdown, window);
    await rememberHandle(fileStorage.lastTaskFileKey, handle);
    await updateReopenButton();
    await loadTaskFileFromHandle(handle);
    hasChanges = false;
    saveBtn.disabled = true;
    showStatus('Created ' + (handle.name || markdownCore.defaultFileName));
  } catch (e) {
    if (e.name !== 'AbortError') { showStatus('Error: ' + e.message); }
  }
}

newTaskBtn.addEventListener('click', createNewTaskFile);
openTaskBtn.addEventListener('click', openTaskFile);
document.getElementById('newBtnLarge')?.addEventListener('click', createNewTaskFile);
document.getElementById('openBtnLarge')?.addEventListener('click', openTaskFile);
reopenTaskBtn?.addEventListener('click', reopenLastTaskFile);
updateReopenButton();

saveBtn.addEventListener('click', async () => {
  await markdownCoreReady;
  if (taskFileIsDownloadFallback) {
    await downloadTaskMarkdown();
    return;
  }
  if (!taskFileHandle) return;
  try {
    await fileActions.writeFileHandle(taskFileHandle, toMarkdown());
    hasChanges = false;
    saveBtn.disabled = true;
    showStatus('Saved');
  } catch (e) { showStatus('Error: ' + e.message); }
});

window.addEventListener('beforeunload', (e) => {
  if (hasChanges) { e.preventDefault(); e.returnValue = ''; }
});

const modalOverlay = document.getElementById('modalOverlay');

function closeModal() {
  modalOverlay.classList.remove('visible');
  modalOverlay.querySelector('.modal-footer').style.display = '';
  modalOverlay.querySelector('.modal-confirm')?.remove();
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
