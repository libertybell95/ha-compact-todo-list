import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULTS, stubConfig, validateConfig } from "../src/config";

describe("validateConfig", () => {
  it("accepts the minimal configuration and fills defaults", () => {
    const { config, unknownKeys } = validateConfig({
      type: "custom:ha-compact-todo-card",
      entity: "todo.ksi",
    });
    expect(config).toMatchObject({ entity: "todo.ksi", title: undefined, ...DEFAULTS });
    expect(unknownKeys).toEqual([]);
  });

  it("accepts the full documented configuration", () => {
    const { config } = validateConfig({
      type: "custom:ha-compact-todo-card",
      entity: "todo.ksi",
      title: "KSI Tasks",
      row_height: 40,
      max_height: 350,
      scrollable: false,
      expand_on_click: false,
      accordion: false,
      animate_expansion: false,
      show_completed: true,
      show_task_count: false,
      show_add_button: false,
      sort: "due_asc",
      theme: "My Theme",
    });
    expect(config).toMatchObject({
      title: "KSI Tasks",
      row_height: 40,
      max_height: 350,
      scrollable: false,
      expand_on_click: false,
      accordion: false,
      animate_expansion: false,
      show_completed: true,
      show_task_count: false,
      show_add_button: false,
      sort: "due_asc",
      theme: "My Theme",
    });
  });

  it.each([
    [undefined, /must be an object/],
    [[], /must be an object/],
    [{}, /"entity" is missing/],
    [{ entity: "light.kitchen" }, /must be a to-do list entity/],
    [{ entity: 42 }, /must be a to-do list entity/],
    [{ entity: "todo.x", row_height: 10 }, /between 28 and 64/],
    [{ entity: "todo.x", row_height: "big" }, /must be a number/],
    [{ entity: "todo.x", max_height: 20 }, /or 0 for no limit/],
    [{ entity: "todo.x", accordion: "yes" }, /true or false/],
    [{ entity: "todo.x", sort: "random" }, /"sort" must be one of/],
    [{ entity: "todo.x", theme: "" }, /"theme"/],
    [{ entity: "todo.x", title: { a: 1 } }, /"title" must be text/],
  ])("rejects invalid config %j", (input, message) => {
    expect(() => validateConfig(input)).toThrow(ConfigError);
    expect(() => validateConfig(input)).toThrow(message);
  });

  it("coerces numeric strings and px values", () => {
    const { config } = validateConfig({ entity: "todo.x", row_height: "40px", max_height: "300" });
    expect(config.row_height).toBe(40);
    expect(config.max_height).toBe(300);
  });

  it("allows max_height 0 (no limit) and an empty title", () => {
    const { config } = validateConfig({ entity: "todo.x", max_height: 0, title: "" });
    expect(config.max_height).toBe(0);
    expect(config.title).toBe("");
  });

  it("reports unknown keys without failing and ignores Home Assistant layout keys", () => {
    const { unknownKeys } = validateConfig({
      entity: "todo.x",
      colour: "red",
      grid_options: { columns: 6 },
      visibility: [],
      view_layout: {},
    });
    expect(unknownKeys).toEqual(["colour"]);
  });
});

describe("stubConfig", () => {
  it("picks the first to-do entity", () => {
    expect(stubConfig(["light.a", "todo.shopping", "todo.ksi"])).toEqual({
      entity: "todo.shopping",
    });
  });
  it("falls back to a placeholder when no to-do entity exists", () => {
    expect(stubConfig(["light.a"])).toEqual({ entity: "todo.shopping_list" });
  });
});
