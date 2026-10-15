import { DEFAULTS, MAX_HEIGHT_MAX, ROW_HEIGHT_MAX, ROW_HEIGHT_MIN } from "./config";

/**
 * Visual editor built on Home Assistant's documented `getConfigForm()` contract:
 * Home Assistant renders the form from this schema using its own selectors,
 * so the card does not depend on internal frontend components.
 */

interface SchemaField {
  name: string;
  type?: string;
  required?: boolean;
  default?: unknown;
  selector?: Record<string, unknown>;
  schema?: SchemaField[];
}

const LABELS: Record<string, string> = {
  entity: "To-do list",
  title: "Title",
  row_height: "Row height",
  max_height: "Maximum list height",
  scrollable: "Scroll when taller than the maximum height",
  expand_on_click: "Expand when the title is clicked",
  accordion: "Accordion (one task open at a time)",
  animate_expansion: "Animate expanding and collapsing",
  show_completed: "Show completed tasks",
  show_task_count: "Show remaining task count",
  show_add_button: "Show add button",
  sort: "Sort order",
  theme: "Theme",
};

const HELPERS: Record<string, string> = {
  title: "Leave empty to use the list's name.",
  row_height: `Height of a collapsed task in pixels (${ROW_HEIGHT_MIN}–${ROW_HEIGHT_MAX}). Default ${DEFAULTS.row_height}.`,
  max_height: "Maximum height of the task list in pixels. 0 means no limit; otherwise at least 72.",
  expand_on_click: "When off, only the chevron button expands a task.",
  show_completed: "Completed tasks appear in a collapsible section below open tasks.",
  sort: "“Manual” keeps the order from Home Assistant.",
};

const SCHEMA: SchemaField[] = [
  { name: "entity", required: true, selector: { entity: { domain: "todo" } } },
  { name: "title", selector: { text: {} } },
  {
    name: "",
    type: "grid",
    schema: [
      {
        name: "row_height",
        default: DEFAULTS.row_height,
        selector: {
          number: {
            min: ROW_HEIGHT_MIN,
            max: ROW_HEIGHT_MAX,
            step: 1,
            mode: "box",
            unit_of_measurement: "px",
          },
        },
      },
      {
        name: "max_height",
        default: DEFAULTS.max_height,
        selector: {
          number: { min: 0, max: MAX_HEIGHT_MAX, step: 10, mode: "box", unit_of_measurement: "px" },
        },
      },
    ],
  },
  {
    name: "sort",
    default: DEFAULTS.sort,
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "manual", label: "Manual" },
          { value: "alpha_asc", label: "Alphabetical (A–Z)" },
          { value: "alpha_desc", label: "Alphabetical (Z–A)" },
          { value: "due_asc", label: "Due date (soonest first)" },
          { value: "due_desc", label: "Due date (latest first)" },
        ],
      },
    },
  },
  ...(
    [
      "show_completed",
      "show_task_count",
      "show_add_button",
      "accordion",
      "expand_on_click",
      "animate_expansion",
      "scrollable",
    ] as const
  ).map((name) => ({ name, default: DEFAULTS[name], selector: { boolean: {} } })),
  { name: "theme", selector: { theme: {} } },
];

export function getConfigForm() {
  return {
    schema: SCHEMA,
    computeLabel: (field: { name: string }) => LABELS[field.name],
    computeHelper: (field: { name: string }) => HELPERS[field.name],
  };
}
