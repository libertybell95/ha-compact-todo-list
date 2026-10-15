import { css } from "lit";

/**
 * All colors come from Home Assistant theme variables, with fallbacks for
 * environments (tests, demo) where no theme is loaded.
 */

export const sharedStyles = css`
  :host {
    --ctc-text: var(--primary-text-color, #212121);
    --ctc-secondary: var(--secondary-text-color, #727272);
    --ctc-divider: var(--divider-color, rgba(0, 0, 0, 0.12));
    --ctc-accent: var(--primary-color, #03a9f4);
    --ctc-on-accent: var(--text-primary-color, #fff);
    --ctc-error: var(--error-color, #db4437);
    --ctc-warning: var(--warning-color, #ffa600);
    --ctc-hover: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.05);
    --ctc-input-bg: var(--secondary-background-color, rgba(127, 127, 127, 0.08));
    --ctc-radius: var(--ha-card-border-radius, 12px);
    --ctc-transition: 180ms ease;
  }

  button {
    font: inherit;
    color: inherit;
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--ctc-secondary);
    cursor: pointer;
  }
  .icon-button:hover {
    background: var(--ctc-hover);
    color: var(--ctc-text);
  }
  .icon-button:disabled {
    opacity: 0.4;
    cursor: default;
    background: none;
  }
  .icon-button svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }

  .text-button {
    min-height: 32px;
    padding: 0 12px;
    border: none;
    border-radius: 16px;
    background: none;
    color: var(--ctc-accent);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.01em;
    cursor: pointer;
  }
  .text-button:hover {
    background: var(--ctc-hover);
  }
  .text-button.primary {
    background: var(--ctc-accent);
    color: var(--ctc-on-accent);
  }
  .text-button.primary:hover {
    filter: brightness(1.08);
  }
  .text-button.danger {
    color: var(--ctc-error);
  }
  .text-button.danger.primary {
    background: var(--ctc-error);
    color: #fff;
  }
  .text-button:disabled {
    opacity: 0.5;
    cursor: default;
    filter: none;
  }

  :is(button, input, textarea):focus-visible {
    outline: 2px solid var(--ctc-accent);
    outline-offset: 1px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    :host {
      --ctc-transition: 0ms;
    }
  }
`;

export const checkboxStyles = css`
  .checkbox {
    appearance: none;
    -webkit-appearance: none;
    flex: none;
    width: 18px;
    height: 18px;
    margin: 0;
    border: 2px solid var(--ctc-secondary);
    border-radius: 3px;
    background: transparent center / 14px 14px no-repeat;
    cursor: pointer;
    transition:
      background-color var(--ctc-transition),
      border-color var(--ctc-transition);
  }
  .checkbox:checked {
    border-color: var(--ctc-accent);
    background-color: var(--ctc-accent);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='white' stroke-width='3' d='M4.5 12.5l5 5 10-11'/%3E%3C/svg%3E");
  }
  .checkbox:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .checkbox[aria-busy="true"] {
    opacity: 0.55;
    cursor: progress;
  }
`;

export const formStyles = css`
  form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  label.field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: var(--ctc-secondary);
  }
  input[type="text"],
  input[type="date"],
  input[type="time"],
  textarea {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid var(--ctc-divider);
    border-radius: 6px;
    background: var(--ctc-input-bg);
    color: var(--ctc-text);
    font: inherit;
    font-size: 14px;
    color-scheme: light dark;
  }
  input:focus,
  textarea:focus {
    border-color: var(--ctc-accent);
    outline: none;
  }
  input[aria-invalid="true"],
  textarea[aria-invalid="true"] {
    border-color: var(--ctc-error);
  }
  textarea {
    resize: vertical;
    min-height: 64px;
    line-height: 1.4;
  }
  .due-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .due-row > label {
    flex: 1 1 130px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
  }
  .actions .spacer {
    flex: 1;
  }
  .form-error {
    margin: 0;
    color: var(--ctc-error);
    font-size: 13px;
  }
  .hint {
    margin: 0;
    color: var(--ctc-secondary);
    font-size: 12px;
  }
  .confirm {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    padding: 6px 8px;
    border-radius: 6px;
    background: rgba(var(--rgb-error-color, 219, 68, 55), 0.1);
    font-size: 14px;
  }
  .confirm span {
    flex: 1 1 auto;
  }
`;
