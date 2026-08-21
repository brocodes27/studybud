import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, ArrowUpRight } from 'lucide-react';

export type CurveTone = 'violet' | 'amber' | 'mint' | 'blush';

const TONE_BG: Record<CurveTone, string> = {
  violet: 'bg-grad-violet',
  amber: 'bg-grad-amber',
  mint: 'bg-grad-mint',
  blush: 'bg-grad-blush',
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Page wrapper. Owns the dark canvas, the ambient glow, and the responsive
 * gutter. Bottom padding leaves room for the floating dock on small screens.
 */
export function CurveShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="curve-root">
      <div className="curve-canvas">
        <div
          className={cx(
            'mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx('curve-panel p-5 sm:p-6', className)}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="curve-eyebrow">{children}</p>;
}

/**
 * Display heading. `lead` renders in regular weight and `children` in bold,
 * matching the two-weight headline treatment in the reference.
 */
export function Display({ lead, children }: { lead?: string; children: ReactNode }) {
  return (
    <h1 className="curve-display">
      {lead ? (
        <>
          <span className="curve-display-light">{lead}</span>
          <br />
        </>
      ) : null}
      {children}
    </h1>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="curve-chip-row -mx-4 px-4 sm:mx-0 sm:px-0" role="group">
      {children}
    </div>
  );
}

export function Chip({
  active = false,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button type="button" className="curve-chip" aria-pressed={active} {...rest}>
      {children}
    </button>
  );
}

export function Orb({
  variant = 'light',
  spin = true,
  label,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'light' | 'dark';
  spin?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        'curve-orb',
        variant === 'dark' ? 'curve-orb-dark' : 'curve-orb-light',
        !spin && 'curve-orb-static',
      )}
      {...rest}
    >
      <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} />
    </button>
  );
}

export function CurveButton({
  ghost = false,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { ghost?: boolean }) {
  return (
    <button
      type="button"
      className={cx('curve-cta', ghost && 'curve-cta-ghost', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * The pastel gradient card. Decorative blobs sit behind the content so the
 * label and title always stay legible against the lightest part of the fill.
 */
export function GradientCard({
  tone,
  tag,
  title,
  subtitle,
  onOpen,
  openLabel,
  children,
}: {
  tone: CurveTone;
  tag?: string;
  title: string;
  subtitle?: string;
  onOpen?: () => void;
  openLabel?: string;
  children?: ReactNode;
}) {
  const interactive = Boolean(onOpen);

  return (
    <div
      className={cx('curve-card', TONE_BG[tone], interactive && 'cursor-pointer')}
      onClick={onOpen}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen?.();
              }
            }
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <span className="curve-card-blob" aria-hidden="true" />
      <span className="curve-card-blob-alt" aria-hidden="true" />

      <div className="mb-auto flex items-start justify-between gap-3">
        {tag ? <span className="curve-tag">{tag}</span> : <span />}
        {onOpen ? (
          <Orb
            variant="dark"
            label={openLabel ?? `Open ${title}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          />
        ) : null}
      </div>

      {children}

      <div className="mt-3">
        <p className="curve-title">{title}</p>
        {subtitle ? (
          <p className="mt-1 text-sm font-medium text-[#1a1224]/70">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Responsive card grid: single column on phones, up to three on desktop. */
export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="curve-label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-curve-faint">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('curve-input', props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx('curve-input', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx('curve-input', props.className)} />;
}

export function Banner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'error';
  children: ReactNode;
}) {
  const border =
    tone === 'error'
      ? 'border-curve-bad/50'
      : tone === 'warn'
        ? 'border-curve-risk/50'
        : 'border-white/10';

  return (
    <div className={cx('curve-inset px-4 py-3 text-sm', border)}>
      <div className="flex items-start gap-2.5">
        <AlertCircle
          className={cx(
            'mt-0.5 h-4 w-4 shrink-0',
            tone === 'error' ? 'text-curve-bad' : tone === 'warn' ? 'text-curve-risk' : 'text-curve-muted',
          )}
        />
        <div className="text-curve-muted">{children}</div>
      </div>
    </div>
  );
}
