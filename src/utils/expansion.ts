/**
 * Expansion state helpers. State is a set of stable item keys so that list
 * updates from Home Assistant never collapse a row unexpectedly.
 */

export function toggleExpanded(
  expanded: ReadonlySet<string>,
  key: string,
  accordion: boolean,
): Set<string> {
  if (expanded.has(key)) {
    const next = new Set(expanded);
    next.delete(key);
    return next;
  }
  if (accordion) return new Set([key]);
  const next = new Set(expanded);
  next.add(key);
  return next;
}

/** Drops keys whose items no longer exist. Returns the same set if nothing changed. */
export function pruneExpanded(
  expanded: ReadonlySet<string>,
  existingKeys: Iterable<string>,
): ReadonlySet<string> {
  if (expanded.size === 0) return expanded;
  const existing = new Set(existingKeys);
  let changed = false;
  const next = new Set<string>();
  for (const key of expanded) {
    if (existing.has(key)) next.add(key);
    else changed = true;
  }
  return changed ? next : expanded;
}

/** When accordion mode is switched on, keep at most one expanded row. */
export function enforceAccordion(expanded: ReadonlySet<string>): ReadonlySet<string> {
  if (expanded.size <= 1) return expanded;
  const last = [...expanded].pop()!;
  return new Set([last]);
}
