import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/compact-todo-card";
import type { CompactTodoCard } from "../src/compact-todo-card";
import type { CompactTodoForm } from "../src/components/todo-form";
import type { CompactTodoRow } from "../src/components/todo-row";
import { MockHass, flush, manyItems } from "./helpers/mock-hass";

let card: CompactTodoCard;

async function mount(config: Record<string, unknown> = {}, mock = new MockHass()) {
  card = document.createElement("ha-compact-todo-card");
  card.setConfig({
    type: "custom:ha-compact-todo-card",
    entity: mock.entityId,
    animate_expansion: false,
    ...config,
  });
  card.hass = mock.hass();
  document.body.append(card);
  await flush();
  await card.updateComplete;
  return mock;
}

const root = () => card.shadowRoot!;
const rows = () => [...root().querySelectorAll<CompactTodoRow>("compact-todo-row")];
const row = (summary: string) => rows().find((r) => r.item.summary === summary)!;
const inRow = <T extends Element>(r: CompactTodoRow, sel: string) =>
  r.shadowRoot!.querySelector<T>(sel);
const settle = async () => {
  await flush();
  await card.updateComplete;
  await Promise.all(rows().map((r) => r.updateComplete));
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  card?.remove();
  vi.restoreAllMocks();
});

describe("rendering", () => {
  it("renders a header with title, count and add button, and compact rows", async () => {
    await mount({ title: "KSI Tasks" });
    expect(root().querySelector(".title")!.textContent).toBe("KSI Tasks");
    expect(root().querySelector(".count")!.textContent!.trim()).toBe("5");
    expect(root().querySelector(".add-button")).not.toBeNull();
    expect(rows().map((r) => r.item.summary)).toEqual([
      "Dry Solids Radar Testing",
      "AB Hardware",
      "AB Sensor Form",
      "APG Radar Sensor",
      "Calvin Onboarding",
    ]);
    expect(root().querySelector<HTMLElement>("ha-card")!.getAttribute("style")).toContain(
      "--ctc-row-height: 36px",
    );
    // Collapsed rows do not render details.
    expect(inRow(row("Dry Solids Radar Testing"), ".description")).toBeNull();
  });

  it("uses the entity name when no title is set and supports hiding the header pieces", async () => {
    await mount({ show_task_count: false, show_add_button: false });
    expect(root().querySelector(".title")!.textContent).toBe("KSi");
    expect(root().querySelector(".count")).toBeNull();
    expect(root().querySelector(".add-button")).toBeNull();
  });

  it("hides completed tasks by default and shows them in a section when enabled", async () => {
    await mount();
    expect(rows().some((r) => r.item.summary === "Old task")).toBe(false);
    card.setConfig({
      type: "x",
      entity: "todo.ksi",
      show_completed: true,
      animate_expansion: false,
    });
    await settle();
    expect(root().querySelector(".section-toggle")!.textContent).toContain("Completed");
    const completed = row("Old task");
    expect(inRow<HTMLInputElement>(completed, "input")!.checked).toBe(true);
  });

  it("renders task text as text, never as HTML", async () => {
    const mock = new MockHass({
      items: [
        {
          uid: "x",
          summary: "<img src=x onerror=alert(1)>",
          description: "<script>bad()</script>",
          status: "needs_action",
        },
      ],
    });
    await mount({}, mock);
    const r = rows()[0];
    expect(r.shadowRoot!.querySelector("img")).toBeNull();
    expect(inRow(r, ".summary")!.textContent).toBe("<img src=x onerror=alert(1)>");
    inRow<HTMLButtonElement>(r, "button.toggle")!.click();
    await settle();
    expect(r.shadowRoot!.querySelector("script")).toBeNull();
    expect(inRow(r, ".description")!.textContent).toBe("<script>bad()</script>");
  });

  it("shows an empty state", async () => {
    await mount({}, new MockHass({ items: [] }));
    expect(root().querySelector(".empty")!.textContent).toContain("No tasks");
  });

  it("applies max_height with scrolling for long lists", async () => {
    await mount({ max_height: 200 }, new MockHass({ items: manyItems(100) }));
    const container = root().querySelector<HTMLElement>(".list-container")!;
    expect(container.classList.contains("limited")).toBe(true);
    expect(container.style.maxHeight).toBe("200px");
    expect(rows()).toHaveLength(80);
  });

  it("does not limit height when scrollable is false", async () => {
    await mount({ max_height: 200, scrollable: false });
    expect(root().querySelector(".list-container")!.classList.contains("limited")).toBe(false);
  });
});

