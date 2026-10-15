import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodoApi } from "../src/api/todo-api";
import { ADD_KEY, TodoStore } from "../src/api/todo-store";
import { MockHass, flush } from "./helpers/mock-hass";

function setup(mock = new MockHass(), options = {}) {
  let hass = mock.hass();
  const onChange = vi.fn();
  const api = new TodoApi(() => hass, mock.entityId);
  const store = new TodoStore(api, onChange, {
    reconcileMs: 1000,
    pollMs: 60_000,
    retryBaseMs: 5_000,
    ...options,
  });
  return { mock, store, onChange, setHass: (h: typeof hass) => (hass = h) };
}

beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TodoStore subscription", () => {
  it("subscribes and receives items", async () => {
    const { store, mock } = setup();
    store.start();
    await flush();
    expect(store.mode).toBe("live");
    expect(store.items).toHaveLength(6);
    expect(mock.subscribeMessage).toHaveBeenCalledWith(expect.any(Function), {
      type: "todo/item/subscribe",
      entity_id: "todo.ksi",
    });
  });

  it("reflects changes made elsewhere (pushed updates)", async () => {
    const { store, mock } = setup();
    store.start();
    await flush();
    mock.items.push({ uid: "z", summary: "From automation", status: "needs_action" });
    mock.push();
    expect(store.items?.some((i) => i.uid === "z")).toBe(true);
  });

  it("unsubscribes and ignores late callbacks after stop", async () => {
    const { store, mock } = setup();
    store.start();
    await flush();
    store.stop();
    expect(mock.subscribers.size).toBe(0);
    expect(store.mode).toBe("idle");
  });

  it("drops a subscription that resolves after stop", async () => {
    const mock = new MockHass();
    const { store } = setup(mock);
    store.start();
    store.stop(); // before the subscribe promise resolves
    await flush();
    expect(mock.subscribers.size).toBe(0);
  });

  it("falls back to get_items and retries the subscription with backoff", async () => {
    vi.useFakeTimers();
    const mock = new MockHass({
      subscribeError: { code: "invalid_entity_id", message: "not found" },
    });
    const { store } = setup(mock);
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.mode).toBe("polling");
    expect(store.items).toHaveLength(6);
    expect(mock.callService).toHaveBeenCalledWith(
      "todo",
      "get_items",
      {},
      { entity_id: "todo.ksi" },
      false,
      true,
    );

    mock.subscribeError = undefined;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(store.mode).toBe("live");
    store.stop();
  });

  it("does not retry when subscriptions are unsupported, but keeps polling", async () => {
    vi.useFakeTimers();
    const mock = new MockHass({
      subscribeError: { code: "unknown_command", message: "Unknown command." },
    });
    const { store } = setup(mock);
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mock.subscribeMessage).toHaveBeenCalledTimes(1);
    const calls = mock.callService.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mock.callService.mock.calls.length).toBe(calls + 1);
    store.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mock.callService.mock.calls.length).toBe(calls + 1);
  });

  it("refreshes on entity state changes only while polling (debounced)", async () => {
    vi.useFakeTimers();
    const mock = new MockHass({ subscribeError: { code: "unknown_command" } });
    const { store } = setup(mock);
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    const calls = mock.callService.mock.calls.length;
    store.entityChanged();
    store.entityChanged();
    await vi.advanceTimersByTimeAsync(400);
    expect(mock.callService.mock.calls.length).toBe(calls + 1);
    store.stop();
  });

  it("marks data stale on malformed payloads but keeps the last good list", async () => {
    const { store, mock } = setup();
    store.start();
    await flush();
    for (const cb of mock.subscribers) cb({ nope: true });
    expect(store.items).toHaveLength(6);
    expect(store.stale).toBe(true);
    expect(store.loadError?.kind).toBe("malformed");
    mock.push();
    expect(store.stale).toBe(false);
    expect(store.loadError).toBeUndefined();
  });

  it("reports retrieval failure when both subscribe and get_items fail", async () => {
    const mock = new MockHass({ subscribeError: { code: "invalid_entity_id" } });
    mock.failNext = {
      service: "get_items",
      error: { code: "not_found", message: "Entity not found" },
    };
    const { store } = setup(mock);
    store.start();
    await flush();
    expect(store.items).toBeUndefined();
    expect(store.loadError?.message).toMatch(/Could not load tasks/);
    store.stop();
  });

  it("marks data stale while disconnected", async () => {
    const { store } = setup();
    store.start();
    await flush();
    store.setConnected(false);
    expect(store.stale).toBe(true);
  });
});

