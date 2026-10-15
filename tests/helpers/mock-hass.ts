import { vi } from "vitest";
import type { HassEntity, HomeAssistant, RawTodoItem } from "../../src/types/home-assistant";

export const ALL_FEATURES = 1 | 2 | 4 | 8 | 16 | 32 | 64;

export interface MockOptions {
  entityId?: string;
  items?: RawTodoItem[];
  features?: number;
  /** Reject todo/item/subscribe with this error. */
  subscribeError?: unknown;
  /** Delay (ms) before service calls resolve; 0 resolves on the next microtask. */
  serviceDelay?: number;
}

/**
 * In-memory stand-in for the Home Assistant frontend `hass` object with a
 * to-do entity. Service calls mutate the list and push updates to subscribers,
 * like Home Assistant does.
 */
export class MockHass {
  entityId: string;
  items: RawTodoItem[];
  features: number;
  subscribers = new Set<(msg: unknown) => void>();
  failNext: { service: string; error: unknown } | undefined;
  /** When true, service calls succeed but no update is pushed (simulates a lost event). */
  suppressPush = false;
  subscribeError: unknown;
  serviceDelay: number;
  connected = true;
  stateValue = "unknown";
  private uidCounter = 1000;

  readonly subscribeMessage = vi.fn(
    async (callback: (msg: unknown) => void, msg: Record<string, unknown>) => {
      if (this.subscribeError) throw this.subscribeError;
      if (msg.type !== "todo/item/subscribe" || msg.entity_id !== this.entityId) {
        throw {
          code: "invalid_entity_id",
          message: `To-do list entity not found: ${msg.entity_id}`,
        };
      }
      this.subscribers.add(callback);
      queueMicrotask(() => callback(this.payload()));
      return () => this.subscribers.delete(callback);
    },
  );

  readonly callService = vi.fn(
    async (
      domain: string,
      service: string,
      data: Record<string, unknown> = {},
      target?: { entity_id?: string | string[] },
      _notify?: boolean,
      returnResponse?: boolean,
    ) => {
      if (this.serviceDelay) await new Promise((r) => setTimeout(r, this.serviceDelay));
      if (this.failNext && this.failNext.service === service) {
        const { error } = this.failNext;
        this.failNext = undefined;
        throw error;
      }
      if (domain !== "todo" || target?.entity_id !== this.entityId) {
        throw { code: "not_found", message: "Entity not found" };
      }
      switch (service) {
        case "get_items":
          return returnResponse
            ? { context: {}, response: { [this.entityId]: this.payload() } }
            : undefined;
        case "add_item":
          this.items.push({
            uid: `uid-${this.uidCounter++}`,
            summary: String(data.item),
            status: "needs_action",
            description: (data.description as string) ?? null,
            due: (data.due_date ?? data.due_datetime ?? null) as string | null,
          });
          break;
        case "update_item": {
          const item = this.items.find((i) => i.uid === data.item || i.summary === data.item);
          if (!item)
            throw {
              code: "service_validation_error",
              message: `Unable to find to-do list item: ${data.item}`,
            };
          if (data.rename) item.summary = data.rename as string;
          if (data.status) item.status = data.status as string;
          if ("description" in data) item.description = data.description as string | null;
          if ("due_date" in data) item.due = data.due_date as string | null;
          if ("due_datetime" in data) item.due = data.due_datetime as string | null;
          break;
        }
        case "remove_item": {
          const refs = data.item as string[];
          this.items = this.items.filter(
            (i) => !refs.includes(i.uid!) && !refs.includes(i.summary!),
          );
          break;
        }
        default:
          throw { code: "service_not_found", message: `Service todo.${service} not found.` };
      }
      if (!this.suppressPush) this.push();
      return undefined;
    },
  );

  constructor(options: MockOptions = {}) {
    this.entityId = options.entityId ?? "todo.ksi";
    this.items = structuredClone(options.items ?? sampleItems());
    this.features = options.features ?? ALL_FEATURES;
    this.subscribeError = options.subscribeError;
    this.serviceDelay = options.serviceDelay ?? 0;
  }

  payload() {
    return { items: structuredClone(this.items) };
  }

  push(): void {
    for (const cb of this.subscribers) cb(this.payload());
  }

  stateObj(): HassEntity {
    return {
      entity_id: this.entityId,
      state:
        this.stateValue === "unknown"
          ? String(this.items.filter((i) => i.status !== "completed").length)
          : this.stateValue,
      attributes: { friendly_name: "KSi", supported_features: this.features },
    };
  }

  /** A fresh `hass` object, as Home Assistant creates on every state change. */
  hass(overrides: Partial<HomeAssistant> = {}): HomeAssistant {
    return {
      states: { [this.entityId]: this.stateObj() },
      connection: {
        subscribeMessage: this.subscribeMessage as HomeAssistant["connection"]["subscribeMessage"],
      },
      connected: this.connected,
      language: "en",
      locale: { language: "en" },
      themes: { darkMode: false, themes: {} },
      callService: this.callService as HomeAssistant["callService"],
      ...overrides,
    };
  }
}

export function sampleItems(): RawTodoItem[] {
  return [
    {
      uid: "a",
      summary: "Dry Solids Radar Testing",
      status: "needs_action",
      description: "Arrived. Most likely install at end\nof October.",
    },
    { uid: "b", summary: "AB Hardware", status: "needs_action", due: "2026-10-20" },
    { uid: "c", summary: "AB Sensor Form", status: "needs_action" },
    { uid: "d", summary: "APG Radar Sensor", status: "needs_action" },
    { uid: "e", summary: "Calvin Onboarding", status: "needs_action" },
    { uid: "f", summary: "Old task", status: "completed", completed: "2026-10-01T12:00:00+00:00" },
  ];
}

export function manyItems(count: number): RawTodoItem[] {
  return Array.from({ length: count }, (_, i) => ({
    uid: `item-${i}`,
    summary: `Task number ${i + 1}`,
    status: i % 5 === 4 ? "completed" : "needs_action",
    description: i % 3 === 0 ? `Description for task ${i + 1}\nSecond line` : null,
  }));
}

/** Flushes pending microtasks and Lit updates. */
export async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) await new Promise((r) => setTimeout(r, 0));
}
