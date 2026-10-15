<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/libertybell95/ha-compact-todo-list/main/docs/images/icon-dark.png">
  <img src="https://raw.githubusercontent.com/libertybell95/ha-compact-todo-list/main/docs/images/icon-light.png" alt="" width="96" height="96" align="right">
</picture>

# Compact To-Do Card

A compact to-do list card for Home Assistant dashboards. Each task is one short row; tap a task to see its description, due date and an **Edit** button.

Home Assistant's built-in to-do card shows every task's description under its title, so a list of five tasks can fill the screen. This card shows only titles until you open a task, and it still lets you add, complete, edit and delete tasks on any to-do list in Home Assistant.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/libertybell95/ha-compact-todo-list/main/docs/images/hero-dark.png">
  <img src="https://raw.githubusercontent.com/libertybell95/ha-compact-todo-list/main/docs/images/hero-light.png" alt="Illustration: a to-do list with descriptions under every task becomes a compact list where only the opened task shows its details." width="800">
</picture>

<sub>Illustration only. Real screenshots are listed under [Screenshots](#screenshots).</sub>

- **Short rows:** 36 px per task by default. Long titles are cut off with "…".
- **Expand a task:** shows its full title, description (line breaks kept), due date, and Edit.
- **Checkbox:** completes or restores a task. It never opens the task.
- **Accordion:** opening one task closes the previous one (you can turn this off).
- **Inline forms:** add and edit tasks without opening a dialog. Delete asks for confirmation.
- **Stays in sync:** changes made in other dashboards, automations, scripts or integrations appear immediately.
- **Fits your dashboard:** follows your Home Assistant theme, light and dark mode, and phone layouts.
- **Visual editor:** configure the card without writing YAML.

The card runs entirely in your browser. It uses Home Assistant's own to-do services and your existing login, has no backend, and doesn't copy your tasks anywhere.

## Screenshots

Screenshots from a real Home Assistant dashboard have not been added yet. Planned:

| View                     | File                         |
| ------------------------ | ---------------------------- |
| Collapsed list           | `docs/images/compact.png`    |
| Expanded task            | `docs/images/expanded.png`   |
| Editing a task           | `docs/images/editing.png`    |
| Phone layout             | `docs/images/mobile.png`     |
| Light mode and dark mode | `docs/images/light-dark.png` |

## Installation

### HACS (recommended)

1. Open **HACS** in Home Assistant.
2. Open the menu (⋮) in the top-right corner and choose **Custom repositories**.
3. Enter `https://github.com/libertybell95/ha-compact-todo-list`, choose type **Dashboard**, and select **Add**.
4. Search HACS for **Compact To-Do Card**, open it, and select **Download**.
5. Reload your browser when asked.

If your dashboard resources are managed in the UI (the default), HACS adds the resource for you. If it doesn't, follow step 3 of the manual installation below.

### Manual

1. Download `ha-compact-todo-card.js` from the [latest release](https://github.com/libertybell95/ha-compact-todo-list/releases/latest).
2. Copy it to `<config>/www/ha-compact-todo-card.js`. The `www` folder sits next to `configuration.yaml`; create it if it doesn't exist.
3. Add the file as a dashboard resource:
   - **UI:** go to **Settings → Dashboards**, open the menu (⋮), choose **Resources**, then **Add resource**. Enter URL `/local/ha-compact-todo-card.js` and choose **JavaScript module**. If you don't see **Resources**, turn on **Advanced mode** in your user profile.
   - **YAML-mode dashboards:**

     ```yaml
     lovelace:
       resources:
         - url: /local/ha-compact-todo-card.js
           type: module
     ```

4. Reload your browser. If you replace the file later, add `?v=2` (any new number) to the resource URL so browsers don't keep the old copy.

## Adding the card

Edit a dashboard, select **Add card**, and search for **Compact To-Do Card**. You can also use a **Manual** card with:

```yaml
type: custom:ha-compact-todo-card
entity: todo.ksi
```

The card doesn't change your to-do list or its settings. It reads and writes tasks only when you act on them.

## Configuration

### Minimal

```yaml
type: custom:ha-compact-todo-card
entity: todo.ksi
```

### Full

```yaml
type: custom:ha-compact-todo-card
entity: todo.ksi
title: KSI Tasks
row_height: 36
max_height: 350
scrollable: true
expand_on_click: true
accordion: true
animate_expansion: true
show_completed: false
show_task_count: true
show_add_button: true
sort: manual
theme: auto
```

### Options

| Option              | Type    | Default         | Description                                                                                                                                    |
| ------------------- | ------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity`            | string  | **required**    | A `todo.*` entity.                                                                                                                             |
| `title`             | string  | the list's name | Header text. Use `""` for no title.                                                                                                            |
| `row_height`        | number  | `36`            | Height of a collapsed task, in pixels (28–64).                                                                                                 |
| `max_height`        | number  | `0`             | Maximum height of the task list, in pixels. `0` means no limit; any other value must be at least 72. Used only when `scrollable` is `true`.    |
| `scrollable`        | boolean | `true`          | When the list is taller than `max_height`, scroll inside the card. When `false`, `max_height` is ignored and the card grows to fit every task. |
| `expand_on_click`   | boolean | `true`          | Tapping the title opens the task. When `false`, only the chevron (›) opens it.                                                                 |
| `accordion`         | boolean | `true`          | Only one task open at a time.                                                                                                                  |
| `animate_expansion` | boolean | `true`          | Animate opening and closing a task. Animations are always off when your device has "reduce motion" turned on.                                  |
| `show_completed`    | boolean | `false`         | Show completed tasks in a "Completed" section you can collapse. Hidden completed tasks are not deleted.                                        |
| `show_task_count`   | boolean | `true`          | Show the number of open tasks in the header.                                                                                                   |
| `show_add_button`   | boolean | `true`          | Show the **+** button. Hidden automatically if the list doesn't allow new tasks.                                                               |
| `sort`              | string  | `manual`        | `manual` keeps Home Assistant's order. Other values: `alpha_asc`, `alpha_desc`, `due_asc`, `due_desc`. Tasks with no due date go last.         |
| `theme`             | string  | `auto`          | `auto` uses the dashboard's theme. Any other value is the name of an installed Home Assistant theme, applied to this card only.                |

If an option has the wrong type or is out of range, the card shows Home Assistant's error card with a message explaining the problem. Options the card doesn't recognize are ignored, with a warning in the browser console.

## Using the card

- **Add a task:** select **+**, type a title, and press **Enter** or select **Add**. Description and due date fields appear only if your list supports them. Press **Esc** to cancel. In the description box, **Ctrl/⌘ + Enter** saves.
- **Complete a task:** select its checkbox. The task shows as completed while Home Assistant saves it, then leaves the list (unless `show_completed` is on).
- **Restore a task:** with `show_completed: true`, clear the checkbox in the **Completed** section.
- **See details:** select the task's title or chevron. Select it again (or press **Esc**) to close it. **↑** and **↓** move between tasks.
- **Edit a task:** open the task and select **Edit**. Only the fields you change are sent, so anything else stored on the task stays as it is.
- **Delete a task:** open the editor, select **Delete**, then confirm.

### What your list supports

Each to-do integration supports a different set of features. The card checks what yours allows and hides controls it doesn't:

| Your list doesn't support… | What the card does                                     |
| -------------------------- | ------------------------------------------------------ |
| Adding tasks               | Hides the **+** button                                 |
| Updating tasks             | Disables checkboxes (hover for why) and hides **Edit** |
| Deleting tasks             | Hides **Delete** in the editor                         |
| Descriptions               | Hides the description field                            |
| Due dates or due times     | Hides the date or time field                           |

For example, the built-in **Local To-do** integration supports everything. The **Shopping list** integration supports titles only.

### Status messages

- **"Tasks may be out of date"** or **"Disconnected"**: the card shows the last tasks it received. A refresh button appears in the header.
- **Error banner**: an action failed (for example, the integration is offline). Your task is left unchanged. Dismiss the banner and try again.
- **"Home Assistant accepted a change but the list does not show it yet"**: the save was accepted, but the updated list didn't include the change. This usually means something else changed the task at the same moment.

## Troubleshooting

| Problem                                              | What to try                                                                                                                                                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Custom element doesn't exist: ha-compact-todo-card" | The resource isn't loaded. Check **Settings → Dashboards → Resources** for `/hacsfiles/ha-compact-todo-list/ha-compact-todo-card.js` (HACS) or `/local/ha-compact-todo-card.js` (manual), with type **JavaScript module**. Then reload the browser. |
| Card missing from the card picker                    | Reload the browser after installing. In the Home Assistant Companion app, go to **Settings → Companion app → Troubleshooting** and select **Reset frontend cache**.                                                                                 |
| JavaScript or resource errors                        | Open the browser console (F12). Messages from this card start with `[compact-todo-card]`. A 404 for the resource means its URL doesn't match where the file is.                                                                                     |
| Old version still showing after an update            | Clear your browser cache, or force-reload with Ctrl/⌘ + Shift + R. For manual installs, change the `?v=` number on the resource URL.                                                                                                                |
| HACS doesn't offer an update                         | In HACS, open the card's menu and choose **Update information**. HACS only sees updates published as GitHub releases.                                                                                                                               |
| "must be a to-do list entity"                        | `entity` must start with `todo.`. Find your lists under **Settings → Devices & services → Entities**, filtered to the to-do domain.                                                                                                                 |
| "Entity not available"                               | The list doesn't exist or its integration hasn't loaded yet. The card connects automatically once the entity appears.                                                                                                                               |
| Checkbox disabled or editing missing                 | Your list doesn't support that action. See [What your list supports](#what-your-list-supports).                                                                                                                                                     |
| "Could not … :" error banners                        | The text after the colon comes from Home Assistant or the integration. Check **Settings → System → Logs** for the matching error.                                                                                                                   |

For detailed logs, run `localStorage.setItem("compact-todo-card.debug", "1")` in the browser console and reload. These logs include entity IDs, task IDs and counts, but never task titles or descriptions. Turn them off with `localStorage.removeItem("compact-todo-card.debug")`.

## Compatibility

**Tested:** automated tests only, run against a simulated Home Assistant (see [Development](#development)). The card has **not yet been tested on a live Home Assistant instance**, so no Home Assistant version is listed as verified.

**Required Home Assistant features** (all documented):

- WebSocket command `todo/item/subscribe`
- Services `todo.get_items`, `todo.add_item`, `todo.update_item`, `todo.remove_item`
- The visual editor uses the custom card `getConfigForm()` editor API. Without it, the card still works and you can configure it in YAML.

**Browsers:** recent versions of Chrome, Edge, Firefox and Safari, and the Home Assistant Companion apps. The card needs CSS `grid-template-rows` animation and native date and time inputs.

## Development

Requires Node.js 20 or newer.

```bash
npm install          # install dependencies
npm run dev          # demo page with a simulated Home Assistant: http://localhost:5173
npm test             # unit and component tests (Vitest + happy-dom)
npm run watch        # development build of dist/ that rebuilds on change, with source maps
npm run build        # production bundle: dist/ha-compact-todo-card.js
npm run check        # type check + lint + format check + tests + build (same as CI)
```

To try a development build in a real Home Assistant, copy `dist/ha-compact-todo-card.js` to `<config>/www/` and register it as described in [Manual installation](#manual).

- Project structure and design decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Releasing, rolling back and checking against a live instance: [docs/RELEASING.md](docs/RELEASING.md)

## License

[MIT](LICENSE)
