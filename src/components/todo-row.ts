import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import type { PendingOp } from "../api/todo-store";
import type { TodoCapabilities, TodoItem } from "../types/home-assistant";
import { checkboxStyles, sharedStyles } from "../styles/styles";
import { icon, mdiChevronRight } from "../utils/icons";
import { formatDueLong, formatDueShort, formatTimestamp, isOverdue } from "../utils/items";
import "./todo-form";

export const ROW_TAG = "compact-todo-row";

let idCounter = 0;

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One task. The checkbox and the expand control are separate, semantic
 * controls; neither triggers the other. Emits:
 *  - `row-check` `{ completed }`
 *  - `row-expand`
 *  - `row-edit`, `row-save` `{ payload }`, `row-cancel-edit`, `row-delete`
 */
export class CompactTodoRow extends LitElement {
  static override properties = {
    item: { attribute: false },
    caps: { attribute: false },
    pending: { attribute: false },
    expanded: { type: Boolean, reflect: true },
    editing: { type: Boolean },
    expandOnClick: { type: Boolean },
    animateExpansion: { type: Boolean },
    locale: { type: String },
    formBusy: { type: Boolean },
    formError: { type: String },
    _rendered: { state: true },
    _open: { state: true },
  };

  declare item: TodoItem;
  declare caps: TodoCapabilities;
  declare pending: PendingOp | undefined;
  declare expanded: boolean;
  declare editing: boolean;
  declare expandOnClick: boolean;
  declare animateExpansion: boolean;
  declare locale: string | undefined;
  declare formBusy: boolean;
  declare formError: string | undefined;
  /** Details are in the DOM (also while the collapse animation runs). */
  declare _rendered: boolean;
  /** Details are at full height. */
  declare _open: boolean;

  private readonly uid = `ctc-row-${++idCounter}`;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private openFrame?: number;

  constructor() {
    super();
    this.expanded = false;
    this.editing = false;
    this.expandOnClick = true;
    this.animateExpansion = true;
    this.formBusy = false;
    this._rendered = false;
    this._open = false;
  }

