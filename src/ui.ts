import { formatName, formatValue, valueKey, FormatOptions } from "./utils.js";

// Make sure global function bindings are attached to the window object so that inline HTML onclick handlers work
declare global {
  interface Window {
    copyCSS: () => void;
    downloadCSS: () => void;
    toggleSidebar: () => void;
    refresh: () => void;
  }
}

let rawData: Record<string, {
  modes: { modeId: string; name: string }[];
  tokens: {
    id: string;
    name: string;
    type: string;
    values: Record<string, any>;
    description: string;
  }[];
}> = {};

let selectedCollections = new Set<string>();

const COLLECTION_ICONS: Record<string, string> = {
  'colors': '🎨',
  'color': '🎨',
  'spacing': '📏',
  'space': '📏',
  'typography': '🔤',
  'font': '🔤',
  'gap': '📐',
  'radius': '⭕'
};

window.onload = () => {
  parent.postMessage({ pluginMessage: { type: 'load-tokens' } }, '*');

  ['scopeSelect', 'globalPrefix', 'optCollectionPrefix', 'optCleanNames',
   'optHeaders', 'optPx', 'optPretty', 'optThemes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const evt = el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text' ? 'input' : 'change';
      el.addEventListener(evt, generate);
    }
  });
};

window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === 'tokens') {
    rawData = msg.data;
    buildChipBar();
    generate();
  } else if (msg.type === 'no-tokens') {
    showError('No variables found in this file.');
  } else if (msg.type === 'error') {
    showError(msg.message || 'Something went wrong while reading variables.');
    showToast(msg.message || 'Failed to load tokens', true);
  }
};

function iconFor(name: string): string {
  const lowerName = name.toLowerCase();
  for (const [key, emoji] of Object.entries(COLLECTION_ICONS)) {
    if (lowerName.includes(key)) return emoji;
  }
  return '📦';
}

function buildChipBar() {
  const bar = document.getElementById('chipBar');
  if (!bar) return;
  bar.innerHTML = '';
  selectedCollections = new Set(Object.keys(rawData));

  const createChip = (name: string, id: string, active = true) => {
    const chip = document.createElement('div');
    chip.className = `chip ${active ? 'active' : ''}`;

    const iconSpan = document.createElement('span');
    iconSpan.textContent = iconFor(name);
    chip.appendChild(iconSpan);
    chip.appendChild(document.createTextNode(' ' + name));

    chip.onclick = () => {
      chip.classList.toggle('active');
      if (chip.classList.contains('active')) selectedCollections.add(id);
      else selectedCollections.delete(id);
      generate();
    };
    return chip;
  };

  for (const name of Object.keys(rawData)) {
    bar.appendChild(createChip(name, name));
  }
}

function buildOptions(): FormatOptions & {
  scope: string;
  useHeaders: boolean;
  pretty: boolean;
  exportThemes: boolean;
} {
  return {
    scope: (document.getElementById('scopeSelect') as HTMLSelectElement).value,
    globalPrefix: (document.getElementById('globalPrefix') as HTMLInputElement).value,
    collectionPrefix: (document.getElementById('optCollectionPrefix') as HTMLInputElement).checked,
    cleanNames: (document.getElementById('optCleanNames') as HTMLInputElement).checked,
    addPx: (document.getElementById('optPx') as HTMLInputElement).checked,
    useHeaders: (document.getElementById('optHeaders') as HTMLInputElement).checked,
    pretty: (document.getElementById('optPretty') as HTMLInputElement).checked,
    exportThemes: (document.getElementById('optThemes') as HTMLInputElement).checked
  };
}

function indent(line: string, opts: { pretty: boolean }): string {
  if (!opts.pretty) return line.trim();
  return `  ${line}`;
}

interface BlockEntry {
  colName: string;
  lines: string[];
}

function buildBlock(selector: string, colEntries: BlockEntry[], opts: { useHeaders: boolean; pretty: boolean }): { css: string; count: number } {
  const lines: string[] = [];
  let count = 0;

  for (const entry of colEntries) {
    if (entry.lines.length === 0) continue;
    if (opts.useHeaders) {
      lines.push(indent(`/* --- ${iconFor(entry.colName)}  ${entry.colName}  --- */`, opts));
    }
    for (const l of entry.lines) {
      lines.push(indent(l, opts));
      count++;
    }
    if (opts.pretty) lines.push('');
  }

  if (count === 0) return { css: '', count: 0 };

  const body = opts.pretty ? lines.join('\n').replace(/\n+$/, '') : lines.join('\n');

  let css;
  if (selector === 'none') {
    css = body;
  } else {
    css = opts.pretty ? `${selector} {\n${body}\n}` : `${selector}{${body}}`;
  }
  return { css, count };
}

