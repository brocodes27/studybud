import DOMPurify from 'dompurify';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseInteractiveUI, type InteractiveUI } from '../../../supabase/functions/_shared/interactive-ui';
import { interactiveDocument } from './interactiveDocument';
import './interactive-answer.css';

export function InteractiveAnswer({ ui, title }: { ui: InteractiveUI; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [revision, setRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const document = useMemo(() => parseInteractiveUI(ui)
    ? interactiveDocument({ ...ui, html: DOMPurify.sanitize(ui.html, { FORBID_TAGS: ['script', 'style', 'meta', 'link', 'iframe', 'object', 'embed', 'form', 'base'], FORBID_ATTR: ['href', 'src', 'srcset', 'action', 'formaction', 'target', 'ping', 'xlink:href'] }) }, crypto.randomUUID()) : null, [ui, revision]);

  useEffect(() => {
    setFailed(false);
    const onMessage = (event: MessageEvent) => {
      if (event.source === frame.current?.contentWindow && event.data?.type === 'curve-visual-error') setFailed(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [document]);

  return (
    <section className="interactive-answer" aria-label={`Interactive explanation: ${title}`}>
      <div className="interactive-answer-toolbar">
        <strong>Explore interactively</strong>
        <div>
          <button type="button" className="learn-button subtle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Reduce' : 'Expand'}</button>
          <button type="button" className="learn-button subtle" onClick={() => setRevision(value => value + 1)}>Reset</button>
        </div>
      </div>
      {failed || !document ? <p role="status">This visual couldn’t run. You can reset it or use the explanation and sources below.</p> : (
        <iframe ref={frame} key={revision} title={`Interactive explanation: ${title}`}
          sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={document}
          className={expanded ? 'expanded' : ''} />
      )}
    </section>
  );
}
