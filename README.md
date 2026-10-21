# Token → CSS Exporter Pro — Figma Plugin 

A Figma plugin that transforms design tokens (Figma Variables) into production-ready CSS custom properties.

## Features
 
- **Recursive Alias Resolution**: Resolves complex alias chains to their final variable names (not internal IDs), including references across collections.
- **Multi-Mode / Theme Export**: The first mode in each collection becomes the `:root` (or unwrapped) baseline. Every additional mode (e.g. "Dark") is exported as a `[data-theme="..."]` block containing only the tokens whose value actually differs from the default — so theme blocks stay small and meaningful instead of duplicating every token.
- **Production-Ready Naming**:
  - "Simplify Names" strips redundant folder words (`color`, `spacing`, `mode`, etc.) from the variable path.
  - "Prefix with Collection Name" prepends the collection name to the variable when it isn't already part of the path.
  - "Global Prefix" field lets you prepend any custom namespace (e.g. `--ds-color-blue-500`), sanitized to safe CSS identifier characters.
- **Selective Export**: Toggle collections on/off via the chip bar; the live preview and download filename update immediately.
- **Value Formatting**: Colors resolve to hex (or `rgba()` when alpha < 1); numeric values get `px` appended automatically except for unit-less properties (`opacity`, `line-height`, `z-index`, `font-weight`, `scale`, `alpha`).
- **Pretty Print toggle**: Switch between a readable, indented, blank-line-separated stylesheet and a minified single-line-per-block version.
- **Export Options**: Copy to clipboard or download as a `.css` file.
- **Private Variable Support**: Automatically ignores variables starting with `.` or `_`.
- **Defensive error handling**: If the Variables API isn't available (older Figma versions) or a lookup fails, the plugin shows a clear in-UI message instead of a blank/broken panel.

## Install (Development)

1. Open Figma desktop app.
2. Go to **Plugins → Development → Import plugin from manifest...**.
3. Select the `manifest.json` file from this folder.
4. Run via **Plugins → Development → Token → CSS Exporter Pro**.

## CSS Output Example

Given a collection with modes `Light` (default) and `Dark`, where `--button-bg` aliases a color that differs per mode:

```css
:root {
  /* --- 🎨  Colors  --- */
  --color-blue-500: #3B82F6;
  --space-md: 16px;
  --button-bg: var(--color-blue-500);
}

[data-theme="Dark"] {
  /* --- 🎨  Colors  --- */
  --button-bg: #1E40AF;
}
```

Only tokens that change between modes appear in the theme block — tokens with identical values across modes stay in `:root` only, so you don't get redundant overrides.

## Notes

- CSS export currently reflects one baseline mode plus override blocks for every other mode in a collection. If you need every mode fully duplicated (rather than diffed), that would be a separate toggle to add.
- JSON (Style Dictionary) export mentioned in earlier drafts of this plugin is not yet implemented — current output is CSS only.
