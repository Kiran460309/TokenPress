import { describe, it } from "node:test";
import assert from "node:assert";
import { rgbaToCSS, sanitizePrefix, formatName, formatValue, valueKey } from "../src/utils.ts";

describe("rgbaToCSS", () => {
  it("should convert solid RGBA to HEX (uppercase)", () => {
    const color = { r: 1, g: 0.5, b: 0, a: 1 };
    assert.strictEqual(rgbaToCSS(color), "#FF8000");
  });

  it("should convert semi-transparent RGBA to rgba() CSS string", () => {
    const color = { r: 0.2, g: 0.4, b: 0.8, a: 0.5 };
    assert.strictEqual(rgbaToCSS(color), "rgba(51, 102, 204, 0.5)");
  });

  it("should assume alpha is 1 if missing", () => {
    const color = { r: 0, g: 0, b: 0 };
    assert.strictEqual(rgbaToCSS(color), "#000000");
  });
});

describe("sanitizePrefix", () => {
  it("should sanitize and lowercase prefixes", () => {
    assert.strictEqual(sanitizePrefix("DS-Color!"), "ds-color");
    assert.strictEqual(sanitizePrefix("---ds-"), "ds-");
  });

  it("should handle empty prefixes", () => {
    assert.strictEqual(sanitizePrefix(""), "");
  });
});

describe("formatName", () => {
  const defaultOpts = {
    cleanNames: true,
    collectionPrefix: false,
    globalPrefix: "",
    addPx: true
  };

  it("should convert slash separated paths to kebab-case", () => {
    assert.strictEqual(formatName("brand/primary/main", null, defaultOpts), "--brand-primary-main");
  });

  it("should strip redundant keywords when cleanNames is enabled", () => {
    assert.strictEqual(formatName("brand/colors/primary", null, { ...defaultOpts, cleanNames: true }), "--brand-primary");
  });

  it("should keep redundant keywords when cleanNames is disabled", () => {
    assert.strictEqual(formatName("colors/brand/primary", null, { ...defaultOpts, cleanNames: false }), "--colors-brand-primary");
  });

  it("should prepend collection name when collectionPrefix is enabled", () => {
    assert.strictEqual(formatName("brand/primary", "ThemeColors", { ...defaultOpts, collectionPrefix: true }), "--themecolors-brand-primary");
  });

  it("should prepend globalPrefix when configured", () => {
    assert.strictEqual(formatName("brand/primary", null, { ...defaultOpts, globalPrefix: "ds-" }), "--ds-brand-primary");
  });
});

describe("formatValue", () => {
  const defaultOpts = {
    cleanNames: true,
    collectionPrefix: false,
    globalPrefix: "",
    addPx: true
  };

  it("should format reference values properly", () => {
    const refToken = { type: "REFERENCE" as const, name: "brand/primary", collection: "colors" };
    assert.strictEqual(formatValue(refToken, "button-bg", defaultOpts), "var(--brand-primary)");
  });

  it("should flag broken references with an error comment", () => {
    const brokenRef = { type: "REFERENCE" as const, name: "unknown-reference", collection: null, isBroken: true, id: "var:123" };
    assert.strictEqual(formatValue(brokenRef, "button-bg", defaultOpts), "var(--unknown-reference) /* ⚠️ ERROR: Broken reference (ID: var:123) */");
  });

  it("should append px to number tokens by default", () => {
    const numToken = { type: "VALUE" as const, value: 16 };
    assert.strictEqual(formatValue(numToken, "spacing-md", defaultOpts), "16px");
  });

  it("should NOT append px to unitless properties", () => {
    const opacityToken = { type: "VALUE" as const, value: 0.5 };
    assert.strictEqual(formatValue(opacityToken, "opacity-disabled", defaultOpts), "0.5");

    const lineheightToken = { type: "VALUE" as const, value: 1.5 };
    assert.strictEqual(formatValue(lineheightToken, "body-lineheight", defaultOpts), "1.5");
  });

  it("should respect addPx flag option being disabled", () => {
    const numToken = { type: "VALUE" as const, value: 16 };
    assert.strictEqual(formatValue(numToken, "spacing-md", { ...defaultOpts, addPx: false }), "16");
  });
});

describe("valueKey", () => {
  it("should generate distinct keys for references and values", () => {
    const refToken = { type: "REFERENCE" as const, name: "primary" };
    const valToken = { type: "VALUE" as const, value: "primary" };
    assert.notStrictEqual(valueKey(refToken), valueKey(valToken));
  });
});
