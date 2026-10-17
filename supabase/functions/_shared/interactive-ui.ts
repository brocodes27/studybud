/** Wire payload for a self-contained, sandboxed learning visual. */
export interface InteractiveUI {
  html: string;
  css: string;
  js: string;
}

export function parseInteractiveUI(value: unknown): InteractiveUI | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { html, css, js } = value as Record<string, unknown>;
  if (typeof html !== 'string' || !html.trim() || html.length > 24000 ||
      typeof css !== 'string' || css.length > 12000 ||
      typeof js !== 'string' || js.length > 24000) return undefined;
  return { html, css, js };
}

export const INTERACTIVE_UI_GUIDE = `When an interactive visual would help explain this concept, also return ui:{html:string,css:string,js:string}; otherwise ui:null. Use a self-contained HTML fragment with inline SVG or canvas, CSS, and plain JavaScript. Make working labelled controls (sliders, buttons, selectable steps), not a static illustration. Base every instructional claim and formula on the supplied source; mark hypothetical example values. Do not add unsupported subject facts. Use accessible labels, keyboard controls, readable contrast, responsive layouts, and respect prefers-reduced-motion. No external dependencies, imports, URLs, network, storage, forms, links, iframes, or host communication. Use only local DOM APIs. Scripts belong only in js, styles only in css. Use a light background, dark text, and restrained green accents. Keep the entire visual concise. The text explanation and citations must stand on their own if the visual cannot run.`;