describe("interaction", () => {
  it("checkbox completes a task without expanding the row", async () => {
    const mock = await mount();
    const r = row("AB Hardware");
    inRow<HTMLInputElement>(r, "input.checkbox")!.click();
    await settle();
    expect(mock.callService).toHaveBeenCalledWith(
      "todo",
      "update_item",
      { status: "completed", item: "b" },
      { entity_id: "todo.ksi" },
      false,
    );
    expect(r.expanded).toBe(false);
    // Completed task disappears once Home Assistant confirms it.
    expect(rows().some((x) => x.item.uid === "b")).toBe(false);
  });

  it("restores a completed task when completed tasks are shown", async () => {
    const mock = await mount({ show_completed: true });
    inRow<HTMLInputElement>(row("Old task"), "input.checkbox")!.click();
    await settle();
    expect(mock.callService).toHaveBeenCalledWith(
      "todo",
      "update_item",
      { status: "needs_action", item: "f" },
      expect.anything(),
      false,
    );
  });

  it("clicking the title expands the full description with line breaks preserved", async () => {
    await mount();
    const r = row("Dry Solids Radar Testing");
    const toggle = inRow<HTMLButtonElement>(r, "button.toggle")!;
    toggle.click();
    await settle();
    expect(r.expanded).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(inRow(r, ".description")!.textContent).toBe(
      "Arrived. Most likely install at end\nof October.",
    );
    expect(inRow(r, ".detail-actions button")!.textContent!.trim()).toBe("Edit");
  });

  it("accordion keeps one row open; clicking an open row collapses it", async () => {
    await mount();
    inRow<HTMLButtonElement>(row("AB Hardware"), "button.toggle")!.click();
    await settle();
    inRow<HTMLButtonElement>(row("AB Sensor Form"), "button.toggle")!.click();
    await settle();
    expect(row("AB Hardware").expanded).toBe(false);
    expect(row("AB Sensor Form").expanded).toBe(true);
    inRow<HTMLButtonElement>(row("AB Sensor Form"), "button.toggle")!.click();
    await settle();
    expect(rows().some((r) => r.expanded)).toBe(false);
  });

  it("allows several rows open when accordion is off", async () => {
    await mount({ accordion: false });
    inRow<HTMLButtonElement>(row("AB Hardware"), "button.toggle")!.click();
    inRow<HTMLButtonElement>(row("AB Sensor Form"), "button.toggle")!.click();
    await settle();
    expect(rows().filter((r) => r.expanded)).toHaveLength(2);
  });

  it("keeps the expanded row open across list updates", async () => {
    const mock = await mount();
    inRow<HTMLButtonElement>(row("AB Hardware"), "button.toggle")!.click();
    await settle();
    mock.items.unshift({ uid: "new", summary: "Added elsewhere", status: "needs_action" });
    mock.push();
    await settle();
    expect(row("AB Hardware").expanded).toBe(true);
  });

  it("with expand_on_click off, only the chevron button expands", async () => {
    await mount({ expand_on_click: false });
    const r = row("AB Hardware");
    expect(inRow(r, "button.toggle")).toBeNull();
    inRow<HTMLButtonElement>(r, ".toggle-alt")!.click();
    await settle();
    expect(r.expanded).toBe(true);
  });

  it("collapse animation keeps details rendered until the transition ends", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
    await mount({ animate_expansion: true });
    const r = row("Dry Solids Radar Testing");
    inRow<HTMLButtonElement>(r, "button.toggle")!.click();
    await settle();
    await new Promise((res) => requestAnimationFrame(() => res(null)));
    await r.updateComplete;
    expect(inRow(r, ".details-wrap")!.classList.contains("open")).toBe(true);
    inRow<HTMLButtonElement>(r, "button.toggle")!.click();
    await settle();
    expect(inRow(r, ".details-wrap")!.hasAttribute("hidden")).toBe(false);
    await new Promise((res) => setTimeout(res, 350));
    await r.updateComplete;
    expect(inRow(r, ".details-wrap")!.hasAttribute("hidden")).toBe(true);
  });

  it("arrow keys move focus between rows", async () => {
    await mount();
    // happy-dom cannot report shadowRoot.activeElement reliably, so observe the focus() call.
    const nextToggle = inRow<HTMLButtonElement>(rows()[1], "button.toggle")!;
    const focusSpy = vi.spyOn(nextToggle, "focus");
    const toggle = inRow<HTMLButtonElement>(rows()[0], "button.toggle")!;
    toggle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, composed: true }),
    );
    expect(focusSpy).toHaveBeenCalled();
  });
});

