import { useEffect, useId, useRef } from 'react';
import './session-exit.css';

export function SessionExitDialog({ answered, total, busy, error, onClose, onSaveExit }: {
  answered: number;
  total: number;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSaveExit: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const opener = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return <dialog ref={dialog} className="learn session-exit-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <span className="session-exit-eyebrow">Your work stays with you</span>
    <h2 id={titleId}>Pause here?</h2>
    <p id={descriptionId}>{answered} of {total} questions answered. Save your draft and pick it up later. Unanswered questions won’t count toward your results.</p>
    {error && <p className="learn-error" role="alert">{error}</p>}
    <div className="session-exit-actions">
      <button type="button" className="learn-button subtle" disabled={busy} onClick={onClose} autoFocus>Keep studying</button>
      <button type="button" className="learn-button dark" disabled={busy} onClick={onSaveExit}>{busy ? 'Saving your draft…' : 'Save & leave'}</button>
    </div>
  </dialog>;
}
