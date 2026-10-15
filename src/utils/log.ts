/**
 * Console logger. Warnings and errors always print; debug output is opt-in:
 *   localStorage.setItem("compact-todo-card.debug", "1")
 * Task titles and descriptions are never logged, only entity ids, uids and counts.
 */

const PREFIX = "[compact-todo-card]";
const DEBUG_KEY = "compact-todo-card.debug";

function debugEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export const log = {
  debug(message: string, details?: Record<string, unknown>): void {
    if (debugEnabled()) console.debug(PREFIX, message, details ?? "");
  },
  warn(message: string, details?: Record<string, unknown>): void {
    console.warn(PREFIX, message, details ?? "");
  },
  error(message: string, details?: Record<string, unknown>): void {
    console.error(PREFIX, message, details ?? "");
  },
};
