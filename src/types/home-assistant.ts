/**
 * Minimal structural types for the parts of the Home Assistant frontend `hass`
 * object this card uses. Only documented, stable members are declared so the
 * card never reaches into frontend internals.
 */

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
    supported_features?: number;
  };
  last_changed?: string;
  last_updated?: string;
}

export type UnsubscribeFunc = () => void;

export interface HassConnection {
  subscribeMessage<T>(
    callback: (message: T) => void,
    subscribeMessage: Record<string, unknown>,
  ): Promise<UnsubscribeFunc>;
}

export interface ServiceCallResponse<T = unknown> {
  context?: unknown;
  response?: T;
}

export interface ThemeVars {
  [key: string]: string | Record<string, Record<string, string>> | undefined;
  modes?: { light?: Record<string, string>; dark?: Record<string, string> };
}

export interface HomeAssistant {
  states: Record<string, HassEntity | undefined>;
  connection: HassConnection;
  connected?: boolean;
  language?: string;
  locale?: { language?: string };
  themes?: {
    darkMode?: boolean;
    themes?: Record<string, ThemeVars | undefined>;
  };
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: { entity_id?: string | string[] },
    notifyOnError?: boolean,
    returnResponse?: boolean,
  ): Promise<ServiceCallResponse | unknown>;
}

/** Bit flags from homeassistant/components/todo/const.py (TodoListEntityFeature). */
export const TodoListEntityFeature = {
  CREATE_TODO_ITEM: 1,
  DELETE_TODO_ITEM: 2,
  UPDATE_TODO_ITEM: 4,
  MOVE_TODO_ITEM: 8,
  SET_DUE_DATE_ON_ITEM: 16,
  SET_DUE_DATETIME_ON_ITEM: 32,
  SET_DESCRIPTION_ON_ITEM: 64,
} as const;

export type TodoItemStatus = "needs_action" | "completed";

/** A to-do item as delivered by `todo/item/subscribe` or `todo.get_items`. */
export interface RawTodoItem {
  uid?: string | null;
  summary?: string | null;
  status?: string | null;
  due?: string | null;
  description?: string | null;
  completed?: string | null;
}

/** Card-facing, normalized to-do item. */
export interface TodoItem {
  /** Stable key for rendering and expansion state. Equal to uid when available. */
  key: string;
  /** Value passed as `item` in service calls (uid, or summary when the provider has no uids). */
  ref: string;
  uid?: string;
  summary: string;
  status: TodoItemStatus;
  due?: string;
  description?: string;
  completed?: string;
}

export interface TodoCapabilities {
  create: boolean;
  delete: boolean;
  update: boolean;
  dueDate: boolean;
  dueDatetime: boolean;
  description: boolean;
}

/** Shape of the `config-changed` and Lovelace card contract pieces we implement. */
export interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

export interface LovelaceGridOptions {
  columns?: number | "full";
  rows?: number | "auto";
  min_columns?: number;
  max_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description?: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}
