import type { TodoItem, TodoItemStatus, UnsubscribeFunc } from "../types/home-assistant";
import { toCardError, type CardError } from "../utils/errors";
import { dueToInputs, normalizeItems, preserveIdentity } from "../utils/items";
import { log } from "../utils/log";
import type { TodoApi } from "./todo-api";

/**
 * - `connecting`: waiting for the first subscription result
 * - `live`: receiving pushed updates via `todo/item/subscribe`
 * - `polling`: subscription unavailable; refreshing on entity state changes,
 *   on a slow timer, and retrying the subscription with backoff
 */
export type SyncMode = "idle" | "connecting" | "live" | "polling";

export type PendingKind = "toggle" | "update" | "remove" | "add";

export interface PendingOp {
  kind: PendingKind;
  key: string;
  /** `sending`: request in flight. `syncing`: accepted, awaiting the updated list. */
  phase: "sending" | "syncing";
  status?: TodoItemStatus;
  expect?: { summary?: string; description?: string | null; dueDate?: string };
  keysBefore?: Set<string>;
  timer?: ReturnType<typeof setTimeout>;
}

export interface StoreOptions {
  /** How long to wait for a write to show up before forcing a refresh. */
  reconcileMs: number;
  /** Refresh interval while in polling mode. */
  pollMs: number;
  retryBaseMs: number;
  retryMaxMs: number;
}

const DEFAULT_OPTIONS: StoreOptions = {
  reconcileMs: 5_000,
  pollMs: 5 * 60_000,
  retryBaseMs: 30_000,
  retryMaxMs: 10 * 60_000,
};

export const ADD_KEY = "\u0000add";

export class TodoStore {
  /** Last item list confirmed by Home Assistant. undefined until first load. */
  items: TodoItem[] | undefined;
  mode: SyncMode = "idle";
  /** Problem loading or syncing the list (not write errors, which are thrown). */
  loadError: CardError | undefined;
  /** True when the displayed list may not reflect Home Assistant. */
  stale = false;
  /** Informational message, e.g. a write that could not be confirmed. */
  notice: string | undefined;

  private readonly pending = new Map<string, PendingOp>();
  private readonly options: StoreOptions;
  private generation = 0;
  private unsubscribe?: UnsubscribeFunc;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private pollTimer?: ReturnType<typeof setInterval>;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private retryAttempt = 0;

  constructor(
    private readonly api: TodoApi,
    private readonly onChange: () => void,
    options: Partial<StoreOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  get entityId(): string {
    return this.api.entityId;
  }

  start(): void {
    this.stop();
    const gen = ++this.generation;
    this.mode = "connecting";
    log.debug("subscribing", { entity: this.entityId });
    void this.subscribe(gen);
  }

  /** Releases subscriptions and timers. Safe to call repeatedly. */
  stop(): void {
    this.generation++;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    clearTimeout(this.retryTimer);
    clearInterval(this.pollTimer);
    clearTimeout(this.debounceTimer);
    this.retryTimer = this.pollTimer = this.debounceTimer = undefined;
    for (const op of this.pending.values()) clearTimeout(op.timer);
    this.pending.clear();
    this.mode = "idle";
  }

  private async subscribe(gen: number): Promise<void> {
    try {
      const unsub = await this.api.subscribe((payload) => {
        if (gen === this.generation) this.receive(payload);
      });
      if (gen !== this.generation) {
        unsub();
        return;
      }
      this.unsubscribe = unsub;
      this.mode = "live";
      this.retryAttempt = 0;
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
      log.debug("subscribed", { entity: this.entityId });
      this.onChange();
    } catch (err) {
      if (gen !== this.generation) return;
      const error = toCardError(err, "subscribe to list updates");
      log.warn("subscription failed, falling back to refreshes", {
        entity: this.entityId,
        kind: error.kind,
      });
      this.mode = "polling";
      this.startPolling();
      if (error.kind !== "unsupported") this.scheduleRetry(gen);
      await this.refresh();
    }
  }

  private startPolling(): void {
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => void this.refresh(), this.options.pollMs);
  }

