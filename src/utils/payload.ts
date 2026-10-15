import type { TodoCapabilities, TodoItem } from "../types/home-assistant";
import { dueToInputs, localDatetimeToIso } from "./items";

/** Raw values from the add/edit form. */
export interface TodoFormValues {
  summary: string;
  description: string;
  date: string;
  time: string;
}

export class FormValidationError extends Error {
  override name = "FormValidationError";
  constructor(
    message: string,
    readonly field: keyof TodoFormValues,
  ) {
    super(message);
  }
}

type DuePatch = { due_date?: string | null; due_datetime?: string | null };

export function canSetDue(caps: TodoCapabilities): boolean {
  return caps.dueDate || caps.dueDatetime;
}

function buildDue(values: TodoFormValues, caps: TodoCapabilities): DuePatch | null | undefined {
  const date = values.date.trim();
  const time = caps.dueDatetime ? values.time.trim() : "";
  if (!date && !time) return null; // explicitly no due date
  if (!date) throw new FormValidationError("Choose a date for the due time.", "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new FormValidationError("Enter a valid date.", "date");
  if (time) {
    if (!/^\d{2}:\d{2}$/.test(time)) throw new FormValidationError("Enter a valid time.", "time");
    return { due_datetime: localDatetimeToIso(date, time) };
  }
  if (caps.dueDate) return { due_date: date };
  throw new FormValidationError("This list requires a time for due dates.", "time");
}

function normalizedDescription(value: string): string | undefined {
  return value.trim() === "" ? undefined : value.replace(/\s+$/, "");
}

/** Service data for `todo.add_item` (without the entity target). */
export function buildAddPayload(
  values: TodoFormValues,
  caps: TodoCapabilities,
): Record<string, unknown> {
  const summary = values.summary.trim();
  if (!summary) throw new FormValidationError("Enter a task title.", "summary");
  const data: Record<string, unknown> = { item: summary };
  if (caps.description) {
    const description = normalizedDescription(values.description);
    if (description !== undefined) data.description = description;
  }
  if (canSetDue(caps)) {
    const due = buildDue(values, caps);
    if (due) Object.assign(data, due);
  }
  return data;
}

/**
 * Service data for `todo.update_item`, containing only fields the user changed
 * and the entity supports. Returns an empty object when nothing changed.
 * Fields omitted from the call are preserved by Home Assistant.
 */
export function buildUpdatePayload(
  item: TodoItem,
  values: TodoFormValues,
  caps: TodoCapabilities,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const summary = values.summary.trim();
  if (!summary) throw new FormValidationError("Enter a task title.", "summary");
  if (summary !== item.summary) patch.rename = summary;

  if (caps.description) {
    const description = normalizedDescription(values.description);
    if (description !== item.description) patch.description = description ?? null;
  }

  if (canSetDue(caps)) {
    const before = dueToInputs(item.due);
    const changed =
      values.date.trim() !== before.date ||
      (caps.dueDatetime && values.time.trim() !== before.time);
    if (changed) {
      const due = buildDue(values, caps);
      if (due) Object.assign(patch, due);
      else if (item.due) patch[caps.dueDate ? "due_date" : "due_datetime"] = null;
    }
  }
  return patch;
}

/** Initial form values for an item (or an empty form). */
export function formValuesFor(item?: TodoItem): TodoFormValues {
  const { date, time } = dueToInputs(item?.due);
  return {
    summary: item?.summary ?? "",
    description: item?.description ?? "",
    date,
    time,
  };
}
