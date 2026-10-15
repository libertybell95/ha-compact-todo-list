import type { SortMode } from "../config";
import {
  TodoListEntityFeature as F,
  type HassEntity,
  type RawTodoItem,
  type TodoCapabilities,
  type TodoItem,
} from "../types/home-assistant";

export class MalformedResponseError extends Error {
  override name = "MalformedResponseError";
}

export function capabilitiesFor(stateObj: HassEntity | undefined): TodoCapabilities {
  const raw = stateObj?.attributes.supported_features;
  const bits = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  return {
    create: (bits & F.CREATE_TODO_ITEM) !== 0,
    delete: (bits & F.DELETE_TODO_ITEM) !== 0,
    update: (bits & F.UPDATE_TODO_ITEM) !== 0,
    dueDate: (bits & F.SET_DUE_DATE_ON_ITEM) !== 0,
    dueDatetime: (bits & F.SET_DUE_DATETIME_ON_ITEM) !== 0,
    description: (bits & F.SET_DESCRIPTION_ON_ITEM) !== 0,
  };
}

const optString = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

/**
 * Validates and normalizes an `{ items: [...] }` payload. Entries that are not
 * objects are dropped; a payload without an items array is rejected.
 */
export function normalizeItems(payload: unknown): TodoItem[] {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { items?: unknown }).items)
  ) {
    throw new MalformedResponseError("Home Assistant returned an unexpected to-do list format.");
  }
  const result: TodoItem[] = [];
  const seenKeys = new Set<string>();
  (payload as { items: unknown[] }).items.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const raw = entry as RawTodoItem;
    const summary =
      typeof raw.summary === "string"
        ? raw.summary
        : raw.summary == null
          ? ""
          : String(raw.summary);
    const uid = optString(raw.uid);
    let key = uid ?? `summary:${summary}`;
    if (seenKeys.has(key)) key = `${key}#${index}`;
    seenKeys.add(key);
    result.push({
      key,
      ref: uid ?? summary,
      uid,
      summary,
      status: raw.status === "completed" ? "completed" : "needs_action",
      due: optString(raw.due),
      description: optString(raw.description),
      completed: optString(raw.completed),
    });
  });
  return result;
}

export function itemsEqual(a: TodoItem, b: TodoItem): boolean {
  return (
    a.key === b.key &&
    a.ref === b.ref &&
    a.summary === b.summary &&
    a.status === b.status &&
    a.due === b.due &&
    a.description === b.description &&
    a.completed === b.completed
  );
}

/** Reuses previous item objects that did not change so unchanged rows skip re-rendering. */
export function preserveIdentity(previous: TodoItem[] | undefined, next: TodoItem[]): TodoItem[] {
  if (!previous?.length) return next;
  const byKey = new Map(previous.map((item) => [item.key, item]));
  return next.map((item) => {
    const old = byKey.get(item.key);
    return old && itemsEqual(old, item) ? old : item;
  });
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateOnly(due: string): boolean {
  return DATE_ONLY.test(due);
}

/** Parses a due value. Date-only values are interpreted as local midnight, not UTC. */
export function parseDue(due: string | undefined): Date | undefined {
  if (!due) return undefined;
  const m = DATE_ONLY.exec(due);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(due);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** A date-only due is overdue from the following day; a datetime from its exact time. */
export function isOverdue(item: TodoItem, now: Date = new Date()): boolean {
  if (item.status === "completed" || !item.due) return false;
  const due = parseDue(item.due);
  if (!due) return false;
  if (isDateOnly(item.due)) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return due.getTime() < today.getTime();
  }
  return due.getTime() < now.getTime();
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

/** Returns a new sorted array; "manual" keeps the provider's order. Missing due dates sort last. */
export function sortItems(items: readonly TodoItem[], mode: SortMode): TodoItem[] {
  const copy = [...items];
  switch (mode) {
    case "alpha_asc":
      return copy.sort((a, b) => compareText(a.summary, b.summary));
    case "alpha_desc":
      return copy.sort((a, b) => compareText(b.summary, a.summary));
    case "due_asc":
    case "due_desc": {
      const dir = mode === "due_asc" ? 1 : -1;
      return copy.sort((a, b) => {
        const da = parseDue(a.due)?.getTime();
        const db = parseDue(b.due)?.getTime();
        if (da === undefined && db === undefined) return 0;
        if (da === undefined) return 1;
        if (db === undefined) return -1;
        return (da - db) * dir;
      });
    }
    default:
      return copy;
  }
}

export interface PartitionedItems {
  active: TodoItem[];
  completed: TodoItem[];
}

/** Splits items by their server-confirmed status. */
export function partitionItems(items: readonly TodoItem[]): PartitionedItems {
  const active: TodoItem[] = [];
  const completed: TodoItem[] = [];
  for (const item of items) (item.status === "completed" ? completed : active).push(item);
  return { active, completed };
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cacheKey = `${locale ?? ""}|${JSON.stringify(options)}`;
  let fmt = formatterCache.get(cacheKey);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat(locale, options);
    } catch {
      fmt = new Intl.DateTimeFormat(undefined, options);
    }
    formatterCache.set(cacheKey, fmt);
  }
  return fmt;
}

/** Short label for the collapsed row, e.g. "Oct 20" or "Oct 20, 3:00 PM". */
export function formatDueShort(due: string, locale?: string, now: Date = new Date()): string {
  const date = parseDue(due);
  if (!date) return due;
  const sameYear = date.getFullYear() === now.getFullYear();
  const dateOpts: Intl.DateTimeFormatOptions = sameYear
    ? { month: "short", day: "numeric" }
    : { year: "numeric", month: "short", day: "numeric" };
  if (isDateOnly(due)) return formatter(locale, dateOpts).format(date);
  return formatter(locale, { ...dateOpts, hour: "numeric", minute: "2-digit" }).format(date);
}

/** Long label for the expanded details. */
export function formatDueLong(due: string, locale?: string): string {
  const date = parseDue(due);
  if (!date) return due;
  if (isDateOnly(due)) return formatter(locale, { dateStyle: "full" }).format(date);
  return formatter(locale, { dateStyle: "full", timeStyle: "short" }).format(date);
}

export function formatTimestamp(value: string, locale?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatter(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Splits a due value into local `YYYY-MM-DD` and `HH:MM` strings for form inputs. */
export function dueToInputs(due: string | undefined): { date: string; time: string } {
  if (!due) return { date: "", time: "" };
  if (isDateOnly(due)) return { date: due, time: "" };
  const d = parseDue(due);
  if (!d) return { date: "", time: "" };
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Builds an ISO 8601 datetime with the browser's UTC offset, e.g. 2026-10-20T15:00:00-05:00. */
export function localDatetimeToIso(date: string, time: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const local = new Date(y, mo - 1, d, h, mi, 0);
  const offsetMin = -local.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${date}T${pad(h)}:${pad(mi)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
