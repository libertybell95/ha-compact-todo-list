import { describe, expect, it } from "vitest";
import type { TodoItem } from "../src/types/home-assistant";
import {
  MalformedResponseError,
  capabilitiesFor,
  dueToInputs,
  formatDueShort,
  isOverdue,
  localDatetimeToIso,
  normalizeItems,
  parseDue,
  partitionItems,
  preserveIdentity,
  sortItems,
} from "../src/utils/items";

const item = (over: Partial<TodoItem>): TodoItem => ({
  key: over.uid ?? over.summary ?? "k",
  ref: over.uid ?? over.summary ?? "k",
  summary: "",
  status: "needs_action",
  ...over,
});

describe("normalizeItems", () => {
  it("normalizes subscription payloads including nulls", () => {
    const items = normalizeItems({
      items: [
        {
          uid: "1",
          summary: "One",
          status: "needs_action",
          description: null,
          due: null,
          completed: null,
        },
        { uid: "2", summary: "Two", status: "completed", description: "x", due: "2026-10-20" },
      ],
    });
    expect(items).toEqual([
      {
        key: "1",
        ref: "1",
        uid: "1",
        summary: "One",
        status: "needs_action",
        due: undefined,
        description: undefined,
        completed: undefined,
      },
      {
        key: "2",
        ref: "2",
        uid: "2",
        summary: "Two",
        status: "completed",
        due: "2026-10-20",
        description: "x",
        completed: undefined,
      },
    ]);
  });

  it("falls back to summary references for providers without uids and de-duplicates keys", () => {
    const items = normalizeItems({ items: [{ summary: "Milk" }, { summary: "Milk" }] });
    expect(items.map((i) => i.ref)).toEqual(["Milk", "Milk"]);
    expect(new Set(items.map((i) => i.key)).size).toBe(2);
  });

  it("treats unknown statuses as needs_action and drops non-object entries", () => {
    const items = normalizeItems({ items: [null, 5, { uid: "x", summary: 7, status: "weird" }] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ summary: "7", status: "needs_action" });
  });

  it.each([null, undefined, "x", {}, { items: "nope" }])(
    "rejects malformed payload %j",
    (payload) => {
      expect(() => normalizeItems(payload)).toThrow(MalformedResponseError);
    },
  );

  it("never interprets content as HTML (values are kept verbatim as text)", () => {
    const [i] = normalizeItems({ items: [{ uid: "x", summary: "<img src=x onerror=alert(1)>" }] });
    expect(i.summary).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("capabilitiesFor", () => {
  it("decodes supported_features bits", () => {
    const caps = capabilitiesFor({
      entity_id: "todo.x",
      state: "1",
      attributes: { supported_features: 1 | 4 | 64 },
    });
    expect(caps).toEqual({
      create: true,
      delete: false,
      update: true,
      dueDate: false,
      dueDatetime: false,
      description: true,
    });
  });
  it("treats missing features as read-only", () => {
    expect(Object.values(capabilitiesFor(undefined)).some(Boolean)).toBe(false);
  });
});

describe("sorting and filtering", () => {
  const list = [
    item({ uid: "1", summary: "banana", due: "2026-10-22" }),
    item({ uid: "2", summary: "Apple" }),
    item({ uid: "3", summary: "cherry", due: "2026-10-20T09:00:00-05:00", status: "completed" }),
    item({ uid: "4", summary: "item 10", due: "2026-10-21" }),
    item({ uid: "5", summary: "item 9" }),
  ];

  it("keeps provider order for manual", () => {
    expect(sortItems(list, "manual").map((i) => i.uid)).toEqual(["1", "2", "3", "4", "5"]);
  });
  it("sorts alphabetically, case-insensitive and numeric-aware", () => {
    expect(sortItems(list, "alpha_asc").map((i) => i.summary)).toEqual([
      "Apple",
      "banana",
      "cherry",
      "item 9",
      "item 10",
    ]);
    expect(sortItems(list, "alpha_desc").map((i) => i.summary)[0]).toBe("item 10");
  });
  it("sorts by due date with undated items last", () => {
    expect(sortItems(list, "due_asc").map((i) => i.uid)).toEqual(["3", "4", "1", "2", "5"]);
    expect(sortItems(list, "due_desc").map((i) => i.uid)).toEqual(["1", "4", "3", "2", "5"]);
  });
  it("does not mutate its input", () => {
    const copy = [...list];
    sortItems(list, "alpha_asc");
    expect(list).toEqual(copy);
  });
  it("partitions by status", () => {
    const { active, completed } = partitionItems(list);
    expect(active.map((i) => i.uid)).toEqual(["1", "2", "4", "5"]);
    expect(completed.map((i) => i.uid)).toEqual(["3"]);
  });
});

describe("due dates", () => {
  it("parses date-only values as local dates", () => {
    const d = parseDue("2026-10-20")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 20, 0]);
  });
  it("detects overdue items", () => {
    const now = new Date(2026, 9, 15, 12, 0);
    expect(isOverdue(item({ due: "2026-10-14" }), now)).toBe(true);
    expect(isOverdue(item({ due: "2026-10-15" }), now)).toBe(false);
    expect(isOverdue(item({ due: new Date(2026, 9, 15, 11, 0).toISOString() }), now)).toBe(true);
    expect(isOverdue(item({ due: "2026-10-14", status: "completed" }), now)).toBe(false);
    expect(isOverdue(item({ due: "garbage" }), now)).toBe(false);
  });
  it("round-trips local datetimes through form inputs", () => {
    const iso = localDatetimeToIso("2026-10-20", "15:30");
    expect(iso).toMatch(/^2026-10-20T15:30:00[+-]\d{2}:\d{2}$/);
    expect(dueToInputs(iso)).toEqual({ date: "2026-10-20", time: "15:30" });
    expect(dueToInputs("2026-10-20")).toEqual({ date: "2026-10-20", time: "" });
    expect(dueToInputs(undefined)).toEqual({ date: "", time: "" });
  });
  it("formats short labels", () => {
    expect(formatDueShort("2026-10-20", "en-US", new Date(2026, 0, 1))).toBe("Oct 20");
    expect(formatDueShort("2027-01-02", "en-US", new Date(2026, 0, 1))).toBe("Jan 2, 2027");
    expect(formatDueShort("not a date", "en-US")).toBe("not a date");
  });
});

describe("preserveIdentity", () => {
  it("reuses unchanged objects so rows can skip re-rendering", () => {
    const prev = normalizeItems({
      items: [
        { uid: "1", summary: "a" },
        { uid: "2", summary: "b" },
      ],
    });
    const next = normalizeItems({
      items: [
        { uid: "1", summary: "a" },
        { uid: "2", summary: "B" },
      ],
    });
    const merged = preserveIdentity(prev, next);
    expect(merged[0]).toBe(prev[0]);
    expect(merged[1]).toBe(next[1]);
  });
});
