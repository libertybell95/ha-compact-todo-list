import { describe, expect, it } from "vitest";
import { toCardError } from "../src/utils/errors";
import { MalformedResponseError } from "../src/utils/items";
import { applyTheme } from "../src/utils/theme";

describe("toCardError", () => {
  it.each([
    [{ code: 3, message: "Connection lost" }, "disconnected"],
    [{ code: "unauthorized", message: "Unauthorized" }, "unauthorized"],
    [{ code: "service_not_found", message: "x" }, "not_found"],
    [{ code: "unknown_command", message: "Unknown command." }, "unsupported"],
    [{ code: "service_validation_error", message: "Unable to find item" }, "failed"],
    [new MalformedResponseError("bad"), "malformed"],
    ["boom", "failed"],
    [undefined, "failed"],
  ])("classifies %j as %s", (error, kind) => {
    const result = toCardError(error, "save the task");
    expect(result.kind).toBe(kind);
    expect(result.message).toMatch(/^Could not save the task/);
  });
  it("includes the Home Assistant message", () => {
    expect(toCardError({ code: "x", message: "Due date not supported" }, "save").message).toBe(
      "Could not save: Due date not supported",
    );
  });
});

describe("applyTheme", () => {
  const hass = {
    themes: {
      darkMode: true,
      themes: {
        Ocean: {
          "primary-color": "#123456",
          modes: {
            dark: { "card-background-color": "#000" },
            light: { "card-background-color": "#fff" },
          },
        },
      },
    },
  };

  it("applies theme variables with the active mode and removes them for auto", () => {
    const el = document.createElement("div");
    const applied = applyTheme(el, hass as never, "Ocean", []);
    expect(el.style.getPropertyValue("--primary-color")).toBe("#123456");
    expect(el.style.getPropertyValue("--card-background-color")).toBe("#000");
    expect(applyTheme(el, hass as never, "auto", applied)).toEqual([]);
    expect(el.style.getPropertyValue("--primary-color")).toBe("");
  });
  it("ignores unknown themes", () => {
    const el = document.createElement("div");
    expect(applyTheme(el, hass as never, "Missing", [])).toEqual([]);
  });
});