describe("adding", () => {
  async function openAdd() {
    root().querySelector<HTMLButtonElement>(".add-button")!.click();
    await settle();
    return root().querySelector<CompactTodoForm>("compact-todo-form")!;
  }

  it("validates the title and adds a task", async () => {
    const mock = await mount();
    const form = await openAdd();
    const save = form.shadowRoot!.querySelector<HTMLButtonElement>("button[type=submit]")!;
    expect(save.disabled).toBe(true);
    form
      .shadowRoot!.querySelector("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await form.updateComplete;
    expect(form.shadowRoot!.querySelector(".form-error")!.textContent).toContain(
      "Enter a task title",
    );
    expect(mock.callService).not.toHaveBeenCalledWith(
      "todo",
      "add_item",
      expect.anything(),
      expect.anything(),
      false,
    );

    const input = form.shadowRoot!.querySelector<HTMLInputElement>("input[name=summary]")!;
    input.value = "  Order parts  ";
    input.dispatchEvent(new Event("input"));
    const desc = form.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea")!;
    desc.value = "Line 1\nLine 2";
    desc.dispatchEvent(new Event("input"));
    await form.updateComplete;
    form
      .shadowRoot!.querySelector("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await settle();
    expect(mock.callService).toHaveBeenCalledWith(
      "todo",
      "add_item",
      { item: "Order parts", description: "Line 1\nLine 2" },
      { entity_id: "todo.ksi" },
      false,
    );
    expect(root().querySelector("compact-todo-form")).toBeNull();
    expect(rows().some((r) => r.item.summary === "Order parts")).toBe(true);
  });

  it("Escape cancels the add form", async () => {
    await mount();
    const form = await openAdd();
    form
      .shadowRoot!.querySelector("input")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    expect(root().querySelector("compact-todo-form")).toBeNull();
  });

  it("keeps the user's input and shows the error when adding fails", async () => {
    const mock = await mount();
    mock.failNext = {
      service: "add_item",
      error: { code: "home_assistant_error", message: "Provider offline" },
    };
    const form = await openAdd();
    const input = form.shadowRoot!.querySelector<HTMLInputElement>("input[name=summary]")!;
    input.value = "Important";
    input.dispatchEvent(new Event("input"));
    form
      .shadowRoot!.querySelector("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await settle();
    await form.updateComplete;
    expect(form.isConnected).toBe(true);
    expect(form.shadowRoot!.querySelector(".form-error")!.textContent).toContain(
      "Provider offline",
    );
    expect(form.shadowRoot!.querySelector<HTMLInputElement>("input[name=summary]")!.value).toBe(
      "Important",
    );
  });

  it("hides fields the list does not support", async () => {
    await mount({}, new MockHass({ features: 1 | 2 | 4 }));
    const form = await openAdd();
    expect(form.shadowRoot!.querySelector("textarea")).toBeNull();
    expect(form.shadowRoot!.querySelector("input[type=date]")).toBeNull();
    expect(form.shadowRoot!.querySelector(".hint")!.textContent).toContain("titles only");
  });

  it("hides the add button when the list cannot create items", async () => {
    await mount({}, new MockHass({ features: 4 }));
    expect(root().querySelector(".add-button")).toBeNull();
  });
});

describe("editing and deleting", () => {
  async function openEditor(summary: string) {
    const r = row(summary);
    inRow<HTMLButtonElement>(r, "button.toggle")!.click();
    await settle();
    inRow<HTMLButtonElement>(r, ".detail-actions button")!.click();
    await settle();
    const form = inRow<CompactTodoForm>(r, "compact-todo-form")!;
    await form.updateComplete;
    return { r, form };
  }

  it("edit opens an inline editor prefilled with current values and saves only changes", async () => {
    const mock = await mount();
    const { r, form } = await openEditor("Dry Solids Radar Testing");
    expect(r.expanded).toBe(true);
    const input = form.shadowRoot!.querySelector<HTMLInputElement>("input[name=summary]")!;
    expect(input.value).toBe("Dry Solids Radar Testing");
    expect(form.shadowRoot!.querySelector("textarea")!.value).toBe(
      "Arrived. Most likely install at end\nof October.",
    );
    input.value = "Dry Solids Radar Testing – done soon";
    input.dispatchEvent(new Event("input"));
    form
      .shadowRoot!.querySelector("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await settle();
    expect(mock.callService).toHaveBeenCalledWith(
      "todo",
      "update_item",
      { rename: "Dry Solids Radar Testing – done soon", item: "a" },
      { entity_id: "todo.ksi" },
      false,
    );
    expect(mock.items[0].description).toBe("Arrived. Most likely install at end\nof October.");
    expect(inRow(rows()[0], "compact-todo-form")).toBeNull();
  });

  it("clicking another row while editing does not discard the edit form", async () => {
    await mount();
    const { r } = await openEditor("AB Hardware");
    inRow<HTMLButtonElement>(row("AB Sensor Form"), "button.toggle")!.click();
    await settle();
    expect(r.expanded).toBe(true);
    expect(inRow(r, "compact-todo-form")).not.toBeNull();
  });

  it("delete requires confirmation", async () => {
    const mock = await mount();
    const { form } = await openEditor("APG Radar Sensor");
    const deleteBtn = [...form.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent!.trim() === "Delete",
    )!;
    deleteBtn.click();
    await form.updateComplete;
    expect(mock.callService).not.toHaveBeenCalledWith(
      "todo",
      "remove_item",
      expect.anything(),
      expect.anything(),
      false,
    );
    expect(form.shadowRoot!.querySelector(".confirm")!.textContent).toContain(
      "Delete this task permanently?",
    );
    form.shadowRoot!.querySelector<HTMLButtonElement>(".confirm .danger")!.click();
    await settle();
    expect(mock.callService).toHaveBeenCalledWith(
      "todo",
      "remove_item",
      { item: ["d"] },
      { entity_id: "todo.ksi" },
      false,
    );
    expect(rows().some((r) => r.item.uid === "d")).toBe(false);
  });

  it("hides edit when the list cannot update or delete", async () => {
    await mount({}, new MockHass({ features: 1 }));
    const r = row("AB Hardware");
    inRow<HTMLButtonElement>(r, "button.toggle")!.click();
    await settle();
    expect(inRow(r, ".detail-actions")).toBeNull();
    expect(inRow<HTMLInputElement>(r, "input.checkbox")!.disabled).toBe(true);
  });
});

describe("errors and states", () => {
  it("shows an error when completing a task fails, and the task stays", async () => {
    const mock = await mount();
    mock.failNext = {
      service: "update_item",
      error: { code: "home_assistant_error", message: "Provider offline" },
    };
    inRow<HTMLInputElement>(row("AB Hardware"), "input.checkbox")!.click();
    await settle();
    const alert = root().querySelector(".banner.error")!;
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toContain("Provider offline");
    expect(inRow<HTMLInputElement>(row("AB Hardware"), "input.checkbox")!.checked).toBe(false);
  });

  it("warns when the entity does not exist", async () => {
    const mock = new MockHass();
    card = document.createElement("ha-compact-todo-card");
    card.setConfig({ type: "x", entity: "todo.missing" });
    card.hass = mock.hass();
    document.body.append(card);
    await settle();
    expect(root().querySelector(".banner.warning")!.textContent).toContain(
      "Entity not available: todo.missing",
    );
    expect(mock.subscribeMessage).not.toHaveBeenCalled();
  });

  it("rejects non-todo entities at configuration time", () => {
    const el = document.createElement("ha-compact-todo-card");
    expect(() => el.setConfig({ type: "x", entity: "light.kitchen" })).toThrow(/to-do list entity/);
  });

  it("disables changes when the entity is unavailable", async () => {
    const mock = new MockHass();
    mock.stateValue = "unavailable";
    await mount({}, mock);
    expect(root().querySelector(".banner.warning")!.textContent).toContain("unavailable");
    expect(inRow<HTMLInputElement>(rows()[0], "input.checkbox")!.disabled).toBe(true);
    expect(root().querySelector(".add-button")).toBeNull();
  });

  it("shows a disconnected warning and a refresh button", async () => {
    const mock = await mount();
    mock.connected = false;
    card.hass = mock.hass();
    await settle();
    expect(root().querySelector(".banner.warning")!.textContent).toContain("Disconnected");
    expect(root().querySelector("[aria-label='Refresh tasks']")).not.toBeNull();
  });

  it("shows a retrieval error when the list cannot be loaded", async () => {
    const mock = new MockHass({ subscribeError: { code: "invalid_entity_id" } });
    mock.failNext = {
      service: "get_items",
      error: { code: "not_found", message: "Entity not found" },
    };
    await mount({}, mock);
    expect(root().querySelector(".banner.error")!.textContent).toContain("Could not load tasks");
  });
});

describe("lifecycle and performance", () => {
  it("unsubscribes when removed and resubscribes when re-attached", async () => {
    const mock = await mount();
    expect(mock.subscribers.size).toBe(1);
    card.remove();
    expect(mock.subscribers.size).toBe(0);
    document.body.append(card);
    await settle();
    expect(mock.subscribers.size).toBe(1);
  });

  it("does not re-render for unrelated hass updates", async () => {
    const mock = await mount();
    const renderSpy = vi.spyOn(card, "render");
    const base = mock.hass();
    card.hass = {
      ...base,
      states: {
        ...base.states,
        [mock.entityId]: card["_stateObj"],
        "light.x": { entity_id: "light.x", state: "on", attributes: {} },
      },
    };
    await card.updateComplete;
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it("does not call the API on ordinary renders", async () => {
    const mock = await mount();
    const calls = mock.callService.mock.calls.length + mock.subscribeMessage.mock.calls.length;
    card.requestUpdate();
    await card.updateComplete;
    expect(mock.callService.mock.calls.length + mock.subscribeMessage.mock.calls.length).toBe(
      calls,
    );
  });

  it("switching entity resubscribes to the new list", async () => {
    const mock = await mount();
    const other = new MockHass({
      entityId: "todo.other",
      items: [{ uid: "o", summary: "Other", status: "needs_action" }],
    });
    const hass = mock.hass();
    hass.states["todo.other"] = other.stateObj();
    card.hass = hass;
    // Route subscriptions for todo.other to the second mock.
    mock.subscribeMessage.mockImplementation((cb, msg) => other.subscribeMessage(cb, msg));
    card.setConfig({ type: "x", entity: "todo.other" });
    await settle();
    expect(mock.subscribers.size).toBe(0);
    expect(rows().map((r) => r.item.summary)).toEqual(["Other"]);
  });
});

describe("theme and card contract", () => {
  it("styles are built from Home Assistant theme variables", async () => {
    await mount();
    const css = [...(card.constructor as typeof CompactTodoCard).elementStyles]
      .map((s) => (s as CSSStyleSheet & { cssText: string }).cssText)
      .join("");
    for (const v of [
      "--primary-text-color",
      "--secondary-text-color",
      "--divider-color",
      "--primary-color",
      "--error-color",
    ]) {
      expect(css).toContain(v);
    }
  });

  it("applies a named theme to the card", async () => {
    const mock = new MockHass();
    card = document.createElement("ha-compact-todo-card");
    card.setConfig({ type: "x", entity: "todo.ksi", theme: "Ocean" });
    card.hass = mock.hass({
      themes: { darkMode: false, themes: { Ocean: { "primary-color": "#123456" } } },
    });
    document.body.append(card);
    await settle();
    expect(card.style.getPropertyValue("--primary-color")).toBe("#123456");
  });

  it("implements the Lovelace sizing and editor contract", async () => {
    const mock = await mount({ max_height: 100 });
    expect(card.getCardSize()).toBe(Math.ceil((48 + 100) / 50));
    expect(card.getGridOptions()).toEqual({ columns: 6, min_columns: 3 });
    const Card = customElements.get("ha-compact-todo-card") as unknown as {
      getStubConfig(h: unknown): unknown;
      getConfigForm(): { schema: Array<{ name: string; selector?: unknown }> };
    };
    expect(Card.getStubConfig(mock.hass())).toEqual({ entity: "todo.ksi" });
    const schema = Card.getConfigForm().schema;
    expect(schema[0]).toEqual({
      name: "entity",
      required: true,
      selector: { entity: { domain: "todo" } },
    });
    expect(window.customCards?.some((c) => c.type === "ha-compact-todo-card")).toBe(true);
  });
});
