import "../src/compact-todo-card";
import type { HomeAssistant, RawTodoItem } from "../src/types/home-assistant";

// Minimal ha-card stand-in so the card looks like it does inside a dashboard.
customElements.define(
  "ha-card",
  class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" }).innerHTML =
        `<style>:host{display:block;background:var(--ha-card-background,var(--card-background-color));border:1px solid var(--divider-color);border-radius:var(--ha-card-border-radius,12px);color:var(--primary-text-color)}</style><slot></slot>`;
    }
  },
);

type Listener = (msg: unknown) => void;

class DemoHass {
  listeners = new Set<Listener>();
  failNext = false;
  connected = true;
  uid = 1;
  cards = new Set<{ hass: HomeAssistant }>();

  constructor(
    public entityId: string,
    public items: RawTodoItem[],
  ) {}

  push() {
    for (const l of this.listeners) l({ items: structuredClone(this.items) });
    this.update();
  }

  update() {
    for (const card of this.cards) card.hass = this.hass();
  }

  hass(): HomeAssistant {
    return {
      states: {
        [this.entityId]: {
          entity_id: this.entityId,
          state: String(this.items.filter((i) => i.status !== "completed").length),
          attributes: { friendly_name: "KSI Tasks", supported_features: 127 },
          last_updated: new Date().toISOString(),
        },
      },
      connected: this.connected,
      language: "en",
      locale: { language: "en" },
      themes: { darkMode: document.documentElement.dataset.theme === "dark", themes: {} },
      connection: {
        subscribeMessage: async <T>(cb: (m: T) => void) => {
          const l = cb as Listener;
          this.listeners.add(l);
          setTimeout(() => l({ items: structuredClone(this.items) }), 150);
          return () => this.listeners.delete(l);
        },
      },
      callService: async (_d, service, data = {}, _t, _n, returnResponse) => {
        await new Promise((r) => setTimeout(r, 350));
        if (this.failNext) {
          this.failNext = false;
          throw { code: "home_assistant_error", message: "Simulated provider failure" };
        }
        if (service === "get_items" && returnResponse)
          return { response: { [this.entityId]: { items: this.items } } };
        const find = () => this.items.find((i) => i.uid === data.item || i.summary === data.item)!;
        if (service === "add_item") {
          this.items.push({
            uid: `new-${this.uid++}`,
            summary: data.item as string,
            status: "needs_action",
            description: (data.description as string) ?? null,
            due: (data.due_date ?? data.due_datetime ?? null) as string | null,
          });
        } else if (service === "update_item") {
          const item = find();
          if (data.rename) item.summary = data.rename as string;
          if (data.status) item.status = data.status as string;
          if ("description" in data) item.description = data.description as string | null;
          if ("due_date" in data) item.due = data.due_date as string | null;
          if ("due_datetime" in data) item.due = data.due_datetime as string | null;
        } else if (service === "remove_item") {
          const refs = data.item as string[];
          this.items = this.items.filter((i) => !refs.includes(i.uid!));
        }
        setTimeout(() => this.push(), 100);
        return undefined;
      },
    };
  }
}

const ksi: RawTodoItem[] = [
  {
    uid: "1",
    summary: "Dry Solids Radar Testing - Wait for replacement sensor",
    status: "needs_action",
    description: "Arrived. Most likely install at end of October",
  },
  {
    uid: "2",
    summary: "AB Hardware - Have Duane get hardware for local bench/lab",
    status: "needs_action",
    description: "For Kiosk OS. Right now hardware desired is a computer/server and a touchscreen",
    due: "2026-10-20",
  },
  {
    uid: "3",
    summary: "AB Sensor Form - Make an autoforming config value for for sensors",
    status: "needs_action",
    description:
      "I'm thinking this will need to be backwards compatible. Right now there is a python file on the AutoBulk server that defines form fields.\n\nWe'll need to think about security too so we can't have just anyone making changes. Talk to Duane about security considerations.",
  },
  {
    uid: "4",
    summary: "APG Radar Sensor",
    status: "needs_action",
    description: "Initial firmware built. Send to Sabetha for eventual installation.",
    due: "2026-10-10",
  },
  {
    uid: "5",
    summary: "Calvin Onboarding",
    status: "needs_action",
    description:
      "Push Duane to get me connected with Calvin so I can help ease his workload. https://example.com/a/very/long/url/that/should/wrap/instead/of/overflowing/the/card/layout",
  },
];

function generated(n: number): RawTodoItem[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `g${i}`,
    summary:
      i % 7 === 0
        ? `A deliberately long task title number ${i + 1} that will need truncation in the collapsed row`
        : `Task ${i + 1}`,
    status: i % 4 === 3 ? "completed" : "needs_action",
    description: i % 2 ? `Notes for task ${i + 1}\nSecond line` : null,
    completed: i % 4 === 3 ? new Date().toISOString() : null,
  }));
}

const lists = [
  new DemoHass("todo.ksi", ksi),
  new DemoHass("todo.big", generated(25)),
  new DemoHass("todo.huge", generated(100)),
];
const configs = [
  { entity: "todo.ksi", title: "KSI Tasks" },
  { entity: "todo.big", title: "Projects", show_completed: true, max_height: 300 },
  { entity: "todo.huge", title: "Backlog", max_height: 400 },
];

lists.forEach((list, i) => {
  const card = document.createElement("ha-compact-todo-card");
  card.setConfig({ type: "custom:ha-compact-todo-card", ...configs[i] });
  card.hass = list.hass();
  list.cards.add(card as unknown as { hass: HomeAssistant });
  document.getElementById(`c${i + 1}`)!.append(card);
});

document.getElementById("theme")!.onclick = () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  lists.forEach((l) => l.update());
};
document.getElementById("external")!.onclick = () => {
  const list = lists[0];
  list.items.unshift({
    uid: `ext-${Date.now()}`,
    summary: "Added by an automation",
    status: "needs_action",
  });
  list.push();
};
document.getElementById("fail")!.onclick = () => lists.forEach((l) => (l.failNext = true));
document.getElementById("disconnect")!.onclick = () =>
  lists.forEach((l) => {
    l.connected = !l.connected;
    l.update();
    if (l.connected) l.push();
  });

if (new URLSearchParams(location.search).get("theme") === "dark")
  document.getElementById("theme")!.click();