  private get shouldAnimate(): boolean {
    return this.animateExpansion && !prefersReducedMotion();
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has("expanded")) return;
    clearTimeout(this.closeTimer);
    if (this.openFrame !== undefined) cancelAnimationFrame(this.openFrame);
    if (this.expanded) {
      this._rendered = true;
      if (this.shouldAnimate && changed.get("expanded") !== undefined) {
        // Render collapsed first, then open on the next frame so the height transitions.
        this._open = false;
        this.openFrame = requestAnimationFrame(() => {
          this.openFrame = undefined;
          this._open = true;
        });
      } else {
        this._open = true;
      }
    } else {
      this._open = false;
      if (this.shouldAnimate && this._rendered) {
        // transitionend is the normal path; the timer covers interrupted transitions.
        this.closeTimer = setTimeout(() => (this._rendered = false), 300);
      } else {
        this._rendered = false;
      }
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.closeTimer);
    if (this.openFrame !== undefined) cancelAnimationFrame(this.openFrame);
  }

  private onTransitionEnd(e: TransitionEvent): void {
    if (e.target === e.currentTarget && !this.expanded) {
      clearTimeout(this.closeTimer);
      this._rendered = false;
    }
  }

  focusToggle(): void {
    this.renderRoot.querySelector<HTMLElement>("button.toggle, .toggle-alt")?.focus();
  }

  private emit(name: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  private onCheck(e: Event): void {
    const input = e.target as HTMLInputElement;
    const completed = input.checked;
    // Keep the checkbox showing the confirmed/pending state; the parent re-renders it.
    input.checked = this.displayCompleted;
    if (this.pending) return;
    this.emit("row-check", { completed });
  }

  private onToggleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && this.expanded) {
      e.preventDefault();
      this.emit("row-expand");
    }
  }

  private get displayCompleted(): boolean {
    if (this.pending?.kind === "toggle" && this.pending.status)
      return this.pending.status === "completed";
    return this.item.status === "completed";
  }

  private statusLabel(): string | undefined {
    switch (this.pending?.kind) {
      case "remove":
        return "Deleting…";
      case "update":
        return "Saving…";
      case "toggle":
        return this.pending.phase === "sending" ? "Updating…" : undefined;
      default:
        return undefined;
    }
  }

  override render() {
    const item = this.item;
    const completed = this.displayCompleted;
    const removing = this.pending?.kind === "remove";
    const overdue = isOverdue(item);
    const detailsId = `${this.uid}-details`;
    const summaryId = `${this.uid}-summary`;
    const status = this.statusLabel();
    const canCheck = this.caps.update && !removing;
    const checkLabel = `Mark “${item.summary || "untitled task"}” as ${completed ? "not completed" : "completed"}`;

    const due = item.due
      ? html`<span class="due ${overdue ? "overdue" : ""}">
          ${overdue ? html`<span class="visually-hidden">Overdue, due </span>` : nothing}${formatDueShort(item.due, this.locale)}
        </span>`
      : nothing;
    const chevron = html`<span class="chevron">${icon(mdiChevronRight)}</span>`;
    const summary = html`<span class="summary" id=${summaryId}
      >${item.summary || html`<em>Untitled</em>`}</span
    >`;

    return html`
      <div
        class="row ${completed ? "completed" : ""} ${removing ? "removing" : ""} ${this.expanded ? "is-expanded" : ""}"
      >
        <div class="line">
          <label
            class="check"
            title=${this.caps.update ? "" : "This list does not support updating tasks"}
          >
            <input
              type="checkbox"
              class="checkbox"
              .checked=${completed}
              ?disabled=${!canCheck}
              aria-busy=${this.pending?.kind === "toggle" ? "true" : "false"}
              aria-label=${checkLabel}
              @change=${this.onCheck}
            />
          </label>
          ${
            this.expandOnClick
              ? html`<button
                  type="button"
                  class="toggle"
                  aria-expanded=${this.expanded ? "true" : "false"}
                  aria-controls=${detailsId}
                  @click=${() => this.emit("row-expand")}
                  @keydown=${this.onToggleKeyDown}
                >
                  ${summary} ${status ? html`<span class="status">${status}</span>` : due}
                  ${chevron}
                </button>`
              : html`<div class="toggle static">
                    ${summary} ${status ? html`<span class="status">${status}</span>` : due}
                  </div>
                  <button
                    type="button"
                    class="icon-button chevron-button toggle-alt"
                    aria-label=${this.expanded ? "Hide details" : "Show details"}
                    aria-expanded=${this.expanded ? "true" : "false"}
                    aria-controls=${detailsId}
                    @click=${() => this.emit("row-expand")}
                    @keydown=${this.onToggleKeyDown}
                  >
                    ${chevron}
                  </button>`
          }
        </div>
        <div
          class="details-wrap ${this._open ? "open" : ""}"
          id=${detailsId}
          role="region"
          aria-labelledby=${summaryId}
          ?hidden=${!this._rendered}
          @transitionend=${this.onTransitionEnd}
        >
          <div class="details-inner">${this._rendered ? this.renderDetails() : nothing}</div>
        </div>
      </div>
    `;
  }

  private renderDetails() {
    const item = this.item;
    if (this.editing) {
      return html`<div class="details editing">
        <compact-todo-form
          mode="edit"
          .item=${item}
          .caps=${this.caps}
          .busy=${this.formBusy}
          .error=${this.formError}
          @form-submit=${(e: CustomEvent) => this.emit("row-save", e.detail)}
          @form-cancel=${() => this.emit("row-cancel-edit")}
          @form-delete=${() => this.emit("row-delete")}
        ></compact-todo-form>
      </div>`;
    }
    const meta = [];
    if (item.due) {
      meta.push(
        html`<div class="meta ${isOverdue(item) ? "overdue" : ""}">
          ${isOverdue(item) ? "Overdue · " : ""}Due ${formatDueLong(item.due, this.locale)}
        </div>`,
      );
    }
    if (item.status === "completed" && item.completed) {
      meta.push(
        html`<div class="meta">Completed ${formatTimestamp(item.completed, this.locale)}</div>`,
      );
    }
    const editable = this.caps.update || this.caps.delete;
    return html`<div class="details">
      ${
        item.description
          ? html`<p class="description">${item.description}</p>`
          : meta.length === 0
            ? html`<p class="description empty">No description</p>`
            : nothing
      }
      ${meta}
      ${
        editable
          ? html`<div class="detail-actions">
              <button
                type="button"
                class="text-button"
                ?disabled=${this.pending !== undefined}
                aria-label=${`Edit “${item.summary || "untitled task"}”`}
                @click=${() => this.emit("row-edit")}
              >
                Edit
              </button>
            </div>`
          : nothing
      }
    </div>`;
  }

  static override styles = [
    sharedStyles,
    checkboxStyles,
    css`
      :host {
        position: relative;
        display: block;
      }
      /* Divider drawn over the row's last pixel so rows are exactly row_height tall. */
      :host::after {
        content: "";
        position: absolute;
        right: 0;
        bottom: 0;
        left: 44px;
        border-bottom: 1px solid var(--ctc-divider);
        pointer-events: none;
      }
      :host(:last-of-type)::after {
        display: none;
      }
      .row.removing {
        opacity: 0.5;
      }
      .line {
        display: flex;
        align-items: stretch;
        min-height: var(--ctc-row-height, 36px);
        padding-right: 4px;
      }
      .line:hover {
        background: var(--ctc-hover);
      }
      .check {
        display: flex;
        flex: none;
        align-items: center;
        justify-content: center;
        width: 44px;
        cursor: pointer;
      }
      .is-expanded .check {
        align-items: flex-start;
        padding-top: calc((var(--ctc-row-height, 36px) - 18px) / 2);
      }
      .is-expanded .toggle {
        align-items: flex-start;
      }
      .is-expanded .toggle > .chevron,
      .is-expanded .toggle > .due,
      .is-expanded .toggle > .status {
        margin-top: calc((var(--ctc-row-height, 36px) - 20px) / 2);
      }
      .toggle {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 8px;
        min-width: 0;
        min-height: var(--ctc-row-height, 36px);
        padding: 0 4px 0 0;
        border: none;
        background: none;
        color: var(--ctc-text);
        font-size: 14px;
        line-height: 20px;
        text-align: start;
        cursor: pointer;
      }
      .toggle.static {
        cursor: default;
      }
      .toggle:focus-visible,
      .toggle-alt:focus-visible {
        outline-offset: -2px;
      }
      .summary {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .is-expanded .summary {
        padding: calc((var(--ctc-row-height, 36px) - 20px) / 2) 0;
        white-space: normal;
        overflow-wrap: anywhere;
        font-weight: 500;
      }
      .completed .summary {
        color: var(--ctc-secondary);
        text-decoration: line-through;
      }
      .due,
      .status {
        flex: none;
        color: var(--ctc-secondary);
        font-size: 12px;
        white-space: nowrap;
      }
      .due.overdue {
        color: var(--ctc-error);
        font-weight: 500;
      }
      .chevron {
        display: inline-flex;
        flex: none;
        color: var(--ctc-secondary);
        transition: transform var(--ctc-transition);
      }
      .chevron svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
      }
      .is-expanded .chevron {
        transform: rotate(90deg);
      }
      .chevron-button {
        align-self: center;
        width: 32px;
        height: 32px;
      }
      .details-wrap {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows var(--ctc-transition);
      }
      .details-wrap.open {
        grid-template-rows: 1fr;
      }
      .details-wrap[hidden] {
        display: none;
      }
      .details-inner {
        min-height: 0;
        overflow: hidden;
      }
      .details {
        padding: 0 12px 8px 44px;
        font-size: 14px;
        color: var(--ctc-text);
      }
      .details.editing {
        padding-top: 4px;
        padding-left: 12px;
      }
      .description {
        margin: 0 0 6px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        line-height: 1.45;
      }
      .description.empty {
        color: var(--ctc-secondary);
        font-style: italic;
      }
      .meta {
        margin: 2px 0;
        color: var(--ctc-secondary);
        font-size: 12px;
      }
      .meta.overdue {
        color: var(--ctc-error);
      }
      .detail-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 2px;
      }
    `,
  ];
}

if (!customElements.get(ROW_TAG)) customElements.define(ROW_TAG, CompactTodoRow);

declare global {
  interface HTMLElementTagNameMap {
    [ROW_TAG]: CompactTodoRow;
  }
}
