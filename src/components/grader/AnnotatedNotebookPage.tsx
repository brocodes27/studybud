import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Grip,
  Loader2,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  NOTEBOOK_ANNOTATION_KINDS,
  NOTEBOOK_ANNOTATION_TONES,
  annotationNeedsAttention,
  deriveAnnotationReviewStatus,
  moveNotebookAnnotation,
  normalizeNotebookAnnotations,
  type NotebookAnnotation,
  type NotebookAnnotationKind,
  type NotebookAnnotationReviewStatus,
  type NotebookAnnotationTone,
} from '../../lib/notebookAnnotations';

interface AnnotatedNotebookPageProps {
  pageNumber: number;
  imageUrl: string;
  annotations: NotebookAnnotation[];
  reviewStatus: NotebookAnnotationReviewStatus;
  // ESLint's base rule treats type-only tuple names as runtime variables.
  // eslint-disable-next-line no-unused-vars
  onSave(...args: [NotebookAnnotation[], NotebookAnnotationReviewStatus]): Promise<void>;
}

interface DragState {
  annotation: NotebookAnnotation;
  pointerX: number;
  pointerY: number;
}

const RED_PEN = '#C2413B';

function AnnotationMark({
  annotation,
  selected,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onNudge,
}: {
  annotation: NotebookAnnotation;
  selected: boolean;
  onSelect: () => void;
  onPointerDown: React.PointerEventHandler<HTMLButtonElement>;
  onPointerMove: React.PointerEventHandler<HTMLButtonElement>;
  onPointerUp: React.PointerEventHandler<HTMLButtonElement>;
  // eslint-disable-next-line no-unused-vars
  onNudge(...args: [number, number]): void;
}) {
  const position: React.CSSProperties = {
    left: `${annotation.x * 100}%`,
    top: `${annotation.y * 100}%`,
    width: `${annotation.width * 100}%`,
    height: `${annotation.height * 100}%`,
    color: RED_PEN,
    borderColor: RED_PEN,
  };
  const commonClass = `absolute z-10 touch-none cursor-grab select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B7355] focus-visible:ring-offset-2 ${
    selected ? 'ring-2 ring-[#8B7355] ring-offset-2' : ''
  }`;
  const pointerHandlers = {
    onClick: (event: React.MouseEvent) => {
      event.stopPropagation();
      onSelect();
    },
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const distance = event.shiftKey ? 0.02 : 0.005;
      const movement = {
        ArrowLeft: [-distance, 0],
        ArrowRight: [distance, 0],
        ArrowUp: [0, -distance],
        ArrowDown: [0, distance],
      }[event.key];
      if (!movement) return;
      event.preventDefault();
      onNudge(movement[0], movement[1]);
    },
  };
  const label = `${annotation.kind}: ${annotation.text || annotation.tone}`;

  if (annotation.kind === 'underline') {
    return (
      <button
        type="button"
        aria-label={label}
        title={annotation.text}
        className={`${commonClass} border-b-[3px]`}
        style={position}
        {...pointerHandlers}
      />
    );
  }

  if (annotation.kind === 'circle') {
    return (
      <button
        type="button"
        aria-label={label}
        title={annotation.text}
        className={`${commonClass} rounded-[50%] border-[3px]`}
        style={position}
        {...pointerHandlers}
      />
    );
  }

  if (annotation.kind === 'strike') {
    return (
      <button
        type="button"
        aria-label={label}
        title={annotation.text}
        className={commonClass}
        style={position}
        {...pointerHandlers}
      >
        <span
          className="absolute left-0 right-0 top-1/2 block border-t-[3px]"
          style={{ borderColor: RED_PEN, transform: 'rotate(-2deg)' }}
        />
      </button>
    );
  }

  if (annotation.kind === 'tick') {
    return (
      <button
        type="button"
        aria-label={label}
        title={annotation.text}
        className={`${commonClass} flex items-center justify-center text-[clamp(16px,3vw,36px)] font-bold`}
        style={{ ...position, fontFamily: "'Segoe Print', 'Bradley Hand', cursive" }}
        {...pointerHandlers}
      >
        ✓
      </button>
    );
  }

  if (annotation.kind === 'score') {
    return (
      <button
        type="button"
        aria-label={label}
        className={`${commonClass} flex items-center justify-center rounded-[50%] border-[3px] bg-white/80 px-1 text-[clamp(9px,1.5vw,18px)] font-bold leading-none`}
        style={{ ...position, fontFamily: "'Segoe Print', 'Bradley Hand', cursive" }}
        {...pointerHandlers}
      >
        {annotation.text}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      className={`${commonClass} overflow-hidden rounded-md bg-[#FFFDF8]/90 px-1.5 text-left text-[clamp(8px,1.35vw,16px)] italic leading-tight shadow-sm`}
      style={{ ...position, fontFamily: "'Segoe Print', 'Bradley Hand', cursive" }}
      {...pointerHandlers}
    >
      {annotation.text}
    </button>
  );
}

