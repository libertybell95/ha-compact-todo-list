import type { LovelaceCardConfig } from "./types/home-assistant";

export const CARD_TYPE = "ha-compact-todo-card";

export const SORT_MODES = ["manual", "alpha_asc", "alpha_desc", "due_asc", "due_desc"] as const;
export type SortMode = (typeof SORT_MODES)[number];

export interface CompactTodoCardConfig {
  type: string;
  entity: string;
  /** undefined → entity friendly name; "" → no title text. */
  title?: string;
  row_height: number;
  /** Maximum height of the task list in px. 0 disables the limit. */
  max_height: number;
  scrollable: boolean;
  expand_on_click: boolean;
  accordion: boolean;
  animate_expansion: boolean;
  show_completed: boolean;
  show_task_count: boolean;
  show_add_button: boolean;
  sort: SortMode;
  /** "auto" inherits the dashboard theme; otherwise the name of an installed theme. */
  theme: string;
}

export const DEFAULTS = {
  row_height: 36,
  max_height: 0,
  scrollable: true,
  expand_on_click: true,
  accordion: true,
  animate_expansion: true,
  show_completed: false,
  show_task_count: true,
  show_add_button: true,
  sort: "manual",
  theme: "auto",
} as const satisfies Partial<CompactTodoCardConfig>;

export const ROW_HEIGHT_MIN = 28;
export const ROW_HEIGHT_MAX = 64;
export const MAX_HEIGHT_MIN = 72;
export const MAX_HEIGHT_MAX = 5000;

/** Keys Home Assistant or common tooling may add to any card config; never warned about. */
const PASSTHROUGH_KEYS = new Set([
  "type",
  "grid_options",
  "layout_options",
  "view_layout",
  "visibility",
  "card_mod",
]);

const KNOWN_KEYS = new Set<string>(["entity", "title", ...Object.keys(DEFAULTS)]);

export class ConfigError extends Error {
  override name = "ConfigError";
}

export interface ValidationResult {
  config: CompactTodoCardConfig;
  unknownKeys: string[];
}

function readBoolean(raw: Record<string, unknown>, key: keyof typeof DEFAULTS): boolean {
  const value = raw[key];
  if (value === undefined || value === null) return DEFAULTS[key] as boolean;
  if (typeof value === "boolean") return value;
  throw new ConfigError(`"${key}" must be true or false (got ${JSON.stringify(value)}).`);
}

function readInteger(
  raw: Record<string, unknown>,
  key: "row_height" | "max_height",
  min: number,
  max: number,
  allowZero = false,
): number {
  const value = raw[key];
  if (value === undefined || value === null || value === "") return DEFAULTS[key];
  const num =
    typeof value === "string" && /^\s*\d+(\.\d+)?\s*(px)?\s*$/.test(value)
      ? parseFloat(value)
      : value;
  if (typeof num !== "number" || !Number.isFinite(num)) {
    throw new ConfigError(`"${key}" must be a number of pixels (got ${JSON.stringify(value)}).`);
  }
  const rounded = Math.round(num);
  if (allowZero && rounded === 0) return 0;
  if (rounded < min || rounded > max) {
    throw new ConfigError(
      `"${key}" must be between ${min} and ${max}${allowZero ? " (or 0 for no limit)" : ""} (got ${rounded}).`,
    );
  }
  return rounded;
}

/**
 * Validates a raw Lovelace config and fills in defaults.
 * Throws ConfigError with a user-facing message for invalid values.
 */
export function validateConfig(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ConfigError("Card configuration must be an object.");
  }
  const raw = input as Record<string, unknown>;

  const entity = raw.entity;
  if (entity === undefined || entity === null || entity === "") {
    throw new ConfigError(
      'Required option "entity" is missing. Example: entity: todo.shopping_list',
    );
  }
  if (typeof entity !== "string" || !/^todo\.[a-z0-9_]+$/.test(entity)) {
    throw new ConfigError(
      `"entity" must be a to-do list entity such as todo.shopping_list (got ${JSON.stringify(entity)}).`,
    );
  }

  let title: string | undefined;
  if (raw.title !== undefined && raw.title !== null) {
    if (typeof raw.title !== "string" && typeof raw.title !== "number") {
      throw new ConfigError('"title" must be text.');
    }
    title = String(raw.title);
  }

  const sort = raw.sort ?? DEFAULTS.sort;
  if (typeof sort !== "string" || !(SORT_MODES as readonly string[]).includes(sort)) {
    throw new ConfigError(
      `"sort" must be one of: ${SORT_MODES.join(", ")} (got ${JSON.stringify(sort)}).`,
    );
  }

  const theme = raw.theme ?? DEFAULTS.theme;
  if (typeof theme !== "string" || theme.trim() === "") {
    throw new ConfigError('"theme" must be "auto" or the name of an installed theme.');
  }

  const config: CompactTodoCardConfig = {
    type: typeof raw.type === "string" ? raw.type : `custom:${CARD_TYPE}`,
    entity,
    title,
    row_height: readInteger(raw, "row_height", ROW_HEIGHT_MIN, ROW_HEIGHT_MAX),
    max_height: readInteger(raw, "max_height", MAX_HEIGHT_MIN, MAX_HEIGHT_MAX, true),
    scrollable: readBoolean(raw, "scrollable"),
    expand_on_click: readBoolean(raw, "expand_on_click"),
    accordion: readBoolean(raw, "accordion"),
    animate_expansion: readBoolean(raw, "animate_expansion"),
    show_completed: readBoolean(raw, "show_completed"),
    show_task_count: readBoolean(raw, "show_task_count"),
    show_add_button: readBoolean(raw, "show_add_button"),
    sort: sort as SortMode,
    theme: theme.trim(),
  };

  const unknownKeys = Object.keys(raw).filter(
    (k) => !KNOWN_KEYS.has(k) && !PASSTHROUGH_KEYS.has(k),
  );
  return { config, unknownKeys };
}

/** Config offered by the card picker. Picks the first to-do entity if one exists. */
export function stubConfig(entityIds: string[]): Omit<LovelaceCardConfig, "type"> {
  const entity = entityIds.find((id) => id.startsWith("todo.")) ?? "todo.shopping_list";
  return { entity };
}
