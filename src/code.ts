import { rgbaToCSS } from "./utils.js";

declare const __html__: string;

figma.showUI(__html__, { width: 480, height: 600, title: "Token → CSS Exporter Pro" });

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === "load-tokens") {
    await loadTokens();
  }
};

interface CollectionInfo {
  name: string;
  modes: { modeId: string; name: string }[];
}

let collectionMap: Record<string, CollectionInfo> = {};

/**
 * Main entry point to fetch and process Figma Variables
 */
async function loadTokens() {
  try {
    // Guard against older Figma versions / editors where the Variables API
    // isn't available, instead of throwing an opaque error later on.
    if (!figma.variables ||
        typeof figma.variables.getLocalVariableCollectionsAsync !== "function" ||
        typeof figma.variables.getLocalVariablesAsync !== "function") {
      figma.ui.postMessage({
        type: "error",
        message: "This version of Figma doesn't support the Variables API. Please update Figma to the latest version and try again."
      });
      return;
    }

    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const allVariables = await figma.variables.getLocalVariablesAsync();

    if (allVariables.length === 0) {
      figma.ui.postMessage({ type: "no-tokens" });
      return;
    }

    collectionMap = {};
    for (const col of collections) {
      collectionMap[col.id] = { name: col.name, modes: col.modes };
    }

    const tokensByCollection: Record<string, {
      modes: { modeId: string; name: string }[];
      tokens: {
        id: string;
        name: string;
        type: string;
        values: Record<string, any>;
        description: string;
      }[];
    }> = {};

    for (const variable of allVariables) {
      // 1. Filter out "private" variables (starting with . or _)
      if (variable.name.split('/').some((part: string) => part.startsWith('.') || part.startsWith('_'))) {
        continue;
      }

      const col = collectionMap[variable.variableCollectionId];
      if (!col) continue;

      const colName = col.name;
      if (!tokensByCollection[colName]) {
        tokensByCollection[colName] = {
          // modes is ordered; modes[0] is treated as the "default" mode
          // and everything else becomes a [data-theme="..."] block.
          modes: col.modes,
          tokens: []
        };
      }

      const resolvedValues: Record<string, any> = {};
      for (const mode of col.modes) {
        const rawVal = variable.valuesByMode[mode.modeId];
        // 2. Resolve the value (handle aliases recursively)
        const resolved = await resolveValue(rawVal, variable.resolvedType);
        resolvedValues[mode.name] = resolved;
      }

      tokensByCollection[colName].tokens.push({
        id: variable.id,
        name: variable.name,
        type: variable.resolvedType,
        values: resolvedValues,
        description: variable.description
      });
    }

    figma.ui.postMessage({ type: "tokens", data: tokensByCollection });
  } catch (err: any) {
    console.error(err);
    figma.ui.postMessage({ type: "error", message: err.message });
  }
}

/**
 * Resolves a variable value, handling recursive aliases and formatting
 */
async function resolveValue(val: any, type: string): Promise<any> {
  if (val === undefined || val === null) return null;

  // Handle Variable Alias
  if (typeof val === "object" && val.type === "VARIABLE_ALIAS") {
    const aliasedVar = await figma.variables.getVariableByIdAsync(val.id);
    if (!aliasedVar) {
      console.warn(`[Token Exporter] Could not resolve remote variable with ID: ${val.id}. Ensure the library is enabled.`);
      // Return safe broken reference flag
      return {
        type: "REFERENCE",
        id: val.id,
        name: "unknown-reference",
        collection: null,
        isBroken: true
      };
    }

    // Look up which collection the aliased variable lives in, so the UI
    // can apply collection-prefixing to references, not just top-level tokens.
    const aliasCol = collectionMap[aliasedVar.variableCollectionId];

    // We keep the name for the CSS var() reference
    return {
      type: "REFERENCE",
      id: aliasedVar.id,
      name: aliasedVar.name,
      collection: aliasCol ? aliasCol.name : null,
      isBroken: false
    };
  }

  // Handle Raw Values
  let formattedValue = val;
  if (type === "COLOR") {
    formattedValue = rgbaToCSS(val);
  } else if (type === "FLOAT") {
    formattedValue = parseFloat(val.toFixed(3));
  } else if (type === "BOOLEAN") {
    formattedValue = Boolean(val);
  }

  return {
    type: "VALUE",
    value: formattedValue
  };
}
