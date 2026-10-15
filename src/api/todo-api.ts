import type { HomeAssistant, UnsubscribeFunc } from "../types/home-assistant";
import { MalformedResponseError } from "../utils/items";

/**
 * Thin wrapper over the documented Home Assistant to-do interfaces:
 *  - WebSocket `todo/item/subscribe` for live item updates
 *  - services `todo.get_items`, `todo.add_item`, `todo.update_item`, `todo.remove_item`
 * Calls use the dashboard's authenticated connection. `notifyOnError` is false
 * because the card shows its own, more specific error messages.
 */
export class TodoApi {
  constructor(
    private readonly getHass: () => HomeAssistant | undefined,
    readonly entityId: string,
  ) {}

  private hass(): HomeAssistant {
    const hass = this.getHass();
    if (!hass) throw { code: 3, message: "Not connected to Home Assistant." };
    return hass;
  }

  subscribe(onItems: (payload: unknown) => void): Promise<UnsubscribeFunc> {
    return this.hass().connection.subscribeMessage<unknown>(onItems, {
      type: "todo/item/subscribe",
      entity_id: this.entityId,
    });
  }

  /** Returns the raw `{ items }` payload for this entity from `todo.get_items`. */
  async getItems(): Promise<unknown> {
    const result = (await this.hass().callService(
      "todo",
      "get_items",
      {},
      { entity_id: this.entityId },
      false,
      true,
    )) as { response?: Record<string, unknown> } | undefined;
    const payload = result?.response?.[this.entityId];
    if (!payload)
      throw new MalformedResponseError("the get_items response did not include this list.");
    return payload;
  }

  async add(data: Record<string, unknown>): Promise<void> {
    await this.call("add_item", data);
  }

  async update(ref: string, patch: Record<string, unknown>): Promise<void> {
    await this.call("update_item", { ...patch, item: ref });
  }

  async remove(ref: string): Promise<void> {
    await this.call("remove_item", { item: [ref] });
  }

  private async call(service: string, data: Record<string, unknown>): Promise<void> {
    await this.hass().callService("todo", service, data, { entity_id: this.entityId }, false);
  }
}