const AnnotatedNotebookPage: React.FC<AnnotatedNotebookPageProps> = ({
  pageNumber,
  imageUrl,
  annotations,
  reviewStatus,
  onSave,
}) => {
  const [draft, setDraft] = useState(() => normalizeNotebookAnnotations(annotations));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const pageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    setDraft(normalizeNotebookAnnotations(annotations));
    setDirty(false);
    setSelectedId(null);
  }, [annotations]);

  const selected = draft.find((annotation) => annotation.id === selectedId) || null;
  const attentionCount = draft.filter(annotationNeedsAttention).length;

  const replaceAnnotation = (id: string, update: Partial<NotebookAnnotation>) => {
    setDraft((current) => current.map((annotation) => (
      annotation.id === id ? { ...annotation, ...update } : annotation
    )));
    setDirty(true);
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    annotation: NotebookAnnotation,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      annotation,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
    setSelectedId(annotation.id);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const pageBounds = pageRef.current?.getBoundingClientRect();
    if (!drag || !pageBounds || pageBounds.width === 0 || pageBounds.height === 0) return;

    const moved = moveNotebookAnnotation(
      drag.annotation,
      (event.clientX - drag.pointerX) / pageBounds.width,
      (event.clientY - drag.pointerY) / pageBounds.height,
    );
    replaceAnnotation(drag.annotation.id, { x: moved.x, y: moved.y });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const persist = async (
    nextDraft: NotebookAnnotation[],
    requestedStatus?: NotebookAnnotationReviewStatus,
  ) => {
    setSaving(true);
    setSaveError('');
    const normalized = normalizeNotebookAnnotations(nextDraft);
    const nextStatus = requestedStatus || deriveAnnotationReviewStatus(normalized);
    try {
      await onSave(normalized, nextStatus);
      setDraft(normalized);
      setDirty(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save annotations');
    } finally {
      setSaving(false);
    }
  };

  const approveAll = async () => {
    const approved = draft.map((annotation) => ({ ...annotation, status: 'approved' as const }));
    await persist(approved, 'approved');
  };

  const reopenReview = async () => {
    const suggested = draft.map((annotation) => ({ ...annotation, status: 'suggested' as const }));
    await persist(suggested, 'review');
  };

  return (
    <article className="overflow-hidden rounded-[24px] border border-[#2D2A26]/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2D2A26]/10 px-5 py-4">
        <div>
          <h4 className="font-bold text-[var(--neo-ink)]">Page {pageNumber}</h4>
          <p className="text-xs text-[var(--neo-muted)]">
            Select a mark to edit it. Drag it, or use the arrow keys, to correct its placement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reviewStatus === 'approved' && !dirty ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> {attentionCount} to review
            </span>
          )}
          <button
            type="button"
            onClick={() => void persist(draft)}
            disabled={saving || !dirty}
            className="neo-button-secondary !px-3 !py-2 text-xs disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
          {reviewStatus === 'approved' && !dirty ? (
            <button
              type="button"
              onClick={() => void reopenReview()}
              disabled={saving}
              className="neo-button-secondary !px-3 !py-2 text-xs disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" /> Reopen review
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void approveAll()}
              disabled={saving}
              className="neo-button !px-3 !py-2 text-xs disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" /> Approve page
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="bg-[var(--neo-surface)] p-3 sm:p-5">
          <div
            ref={pageRef}
            className="relative mx-auto w-full max-w-3xl overflow-hidden bg-white shadow-md"
            onClick={() => setSelectedId(null)}
          >
            <img
              src={imageUrl}
              alt={`Annotated notebook page ${pageNumber}`}
              className="block h-auto w-full"
              draggable={false}
            />
            {draft.map((annotation) => (
              <AnnotationMark
                key={annotation.id}
                annotation={annotation}
                selected={selectedId === annotation.id}
                onSelect={() => setSelectedId(annotation.id)}
                onPointerDown={(event) => handlePointerDown(event, annotation)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onNudge={(deltaX, deltaY) => {
                  const moved = moveNotebookAnnotation(annotation, deltaX, deltaY);
                  replaceAnnotation(annotation.id, { x: moved.x, y: moved.y });
                }}
              />
            ))}
          </div>
        </div>

        <aside className="border-t border-[#2D2A26]/10 bg-[#FFFDF8] p-5 xl:border-l xl:border-t-0">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--neo-ink)]">
                  <Grip className="h-4 w-4 text-[var(--neo-muted)]" /> Selected mark
                </div>
                <button
                  type="button"
                  aria-label="Delete selected annotation"
                  onClick={() => {
                    setDraft((current) => current.filter(({ id }) => id !== selected.id));
                    setSelectedId(null);
                    setDirty(true);
                  }}
                  className="rounded-full p-2 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <label className="block text-xs font-bold text-[var(--neo-muted)]">
                Mark type
                <select
                  value={selected.kind}
                  onChange={(event) => replaceAnnotation(
                    selected.id,
                    { kind: event.target.value as NotebookAnnotationKind },
                  )}
                  className="neo-input mt-1 w-full !px-3 !py-2 text-sm"
                >
                  {NOTEBOOK_ANNOTATION_KINDS.map((kind) => (
                    <option key={kind} value={kind}>{kind}</option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-[var(--neo-muted)]">
                Meaning
                <select
                  value={selected.tone}
                  onChange={(event) => replaceAnnotation(
                    selected.id,
                    { tone: event.target.value as NotebookAnnotationTone },
                  )}
                  className="neo-input mt-1 w-full !px-3 !py-2 text-sm"
                >
                  {NOTEBOOK_ANNOTATION_TONES.map((tone) => (
                    <option key={tone} value={tone}>{tone}</option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-[var(--neo-muted)]">
                Teacher note
                <textarea
                  value={selected.text}
                  onChange={(event) => replaceAnnotation(selected.id, { text: event.target.value })}
                  rows={4}
                  maxLength={500}
                  className="neo-input mt-1 w-full resize-y !px-3 !py-2 text-sm"
                />
              </label>

              <div className="rounded-2xl bg-white p-3 text-xs text-[var(--neo-muted)]">
                AI placement confidence:{' '}
                <strong className={selected.confidence < 0.75 ? 'text-amber-700' : 'text-emerald-700'}>
                  {Math.round(selected.confidence * 100)}%
                </strong>
              </div>

              <button
                type="button"
                onClick={() => replaceAnnotation(selected.id, {
                  status: selected.status === 'approved' ? 'suggested' : 'approved',
                })}
                className="neo-button-secondary w-full !px-3 !py-2 text-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
                {selected.status === 'approved' ? 'Mark as suggested' : 'Approve this mark'}
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-[var(--neo-muted)]">
              <p className="font-bold text-[var(--neo-ink)]">Annotation review</p>
              <p>
                The AI marks are suggestions until you approve them. Low-confidence placement remains highlighted for review.
              </p>
              {draft.length === 0 && (
                <p className="rounded-2xl bg-amber-50 p-3 text-amber-800">
                  No reliable marks were placed on this page. Review it manually.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </article>
  );
};

export default AnnotatedNotebookPage;
