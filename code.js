"use strict";

// src/utils.ts
function rgbaToCSS(color) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a !== void 0 ? color.a : 1;
  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${parseFloat(a.toFixed(3))})`;
  }
  const hex = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return hex.toUpperCase();
}

// src/code.ts
figma.showUI(__html__, { width: 480, height: 600, title: "Token \u2192 CSS Exporter Pro" });
figma.ui.onmessage = async (msg) => {
  if (msg.type === "load-tokens") {
    await loadTokens();
  }
};
var collectionMap = {};
async function loadTokens() {
  try {
    if (!figma.variables || typeof figma.variables.getLocalVariableCollectionsAsync !== "function" || typeof figma.variables.getLocalVariablesAsync !== "function") {
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
    const tokensByCollection = {};
    for (const variable of allVariables) {
      if (variable.name.split("/").some((part) => part.startsWith(".") || part.startsWith("_"))) {
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
      const resolvedValues = {};
      for (const mode of col.modes) {
        const rawVal = variable.valuesByMode[mode.modeId];
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
  } catch (err) {
    console.error(err);
    figma.ui.postMessage({ type: "error", message: err.message });
  }
}
async function resolveValue(val, type) {
  if (val === void 0 || val === null) return null;
  if (typeof val === "object" && val.type === "VARIABLE_ALIAS") {
    const aliasedVar = await figma.variables.getVariableByIdAsync(val.id);
    if (!aliasedVar) {
      console.warn(`[Token Exporter] Could not resolve remote variable with ID: ${val.id}. Ensure the library is enabled.`);
      return {
        type: "REFERENCE",
        id: val.id,
        name: "unknown-reference",
        collection: null,
        isBroken: true
      };
    }
    const aliasCol = collectionMap[aliasedVar.variableCollectionId];
    return {
      type: "REFERENCE",
      id: aliasedVar.id,
      name: aliasedVar.name,
      collection: aliasCol ? aliasCol.name : null,
      isBroken: false
    };
  }
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
