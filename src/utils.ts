export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface TokenValue {
  type: "VALUE" | "REFERENCE";
  value?: any;
  id?: string;
  name?: string;
  collection?: string | null;
  isBroken?: boolean;
}

export interface FormatOptions {
  cleanNames: boolean;
  collectionPrefix: boolean;
  globalPrefix: string;
  addPx: boolean;
}

/**
 * Converts Figma RGBA to CSS HEX or RGBA string
 */
export function rgbaToCSS(color: Color): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a !== undefined ? color.a : 1;

  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${parseFloat(a.toFixed(3))})`;
  }

  const hex = "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
  return hex.toUpperCase();
}

/**
 * Sanitizes a prefix input to safe CSS identifier characters
 */
export function sanitizePrefix(raw: string): string {
  return (raw || '')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .replace(/^-+/, '')
    .toLowerCase();
}

/**
 * Formats a variable name to CSS custom property kebab-case format
 */
export function formatName(name: string, colName: string | null, opts: FormatOptions): string {
  let parts = name.split('/').map(p => p.trim());

  if (opts.cleanNames) {
    const strip = ['primitive', 'primitives', 'collection', 'mode', 'default', 'colors', 'color', 'spacing', 'space', 'typography', 'font'];
    parts = parts.filter((p, i) => {
      if (i === 0 && strip.includes(p.toLowerCase())) return true;
      return !strip.includes(p.toLowerCase());
    });
    parts = parts.filter((p, i) => parts.indexOf(p) === i);
  }

  if (opts.collectionPrefix && colName) {
    const colKebabCheck = colName.toLowerCase().replace(/\s+/g, '-');
    const firstPartKebab = (parts[0] || '').toLowerCase().replace(/\s+/g, '-');
    if (firstPartKebab !== colKebabCheck) {
      parts = [colName, ...parts];
    }
  }

  let kebab = parts.join('-')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  const prefix = sanitizePrefix(opts.globalPrefix);
  return `--${prefix}${kebab}`;
}

/**
 * Formats a token value (raw or reference) into its CSS string representation
 */
export function formatValue(tokenObj: TokenValue | undefined, tokenName: string, opts: FormatOptions): string {
  if (!tokenObj) return '';

  if (tokenObj.type === 'REFERENCE') {
    if (tokenObj.isBroken) {
      return `var(--${tokenObj.name}) /* ⚠️ ERROR: Broken reference (ID: ${tokenObj.id || 'unknown'}) */`;
    }
    return `var(${formatName(tokenObj.name || 'unknown', tokenObj.collection || null, opts)})`;
  }

  const val = tokenObj.value;
  if (typeof val === 'number' && opts.addPx) {
    const lowerName = tokenName.toLowerCase();
    const noPx = ['opacity', 'lineheight', 'zindex', 'fontweight', 'alpha', 'scale'];
    if (!noPx.some(s => lowerName.includes(s))) {
      return `${val}px`;
    }
  }
  return String(val);
}

/**
 * Generates a uniqueness key for comparing token values across modes
 */
export function valueKey(tokenObj: TokenValue | undefined): string {
  if (!tokenObj) return '';
  if (tokenObj.type === 'REFERENCE') {
    return `ref:${tokenObj.name}:${tokenObj.isBroken ? 'broken' : 'ok'}`;
  }
  return `val:${tokenObj.value}`;
}
