import { describe, expect, it } from "vitest";
import type { TodoCapabilities, TodoItem } from "../src/types/home-assistant";
import {
  FormValidationError,
  buildAddPayload,
  buildUpdatePayload,
  formValuesFor,
} from "../src/utils/payload";

const ALL: TodoCapabilities = {
  create: true,
  delete: true,
  update: true,
  dueDate: true,
  dueDatetime: true,
  description: true,
};
const TITLE_ONLY: TodoCapabilities = {
  create: true,
  delete: true,
  update: true,
  dueDate: false,
  dueDatetime: false,
  description: false,
};
const DATETIME_ONLY: TodoCapabilities = { ...TITLE_ONLY, dueDatetime: true };

const values = (over: Partial<ReturnType<typeof formValuesFor>> = {}) => ({
  ...formValuesFor(),
  ...over,
});

const existing: TodoItem = {
  key: "a",
  ref: "a",
  uid: "a",
  summary: "Dry Solids",
  status: "needs_action",
  description: "Arrived.",
  due: "2026-10-20",
};

describe("buildAddPayload", () => {
  it("requires a non-blank title", () => {
    expect(() => buildAddPayload(values({ summary: "   " }), ALL)).toThrow(FormValidationError);
  });
  it("trims the title and includes supported optional fields", () => {
    expect(
      buildAddPayload(
        values({ summary: "  Buy milk ", description: "2%\n", date: "2026-10-20" }),
        ALL,
      ),
    ).toEqual({
      item: "Buy milk",
      description: "2%",
      due_date: "2026-10-20",
    });
  });
  it("uses due_datetime when a time is given", () => {
    const data = buildAddPayload(values({ summary: "x", date: "2026-10-20", time: "09:15" }), ALL);
    expect(data.due_datetime).toMatch(/^2026-10-20T09:15:00[+-]/);
    expect(data).not.toHaveProperty("due_date");
  });
  it("never sends fields the list does not support", () => {
    expect(
      buildAddPayload(
        values({ summary: "x", description: "d", date: "2026-10-20", time: "10:00" }),
        TITLE_ONLY,
      ),
    ).toEqual({ item: "x" });
  });
  it("rejects a time without a date and a date-only due on datetime-only lists", () => {
    expect(() => buildAddPayload(values({ summary: "x", time: "10:00" }), ALL)).toThrow(
      /Choose a date/,
    );
    expect(() =>
      buildAddPayload(values({ summary: "x", date: "2026-10-20" }), DATETIME_ONLY),
    ).toThrow(/requires a time/);
  });
});

describe("buildUpdatePayload", () => {
  it("returns an empty patch when nothing changed", () => {
    expect(buildUpdatePayload(existing, formValuesFor(existing), ALL)).toEqual({});
  });
  it("only includes changed fields, preserving the rest", () => {
    expect(
      buildUpdatePayload(existing, { ...formValuesFor(existing), summary: "Renamed" }, ALL),
    ).toEqual({ rename: "Renamed" });
    expect(
      buildUpdatePayload(existing, { ...formValuesFor(existing), description: "" }, ALL),
    ).toEqual({ description: null });
  });
  it("clears the due date with null", () => {
    expect(buildUpdatePayload(existing, { ...formValuesFor(existing), date: "" }, ALL)).toEqual({
      due_date: null,
    });
  });
  it("does not touch unsupported fields even if the item has them", () => {
    expect(
      buildUpdatePayload(existing, { ...formValuesFor(existing), summary: "New" }, TITLE_ONLY),
    ).toEqual({ rename: "New" });
  });
  it("rejects a blank title", () => {
    expect(() =>
      buildUpdatePayload(existing, { ...formValuesFor(existing), summary: "" }, ALL),
    ).toThrow(/title/);
  });
});