function generate() {
  const opts = buildOptions();

  updateDownloadButtonText();

  let tokenCount = 0;
  let foundTotal = 0;

  const defaultEntries: BlockEntry[] = [];
  const themeEntries: Record<string, BlockEntry[]> = {};

  for (const [colName, colData] of Object.entries(rawData)) {
    foundTotal += colData.tokens.length;
    if (!selectedCollections.has(colName)) continue;

    const modes = colData.modes || [];
    const defaultModeName = modes.length ? modes[0].name : null;

    const defaultLines: string[] = [];
    const themeLinesByMode: Record<string, string[]> = {};

    colData.tokens.forEach(t => {
      if (!defaultModeName || !(defaultModeName in t.values)) return;

      const varName = formatName(t.name, colName, opts);
      const defaultVal = t.values[defaultModeName];
      // Note the bug fix here: passing t.name as second arg to formatValue
      defaultLines.push(`${varName}: ${formatValue(defaultVal, t.name, opts)};`);
      tokenCount++;

      if (opts.exportThemes && modes.length > 1) {
        for (let i = 1; i < modes.length; i++) {
          const modeName = modes[i].name;
          const modeVal = t.values[modeName];
          if (!modeVal) continue;
          if (valueKey(modeVal) === valueKey(defaultVal)) continue;
          if (!themeLinesByMode[modeName]) themeLinesByMode[modeName] = [];
          // Note the bug fix here: passing t.name as second arg to formatValue
          themeLinesByMode[modeName].push(`${varName}: ${formatValue(modeVal, t.name, opts)};`);
        }
      }
    });

    defaultEntries.push({ colName, lines: defaultLines });

    for (const [modeName, lines] of Object.entries(themeLinesByMode)) {
      if (!themeEntries[modeName]) themeEntries[modeName] = [];
      themeEntries[modeName].push({ colName, lines });
    }
  }

  const outputArea = document.getElementById('output') as HTMLTextAreaElement;
  const placeholder = document.getElementById('placeholder') as HTMLDivElement;
  const badge = document.getElementById('badge') as HTMLDivElement;

  if (tokenCount === 0) {
    outputArea.style.display = 'none';
    placeholder.style.display = 'flex';
    badge.style.display = 'none';
    return;
  }

  const rootSelector = opts.scope === ':root' ? ':root' : 'none';
  const blocks: string[] = [];

  const baseBlock = buildBlock(rootSelector, defaultEntries, opts);
  if (baseBlock.css) blocks.push(baseBlock.css);

  for (const [modeName, entries] of Object.entries(themeEntries)) {
    const safeModeName = modeName.replace(/"/g, '\\"');
    const themeSelector = `[data-theme="${safeModeName}"]`;
    const themeBlock = buildBlock(themeSelector, entries, opts);
    if (themeBlock.css) blocks.push(themeBlock.css);
  }

  const finalCSS = opts.pretty ? blocks.join('\n\n') : blocks.join('');

  outputArea.value = finalCSS;
  outputArea.style.display = 'block';
  placeholder.style.display = 'none';
  badge.style.display = 'flex';

  const statTokens = document.getElementById('statTokens');
  const statFound = document.getElementById('statFound');
  if (statTokens) {
    const span = statTokens.querySelector('span');
    if (span) span.textContent = String(tokenCount);
  }
  if (statFound) {
    const span = statFound.querySelector('span');
    if (span) span.textContent = String(foundTotal);
  }
}

function updateDownloadButtonText() {
  const btn = document.getElementById('downloadBtn');
  if (!btn || !rawData) return;

  let filename = 'tokens.css';
  const selectedArray = Array.from(selectedCollections);

  if (selectedArray.length === 1) {
    filename = `${selectedArray[0].replace(/[\/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-')}.css`;
  }

  btn.textContent = `Download ${filename}`;
}

function showToast(message: string, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle('error', !!isError);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function copyCSS() {
  const output = document.getElementById('output') as HTMLTextAreaElement;
  if (!output) return;
  const val = output.value;
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => {
    showToast('Copied to clipboard!');
  }).catch(() => {
    showToast('Could not copy — try selecting the text manually.', true);
  });
}

function downloadCSS() {
  const output = document.getElementById('output') as HTMLTextAreaElement;
  if (!output) return;
  const val = output.value;
  if (!val) return;

  let filename = 'tokens.css';
  const selectedArray = Array.from(selectedCollections);
  if (selectedArray.length === 1) {
    filename = `${selectedArray[0].replace(/[\/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-')}.css`;
  }

  const url = 'data:text/css;charset=utf-8,' + encodeURIComponent(val);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  a.click();
}

function toggleSidebar() {
  const aside = document.querySelector('aside');
  if (!aside) return;

  const isCollapsed = aside.classList.toggle('collapsed');
  const toggleBtn = document.querySelector('.toggle-btn svg') as HTMLElement | null;

  if (toggleBtn) {
    toggleBtn.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}

function refresh() {
  const placeholder = document.getElementById('placeholder');
  const output = document.getElementById('output');
  const badge = document.getElementById('badge');
  if (placeholder) {
    placeholder.innerHTML = '<p>Connecting to Figma...</p>';
    placeholder.style.display = 'flex';
  }
  if (output) output.style.display = 'none';
  if (badge) badge.style.display = 'none';
  parent.postMessage({ pluginMessage: { type: 'load-tokens' } }, '*');
}

function showError(msg: string) {
  const placeholder = document.getElementById('placeholder');
  const output = document.getElementById('output');
  const badge = document.getElementById('badge');
  if (placeholder) {
    placeholder.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'error-text';
    p.textContent = msg;
    placeholder.appendChild(p);
    placeholder.style.display = 'flex';
  }
  if (output) output.style.display = 'none';
  if (badge) badge.style.display = 'none';
}

// Bind to window to allow HTML inline handlers to work
window.copyCSS = copyCSS;
window.downloadCSS = downloadCSS;
window.toggleSidebar = toggleSidebar;
window.refresh = refresh;
