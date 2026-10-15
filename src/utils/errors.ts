import { MalformedResponseError } from "./items";

/** Error codes from home-assistant-js-websocket for connection problems. */
const ERR_CONNECTION_LOST = 3;

export interface CardError {
  /** Short machine-readable category, useful for tests and debug logs. */
  kind: "disconnected" | "unauthorized" | "not_found" | "unsupported" | "malformed" | "failed";
  message: string;
}

function describe(error: unknown): { code?: string | number; message?: string } {
  if (error && typeof error === "object") {
    const e = error as {
      code?: unknown;
      message?: unknown;
      error?: { code?: unknown; message?: unknown };
    };
    const source = e.error && typeof e.error === "object" ? e.error : e;
    return {
      code:
        typeof source.code === "string" || typeof source.code === "number"
          ? source.code
          : undefined,
      message: typeof source.message === "string" ? source.message : undefined,
    };
  }
  if (typeof error === "string") return { message: error };
  if (typeof error === "number") return { code: error };
  return {};
}

/** Converts Home Assistant / websocket errors into a user-facing message. */
export function toCardError(error: unknown, action: string): CardError {
  if (error instanceof MalformedResponseError) {
    return { kind: "malformed", message: `Could not ${action}: ${error.message}` };
  }
  const { code, message } = describe(error);
  if (code === ERR_CONNECTION_LOST || code === "connection_lost") {
    return {
      kind: "disconnected",
      message: `Could not ${action}: the connection to Home Assistant was lost.`,
    };
  }
  if (code === "unauthorized") {
    return {
      kind: "unauthorized",
      message: `Could not ${action}: your user is not allowed to do that.`,
    };
  }
  if (code === "not_found" || code === "service_not_found" || code === "invalid_entity_id") {
    return {
      kind: "not_found",
      message: `Could not ${action}: ${message ?? "the list or task was not found."}`,
    };
  }
  if (code === "unknown_command" || code === "not_supported") {
    return {
      kind: "unsupported",
      message: `Could not ${action}: not supported by this to-do list.`,
    };
  }
  return {
    kind: "failed",
    message: `Could not ${action}${message ? `: ${message}` : "."}`,
  };
}