  private scheduleRetry(gen: number): void {
    const delay = Math.min(
      this.options.retryBaseMs * 2 ** this.retryAttempt,
      this.options.retryMaxMs,
    );
    this.retryAttempt++;
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      if (gen === this.generation) void this.subscribe(gen);
    }, delay);
  }

  /** Fetches the full list once. Used for fallback, manual refresh and reconciliation. */
  async refresh(): Promise<void> {
    const gen = this.generation;
    try {
      const payload = await this.api.getItems();
      if (gen === this.generation) this.receive(payload);
    } catch (err) {
      if (gen !== this.generation) return;
      this.loadError = toCardError(err, "load tasks");
      this.stale = this.items !== undefined;
      log.warn("refresh failed", { entity: this.entityId, kind: this.loadError.kind });
      this.onChange();
    }
  }

  private receive(payload: unknown): void {
    let next: TodoItem[];
    try {
      next = normalizeItems(payload);
    } catch (err) {
      this.loadError = toCardError(err, "read tasks");
      this.stale = this.items !== undefined;
      log.warn("malformed item payload", { entity: this.entityId });
      this.onChange();
      return;
    }
    this.items = preserveIdentity(this.items, next);
    this.loadError = undefined;
    this.stale = false;
    log.debug("items received", { entity: this.entityId, count: next.length });
    this.reconcilePending();
    this.onChange();
  }

  /** Call when the dashboard connection state changes. */
  setConnected(connected: boolean): void {
    if (!connected && !this.stale && this.items) {
      this.stale = true;
      this.onChange();
    } else if (connected && this.stale && this.mode === "polling") {
      void this.refresh();
    }
    // In live mode the websocket library resubscribes after reconnecting and
    // Home Assistant pushes the full list, which clears `stale`.
  }

  /** Call when the entity's state object changes. Only used while polling. */
  entityChanged(): void {
    if (this.mode !== "polling") return;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.refresh(), 300);
  }

  pendingFor(key: string): PendingOp | undefined {
    return this.pending.get(key);
  }

  dismissNotice(): void {
    this.notice = undefined;
    this.onChange();
  }

  // ---- writes -------------------------------------------------------------

  /** Returns false if an operation on this item is already in progress. */
  setStatus(item: TodoItem, completed: boolean): Promise<boolean> {
    const status: TodoItemStatus = completed ? "completed" : "needs_action";
    return this.run(
      { kind: "toggle", key: item.key, phase: "sending", status },
      "update the task",
      () => this.api.update(item.ref, { status }),
    );
  }

  update(item: TodoItem, patch: Record<string, unknown>): Promise<boolean> {
    if (Object.keys(patch).length === 0) return Promise.resolve(true);
    const expect: PendingOp["expect"] = {};
    if (typeof patch.rename === "string") expect.summary = patch.rename;
    if ("description" in patch) expect.description = (patch.description as string | null) ?? null;
    if ("due_date" in patch || "due_datetime" in patch) {
      const value = (patch.due_date ?? patch.due_datetime) as string | null;
      expect.dueDate = dueToInputs(value ?? undefined).date;
    }
    return this.run(
      { kind: "update", key: item.key, phase: "sending", expect },
      "save the task",
      () => this.api.update(item.ref, patch),
    );
  }

  remove(item: TodoItem): Promise<boolean> {
    return this.run({ kind: "remove", key: item.key, phase: "sending" }, "delete the task", () =>
      this.api.remove(item.ref),
    );
  }

  add(data: Record<string, unknown>): Promise<boolean> {
    const op: PendingOp = {
      kind: "add",
      key: ADD_KEY,
      phase: "sending",
      expect: { summary: String(data.item) },
      keysBefore: new Set(this.items?.map((i) => i.key)),
    };
    return this.run(op, "add the task", () => this.api.add(data));
  }

  /**
   * Runs a write with duplicate protection. Resolves true once Home Assistant
   * accepted the call (the row stays marked as syncing until the updated list
   * arrives). Rejects with a CardError if the call failed.
   */
  private async run(op: PendingOp, action: string, call: () => Promise<void>): Promise<boolean> {
    if (this.pending.has(op.key)) return false;
    const gen = this.generation;
    this.pending.set(op.key, op);
    this.notice = undefined;
    this.onChange();
    try {
      await call();
    } catch (err) {
      if (this.pending.get(op.key) === op) this.pending.delete(op.key);
      const error = toCardError(err, action);
      log.warn("write failed", { entity: this.entityId, op: op.kind, kind: error.kind });
      this.onChange();
      throw error;
    }
    if (gen !== this.generation || this.pending.get(op.key) !== op) return true;
    op.phase = "syncing";
    if (this.isReconciled(op)) {
      this.pending.delete(op.key);
    } else {
      if (this.mode !== "live") void this.refresh();
      op.timer = setTimeout(() => void this.reconcileTimeout(op, gen), this.options.reconcileMs);
    }
    this.onChange();
    return true;
  }

  private async reconcileTimeout(op: PendingOp, gen: number): Promise<void> {
    if (gen !== this.generation || this.pending.get(op.key) !== op) return;
    log.debug("write not yet reflected, refreshing", { entity: this.entityId, op: op.kind });
    await this.refresh();
    if (gen !== this.generation || this.pending.get(op.key) !== op) return;
    this.pending.delete(op.key);
    this.notice =
      "Home Assistant accepted a change but the list does not show it yet. It may have been modified elsewhere.";
    log.warn("write could not be confirmed", { entity: this.entityId, op: op.kind });
    this.onChange();
  }

  private reconcilePending(): void {
    for (const op of this.pending.values()) {
      if (op.phase === "syncing" && this.isReconciled(op)) {
        clearTimeout(op.timer);
        this.pending.delete(op.key);
      }
    }
  }

  private isReconciled(op: PendingOp): boolean {
    const items = this.items ?? [];
    const item = items.find((i) => i.key === op.key);
    switch (op.kind) {
      case "toggle":
        return !item || item.status === op.status;
      case "remove":
        return !item;
      case "update": {
        if (!item) return true;
        const e = op.expect ?? {};
        return (
          (e.summary === undefined || item.summary === e.summary) &&
          (e.description === undefined || (item.description ?? null) === e.description) &&
          (e.dueDate === undefined || dueToInputs(item.due).date === e.dueDate)
        );
      }
      case "add":
        return items.some((i) => !op.keysBefore?.has(i.key) && i.summary === op.expect?.summary);
    }
  }
}
