import { LitElement, html, nothing, type PropertyValues } from "lit";
import type { TodoCapabilities, TodoItem } from "../types/home-assistant";
import { formStyles, sharedStyles } from "../styles/styles";
import {
  FormValidationError,
  buildAddPayload,
  buildUpdatePayload,
  canSetDue,
  formValuesFor,
  type TodoFormValues,
} from "../utils/payload";

export const FORM_TAG = "compact-todo-form";

let idCounter = 0;

/**
 * Inline add/edit form. Validates input and emits:
 *  - `form-submit` with `{ payload }` ready for todo.add_item / todo.update_item
 *  - `form-cancel`
 *  - `form-delete` after the user confirmed deletion (edit mode only)
 * The parent owns the API call and reports back through `busy` and `error`;
 * the form keeps the user's input until it is closed.
 */
export class CompactTodoForm extends LitElement {
  static override properties = {
    mode: { type: String },
    item: { attribute: false },
    caps: { attribute: false },
    busy: { type: Boolean },
    error: { type: String },
    _values: { state: true },
    _fieldError: { state: true },
    _confirmDelete: { state: true },
  };

  static override styles = [sharedStyles, formStyles];

  declare mode: "add" | "edit";
  declare item: TodoItem | undefined;
  declare caps: TodoCapabilities;
  declare busy: boolean;
  declare error: string | undefined;
  declare _values: TodoFormValues;
  declare _fieldError: { field: keyof TodoFormValues; message: string } | undefined;
  declare _confirmDelete: boolean;

  private readonly uid = `ctc-form-${++idCounter}`;

  constructor() {
    super();
    this.mode = "add";
    this.busy = false;
    this._values = formValuesFor();
    this._confirmDelete = false;
  }

  override willUpdate(changed: PropertyValues<this>): void {
    // Initialize once from the item; later list updates must not overwrite the user's draft.
    if (changed.has("item") && changed.get("item") === undefined && this.item) {
      this._values = formValuesFor(this.item);
    }
  }

  override firstUpdated(): void {
    const input = this.renderRoot.querySelector<HTMLInputElement>("input[name=summary]");
    input?.focus();
    if (this.mode === "edit") input?.select();
  }

  private onInput(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const name = target.name as keyof TodoFormValues;
    this._values = { ...this._values, [name]: target.value };
    if (this._fieldError?.field === name) this._fieldError = undefined;
  }

  private submit(e?: Event): void {
    e?.preventDefault();
    if (this.busy) return;
    try {
      const payload =
        this.mode === "edit" && this.item
          ? buildUpdatePayload(this.item, this._values, this.caps)
          : buildAddPayload(this._values, this.caps);
      this._fieldError = undefined;
      this.dispatchEvent(new CustomEvent("form-submit", { detail: { payload } }));
    } catch (err) {
      if (err instanceof FormValidationError) {
        this._fieldError = { field: err.field, message: err.message };
        this.renderRoot.querySelector<HTMLElement>(`[name=${err.field}]`)?.focus();
      } else {
        throw err;
      }
    }
  }

  private cancel(): void {
    this.dispatchEvent(new CustomEvent("form-cancel"));
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      if (this._confirmDelete) this._confirmDelete = false;
      else this.cancel();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.submit();
    }
  }

  private invalid(field: keyof TodoFormValues) {
    return this._fieldError?.field === field ? "true" : "false";
  }

  override render() {
    const caps = this.caps;
    const isEdit = this.mode === "edit";
    const summaryBlank = this._values.summary.trim() === "";
    const errorId = `${this.uid}-error`;
    const describedBy = this._fieldError || this.error ? errorId : nothing;
    const dueOnlyWithTime = caps.dueDatetime && !caps.dueDate;
    const onlyTitle = !caps.description && !canSetDue(caps);

    return html`
      <form
        @submit=${this.submit}
        @keydown=${this.onKeyDown}
        aria-busy=${this.busy ? "true" : "false"}
        novalidate
      >
        <label class="field">
          ${isEdit ? "Title" : "New task"}
          <input
            type="text"
            name="summary"
            autocomplete="off"
            enterkeyhint="done"
            required
            .value=${this._values.summary}
            aria-invalid=${this.invalid("summary")}
            aria-describedby=${describedBy}
            ?disabled=${this.busy}
            @input=${this.onInput}
          />
        </label>
        ${
          caps.description
            ? html`<label class="field">
                Description
                <textarea
                  name="description"
                  rows="3"
                  .value=${this._values.description}
                  aria-invalid=${this.invalid("description")}
                  ?disabled=${this.busy}
                  @input=${this.onInput}
                ></textarea>
              </label>`
            : nothing
        }
        ${
          canSetDue(caps)
            ? html`<div class="due-row">
                <label class="field">
                  Due date
                  <input
                    type="date"
                    name="date"
                    .value=${this._values.date}
                    aria-invalid=${this.invalid("date")}
                    ?disabled=${this.busy}
                    @input=${this.onInput}
                  />
                </label>
                ${
                  caps.dueDatetime
                    ? html`<label class="field">
                        Time${dueOnlyWithTime ? "" : " (optional)"}
                        <input
                          type="time"
                          name="time"
                          .value=${this._values.time}
                          aria-invalid=${this.invalid("time")}
                          ?disabled=${this.busy}
                          @input=${this.onInput}
                        />
                      </label>`
                    : nothing
                }
              </div>`
            : nothing
        }
        ${onlyTitle && !isEdit ? html`<p class="hint">This list supports task titles only.</p>` : nothing}
        ${
          this._fieldError || this.error
            ? html`<p class="form-error" id=${errorId} role="alert">
                ${this._fieldError?.message ?? this.error}
              </p>`
            : nothing
        }
        ${
          this._confirmDelete
            ? html`<div class="confirm" role="group" aria-label="Confirm deletion">
                <span>Delete this task permanently?</span>
                <button
                  type="button"
                  class="text-button"
                  ?disabled=${this.busy}
                  @click=${() => (this._confirmDelete = false)}
                >
                  Keep
                </button>
                <button
                  type="button"
                  class="text-button danger primary"
                  ?disabled=${this.busy}
                  @click=${() => this.dispatchEvent(new CustomEvent("form-delete"))}
                >
                  ${this.busy ? "Deleting…" : "Delete"}
                </button>
              </div>`
            : html`<div class="actions">
                ${
                  isEdit && caps.delete
                    ? html`<button
                          type="button"
                          class="text-button danger"
                          ?disabled=${this.busy}
                          @click=${() => (this._confirmDelete = true)}
                        >
                          Delete
                        </button>
                        <span class="spacer"></span>`
                    : nothing
                }
                <button
                  type="button"
                  class="text-button"
                  ?disabled=${this.busy}
                  @click=${this.cancel}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="text-button primary"
                  ?disabled=${this.busy || summaryBlank}
                >
                  ${this.busy ? "Saving…" : isEdit ? "Save" : "Add"}
                </button>
              </div>`
        }
      </form>
    `;
  }
}

if (!customElements.get(FORM_TAG)) customElements.define(FORM_TAG, CompactTodoForm);

declare global {
  interface HTMLElementTagNameMap {
    [FORM_TAG]: CompactTodoForm;
  }
}