describe("TodoStore writes", () => {
  async function live(mock = new MockHass()) {
    const ctx = setup(mock);
    ctx.store.start();
    await flush();
    return ctx;
  }

  it("toggles completion with a minimal patch and reconciles", async () => {
    const { store, mock } = await live();
    const item = store.items![0];
    await expect(store.setStatus(item, true)).resolves.toBe(true);
    expect(mock.callService).toHaveBeenLastCalledWith(
      "todo",
      "update_item",
      { status: "completed", item: "a" },
      { entity_id: "todo.ksi" },
      false,
    );
    expect(store.pendingFor(item.key)).toBeUndefined();
    expect(store.items![0].status).toBe("completed");
  });

  it("prevents duplicate operations on the same item", async () => {
    const mock = new MockHass({ serviceDelay: 10 });
    const { store } = await live(mock);
    const item = store.items![1];
    const first = store.setStatus(item, true);
    const second = await store.setStatus(item, true);
    expect(second).toBe(false);
    await first;
    expect(mock.callService.mock.calls.filter((c) => c[1] === "update_item")).toHaveLength(1);
  });

  it("keeps pending state until Home Assistant pushes the change", async () => {
    vi.useFakeTimers();
    const { store, mock } = await (async () => {
      const ctx = setup();
      ctx.store.start();
      await vi.advanceTimersByTimeAsync(0);
      return ctx;
    })();
    mock.suppressPush = true;
    const item = store.items![0];
    await store.setStatus(item, true);
    expect(store.pendingFor(item.key)?.phase).toBe("syncing");
    expect(store.items![0].status).toBe("needs_action"); // not claimed until reconciled
    mock.push();
    expect(store.pendingFor(item.key)).toBeUndefined();
    store.stop();
  });

  it("refreshes after a timeout when no update arrives", async () => {
    vi.useFakeTimers();
    const ctx = setup();
    ctx.store.start();
    await vi.advanceTimersByTimeAsync(0);
    ctx.mock.suppressPush = true;
    const item = ctx.store.items![0];
    await ctx.store.setStatus(item, true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctx.mock.callService).toHaveBeenCalledWith(
      "todo",
      "get_items",
      {},
      expect.anything(),
      false,
      true,
    );
    expect(ctx.store.pendingFor(item.key)).toBeUndefined();
    expect(ctx.store.items![0].status).toBe("completed");
    expect(ctx.store.notice).toBeUndefined();
    ctx.store.stop();
  });

  it("shows a notice if a write never shows up even after refresh", async () => {
    vi.useFakeTimers();
    const ctx = setup();
    ctx.store.start();
    await vi.advanceTimersByTimeAsync(0);
    const item = ctx.store.items![0];
    // Service "succeeds" but nothing changes server-side.
    ctx.mock.callService.mockImplementationOnce(async () => undefined);
    await ctx.store.setStatus(item, true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctx.store.notice).toMatch(/does not show it yet/);
    ctx.store.stop();
  });

  it("recovers from a failed write and rethrows a readable error", async () => {
    const { store, mock } = await live();
    mock.failNext = {
      service: "update_item",
      error: { code: "home_assistant_error", message: "Provider offline" },
    };
    const item = store.items![0];
    await expect(store.setStatus(item, true)).rejects.toMatchObject({
      message: "Could not update the task: Provider offline",
    });
    expect(store.pendingFor(item.key)).toBeUndefined();
    expect(store.items![0].status).toBe("needs_action");
  });

  it("keeps a deleted row until removal is confirmed", async () => {
    const mock = new MockHass({ serviceDelay: 10 });
    const { store } = await live(mock);
    const item = store.items![2];
    const pending = store.remove(item);
    expect(store.pendingFor(item.key)?.kind).toBe("remove");
    expect(store.items!.some((i) => i.key === item.key)).toBe(true);
    await pending;
    await flush();
    expect(store.items!.some((i) => i.key === item.key)).toBe(false);
    expect(mock.callService).toHaveBeenCalledWith(
      "todo",
      "remove_item",
      { item: ["c"] },
      { entity_id: "todo.ksi" },
      false,
    );
  });

  it("adds items and reconciles on the new item", async () => {
    const { store, mock } = await live();
    await store.add({ item: "New task", description: "d" });
    expect(store.pendingFor(ADD_KEY)).toBeUndefined();
    expect(store.items!.at(-1)).toMatchObject({ summary: "New task", description: "d" });
    expect(mock.items).toHaveLength(7);
  });

  it("updates only changed fields and preserves the rest", async () => {
    const { store, mock } = await live();
    const item = store.items![0];
    await store.update(item, { rename: "Renamed" });
    expect(mock.items[0]).toMatchObject({
      summary: "Renamed",
      description: "Arrived. Most likely install at end\nof October.",
    });
  });

  it("treats an empty patch as a no-op", async () => {
    const { store, mock } = await live();
    const before = mock.callService.mock.calls.length;
    await expect(store.update(store.items![0], {})).resolves.toBe(true);
    expect(mock.callService.mock.calls.length).toBe(before);
  });

  it("handles rapid actions on different items independently", async () => {
    const mock = new MockHass({ serviceDelay: 5 });
    const { store } = await live(mock);
    const [a, b, c] = store.items!;
    await Promise.all([store.setStatus(a, true), store.setStatus(b, true), store.remove(c)]);
    await flush();
    expect(
      store
        .items!.filter((i) => i.status === "completed")
        .map((i) => i.uid)
        .sort(),
    ).toEqual(["a", "b", "f"]);
    expect(store.items!.some((i) => i.uid === "c")).toBe(false);
  });
});
