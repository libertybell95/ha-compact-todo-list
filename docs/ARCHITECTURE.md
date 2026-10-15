# Architecture

The card is a single ES module, `dist/ha-compact-todo-card.js`. It is built with Vite and bundles [Lit](https://lit.dev/), its only runtime dependency. It talks only to the `hass` object Home Assistant gives every dashboard card.

```text
src/
├── compact-todo-card.ts   Card element: config, hass handling, layout, actions, registration
├── editor.ts              Visual editor schema (getConfigForm)
├── config.ts              Option types, defaults and validation
├── api/
│   ├── todo-api.ts        Calls to Home Assistant (WebSocket subscription and todo.* services)
│   └── todo-store.ts      Sync state: subscription, fallback, pending writes, reconciliation
├── components/
│   ├── todo-row.ts        One task row: checkbox, expand control, details, animation
│   └── todo-form.ts       Add and edit form with validation and delete confirmation
├── styles/styles.ts       Shared CSS built on Home Assistant theme variables
├── types/home-assistant.ts  Minimal types for the documented parts of hass
└── utils/                 Pure helpers: items, service payloads, expansion, errors, theme, log, icons
```

Display code (the card, rows and form) is kept separate from data code (the store and API). Everything in `utils/` and `config.ts` is a pure function and has unit tests.

## Home Assistant interfaces used

| Purpose                | Interface                                                                     |
| ---------------------- | ----------------------------------------------------------------------------- |
| Live list              | WebSocket `todo/item/subscribe` (`{ entity_id }` → events `{ items }`)        |
| One-off fetch          | Service `todo.get_items` with `return_response`                               |
| Add                    | Service `todo.add_item` (`item`, `description`, `due_date` or `due_datetime`) |
| Complete, edit         | Service `todo.update_item` (`item` = uid, plus only the changed fields)       |
| Delete                 | Service `todo.remove_item` (`item: [uid]`)                                    |
| What the list supports | `supported_features` on the entity (`TodoListEntityFeature` bits)             |

These were checked against the Home Assistant source (`homeassistant/components/todo/`) and the official frontend's `src/data/todo.ts`.

- **`update_item` keeps omitted fields.** It merges the call into the existing item and changes only the fields provided. Sending `null` for `description`, `due_date` or `due_datetime` clears that field. The card therefore sends only changed fields, which keeps edits from overwriting data.
- **Unsupported fields cause errors.** Sending a field the entity doesn't support raises `ServiceValidationError`, so payloads are built from the entity's capabilities.
- **`item` matches by uid or by title.** Home Assistant looks up `item` by `uid` or `summary`. The card always sends the `uid`. For integrations that don't provide uids, it sends the title instead. If several tasks share that title, Home Assistant picks the first.

## Sync model (`TodoStore`)

- **Live mode.** On start, the store subscribes with `todo/item/subscribe`. Home Assistant sends the full list right away and after every change, whatever made it. If the connection drops, the WebSocket library resubscribes, and the new full list clears the "stale" flag.
- **Fallback mode.** If subscribing fails, the store fetches the list once with `todo.get_items`. After that it refreshes:
  - when the entity's state object changes (debounced 300 ms),
  - every 5 minutes,
  - and when the connection returns.

  It retries the subscription with exponential backoff (30 s, doubling, up to 10 min). If Home Assistant doesn't recognize the subscription command at all, it doesn't retry.

- **Writes.** Each task can have only one write in flight, so a double-tap can't send two requests. A write goes through three steps:
  1. **Sending:** the request is in flight.
  2. **Syncing:** Home Assistant accepted it, and the store waits for an updated list that shows the change.
  3. **Done:** the list confirms it.

  If no confirming list arrives within 5 s, the store fetches the list once. If the change still isn't there, it shows a notice instead of claiming success. A failed write returns a readable error, and the row returns to its last confirmed state.

- **Completing or deleting.** While a write is pending, the checkbox shows the requested state. Filtering uses only the state Home Assistant has confirmed, so a task leaves the list only after Home Assistant confirms it is completed or deleted.
- **Stale callbacks.** Each `start()` and `stop()` increments a counter. Callbacks and timers started under an older value do nothing. `stop()` unsubscribes and clears every timer. The card calls it from `disconnectedCallback` and when the entity changes.

## Rendering and performance

- Home Assistant passes a new `hass` object to every card whenever anything in the house changes. The card copies only its own entity's state object, the connection flag and the theme into reactive state, so changes to other entities never re-render it (there's a test for this).
- Rows are Lit elements rendered with keyed `repeat`. Item objects whose fields didn't change are reused between updates (`preserveIdentity`), so only changed rows re-render.
- Details are added to the page only for expanded rows, and kept just long enough for the collapse animation. The animation uses CSS `grid-template-rows: 0fr → 1fr`. Nothing animates continuously.
- Icons are a few `@mdi/js` paths drawn as inline SVG; unused icons are removed from the bundle. The card doesn't use Home Assistant's internal elements except `<ha-card>`, which the official custom card documentation uses.

## Security

- Titles and descriptions are only ever rendered as plain text through Lit bindings. The card never sets `innerHTML`, never uses `unsafeHTML`, and never calls `eval`. ESLint enforces `no-eval` and `no-implied-eval`.
- The card uses the dashboard's authenticated connection. It never asks for, stores or logs credentials.
- Logs contain entity IDs, uids and counts only, never task text. Nothing is sent outside Home Assistant.

## Design decisions

| Decision                                                                                         | Why                                                                                                                     |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Visual editor via `getConfigForm`, not a custom editor element                                   | Documented, and needs no internal form components. Home Assistant draws its own entity, number and theme pickers.       |
| Native `<input type="checkbox">`, `<input type="date">` and buttons, styled with theme variables | Accessible by default, look right in every theme, and don't depend on Home Assistant's private `ha-*`/`mwc-*` elements. |
| Due times sent as ISO strings with the browser's UTC offset                                      | Removes any doubt about time zones. Home Assistant converts the time to its own zone.                                   |
| Delete confirmation inside the form, not `window.confirm`                                        | Works in the Companion apps and kiosk browsers, and is easier to use with a keyboard.                                   |
| Open/closed state stored per task, not per row position                                          | List updates never close or swap the open task.                                                                         |
| Edit form stays open when another task is opened                                                 | Accordion mode must never throw away unsaved edits.                                                                     |
| `max_height: 0` (no limit) by default                                                            | Matches the built-in card. Long lists are opt-in via `max_height`.                                                      |
| Bundle not committed; attached to GitHub releases                                                | Keeps the history clean. The release workflow checks that the tag matches the version before attaching the file.        |
