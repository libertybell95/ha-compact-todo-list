import { describe, expect, it } from "vitest";
import { enforceAccordion, pruneExpanded, toggleExpanded } from "../src/utils/expansion";

describe("expansion state", () => {
  it("accordion mode keeps one row open", () => {
    let s: ReadonlySet<string> = new Set();
    s = toggleExpanded(s, "a", true);
    s = toggleExpanded(s, "b", true);
    expect([...s]).toEqual(["b"]);
  });
  it("clicking the open row collapses it", () => {
    expect(toggleExpanded(new Set(["a"]), "a", true).size).toBe(0);
  });
  it("non-accordion mode allows several rows", () => {
    expect([...toggleExpanded(new Set(["a"]), "b", false)]).toEqual(["a", "b"]);
  });
  it("prunes keys of removed items and keeps identity otherwise", () => {
    const s = new Set(["a", "b"]);
    expect(pruneExpanded(s, ["a", "b", "c"])).toBe(s);
    expect([...pruneExpanded(s, ["b"])]).toEqual(["b"]);
  });
  it("enforces a single open row when accordion is switched on", () => {
    expect([...enforceAccordion(new Set(["a", "b"]))]).toEqual(["b"]);
  });
});
