import { useMemo } from 'react';
import {
  createParser,
  Renderer,
  type ActionEvent,
  type OpenUIError,
} from '@openuidev/react-lang';
import { AlertCircle } from 'lucide-react';
import { atlasOpenUILibrary } from './atlasLibrary';

interface AtlasOpenUIMessageProps {
  content: string;
  fallbackContent?: string;
  onAction: (event: ActionEvent) => void;
}

const DEFAULT_FALLBACK =
  "I couldn't display that interactive study view. Ask me to try the plan again, or continue below in chat.";

export function AtlasOpenUIMessage({
  content,
  fallbackContent = DEFAULT_FALLBACK,
  onAction,
}: AtlasOpenUIMessageProps) {
  const parseResult = useMemo(() => {
    try {
      return createParser(atlasOpenUILibrary.toJSONSchema()).parse(content);
    } catch (error) {
      console.warn('Atlas OpenUI parse failed:', error);
      return null;
    }
  }, [content]);

  const hasRenderableRoot = Boolean(parseResult?.root);
  const hasCriticalError = Boolean(
    parseResult?.meta.errors.some((error) =>
      ['unknown-component', 'missing-required', 'null-required'].includes(error.code),
    ),
  );

  if (!hasRenderableRoot || hasCriticalError) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--neo-surface)] p-4 text-sm text-[var(--neo-muted)]">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-coral)]" />
        <p className="leading-relaxed">{fallbackContent}</p>
      </div>
    );
  }

  const handleErrors = (errors: OpenUIError[]) => {
    if (errors.length > 0) {
      console.warn('Atlas OpenUI renderer warnings:', errors);
    }
  };

  return (
    <Renderer
      library={atlasOpenUILibrary}
      response={content}
      isStreaming={false}
      onAction={onAction}
      onError={handleErrors}
    />
  );
}
