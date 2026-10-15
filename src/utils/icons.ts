import { svg, type SVGTemplateResult } from "lit";

export {
  mdiAlertCircleOutline,
  mdiChevronDown,
  mdiChevronRight,
  mdiClose,
  mdiPlus,
  mdiRefresh,
} from "@mdi/js";

/** Renders a Material Design Icon path as an inline, decorative SVG. */
export function icon(path: string): SVGTemplateResult {
  return svg`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d=${path}></path></svg>`;
}
