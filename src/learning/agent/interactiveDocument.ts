import { parseInteractiveUI, type InteractiveUI } from '../../../supabase/functions/_shared/interactive-ui';

export function interactiveDocument(ui: InteractiveUI, nonce: string): string {
  if (!parseInteractiveUI(ui) || !/^[a-zA-Z0-9-]+$/.test(nonce)) throw new Error('Invalid interactive view.');
  // The opaque-origin sandbox and CSP confine generated code to this document.
  const policy = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;font:15px/1.5 system-ui;color:#18352b;background:#fff}*{box-sizing:border-box}input,button,select{font:inherit}svg,canvas{max-width:100%}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}${ui.css.replace(/<\/style/gi, '<\\/style')}</style></head><body>${ui.html}<script nonce="${nonce}">
window.addEventListener('error',()=>parent.postMessage({type:'curve-visual-error'},'*'));
window.addEventListener('unhandledrejection',()=>parent.postMessage({type:'curve-visual-error'},'*'));
try {
${ui.js.replace(/<\/script/gi, '<\\/script')}
} catch (error) { parent.postMessage({type:'curve-visual-error'},'*'); }
</script></body></html>`;
}
