# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.2] - 2026-10-20

### Changed

- Long task titles now wrap onto more lines at word boundaries instead of
  being cut off with an ellipsis. Words are not hyphenated or split, unless
  one word is wider than the whole row. The checkbox, due date and chevron
  line up with the first line of the title.

## [0.1.1] - 2026-10-15

### Added

- Project artwork in `docs/images/`: icon, README illustration (light and
  dark variants) and a GitHub social preview image.

### Changed

- README shows the icon and illustration, switching with the reader's
  light or dark mode.
- HACS validation no longer skips the README image check.

## [0.1.0] - 2026-10-15

### Added

- Compact single-line task rows (36 px by default) with expandable details.
- Accordion or multi-expand behavior, with optional expand/collapse animation
  that respects `prefers-reduced-motion`.
- Complete and restore tasks; checkbox and expand controls are independent.
- Inline add form and inline editor (title, description, due date/time) that
  only shows fields the to-do entity supports and only sends changed fields.
- Delete with explicit confirmation.
- Optional collapsible "Completed" section.
- Sorting: manual, alphabetical, due date.
- Live updates via `todo/item/subscribe`, with a fallback to `todo.get_items`
  refreshes and subscription retries.
- Pending, error, stale and disconnected states; writes are reconciled against
  the updated list before they are considered done.
- Visual editor via Home Assistant's `getConfigForm` and card picker entry.
- Optional per-card `theme`.
