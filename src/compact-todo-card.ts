import { LitElement, css, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { TodoApi } from "./api/todo-api";
import { ADD_KEY, TodoStore } from "./api/todo-store";
import "./components/todo-form";
import "./components/todo-row";
import type { CompactTodoRow } from "./components/todo-row";
import { CARD_TYPE, stubConfig, validateConfig, type CompactTodoCardConfig } from "./config";
import { getConfigForm } from "./editor";
import { sharedStyles } from "./styles/styles";
import type {
  HassEntity,
  HomeAssistant,
  LovelaceGridOptions,
  TodoCapabilities,
  TodoItem,
} from "./types/home-assistant";
import type { CardError } from "./utils/errors";
import { enforceAccordion, pruneExpanded, toggleExpanded } from "./utils/expansion";
import {
  icon,
  mdiAlertCircleOutline,
  mdiChevronRight,
  mdiClose,
  mdiPlus,
  mdiRefresh,
} from "./utils/icons";
import { capabilitiesFor, partitionItems, sortItems } from "./utils/items";
import { log } from "./utils/log";
import { applyTheme } from "./utils/theme";

const NO_CAPS: TodoCapabilities = {
  create: false,
  delete: false,
  update: false,
  dueDate: false,
  dueDatetime: false,
  description: false,
};

const HEADER_PX = 48;

export class CompactTodoCard extends LitElement {
  static override properties = {
    _config: { state: true },
    _stateObj: { state: true },
    _connected: { state: true },
    _expanded: { state: true },
    _editingKey: { state: true },
    _adding: { state: true },
    _formBusy: { state: true },
    _formError: { state: true },
    _addError: { state: true },
    _actionError: { state: true },
    _completedOpen: { state: true },
    _announcement: { state: true },
  };

  declare _config: CompactTodoCardConfig | undefined;
  declare _stateObj: HassEntity | undefined;
  declare _connected: boolean;
  declare _expanded: ReadonlySet<string>;
  declare _editingKey: string | undefined;
  declare _adding: boolean;
  declare _formBusy: boolean;
  declare _formError: string | undefined;
  declare _addError: string | undefined;
  declare _actionError: string | undefined;
  declare _completedOpen: boolean;
  declare _announcement: string;

  private _hass?: HomeAssistant;
  private _store?: TodoStore;
  private _themeVars: string[] = [];
  private _themeName?: string;
  private _themesRef?: HomeAssistant["themes"];
  private _scrollToKey?: string;

  constructor() {
    super();
    this._connected = true;
    this._expanded = new Set();
    this._adding = false;
    this._formBusy = false;
    this._completedOpen = true;
    this._announcement = "";
  }

  // ---- Lovelace card contract --------------------------------------------

  static getConfigForm = getConfigForm;

  static getStubConfig(hass?: HomeAssistant): Record<string, unknown> {
    return stubConfig(Object.keys(hass?.states ?? {}));
  }

  setConfig(config: unknown): void {
    const { config: next, unknownKeys } = validateConfig(config);
    if (unknownKeys.length) log.warn("ignoring unknown options", { options: unknownKeys });
    if (this._config && this._config.entity !== next.entity) {
      this.teardown();
      this._expanded = new Set();
      this._editingKey = undefined;
      this._adding = false;
    }
    if (next.accordion) this._expanded = enforceAccordion(this._expanded);
    this._config = next;
    this.syncFromHass();
    this.ensureStore();
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this.syncFromHass();
    this.ensureStore();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  getCardSize(): number {
    const config = this._config;
    if (!config) return 1;
    const rows = this._store?.items ? partitionItems(this._store.items).active.length : 3;
    let px = HEADER_PX + Math.max(rows, 1) * config.row_height;
    if (config.scrollable && config.max_height > 0)
      px = Math.min(px, HEADER_PX + config.max_height);
    return Math.max(1, Math.ceil(px / 50));
  }

  getGridOptions(): LovelaceGridOptions {
    return { columns: 6, min_columns: 3 };
  }

  // ---- lifecycle ------------------------------------------------------------

  override connectedCallback(): void {
    super.connectedCallback();
    this.ensureStore();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardown();
  }

  /** Copies only what the card needs from `hass`, so unrelated state changes do not re-render. */
  private syncFromHass(): void {
    const hass = this._hass;
    const config = this._config;
    if (!hass || !config) return;

    const stateObj = hass.states[config.entity];
    if (stateObj !== this._stateObj) {
      this._stateObj = stateObj;
      this._store?.entityChanged();
    }
    const connected = hass.connected !== false;
    if (connected !== this._connected) {
      this._connected = connected;
      this._store?.setConnected(connected);
    }
    if (
      config.theme !== this._themeName ||
      (config.theme !== "auto" && hass.themes !== this._themesRef)
    ) {
      this._themeName = config.theme;
      this._themesRef = hass.themes;
      this._themeVars = applyTheme(this, hass, config.theme, this._themeVars);
    }
  }

  private ensureStore(): void {
    const config = this._config;
    if (!this.isConnected || !this._hass || !config || !this._stateObj) return;
    if (this._store?.entityId === config.entity) return;
    this.teardown();
    const api = new TodoApi(() => this._hass, config.entity);
    this._store = new TodoStore(api, () => this.requestUpdate());
    this._store.start();
  }

  private teardown(): void {
    this._store?.stop();
    this._store = undefined;
  }

  override willUpdate(): void {
    const items = this._store?.items;
    if (!items) return;
    this._expanded = pruneExpanded(
      this._expanded,
      items.map((i) => i.key),
    );
    if (this._editingKey && !items.some((i) => i.key === this._editingKey)) {
      const wasDeleting = this._formBusy;
      this._editingKey = undefined;
      this._formError = undefined;
      if (!wasDeleting) this._actionError = "The task you were editing was removed elsewhere.";
    }
  }

  override updated(): void {
    const key = this._scrollToKey;
    if (!key) return;
    this._scrollToKey = undefined;
    const config = this._config;
    if (!config?.scrollable || config.max_height <= 0) return;
    const row = [...this.renderRoot.querySelectorAll<CompactTodoRow>("compact-todo-row")].find(
      (r) => r.item.key === key,
    );
    row?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }

  // ---- derived state ----------------------------------------------------------

  private get locale(): string | undefined {
    return this._hass?.locale?.language ?? this._hass?.language;
  }

  private get writable(): boolean {
    return this._connected && !!this._stateObj && this._stateObj.state !== "unavailable";
  }

  private get caps(): TodoCapabilities {
    return this.writable ? capabilitiesFor(this._stateObj) : NO_CAPS;
  }

  private get cardTitle(): string {
    const config = this._config!;
    if (config.title !== undefined) return config.title;
    const name = this._stateObj?.attributes.friendly_name;
    return typeof name === "string" ? name : config.entity;
  }

  // ---- actions -------------------------------------------------------------------

  private announce(message: string): void {
    // Re-announce identical messages by clearing first.
    this._announcement = "";
    requestAnimationFrame(() => (this._announcement = message));
  }

  private showActionError(error: unknown): void {
    this._actionError = (error as CardError)?.message ?? "Something went wrong.";
  }

  private async onCheck(item: TodoItem, completed: boolean): Promise<void> {
    if (!this._store) return;
    this._actionError = undefined;
    try {
      const accepted = await this._store.setStatus(item, completed);
      if (accepted)
        this.announce(`${item.summary} marked as ${completed ? "completed" : "not completed"}.`);
    } catch (err) {
      this.showActionError(err);
    }
  }

  private onExpand(item: TodoItem): void {
    const config = this._config!;
    if (this._editingKey === item.key && this._expanded.has(item.key)) return;
    let next = toggleExpanded(this._expanded, item.key, config.accordion);
    if (this._editingKey && !next.has(this._editingKey)) {
      // Never discard an open edit form by collapsing it.
      next = new Set([...next, this._editingKey]);
    }
    if (next.has(item.key)) this._scrollToKey = item.key;
    this._expanded = next;
  }

  private onEdit(item: TodoItem): void {
    this._editingKey = item.key;
    this._formError = undefined;
    this._formBusy = false;
    if (!this._expanded.has(item.key))
      this._expanded = toggleExpanded(this._expanded, item.key, this._config!.accordion);
  }

  private closeEditor(): void {
    this._editingKey = undefined;
    this._formError = undefined;
    this._formBusy = false;
  }

  private async onSave(item: TodoItem, payload: Record<string, unknown>): Promise<void> {
    if (!this._store || this._formBusy) return;
    this._formBusy = true;
    this._formError = undefined;
    try {
      const accepted = await this._store.update(item, payload);
      if (accepted) {
        this.closeEditor();
        this.announce("Task saved.");
      }
    } catch (err) {
      this._formError = (err as CardError).message;
    } finally {
      this._formBusy = false;
    }
  }

  private async onDelete(item: TodoItem): Promise<void> {
    if (!this._store || this._formBusy) return;
    this._formBusy = true;
    this._formError = undefined;
    try {
      const accepted = await this._store.remove(item);
      if (accepted) {
        this.closeEditor();
        this.announce("Task deleted.");
      }
    } catch (err) {
      this._formError = (err as CardError).message;
    } finally {
      this._formBusy = false;
    }
  }

  private toggleAdd(): void {
    this._adding = !this._adding;
    this._addError = undefined;
  }

  private async onAdd(payload: Record<string, unknown>): Promise<void> {
    if (!this._store || this._store.pendingFor(ADD_KEY)) return;
    this._addError = undefined;
    try {
      const accepted = await this._store.add(payload);
      if (accepted) {
        this._adding = false;
        this.announce("Task added.");
      }
    } catch (err) {
      this._addError = (err as CardError).message;
    }
  }

  private onListKeyDown(e: KeyboardEvent): void {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const path = e.composedPath();
    const origin = path[0] as HTMLElement | undefined;
    if (!origin?.matches?.(".toggle, .toggle-alt")) return;
    const rows = [...this.renderRoot.querySelectorAll<CompactTodoRow>("compact-todo-row")];
    const index = rows.findIndex((r) => path.includes(r));
    const next = rows[index + (e.key === "ArrowDown" ? 1 : -1)];
    if (next) {
      e.preventDefault();
      next.focusToggle();
    }
  }

  // ---- rendering -----------------------------------------------------------------

  override render() {
    const config = this._config;
    if (!config) return nothing;
    const store = this._store;
    const items = store?.items;
    const { active, completed } = partitionItems(items ?? []);
    const sortedActive = sortItems(active, config.sort);
    const sortedCompleted = sortItems(completed, config.sort);
    const caps = this.caps;
    const title = this.cardTitle;
    const showAdd = config.show_add_button && caps.create;
    const showCount = config.show_task_count && items !== undefined;
    const showRefresh = !!store && (store.stale || store.mode === "polling" || !!store.loadError);
    const hasHeader = title !== "" || showAdd || showCount || showRefresh;
    const limitHeight = config.scrollable && config.max_height > 0;

    return html`
      <ha-card style="--ctc-row-height: ${config.row_height}px">
        ${
          hasHeader
            ? html`<div class="header">
                <h2 class="title">${title}</h2>
                ${
                  showCount
                    ? html`<span
                        class="count"
                        title="Open tasks"
                        aria-label="${active.length} open tasks"
                        >${active.length}</span
                      >`
                    : nothing
                }
                ${
                  showRefresh
                    ? html`<button
                        type="button"
                        class="icon-button"
                        aria-label="Refresh tasks"
                        title="Refresh tasks"
                        @click=${() => void store?.refresh()}
                      >
                        ${icon(mdiRefresh)}
                      </button>`
                    : nothing
                }
                ${
                  showAdd
                    ? html`<button
                        type="button"
                        class="icon-button add-button"
                        aria-label=${this._adding ? "Close new task form" : "Add task"}
                        aria-expanded=${this._adding ? "true" : "false"}
                        title=${this._adding ? "Cancel" : "Add task"}
                        @click=${this.toggleAdd}
                      >
                        ${icon(this._adding ? mdiClose : mdiPlus)}
                      </button>`
                    : nothing
                }
              </div>`
            : nothing
        }
        ${this.renderBanners()}
        ${
          this._adding && showAdd
            ? html`<div class="add-form">
                <compact-todo-form
                  mode="add"
                  .caps=${caps}
                  .busy=${!!store?.pendingFor(ADD_KEY)}
                  .error=${this._addError}
                  @form-submit=${(e: CustomEvent) => void this.onAdd(e.detail.payload)}
                  @form-cancel=${() => this.toggleAdd()}
                ></compact-todo-form>
              </div>`
            : nothing
        }
        <div
          class="list-container ${limitHeight ? "limited" : ""}"
          style=${limitHeight ? `max-height: ${config.max_height}px` : ""}
          tabindex=${limitHeight ? "-1" : nothing}
          @keydown=${this.onListKeyDown}
        >
          ${this.renderBody(items, sortedActive, sortedCompleted, caps)}
        </div>
        <div class="visually-hidden" aria-live="polite" role="status">${this._announcement}</div>
      </ha-card>
    `;
  }

  private renderBanners() {
    const config = this._config!;
    const store = this._store;
    const banners = [];
    if (this._hass && !this._stateObj) {
      banners.push(
        this.banner(
          "warning",
          `Entity not available: ${config.entity}. Check that the to-do list exists.`,
        ),
      );
    } else if (this._stateObj?.state === "unavailable") {
      banners.push(this.banner("warning", "This to-do list is unavailable. Changes are disabled."));
    }
    if (!this._connected) {
      banners.push(
        this.banner("warning", "Disconnected from Home Assistant. Showing the last known tasks."),
      );
    } else if (store?.loadError) {
      banners.push(this.banner("error", store.loadError.message));
    } else if (store?.stale) {
      banners.push(this.banner("warning", "Tasks may be out of date."));
    }
    if (store?.notice) {
      banners.push(this.banner("warning", store.notice, () => store.dismissNotice()));
    }
    if (this._actionError) {
      banners.push(this.banner("error", this._actionError, () => (this._actionError = undefined)));
    }
    return banners;
  }

  private banner(kind: "error" | "warning", message: string, dismiss?: () => void) {
    return html`<div class="banner ${kind}" role=${kind === "error" ? "alert" : "status"}>
      ${icon(mdiAlertCircleOutline)}
      <span class="banner-text">${message}</span>
      ${
        dismiss
          ? html`<button
              type="button"
              class="icon-button small"
              aria-label="Dismiss"
              @click=${dismiss}
            >
              ${icon(mdiClose)}
            </button>`
          : nothing
      }
    </div>`;
  }

  private renderBody(
    items: TodoItem[] | undefined,
    active: TodoItem[],
    completed: TodoItem[],
    caps: TodoCapabilities,
  ) {
    const config = this._config!;
    if (!this._stateObj) return nothing;
    if (items === undefined) {
      return this._store?.loadError
        ? nothing
        : html`<div class="empty" aria-busy="true">Loading tasks…</div>`;
    }
    const showCompleted = config.show_completed && completed.length > 0;
    return html`
      ${
        active.length === 0
          ? html`<div class="empty">
              ${completed.length > 0 ? "All tasks are completed." : "No tasks."}
            </div>`
          : html`<div class="list" role="list" aria-label="Open tasks">
              ${repeat(
                active,
                (item) => item.key,
                (item) => this.renderRow(item, caps),
              )}
            </div>`
      }
      ${
        showCompleted
          ? html`<button
                type="button"
                class="section-toggle ${this._completedOpen ? "open" : ""}"
                aria-expanded=${this._completedOpen ? "true" : "false"}
                @click=${() => (this._completedOpen = !this._completedOpen)}
              >
                ${icon(mdiChevronRight)}
                <span>Completed</span>
                <span class="section-count">${completed.length}</span>
              </button>
              ${
                this._completedOpen
                  ? html`<div class="list completed-list" role="list" aria-label="Completed tasks">
                      ${repeat(
                        completed,
                        (item) => item.key,
                        (item) => this.renderRow(item, caps),
                      )}
                    </div>`
                  : nothing
              }`
          : nothing
      }
    `;
  }

  private renderRow(item: TodoItem, caps: TodoCapabilities) {
    const config = this._config!;
    const editing = this._editingKey === item.key;
    return html`<compact-todo-row
      role="listitem"
      .item=${item}
      .caps=${caps}
      .pending=${this._store?.pendingFor(item.key)}
      .expanded=${this._expanded.has(item.key)}
      .editing=${editing}
      .expandOnClick=${config.expand_on_click}
      .animateExpansion=${config.animate_expansion}
      .locale=${this.locale}
      .formBusy=${editing && this._formBusy}
      .formError=${editing ? this._formError : undefined}
      @row-check=${(e: CustomEvent) => void this.onCheck(item, e.detail.completed)}
      @row-expand=${() => this.onExpand(item)}
      @row-edit=${() => this.onEdit(item)}
      @row-save=${(e: CustomEvent) => void this.onSave(item, e.detail.payload)}
      @row-cancel-edit=${() => this.closeEditor()}
      @row-delete=${() => void this.onDelete(item)}
    ></compact-todo-row>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      ha-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        box-sizing: border-box;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: ${HEADER_PX}px;
        padding: 4px 6px 4px 16px;
        box-sizing: border-box;
        border-bottom: 1px solid var(--ctc-divider);
      }
      .title {
        flex: 1;
        min-width: 0;
        margin: 0;
        overflow: hidden;
        color: var(--ctc-text);
        font-size: var(--compact-todo-card-title-size, 16px);
        font-weight: 500;
        line-height: 24px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .count {
        min-width: 20px;
        padding: 1px 7px;
        border-radius: 10px;
        background: var(--ctc-input-bg);
        color: var(--ctc-secondary);
        font-size: 12px;
        font-weight: 500;
        line-height: 18px;
        text-align: center;
        box-sizing: border-box;
      }
      .icon-button.small {
        width: 28px;
        height: 28px;
      }
      .icon-button.small svg {
        width: 16px;
        height: 16px;
      }
      .banner {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 8px 8px 0;
        padding: 6px 6px 6px 10px;
        border-radius: 8px;
        color: var(--ctc-text);
        font-size: 13px;
        line-height: 18px;
      }
      .banner > svg {
        flex: none;
        width: 18px;
        height: 18px;
      }
      .banner-text {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .banner.error {
        background: rgba(var(--rgb-error-color, 219, 68, 55), 0.12);
      }
      .banner.error > svg {
        fill: var(--ctc-error);
      }
      .banner.warning {
        background: rgba(var(--rgb-warning-color, 255, 166, 0), 0.14);
      }
      .banner.warning > svg {
        fill: var(--ctc-warning);
      }
      .add-form {
        padding: 10px 12px;
        border-bottom: 1px solid var(--ctc-divider);
      }
      .list-container {
        flex: 1;
        min-height: 0;
      }
      .list-container.limited {
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      .list-container:focus {
        outline: none;
      }
      .empty {
        padding: 10px 16px;
        color: var(--ctc-secondary);
        font-size: 14px;
      }
      .section-toggle {
        display: flex;
        align-items: center;
        gap: 4px;
        width: 100%;
        min-height: 32px;
        padding: 0 12px 0 10px;
        border: none;
        border-top: 1px solid var(--ctc-divider);
        border-bottom: 1px solid var(--ctc-divider);
        background: none;
        color: var(--ctc-secondary);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
      }
      .section-toggle:hover {
        background: var(--ctc-hover);
      }
      .section-toggle svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
        transition: transform var(--ctc-transition);
      }
      .section-toggle.open svg {
        transform: rotate(90deg);
      }
      .section-count {
        margin-inline-start: 4px;
        font-weight: 400;
      }
    `,
  ];
}

if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, CompactTodoCard);
  window.customCards = window.customCards ?? [];
  window.customCards.push({
    type: CARD_TYPE,
    name: "Compact To-Do Card",
    description: "A dense to-do list with expandable task details and inline editing.",
    preview: true,
    documentationURL: "https://github.com/libertybell95/ha-compact-todo-list",
  });
  console.info(
    `%c COMPACT-TODO-CARD %c v${__CARD_VERSION__} `,
    "color: white; background: #03a9f4; font-weight: 600",
    "color: #03a9f4; background: transparent",
  );
}

declare global {
  interface HTMLElementTagNameMap {
    [CARD_TYPE]: CompactTodoCard;
  }
}
